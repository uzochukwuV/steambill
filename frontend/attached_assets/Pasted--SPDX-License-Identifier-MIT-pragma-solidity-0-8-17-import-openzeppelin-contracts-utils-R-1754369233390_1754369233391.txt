// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./interfaces/ISignatureTransfer.sol";

// Interface for your payment protocol
interface ISimpleUSDCPaymentProtocol {
    struct PaymentIntent {
        bytes32 id;
        address sender;
        address recipient;
        uint256 amount;
        uint256 protocolFee;
        uint256 deadline;
        uint256 nonce;
        bytes signature;
    }

    struct Permit2Data {
        PermitTransferFrom permit;
        SignatureTransferDetails transferDetails;
        bytes signature;
    }

    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }

    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount;
    }

    function processPaymentPreApproved(PaymentIntent calldata _intent) external;
    function processPaymentWithPermit2(PaymentIntent calldata _intent, Permit2Data calldata _permit2Data) external;
    function calculateProtocolFee(uint256 amount) external pure returns (uint256);
    function getCurrentNonce(address user) external view returns (uint256);
    function isPaymentProcessed(bytes32 paymentId) external view returns (bool);
}

/**
 * @title DecentralizedMarketplace
 * @dev A marketplace contract that uses the SimpleUSDCPaymentProtocol for payments
 * Supports both NFT and physical item listings
 */
contract DecentralizedMarketplace is Ownable, ReentrancyGuard, Pausable {
    // Constants
    ISimpleUSDCPaymentProtocol public immutable paymentProtocol;
    uint256 public constant MARKETPLACE_FEE_BASIS_POINTS = 250; // 2.5% marketplace fee
    uint256 public constant BASIS_POINTS = 10000;

    // Enums
    enum ItemType {
        PHYSICAL,
        ERC721,
        ERC1155
    }
    enum ListingStatus {
        ACTIVE,
        SOLD,
        CANCELLED,
        EXPIRED
    }

    // Structs
    struct Listing {
        bytes32 id; // Unique listing ID
        address seller; // Seller address
        ItemType itemType; // Type of item being sold
        address tokenContract; // Contract address for NFTs (zero for physical items)
        uint256 tokenId; // Token ID for NFTs (zero for physical items)
        uint256 quantity; // Quantity (1 for ERC721, >1 for ERC1155/physical)
        uint256 pricePerUnit; // Price per unit in USDC (6 decimals)
        uint256 expirationTime; // When listing expires
        ListingStatus status; // Current status
        string metadataURI; // IPFS hash or metadata URI
        bytes32[] tags; // Search tags
    }

    struct Purchase {
        bytes32 listingId;
        address buyer;
        uint256 quantity;
        uint256 totalPrice;
        uint256 marketplaceFee;
        uint256 protocolFee;
        uint256 timestamp;
        bytes32 paymentId;
    }

    // State variables
    mapping(bytes32 => Listing) public listings;
    mapping(bytes32 => Purchase) public purchases;
    mapping(address => bytes32[]) public sellerListings;
    mapping(address => bytes32[]) public buyerPurchases;
    mapping(bytes32 => bool) public validListings;

    address public marketplaceFeeRecipient;
    uint256 private listingCounter;

    // Events
    event ListingCreated(
        bytes32 indexed listingId, address indexed seller, ItemType itemType, uint256 pricePerUnit, uint256 quantity
    );

    event ListingUpdated(bytes32 indexed listingId, uint256 newPrice, uint256 newQuantity);

    event ListingCancelled(bytes32 indexed listingId);

    event PurchaseCompleted(
        bytes32 indexed listingId,
        bytes32 indexed purchaseId,
        address indexed buyer,
        uint256 quantity,
        uint256 totalPrice,
        bytes32 paymentId
    );

    event MarketplaceFeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    // Custom errors
    error InvalidListing();
    error ListingNotActive();
    error InsufficientQuantity();
    error UnauthorizedSeller();
    error InvalidPrice();
    error InvalidQuantity();
    error ListingExpired();
    error PaymentFailed();
    error NFTTransferFailed();

    constructor(address _paymentProtocol, address _marketplaceFeeRecipient) Ownable(msg.sender) {
        require(_paymentProtocol != address(0), "Invalid payment protocol");
        require(_marketplaceFeeRecipient != address(0), "Invalid fee recipient");

        paymentProtocol = ISimpleUSDCPaymentProtocol(_paymentProtocol);
        marketplaceFeeRecipient = _marketplaceFeeRecipient;
    }

    /**
     * @dev Create a new listing
     */
    function createListing(
        ItemType _itemType,
        address _tokenContract,
        uint256 _tokenId,
        uint256 _quantity,
        uint256 _pricePerUnit,
        uint256 _duration,
        string calldata _metadataURI,
        bytes32[] calldata _tags
    ) external whenNotPaused returns (bytes32) {
        require(_quantity > 0, "Invalid quantity");
        require(_pricePerUnit > 0, "Invalid price");
        require(_duration > 0, "Invalid duration");

        // Validate NFT ownership for token listings
        if (_itemType == ItemType.ERC721) {
            require(_quantity == 1, "ERC721 quantity must be 1");
            require(IERC721(_tokenContract).ownerOf(_tokenId) == msg.sender, "Not token owner");
        } else if (_itemType == ItemType.ERC1155) {
            require(IERC1155(_tokenContract).balanceOf(msg.sender, _tokenId) >= _quantity, "Insufficient token balance");
        }

        bytes32 listingId =
            keccak256(abi.encodePacked(msg.sender, _tokenContract, _tokenId, block.timestamp, listingCounter++));

        listings[listingId] = Listing({
            id: listingId,
            seller: msg.sender,
            itemType: _itemType,
            tokenContract: _tokenContract,
            tokenId: _tokenId,
            quantity: _quantity,
            pricePerUnit: _pricePerUnit,
            expirationTime: block.timestamp + _duration,
            status: ListingStatus.ACTIVE,
            metadataURI: _metadataURI,
            tags: _tags
        });

        validListings[listingId] = true;
        sellerListings[msg.sender].push(listingId);

        emit ListingCreated(listingId, msg.sender, _itemType, _pricePerUnit, _quantity);

        return listingId;
    }

    /**
     * @dev Purchase items using pre-approved USDC payment
     */
    function purchaseWithPreApproval(
        bytes32 _listingId,
        uint256 _quantity,
        ISimpleUSDCPaymentProtocol.PaymentIntent calldata _paymentIntent
    ) external nonReentrant whenNotPaused {
        _executePurchase(
            _listingId,
            _quantity,
            _paymentIntent,
            false,
            ISimpleUSDCPaymentProtocol.Permit2Data({
                permit: ISimpleUSDCPaymentProtocol.PermitTransferFrom({
                    permitted: ISimpleUSDCPaymentProtocol.TokenPermissions({token: address(0), amount: 0}),
                    nonce: 0,
                    deadline: 0
                }),
                transferDetails: ISimpleUSDCPaymentProtocol.SignatureTransferDetails({to: address(0), requestedAmount: 0}),
                signature: ""
            })
        );
    }

    /**
     * @dev Purchase items using Permit2 gasless payment
     */
    function purchaseWithPermit2(
        bytes32 _listingId,
        uint256 _quantity,
        ISimpleUSDCPaymentProtocol.PaymentIntent calldata _paymentIntent,
        ISimpleUSDCPaymentProtocol.Permit2Data calldata _permit2Data
    ) external nonReentrant whenNotPaused {
        _executePurchase(_listingId, _quantity, _paymentIntent, true, _permit2Data);
    }

    /**
     * @dev Internal function to execute purchase
     */
    function _executePurchase(
        bytes32 _listingId,
        uint256 _quantity,
        ISimpleUSDCPaymentProtocol.PaymentIntent calldata _paymentIntent,
        bool _usePermit2,
        ISimpleUSDCPaymentProtocol.Permit2Data memory _permit2Data
    ) internal {
        Listing storage listing = listings[_listingId];

        // Validate listing
        require(validListings[_listingId], "Invalid listing");
        require(listing.status == ListingStatus.ACTIVE, "Listing not active");
        require(block.timestamp <= listing.expirationTime, "Listing expired");
        require(_quantity > 0 && _quantity <= listing.quantity, "Invalid quantity");

        // Calculate fees
        uint256 totalPrice = listing.pricePerUnit * _quantity;
        uint256 marketplaceFee = (totalPrice * MARKETPLACE_FEE_BASIS_POINTS) / BASIS_POINTS;
        uint256 protocolFee = paymentProtocol.calculateProtocolFee(totalPrice + marketplaceFee);
        // uint256 sellerAmount = totalPrice - marketplaceFee;

        // Validate payment intent matches purchase
        require(_paymentIntent.sender == msg.sender, "Invalid payment sender");
        require(_paymentIntent.amount == totalPrice + marketplaceFee, "Invalid payment amount");
        require(_paymentIntent.protocolFee == protocolFee, "Invalid protocol fee");

        // Process payment through protocol

        if (_usePermit2) {
            paymentProtocol.processPaymentWithPermit2(_paymentIntent, _permit2Data);
        } else {
            paymentProtocol.processPaymentPreApproved(_paymentIntent);
        }

        // Transfer NFTs if applicable
        if (listing.itemType == ItemType.ERC721) {
            try IERC721(listing.tokenContract).safeTransferFrom(listing.seller, msg.sender, listing.tokenId) {}
            catch {
                revert NFTTransferFailed();
            }
        } else if (listing.itemType == ItemType.ERC1155) {
            try IERC1155(listing.tokenContract).safeTransferFrom(
                listing.seller, msg.sender, listing.tokenId, _quantity, ""
            ) {} catch {
                revert NFTTransferFailed();
            }
        }

        // Update listing
        listing.quantity -= _quantity;
        if (listing.quantity == 0) {
            listing.status = ListingStatus.SOLD;
        }

        // Create purchase record
        bytes32 purchaseId = keccak256(abi.encodePacked(_listingId, msg.sender, block.timestamp));

        purchases[purchaseId] = Purchase({
            listingId: _listingId,
            buyer: msg.sender,
            quantity: _quantity,
            totalPrice: totalPrice,
            marketplaceFee: marketplaceFee,
            protocolFee: protocolFee,
            timestamp: block.timestamp,
            paymentId: _paymentIntent.id
        });

        buyerPurchases[msg.sender].push(purchaseId);

        emit PurchaseCompleted(_listingId, purchaseId, msg.sender, _quantity, totalPrice, _paymentIntent.id);
    }

    /**
     * @dev Cancel a listing (seller only)
     */
    function cancelListing(bytes32 _listingId) external {
        Listing storage listing = listings[_listingId];
        require(listing.seller == msg.sender, "Not the seller");
        require(listing.status == ListingStatus.ACTIVE, "Listing not active");

        listing.status = ListingStatus.CANCELLED;
        emit ListingCancelled(_listingId);
    }

    /**
     * @dev Update listing price and quantity (seller only)
     */
    function updateListing(bytes32 _listingId, uint256 _newPrice, uint256 _newQuantity) external {
        Listing storage listing = listings[_listingId];
        require(listing.seller == msg.sender, "Not the seller");
        require(listing.status == ListingStatus.ACTIVE, "Listing not active");
        require(_newPrice > 0, "Invalid price");
        require(_newQuantity > 0, "Invalid quantity");

        listing.pricePerUnit = _newPrice;
        listing.quantity = _newQuantity;

        emit ListingUpdated(_listingId, _newPrice, _newQuantity);
    }

    /**
     * @dev Get listing details
     */
    function getListing(bytes32 _listingId) external view returns (Listing memory) {
        return listings[_listingId];
    }

    /**
     * @dev Get purchase details
     */
    function getPurchase(bytes32 _purchaseId) external view returns (Purchase memory) {
        return purchases[_purchaseId];
    }

    /**
     * @dev Get seller's listings
     */
    function getSellerListings(address _seller) external view returns (bytes32[] memory) {
        return sellerListings[_seller];
    }

    /**
     * @dev Get buyer's purchases
     */
    function getBuyerPurchases(address _buyer) external view returns (bytes32[] memory) {
        return buyerPurchases[_buyer];
    }

    /**
     * @dev Calculate total cost including all fees
     */
    function calculateTotalCost(uint256 _baseAmount)
        external
        view
        returns (uint256 marketplaceFee, uint256 protocolFee, uint256 totalCost)
    {
        marketplaceFee = (_baseAmount * MARKETPLACE_FEE_BASIS_POINTS) / BASIS_POINTS;
        protocolFee = paymentProtocol.calculateProtocolFee(_baseAmount + marketplaceFee);
        totalCost = _baseAmount + marketplaceFee + protocolFee;
    }

    // Admin functions
    function updateMarketplaceFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Invalid recipient");
        address oldRecipient = marketplaceFeeRecipient;
        marketplaceFeeRecipient = _newRecipient;
        emit MarketplaceFeeRecipientUpdated(oldRecipient, _newRecipient);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency function to expire listings
     */
    function expireListings(bytes32[] calldata _listingIds) external onlyOwner {
        for (uint256 i = 0; i < _listingIds.length; i++) {
            if (listings[_listingIds[i]].status == ListingStatus.ACTIVE) {
                listings[_listingIds[i]].status = ListingStatus.EXPIRED;
            }
        }
    }
}

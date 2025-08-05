// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./DecentralizedMarketplace.sol";

/**
 * @title MarketplaceHelper
 * @dev Helper contract for batch operations and advanced marketplace functionality
 */
contract MarketplaceHelper {
    DecentralizedMarketplace public immutable marketplace;
    ISimpleUSDCPaymentProtocol public immutable paymentProtocol;

    struct BatchPurchaseItem {
        bytes32 listingId;
        uint256 quantity;
        ISimpleUSDCPaymentProtocol.PaymentIntent paymentIntent;
    }

    struct BatchPurchaseWithPermit2Item {
        bytes32 listingId;
        uint256 quantity;
        ISimpleUSDCPaymentProtocol.PaymentIntent paymentIntent;
        ISimpleUSDCPaymentProtocol.Permit2Data permit2Data;
    }

    struct ListingInfo {
        bytes32 id;
        address seller;
        DecentralizedMarketplace.ItemType itemType;
        uint256 pricePerUnit;
        uint256 quantity;
        uint256 expirationTime;
        DecentralizedMarketplace.ListingStatus status;
        string metadataURI;
        uint256 totalCost; // Including all fees
    }

    event BatchPurchaseCompleted(address indexed buyer, uint256 itemCount, uint256 totalAmount);

    constructor(address _marketplace, address _paymentProtocol) {
        marketplace = DecentralizedMarketplace(_marketplace);
        paymentProtocol = ISimpleUSDCPaymentProtocol(_paymentProtocol);
    }

    /**
     * @dev Batch purchase multiple items with pre-approved USDC
     */
    function batchPurchaseWithPreApproval(BatchPurchaseItem[] calldata _items) external {
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < _items.length; i++) {
            marketplace.purchaseWithPreApproval(_items[i].listingId, _items[i].quantity, _items[i].paymentIntent);
            totalAmount += _items[i].paymentIntent.amount;
        }

        emit BatchPurchaseCompleted(msg.sender, _items.length, totalAmount);
    }

    /**
     * @dev Batch purchase multiple items with Permit2
     */
    function batchPurchaseWithPermit2(BatchPurchaseWithPermit2Item[] calldata _items) external {
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < _items.length; i++) {
            marketplace.purchaseWithPermit2(
                _items[i].listingId, _items[i].quantity, _items[i].paymentIntent, _items[i].permit2Data
            );
            totalAmount += _items[i].paymentIntent.amount;
        }

        emit BatchPurchaseCompleted(msg.sender, _items.length, totalAmount);
    }

    /**
     * @dev Get detailed listing information with calculated costs
     */
    function getListingWithCosts(bytes32 _listingId) external view returns (ListingInfo memory) {
        DecentralizedMarketplace.Listing memory listing = marketplace.getListing(_listingId);

        (uint256 marketplaceFee, uint256 protocolFee, uint256 totalCost) =
            marketplace.calculateTotalCost(listing.pricePerUnit);

        return ListingInfo({
            id: listing.id,
            seller: listing.seller,
            itemType: listing.itemType,
            pricePerUnit: listing.pricePerUnit,
            quantity: listing.quantity,
            expirationTime: listing.expirationTime,
            status: listing.status,
            metadataURI: listing.metadataURI,
            totalCost: totalCost
        });
    }

    /**
     * @dev Get multiple listings with costs in a single call
     */
    function getMultipleListingsWithCosts(bytes32[] calldata _listingIds)
        external
        view
        returns (ListingInfo[] memory)
    {
        ListingInfo[] memory results = new ListingInfo[](_listingIds.length);

        for (uint256 i = 0; i < _listingIds.length; i++) {
            results[i] = this.getListingWithCosts(_listingIds[i]);
        }

        return results;
    }

    /**
     * @dev Generate payment intent template for a purchase
     * Frontend can use this to prepare the payment intent for signing
     */
    function generatePaymentIntentTemplate(bytes32 _listingId, uint256 _quantity, address _buyer)
        external
        view
        returns (uint256 amount, uint256 protocolFee, address recipient, uint256 nonce, uint256 suggestedDeadline)
    {
        DecentralizedMarketplace.Listing memory listing = marketplace.getListing(_listingId);
        require(listing.seller != address(0), "Listing not found");

        uint256 totalPrice = listing.pricePerUnit * _quantity;
        (uint256 marketplaceFee, uint256 calculatedProtocolFee,) = marketplace.calculateTotalCost(totalPrice);

        amount = totalPrice + marketplaceFee;
        protocolFee = calculatedProtocolFee;
        recipient = address(marketplace); // Marketplace contract receives the payment
        nonce = paymentProtocol.getCurrentNonce(_buyer);
        suggestedDeadline = block.timestamp + 3600; // 1 hour from now
    }

    /**
     * @dev Check if multiple payments are valid and not processed
     */
    function validatePaymentIntents(bytes32[] calldata _paymentIds) external view returns (bool[] memory) {
        bool[] memory results = new bool[](_paymentIds.length);

        for (uint256 i = 0; i < _paymentIds.length; i++) {
            results[i] = !paymentProtocol.isPaymentProcessed(_paymentIds[i]);
        }

        return results;
    }

    /**
     * @dev Get active listings by seller with pagination
     */
    function getActiveListingsBySeller(address _seller, uint256 _offset, uint256 _limit)
        external
        view
        returns (ListingInfo[] memory listings, uint256 total)
    {
        bytes32[] memory sellerListings = marketplace.getSellerListings(_seller);

        // Count active listings
        uint256 activeCount = 0;
        for (uint256 i = 0; i < sellerListings.length; i++) {
            DecentralizedMarketplace.Listing memory listing = marketplace.getListing(sellerListings[i]);
            if (
                listing.status == DecentralizedMarketplace.ListingStatus.ACTIVE
                    && block.timestamp <= listing.expirationTime
            ) {
                activeCount++;
            }
        }

        total = activeCount;

        if (_offset >= activeCount) {
            return (new ListingInfo[](0), total);
        }

        uint256 returnCount = _limit;
        if (_offset + _limit > activeCount) {
            returnCount = activeCount - _offset;
        }

        listings = new ListingInfo[](returnCount);
        uint256 currentIndex = 0;
        uint256 returnIndex = 0;

        for (uint256 i = 0; i < sellerListings.length && returnIndex < returnCount; i++) {
            DecentralizedMarketplace.Listing memory listing = marketplace.getListing(sellerListings[i]);
            if (
                listing.status == DecentralizedMarketplace.ListingStatus.ACTIVE
                    && block.timestamp <= listing.expirationTime
            ) {
                if (currentIndex >= _offset) {
                    (uint256 marketplaceFee, uint256 protocolFee, uint256 totalCost) =
                        marketplace.calculateTotalCost(listing.pricePerUnit);

                    listings[returnIndex] = ListingInfo({
                        id: listing.id,
                        seller: listing.seller,
                        itemType: listing.itemType,
                        pricePerUnit: listing.pricePerUnit,
                        quantity: listing.quantity,
                        expirationTime: listing.expirationTime,
                        status: listing.status,
                        metadataURI: listing.metadataURI,
                        totalCost: totalCost
                    });
                    returnIndex++;
                }
                currentIndex++;
            }
        }

        return (listings, total);
    }

    /**
     * @dev Estimate gas for a purchase transaction
     */
    function estimatePurchaseGas(bytes32 _listingId, uint256 _quantity, bool _usePermit2)
        external
        view
        returns (uint256 estimatedGas)
    {
        // Base gas estimates based on operation type
        uint256 baseGas = 150000; // Base transaction gas

        DecentralizedMarketplace.Listing memory listing = marketplace.getListing(_listingId);

        // Add gas for NFT transfers
        if (listing.itemType == DecentralizedMarketplace.ItemType.ERC721) {
            baseGas += 100000; // ERC721 transfer
        } else if (listing.itemType == DecentralizedMarketplace.ItemType.ERC1155) {
            baseGas += 120000; // ERC1155 transfer
        }

        // Add gas for payment processing
        if (_usePermit2) {
            baseGas += 200000; // Permit2 processing
        } else {
            baseGas += 150000; // Pre-approved processing
        }

        return baseGas;
    }

    /**
     * @dev Check if a user can afford to purchase an item
     */
    function canAffordPurchase(address _buyer, bytes32 _listingId, uint256 _quantity)
        external
        view
        returns (bool canAfford, uint256 requiredAmount, uint256 userBalance, uint256 userAllowance)
    {
        DecentralizedMarketplace.Listing memory listing = marketplace.getListing(_listingId);
        require(listing.seller != address(0), "Listing not found");

        (,, uint256 totalCost) = marketplace.calculateTotalCost(listing.pricePerUnit * _quantity);
        requiredAmount = totalCost;

        // This would require importing IERC20, but showing the pattern
        // IERC20 usdc = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
        // userBalance = usdc.balanceOf(_buyer);
        // userAllowance = usdc.allowance(_buyer, address(marketplace));

        // For now, return placeholder values
        userBalance = 0;
        userAllowance = 0;
        canAfford = false; // Would be: userBalance >= requiredAmount && userAllowance >= requiredAmount
    }
}

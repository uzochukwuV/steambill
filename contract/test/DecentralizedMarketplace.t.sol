// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {Test, console} from "forge-std/Test.sol";
import {DecentralizedMarketplace, ISimpleUSDCPaymentProtocol} from "../src/DecentralizedMarketplace.sol";
import {SimpleUSDCPaymentProtocol} from "../src/PaymentProtocol.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {ERC721Mock} from "../src//ERC721Mock.sol";
import {ERC1155Mock} from "../src/ERC1155Mock.sol";
import {Permit2} from "permit2/src/Permit2.sol";

contract DecentralizedMarketplaceTest is Test {
    DecentralizedMarketplace public marketplace;
    SimpleUSDCPaymentProtocol public paymentProtocol;
    ERC20Mock public usdc;
    ERC721Mock public nft721;
    ERC1155Mock public nft1155;
    Permit2 public permit2;

    // Test addresses
    address public protocolFeeRecipient = address(0x111);
    address public marketplaceFeeRecipient = address(0x222);
    address public seller = address(0x333);
    address public buyer = address(0x444);
    address public owner;

    // Private keys for signing
    uint256 private sellerPrivateKey = 0x1111111111111111111111111111111111111111111111111111111111111111;
    uint256 private buyerPrivateKey = 0x2222222222222222222222222222222222222222222222222222222222222222;

    // Test constants
    uint256 constant AMOUNT = 1000 * 1e6; // 1000 USDC
    uint256 constant NFT_PRICE = 500 * 1e6; // 500 USDC
    uint256 constant TOKEN_ID_721 = 1;
    uint256 constant TOKEN_ID_1155 = 1;
    uint256 constant NFT_QUANTITY = 10;

    // Domain separator for EIP-712
    bytes32 private DOMAIN_SEPARATOR;
    string private constant EIP712_DOMAIN_NAME = "SimpleUSDCPaymentProtocol";
    string private constant EIP712_DOMAIN_VERSION = "1";

    function setUp() public {
        owner = address(this);
        
        // Set addresses from private keys
        seller = vm.addr(sellerPrivateKey);
        buyer = vm.addr(buyerPrivateKey);

        // Deploy mock tokens
        usdc = new ERC20Mock();
        nft721 = new ERC721Mock();
        nft1155 = new ERC1155Mock();
        permit2 = new Permit2();

        // Deploy payment protocol
        paymentProtocol = new SimpleUSDCPaymentProtocol(
            protocolFeeRecipient,
            address(usdc),
            address(permit2)
        );

        // Deploy marketplace
        marketplace = new DecentralizedMarketplace(
            address(paymentProtocol),
            marketplaceFeeRecipient
        );

        // Calculate domain separator
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(EIP712_DOMAIN_NAME)),
                keccak256(bytes(EIP712_DOMAIN_VERSION)),
                block.chainid,
                address(paymentProtocol)
            )
        );

        // Setup test conditions
        _setupTestConditions();
    }

    function _setupTestConditions() internal {
        // Give ETH to test addresses
        vm.deal(seller, 10 ether);
        vm.deal(buyer, 10 ether);

        // Mint USDC to buyer
        usdc.mint(buyer, AMOUNT * 10);

        // Mint NFTs to seller
        vm.startPrank(seller);
        nft721.mint(seller, TOKEN_ID_721);
        nft1155.mint(seller, TOKEN_ID_1155, NFT_QUANTITY, "");
        vm.stopPrank();

        // Setup approvals for buyer
        vm.startPrank(buyer);
        usdc.approve(address(paymentProtocol), type(uint256).max);
        usdc.approve(address(permit2), type(uint256).max);
        vm.stopPrank();

        // Setup NFT approvals for seller
        vm.startPrank(seller);
        nft721.setApprovalForAll(address(marketplace), true);
        nft1155.setApprovalForAll(address(marketplace), true);
        vm.stopPrank();
    }

    // Test initialization
    function test_Initialize() public {
        assertEq(address(marketplace.paymentProtocol()), address(paymentProtocol));
        assertEq(marketplace.marketplaceFeeRecipient(), marketplaceFeeRecipient);
        assertEq(marketplace.MARKETPLACE_FEE_BASIS_POINTS(), 250);
        assertEq(marketplace.owner(), address(this));
    }

    // Test physical item listing creation
    function test_CreatePhysicalListing() public {
        vm.startPrank(seller);
        
        bytes32[] memory tags = new bytes32[](2);
        tags[0] = keccak256("electronics");
        tags[1] = keccak256("smartphone");

        bytes32 listingId = marketplace.createListing(
            DecentralizedMarketplace.ItemType.PHYSICAL,
            address(0),
            0,
            5, // quantity
            NFT_PRICE,
            7 days,
            "ipfs://physical-item-metadata",
            tags
        );

        DecentralizedMarketplace.Listing memory listing = marketplace.getListing(listingId);
        
        assertEq(uint8(listing.itemType), uint8(DecentralizedMarketplace.ItemType.PHYSICAL));
        assertEq(listing.seller, seller);
        assertEq(listing.quantity, 5);
        assertEq(listing.pricePerUnit, NFT_PRICE);
        assertEq(uint8(listing.status), uint8(DecentralizedMarketplace.ListingStatus.ACTIVE));
        
        vm.stopPrank();
    }

    // Test ERC721 listing creation
    function test_CreateERC721Listing() public {
        vm.startPrank(seller);
        
        bytes32[] memory tags = new bytes32[](1);
        tags[0] = keccak256("art");

        bytes32 listingId = marketplace.createListing(
            DecentralizedMarketplace.ItemType.ERC721,
            address(nft721),
            TOKEN_ID_721,
            1,
            NFT_PRICE,
            7 days,
            "ipfs://nft-metadata",
            tags
        );

        DecentralizedMarketplace.Listing memory listing = marketplace.getListing(listingId);
        
        assertEq(uint8(listing.itemType), uint8(DecentralizedMarketplace.ItemType.ERC721));
        assertEq(listing.tokenContract, address(nft721));
        assertEq(listing.tokenId, TOKEN_ID_721);
        assertEq(listing.quantity, 1);
        
        vm.stopPrank();
    }

    // Test ERC1155 listing creation
    function test_CreateERC1155Listing() public {
        vm.startPrank(seller);
        
        bytes32[] memory tags = new bytes32[](1);
        tags[0] = keccak256("gaming");

        bytes32 listingId = marketplace.createListing(
            DecentralizedMarketplace.ItemType.ERC1155,
            address(nft1155),
            TOKEN_ID_1155,
            5, // List 5 out of 10
            NFT_PRICE,
            7 days,
            "ipfs://nft1155-metadata",
            tags
        );

        DecentralizedMarketplace.Listing memory listing = marketplace.getListing(listingId);
        
        assertEq(uint8(listing.itemType), uint8(DecentralizedMarketplace.ItemType.ERC1155));
        assertEq(listing.tokenContract, address(nft1155));
        assertEq(listing.tokenId, TOKEN_ID_1155);
        assertEq(listing.quantity, 5);
        
        vm.stopPrank();
    }

    // Test invalid listing creation - not NFT owner
    function test_CreateERC721Listing_NotOwner() public {
        vm.startPrank(buyer); // buyer doesn't own the NFT
        
        bytes32[] memory tags = new bytes32[](0);

        vm.expectRevert("Not token owner");
        marketplace.createListing(
            DecentralizedMarketplace.ItemType.ERC721,
            address(nft721),
            TOKEN_ID_721,
            1,
            NFT_PRICE,
            7 days,
            "ipfs://nft-metadata",
            tags
        );
        
        vm.stopPrank();
    }

    // Test invalid ERC721 quantity
    function test_CreateERC721Listing_InvalidQuantity() public {
        vm.startPrank(seller);
        
        bytes32[] memory tags = new bytes32[](0);

        vm.expectRevert("ERC721 quantity must be 1");
        marketplace.createListing(
            DecentralizedMarketplace.ItemType.ERC721,
            address(nft721),
            TOKEN_ID_721,
            2, // Invalid quantity for ERC721
            NFT_PRICE,
            7 days,
            "ipfs://nft-metadata",
            tags
        );
        
        vm.stopPrank();
    }

    // Test purchasing physical item with pre-approved payment
    function test_PurchasePhysicalItemPreApproved() public {
        // Create listing
        vm.startPrank(seller);
        bytes32[] memory tags = new bytes32[](0);
        bytes32 listingId = marketplace.createListing(
            DecentralizedMarketplace.ItemType.PHYSICAL,
            address(0),
            0,
            5,
            NFT_PRICE,
            7 days,
            "ipfs://physical-item",
            tags
        );
        vm.stopPrank();

        // Calculate costs
        uint256 quantity = 2;
        uint256 baseAmount = NFT_PRICE * quantity;
        (uint256 marketplaceFee, uint256 protocolFee, uint256 totalCost) = 
            marketplace.calculateTotalCost(baseAmount);

        // Create payment intent
        ISimpleUSDCPaymentProtocol.PaymentIntent memory paymentIntent = 
            _createPaymentIntent(buyer, baseAmount + marketplaceFee, protocolFee);

        // Sign payment intent
        paymentIntent.signature = _signPaymentIntent(paymentIntent, buyerPrivateKey);

        // Record balances before
        uint256 buyerBalanceBefore = usdc.balanceOf(buyer);
        uint256 protocolFeeRecipientBefore = usdc.balanceOf(protocolFeeRecipient);
        uint256 paymentProtocolBefore = usdc.balanceOf(address(paymentProtocol));

        // Execute purchase
        vm.prank(buyer);
        marketplace.purchaseWithPreApproval(listingId, quantity, paymentIntent);

        // Verify balances
        assertEq(usdc.balanceOf(buyer), buyerBalanceBefore - totalCost);
        assertEq(usdc.balanceOf(protocolFeeRecipient), protocolFeeRecipientBefore + protocolFee);
        assertEq(usdc.balanceOf(address(paymentProtocol)), paymentProtocolBefore + baseAmount + marketplaceFee);

        // Verify listing updated
        DecentralizedMarketplace.Listing memory listing = marketplace.getListing(listingId);
        assertEq(listing.quantity, 3); // 5 - 2 = 3

        // Verify purchase recorded
        bytes32[] memory buyerPurchases = marketplace.getBuyerPurchases(buyer);
        assertEq(buyerPurchases.length, 1);
    }

    // Test purchasing ERC721 with pre-approved payment
    function test_PurchaseERC721PreApproved() public {
        // Create listing
        vm.startPrank(seller);
        bytes32[] memory tags = new bytes32[](0);
        bytes32 listingId = marketplace.createListing(
            DecentralizedMarketplace.ItemType.ERC721,
            address(nft721),
            TOKEN_ID_721,
            1,
            NFT_PRICE,
            7 days,
            "ipfs://nft-metadata",
            tags
        );
        vm.stopPrank();

        // Calculate costs
        uint256 quantity = 1;
        uint256 baseAmount = NFT_PRICE * quantity;
        (uint256 marketplaceFee, uint256 protocolFee, uint256 totalCost) = 
            marketplace.calculateTotalCost(baseAmount);

        // Create payment intent
        ISimpleUSDCPaymentProtocol.PaymentIntent memory paymentIntent = 
            _createPaymentIntent(buyer, baseAmount + marketplaceFee, protocolFee);

        paymentIntent.signature = _signPaymentIntent(paymentIntent, buyerPrivateKey);

        // Verify NFT ownership before
        assertEq(nft721.ownerOf(TOKEN_ID_721), seller);

        // Execute purchase
        vm.prank(buyer);
        marketplace.purchaseWithPreApproval(listingId, quantity, paymentIntent);

        // Verify NFT transferred
        assertEq(nft721.ownerOf(TOKEN_ID_721), buyer);

        // Verify listing marked as sold
        DecentralizedMarketplace.Listing memory listing = marketplace.getListing(listingId);
        assertEq(uint8(listing.status), uint8(DecentralizedMarketplace.ListingStatus.SOLD));
        assertEq(listing.quantity, 0);
    }

    // Test purchasing ERC1155 with Permit2
    function test_PurchaseERC1155WithPermit2() public {
        // Create listing
        vm.startPrank(seller);
        bytes32[] memory tags = new bytes32[](0);
        bytes32 listingId = marketplace.createListing(
            DecentralizedMarketplace.ItemType.ERC1155,
            address(nft1155),
            TOKEN_ID_1155,
            5,
            NFT_PRICE,
            7 days,
            "ipfs://nft1155-metadata",
            tags
        );
        vm.stopPrank();

        // Calculate costs
        uint256 quantity = 3;
        uint256 baseAmount = NFT_PRICE * quantity;
        (uint256 marketplaceFee, uint256 protocolFee, uint256 totalCost) = 
            marketplace.calculateTotalCost(baseAmount);

        // Create payment intent
        ISimpleUSDCPaymentProtocol.PaymentIntent memory paymentIntent = 
            _createPaymentIntent(buyer, baseAmount + marketplaceFee, protocolFee);

        paymentIntent.signature = _signPaymentIntent(paymentIntent, buyerPrivateKey);

        // Create Permit2 data
        ISimpleUSDCPaymentProtocol.Permit2Data memory permit2Data = 
            _createPermit2Data(totalCost, buyerPrivateKey);

        // Verify ERC1155 balance before
        assertEq(nft1155.balanceOf(buyer, TOKEN_ID_1155), 0);
        assertEq(nft1155.balanceOf(seller, TOKEN_ID_1155), NFT_QUANTITY);

        // Execute purchase
        vm.prank(buyer);
        marketplace.purchaseWithPermit2(listingId, quantity, paymentIntent, permit2Data);

        // Verify ERC1155 transferred
        assertEq(nft1155.balanceOf(buyer, TOKEN_ID_1155), quantity);
        assertEq(nft1155.balanceOf(seller, TOKEN_ID_1155), NFT_QUANTITY - quantity);

        // Verify listing updated
        DecentralizedMarketplace.Listing memory listing = marketplace.getListing(listingId);
        assertEq(listing.quantity, 2); // 5 - 3 = 2
        assertEq(uint8(listing.status), uint8(DecentralizedMarketplace.ListingStatus.ACTIVE));
    }

    // Test purchase with invalid payment amount
    function test_PurchaseInvalidPaymentAmount() public {
        // Create listing
        vm.startPrank(seller);
        bytes32[] memory tags = new bytes32[](0);
        bytes32 listingId = marketplace.createListing(
            DecentralizedMarketplace.ItemType.PHYSICAL,
            address(0),
            0,
            5,
            NFT_PRICE,
            7 days,
            "ipfs://physical-item",
            tags
        );
        vm.stopPrank();

        // Create payment intent with wrong amount
        ISimpleUSDCPaymentProtocol.PaymentIntent memory paymentIntent = 
            _createPaymentIntent(buyer, NFT_PRICE, 0); // Wrong amount

        paymentIntent.signature = _signPaymentIntent(paymentIntent, buyerPrivateKey);

        // Should revert
        vm.expectRevert("Invalid payment amount");
        vm.prank(buyer);
        marketplace.purchaseWithPreApproval(listingId, 1, paymentIntent);
    }

    // Test purchase of expired listing
    function test_PurchaseExpiredListing() public {
        // Create listing with short duration
        vm.startPrank(seller);
        bytes32[] memory tags = new bytes32[](0);
        bytes32 listingId = marketplace.createListing(
            DecentralizedMarketplace.ItemType.PHYSICAL,
            address(0),
            0,
            5,
            NFT_PRICE,
            1 seconds,
            "ipfs://physical-item",
            tags
        );
        vm.stopPrank();

        // Wait for expiration
        vm.warp(block.timestamp + 2 seconds);

        // Create payment intent
        uint256 baseAmount = NFT_PRICE;
        (uint256 marketplaceFee, uint256 protocolFee,) = 
            marketplace.calculateTotalCost(baseAmount);

        ISimpleUSDCPaymentProtocol.PaymentIntent memory paymentIntent = 
            _createPaymentIntent(buyer, baseAmount + marketplaceFee, protocolFee);

        paymentIntent.signature = _signPaymentIntent(paymentIntent, buyerPrivateKey);

        // Should revert
        vm.expectRevert("Listing expired");
        vm.prank(buyer);
        marketplace.purchaseWithPreApproval(listingId, 1, paymentIntent);
    }

    // Test cancel listing
    function test_CancelListing() public {
        // Create listing
        vm.startPrank(seller);
        bytes32[] memory tags = new bytes32[](0);
        bytes32 listingId = marketplace.createListing(
            DecentralizedMarketplace.ItemType.PHYSICAL,
            address(0),
            0,
            5,
            NFT_PRICE,
            7 days,
            "ipfs://physical-item",
            tags
        );
        
        // Cancel listing
        marketplace.cancelListing(listingId);
        vm.stopPrank();

        // Verify cancelled
        DecentralizedMarketplace.Listing memory listing = marketplace.getListing(listingId);
        assertEq(uint8(listing.status), uint8(DecentralizedMarketplace.ListingStatus.CANCELLED));
    }

    // Test unauthorized cancel
    function test_CancelListingUnauthorized() public {
        // Create listing
        vm.startPrank(seller);
        bytes32[] memory tags = new bytes32[](0);
        bytes32 listingId = marketplace.createListing(
            DecentralizedMarketplace.ItemType.PHYSICAL,
            address(0),
            0,
            5,
            NFT_PRICE,
            7 days,
            "ipfs://physical-item",
            tags
        );
        vm.stopPrank();

        // Try to cancel from different address
        vm.expectRevert("Not the seller");
        vm.prank(buyer);
        marketplace.cancelListing(listingId);
    }

    // Test update listing
    function test_UpdateListing() public {
        // Create listing
        vm.startPrank(seller);
        bytes32[] memory tags = new bytes32[](0);
        bytes32 listingId = marketplace.createListing(
            DecentralizedMarketplace.ItemType.PHYSICAL,
            address(0),
            0,
            5,
            NFT_PRICE,
            7 days,
            "ipfs://physical-item",
            tags
        );

        // Update listing
        uint256 newPrice = NFT_PRICE * 2;
        uint256 newQuantity = 10;
        marketplace.updateListing(listingId, newPrice, newQuantity);
        vm.stopPrank();

        // Verify updated
        DecentralizedMarketplace.Listing memory listing = marketplace.getListing(listingId);
        assertEq(listing.pricePerUnit, newPrice);
        assertEq(listing.quantity, newQuantity);
    }

    // Test admin functions
    function test_UpdateMarketplaceFeeRecipient() public {
        address newRecipient = address(0x999);
        marketplace.updateMarketplaceFeeRecipient(newRecipient);
        assertEq(marketplace.marketplaceFeeRecipient(), newRecipient);
    }

    function test_PauseUnpause() public {
        marketplace.pause();
        assertTrue(marketplace.paused());

        marketplace.unpause();
        assertFalse(marketplace.paused());
    }

    function test_ExpireListings() public {
        // Create multiple listings
        vm.startPrank(seller);
        bytes32[] memory tags = new bytes32[](0);
        
        bytes32 listingId1 = marketplace.createListing(
            DecentralizedMarketplace.ItemType.PHYSICAL,
            address(0),
            0,
            5,
            NFT_PRICE,
            7 days,
            "ipfs://item1",
            tags
        );

        bytes32 listingId2 = marketplace.createListing(
            DecentralizedMarketplace.ItemType.PHYSICAL,
            address(0),
            0,
            3,
            NFT_PRICE,
            7 days,
            "ipfs://item2",
            tags
        );
        vm.stopPrank();

        // Expire listings
        bytes32[] memory listingsToExpire = new bytes32[](2);
        listingsToExpire[0] = listingId1;
        listingsToExpire[1] = listingId2;

        marketplace.expireListings(listingsToExpire);

        // Verify expired
        assertEq(uint8(marketplace.getListing(listingId1).status), 
                uint8(DecentralizedMarketplace.ListingStatus.EXPIRED));
        assertEq(uint8(marketplace.getListing(listingId2).status), 
                uint8(DecentralizedMarketplace.ListingStatus.EXPIRED));
    }

    // Test view functions
    function test_GetListingsAndPurchases() public {
        // Create listing and purchase
        vm.startPrank(seller);
        bytes32[] memory tags = new bytes32[](0);
        bytes32 listingId = marketplace.createListing(
            DecentralizedMarketplace.ItemType.PHYSICAL,
            address(0),
            0,
            5,
            NFT_PRICE,
            7 days,
            "ipfs://physical-item",
            tags
        );
        vm.stopPrank();

        // Make purchase
        uint256 baseAmount = NFT_PRICE;
        (uint256 marketplaceFee, uint256 protocolFee,) = 
            marketplace.calculateTotalCost(baseAmount);

        ISimpleUSDCPaymentProtocol.PaymentIntent memory paymentIntent = 
            _createPaymentIntent(buyer, baseAmount + marketplaceFee, protocolFee);

        paymentIntent.signature = _signPaymentIntent(paymentIntent, buyerPrivateKey);

        vm.prank(buyer);
        marketplace.purchaseWithPreApproval(listingId, 1, paymentIntent);

        // Test view functions
        bytes32[] memory sellerListings = marketplace.getSellerListings(seller);
        assertEq(sellerListings.length, 1);
        assertEq(sellerListings[0], listingId);

        bytes32[] memory buyerPurchases = marketplace.getBuyerPurchases(buyer);
        assertEq(buyerPurchases.length, 1);

        // Test calculate total cost
        (uint256 calcMarketplaceFee, uint256 calcProtocolFee, uint256 calcTotalCost) = 
            marketplace.calculateTotalCost(1000 * 1e6);
        
        assertEq(calcMarketplaceFee, 25 * 1e6); // 2.5% of 1000
        assertGt(calcProtocolFee, 0);
        assertEq(calcTotalCost, 1000 * 1e6 + calcMarketplaceFee + calcProtocolFee);
    }

    // Helper functions
    function _createPaymentIntent(
        address _buyer,
        uint256 _amount,
        uint256 _protocolFee
    ) internal view returns (ISimpleUSDCPaymentProtocol.PaymentIntent memory) {
        return ISimpleUSDCPaymentProtocol.PaymentIntent({
            id: keccak256(abi.encode(_buyer, block.timestamp, _amount)),
            sender: _buyer,
            recipient: address(paymentProtocol), // Payment goes to protocol first
            amount: _amount,
            protocolFee: _protocolFee,
            deadline: block.timestamp + 1 hours,
            nonce: paymentProtocol.getCurrentNonce(_buyer),
            signature: ""
        });
    }

    function _signPaymentIntent(
        ISimpleUSDCPaymentProtocol.PaymentIntent memory intent,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("PaymentIntent(bytes32 id,address sender,address recipient,uint256 amount,uint256 protocolFee,uint256 deadline,uint256 nonce)"),
                intent.id,
                intent.sender,
                intent.recipient,
                intent.amount,
                intent.protocolFee,
                intent.deadline,
                intent.nonce
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _createPermit2Data(
        uint256 amount,
        uint256 privateKey
    ) internal view returns (ISimpleUSDCPaymentProtocol.Permit2Data memory) {
        ISimpleUSDCPaymentProtocol.PermitTransferFrom memory permit = ISimpleUSDCPaymentProtocol.PermitTransferFrom({
            permitted: ISimpleUSDCPaymentProtocol.TokenPermissions({
                token: address(usdc),
                amount: amount
            }),
            nonce: 0,
            deadline: block.timestamp + 1 hours
        });

        ISimpleUSDCPaymentProtocol.SignatureTransferDetails memory transferDetails = 
            ISimpleUSDCPaymentProtocol.SignatureTransferDetails({
                to: address(paymentProtocol),
                requestedAmount: amount
            });

        bytes memory signature = _getPermitTransferSignature(permit, privateKey, permit2.DOMAIN_SEPARATOR());

        return ISimpleUSDCPaymentProtocol.Permit2Data({
            permit: permit,
            transferDetails: transferDetails,
            signature: signature
        });
    }

    function _getPermitTransferSignature(
        ISimpleUSDCPaymentProtocol.PermitTransferFrom memory permit,
        uint256 privateKey,
        bytes32 domainSeparator
    ) internal view returns (bytes memory) {
        bytes32 TOKEN_PERMISSIONS_TYPEHASH = keccak256("TokenPermissions(address token,uint256 amount)");
        bytes32 PERMIT_TRANSFER_FROM_TYPEHASH = keccak256(
            "PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)"
        );

        bytes32 tokenPermissionsHash = keccak256(
            abi.encode(TOKEN_PERMISSIONS_TYPEHASH, permit.permitted.token, permit.permitted.amount)
        );

        bytes32 msgHash = keccak256(
            abi.encode(
                PERMIT_TRANSFER_FROM_TYPEHASH,
                tokenPermissionsHash,
                address(paymentProtocol),
                permit.nonce,
                permit.deadline
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
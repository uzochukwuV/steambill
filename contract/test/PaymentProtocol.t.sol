// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {Test, console} from "forge-std/Test.sol";
import {SimpleUSDCPaymentProtocol} from "../src/PaymentProtocol.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {Permit2} from "permit2/src/Permit2.sol";
import "../src/interfaces/ISimpleUSDCPaymentProtocol.sol";



contract SimpleUSDCPaymentProtocolTest is Test {
    SimpleUSDCPaymentProtocol public paymentProtocol;
    ERC20Mock public usdc;
    Permit2 public permit2;
    address public feeRecipient = address(0x123);
    address public sender = address(0x456);
    address public recipient = address(0x789);

    // Private keys for signing
    uint256 private senderPrivateKey = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
    uint256 private permit2PrivateKey = 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890;

    // Test variables
    uint256 constant AMOUNT = 1000 * 1e6; // 1000 USDC (6 decimals)
    uint256 constant PROTOCOL_FEE_BP = 25; // 0.25%
    uint256 constant BASIS_POINTS = 10000;
    address constant USDC_ADDRESS = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; // Base USDC
    address constant PERMIT2_ADDRESS = 0x000000000022D473030F116dDEE9F6B43aC78BA3; // Permit2

    // Domain separator for EIP-712
    bytes32 private DOMAIN_SEPARATOR;
    string private constant EIP712_DOMAIN_NAME = "SimpleUSDCPaymentProtocol";
    string private constant EIP712_DOMAIN_VERSION = "1";

    function setUp() public {
        // Set up sender address from private key
        sender = vm.addr(senderPrivateKey);
        
        // Deploy mock USDC
        usdc = new ERC20Mock();
        vm.etch(USDC_ADDRESS, address(usdc).code);

        // Deploy mock Permit2
        permit2 = new Permit2();
        vm.etch(PERMIT2_ADDRESS, address(permit2).code);

        // Deploy payment protocol
        paymentProtocol = new SimpleUSDCPaymentProtocol(feeRecipient, address(usdc), address(permit2));

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

        // Set up initial conditions
        vm.deal(sender, 1 ether);
        vm.startPrank(sender);
        usdc.mint(sender, AMOUNT * 2);
        
        // Approve both the payment protocol and Permit2
        usdc.approve(address(paymentProtocol), type(uint256).max);
        usdc.approve(address(permit2), type(uint256).max);
        
        vm.stopPrank();
    }

    function test_Initialize() public {
        assertEq(paymentProtocol.protocolFeeRecipient(), feeRecipient);
        assertEq(paymentProtocol.PROTOCOL_FEE_BASIS_POINTS(), PROTOCOL_FEE_BP);
    }

    function test_CalculateProtocolFee() public {
        uint256 amount = 1000 * 1e6; // 1000 USDC
        uint256 expectedFee = (amount * PROTOCOL_FEE_BP) / BASIS_POINTS;
        assertEq(paymentProtocol.calculateProtocolFee(amount), expectedFee);
    }

    function test_ProcessPaymentPreApproved() public {
        // Create payment intent
        SimpleUSDCPaymentProtocol.PaymentIntent memory intent = SimpleUSDCPaymentProtocol.PaymentIntent({
            id: keccak256(abi.encode(block.timestamp)),
            sender: sender,
            recipient: recipient,
            amount: AMOUNT,
            protocolFee: paymentProtocol.calculateProtocolFee(AMOUNT),
            deadline: block.timestamp + 1 days,
            nonce: paymentProtocol.getCurrentNonce(sender),
            signature: ""
        });

        // Generate signature
        intent.signature = _signPaymentIntent(intent, senderPrivateKey);

        uint256 senderBalanceBefore = usdc.balanceOf(sender);
        uint256 recipientBalanceBefore = usdc.balanceOf(recipient);
        uint256 feeRecipientBalanceBefore = usdc.balanceOf(feeRecipient);

        vm.prank(sender);
        paymentProtocol.processPaymentPreApproved(intent);

        assertTrue(paymentProtocol.isPaymentProcessed(intent.id));
        assertEq(paymentProtocol.getCurrentNonce(sender), 1);
        assertEq(usdc.balanceOf(sender), senderBalanceBefore - AMOUNT - intent.protocolFee);
        assertEq(usdc.balanceOf(recipient), recipientBalanceBefore + AMOUNT);
        assertEq(usdc.balanceOf(feeRecipient), feeRecipientBalanceBefore + intent.protocolFee);
    }

    function test_PaymentAlreadyProcessed() public {
        SimpleUSDCPaymentProtocol.PaymentIntent memory intent = SimpleUSDCPaymentProtocol.PaymentIntent({
            id: keccak256(abi.encode(block.timestamp)),
            sender: sender,
            recipient: recipient,
            amount: AMOUNT,
            protocolFee: paymentProtocol.calculateProtocolFee(AMOUNT),
            deadline: block.timestamp + 1 days,
            nonce: paymentProtocol.getCurrentNonce(sender),
            signature: ""
        });

        intent.signature = _signPaymentIntent(intent, senderPrivateKey);

        vm.prank(sender);
        paymentProtocol.processPaymentPreApproved(intent);

        // Try processing same payment again - should revert
        vm.expectRevert(SimpleUSDCPaymentProtocol.PaymentAlreadyProcessed.selector);
        vm.prank(sender);
        paymentProtocol.processPaymentPreApproved(intent);
    }

    function test_PaymentExpired() public {
        SimpleUSDCPaymentProtocol.PaymentIntent memory intent = SimpleUSDCPaymentProtocol.PaymentIntent({
            id: keccak256(abi.encode(block.timestamp)),
            sender: sender,
            recipient: recipient,
            amount: AMOUNT,
            protocolFee: paymentProtocol.calculateProtocolFee(AMOUNT),
            deadline: block.timestamp - 1, // Expired
            nonce: paymentProtocol.getCurrentNonce(sender),
            signature: ""
        });

        intent.signature = _signPaymentIntent(intent, senderPrivateKey);

        vm.expectRevert(SimpleUSDCPaymentProtocol.PaymentExpired.selector);
        vm.prank(sender);
        paymentProtocol.processPaymentPreApproved(intent);
    }

    function test_ProcessPaymentWithPermit2() public {
        SimpleUSDCPaymentProtocol.PaymentIntent memory intent = SimpleUSDCPaymentProtocol.PaymentIntent({
            id: keccak256(abi.encode(block.timestamp)),
            sender: sender,
            recipient: recipient,
            amount: AMOUNT,
            protocolFee: paymentProtocol.calculateProtocolFee(AMOUNT),
            deadline: block.timestamp + 1 days,
            nonce: paymentProtocol.getCurrentNonce(sender),
            signature: ""
        });

        intent.signature = _signPaymentIntent(intent, senderPrivateKey);

        uint256 totalAmount = AMOUNT + intent.protocolFee;
        uint256 permit2Nonce = 0;
        uint256 permit2Deadline = block.timestamp + 1 days;

        // Create Permit2 permit struct
        ISimpleUSDCPaymentProtocol.PermitTransferFrom memory permit = ISimpleUSDCPaymentProtocol.PermitTransferFrom({
            permitted: ISimpleUSDCPaymentProtocol.TokenPermissions({
                token: address(usdc),
                amount: totalAmount
            }),
            nonce: permit2Nonce,
            deadline: permit2Deadline
        });

        // Create transfer details
        ISimpleUSDCPaymentProtocol.SignatureTransferDetails memory transferDetails = ISimpleUSDCPaymentProtocol.SignatureTransferDetails({
            to: address(paymentProtocol),
            requestedAmount: totalAmount
        });

        // Generate proper Permit2 signature
        bytes memory permit2Signature = _getPermitTransferSignature(
            permit,
            senderPrivateKey,
            permit2.DOMAIN_SEPARATOR()
        );

        // Create Permit2 data
        SimpleUSDCPaymentProtocol.Permit2Data memory permit2Data = SimpleUSDCPaymentProtocol.Permit2Data({
            permit: permit,
            transferDetails: transferDetails,
            signature: permit2Signature
        });

        uint256 senderBalanceBefore = usdc.balanceOf(sender);
        uint256 recipientBalanceBefore = usdc.balanceOf(recipient);
        uint256 feeRecipientBalanceBefore = usdc.balanceOf(feeRecipient);

        vm.prank(sender);
        paymentProtocol.processPaymentWithPermit2(intent, permit2Data);

        assertTrue(paymentProtocol.isPaymentProcessed(intent.id));
        assertEq(paymentProtocol.getCurrentNonce(sender), 1);
        assertEq(usdc.balanceOf(sender), senderBalanceBefore - AMOUNT - intent.protocolFee);
        assertEq(usdc.balanceOf(recipient), recipientBalanceBefore + AMOUNT);
        assertEq(usdc.balanceOf(feeRecipient), feeRecipientBalanceBefore + intent.protocolFee);
    }

    // Helper function based on Uniswap's Permit2 test patterns
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
                address(paymentProtocol), // spender - this is the contract that will receive the tokens
                permit.nonce, 
                permit.deadline
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, msgHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_UpdateProtocolFeeRecipient() public {
        address newFeeRecipient = address(0xABC);
        vm.prank(paymentProtocol.owner());
        paymentProtocol.updateProtocolFeeRecipient(newFeeRecipient);
        assertEq(paymentProtocol.protocolFeeRecipient(), newFeeRecipient);
    }

    function test_PauseUnpause() public {
        vm.prank(paymentProtocol.owner());
        paymentProtocol.pause();
        assertTrue(paymentProtocol.paused());

        vm.prank(paymentProtocol.owner());
        paymentProtocol.unpause();
        assertFalse(paymentProtocol.paused());
    }

    function test_EmergencyWithdraw() public {
        uint256 amount = 100 * 1e6;
        usdc.mint(address(paymentProtocol), amount);

        uint256 ownerBalanceBefore = usdc.balanceOf(paymentProtocol.owner());

        vm.prank(paymentProtocol.owner());
        paymentProtocol.emergencyWithdraw(address(usdc), amount);

        assertEq(usdc.balanceOf(paymentProtocol.owner()), ownerBalanceBefore + amount);
    }

    // Helper function to sign payment intent
    function _signPaymentIntent(
        SimpleUSDCPaymentProtocol.PaymentIntent memory intent,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        // Create EIP-712 hash
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

        // Sign the hash
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // Helper function to sign Permit2 transfer
    function _signPermit2Transfer(
        address token,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        address to,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        // Use the correct Permit2 typehashes
        bytes32 TOKEN_PERMISSIONS_TYPEHASH = keccak256("TokenPermissions(address token,uint256 amount)");
        bytes32 PERMIT_TRANSFER_FROM_TYPEHASH = keccak256(
            "PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)"
        );

        // Create the TokenPermissions struct hash
        bytes32 tokenPermissionsHash = keccak256(abi.encode(TOKEN_PERMISSIONS_TYPEHASH, token, amount));

        // Create the PermitTransferFrom struct hash
        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TRANSFER_FROM_TYPEHASH,
                tokenPermissionsHash,
                to, // spender
                nonce,
                deadline
            )
        );

        // Get Permit2's domain separator from the deployed contract
        bytes32 permit2DomainSeparator = permit2.DOMAIN_SEPARATOR();

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", permit2DomainSeparator, structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
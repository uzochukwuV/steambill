// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
// import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ISimpleUSDCPaymentProtocol.sol";
// Permit2 interface for gasless approvals


// Interface for your payment protocol
// interface ISimpleUSDCPaymentProtocol {
//     struct PaymentIntent {
//         bytes32 id;
//         address sender;
//         address recipient;
//         uint256 amount;
//         uint256 protocolFee;
//         uint256 deadline;
//         uint256 nonce;
//         bytes signature;
//     }

//     struct Permit2Data {
//         PermitTransferFrom permit;
//         SignatureTransferDetails transferDetails;
//         bytes signature;
//     }

//     struct PermitTransferFrom {
//         TokenPermissions permitted;
//         uint256 nonce;
//         uint256 deadline;
//     }

//     struct TokenPermissions {
//         address token;
//         uint256 amount;
//     }

//     struct SignatureTransferDetails {
//         address to;
//         uint256 requestedAmount;
//     }

//     function processPaymentPreApproved(PaymentIntent calldata _intent) external;
//     function processPaymentWithPermit2(PaymentIntent calldata _intent, Permit2Data calldata _permit2Data) external;
//     function calculateProtocolFee(uint256 amount) external pure returns (uint256);
//     function getCurrentNonce(address user) external view returns (uint256);
//     function isPaymentProcessed(bytes32 paymentId) external view returns (bool);
// }

/**
 * @title SimpleUSDCPaymentProtocol
 * @dev A simplified payment protocol that only handles USDC transfers
 * Supports both pre-approved transfers and Permit2 gasless transfers
 */
contract SimpleUSDCPaymentProtocol is Ownable, ReentrancyGuard, Pausable, EIP712 {
    using ECDSA for bytes32;

    // Constants
    address public immutable USDC; // Base USDC
    address public immutable PERMIT2; // Permit2 contract
    uint256 public constant PROTOCOL_FEE_BASIS_POINTS = 25; // 0.25%
    uint256 public constant BASIS_POINTS = 10000;

    // EIP-712 Type Hash
    bytes32 private constant PAYMENT_INTENT_TYPEHASH = keccak256(
        "PaymentIntent(bytes32 id,address sender,address recipient,uint256 amount,uint256 protocolFee,uint256 deadline,uint256 nonce)"
    );

    // Payment intent structure
    struct PaymentIntent {
        bytes32 id; // Unique payment ID
        address sender; // Who's paying
        address recipient; // Who receives the payment
        uint256 amount; // Amount in USDC (6 decimals)
        uint256 protocolFee; // Protocol fee in USDC
        uint256 deadline; // Payment expiration timestamp
        uint256 nonce; // Sender's nonce for replay protection
        bytes signature; // Sender's signature
    }

    // Permit2 signature data
    struct Permit2Data {
        ISimpleUSDCPaymentProtocol.PermitTransferFrom permit;
        ISimpleUSDCPaymentProtocol.SignatureTransferDetails transferDetails;
        bytes signature;
    }

    // State variables
    mapping(bytes32 => bool) public processedPayments;
    mapping(address => uint256) public nonces;
    address public protocolFeeRecipient;

    // Events
    event PaymentProcessed(
        bytes32 indexed paymentId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 protocolFee
    );

    event ProtocolFeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    // Custom errors
    error InvalidPaymentId();
    error PaymentAlreadyProcessed();
    error PaymentExpired();
    error InvalidSignature();
    error InvalidAmount();
    error InvalidRecipient();
    error InsufficientBalance();
    error TransferFailed();

    constructor(address _protocolFeeRecipient, address _usdc, address _permit2) 
        Ownable(msg.sender) 
        EIP712("SimpleUSDCPaymentProtocol", "1")
    {
        require(_protocolFeeRecipient != address(0), "Invalid fee recipient");
        protocolFeeRecipient = _protocolFeeRecipient;
        USDC = _usdc;
        PERMIT2 = _permit2;
    }

    /**
     * @dev Process payment with pre-approved USDC
     * User must approve this contract to spend USDC before calling
     */
    function processPaymentPreApproved(PaymentIntent calldata _intent) external nonReentrant whenNotPaused {
        _validatePaymentIntent(_intent);
        _validateSignature(_intent);

        uint256 totalAmount = _intent.amount + _intent.protocolFee;

        // Check sender has enough USDC and approved this contract
        require(IERC20(USDC).balanceOf(_intent.sender) >= totalAmount, "Insufficient USDC balance");
        require(IERC20(USDC).allowance(_intent.sender, address(this)) >= totalAmount, "Insufficient allowance");

        // Transfer USDC from sender to this contract
        IERC20(USDC).transferFrom(_intent.sender, address(this), totalAmount);

        // Transfer amount to recipient
        IERC20(USDC).transfer(_intent.recipient, _intent.amount);

        // Transfer protocol fee
        if (_intent.protocolFee > 0) {
            IERC20(USDC).transfer(protocolFeeRecipient, _intent.protocolFee);
        }

        // Mark as processed and increment nonce
        processedPayments[_intent.id] = true;
        nonces[_intent.sender]++;

        emit PaymentProcessed(_intent.id, _intent.sender, _intent.recipient, _intent.amount, _intent.protocolFee);
    }

    /**
     * @dev Process payment using Permit2 (gasless for sender)
     * No pre-approval needed, uses signature-based transfer
     */
    function processPaymentWithPermit2(PaymentIntent calldata _intent, Permit2Data calldata _permit2Data)
        external
        nonReentrant
        whenNotPaused
    {
        _validatePaymentIntent(_intent);
        _validateSignature(_intent);

        // Use Permit2 to transfer USDC from sender to this contract
        ISimpleUSDCPaymentProtocol(PERMIT2).permitTransferFrom(
            _permit2Data.permit, _permit2Data.transferDetails, _intent.sender, _permit2Data.signature
        );

        // Transfer amount to recipient
        IERC20(USDC).transfer(_intent.recipient, _intent.amount);

        // Transfer protocol fee
        if (_intent.protocolFee > 0) {
            IERC20(USDC).transfer(protocolFeeRecipient, _intent.protocolFee);
        }

        // Mark as processed and increment nonce
        processedPayments[_intent.id] = true;
        nonces[_intent.sender]++;

        emit PaymentProcessed(_intent.id, _intent.sender, _intent.recipient, _intent.amount, _intent.protocolFee);
    }

    /**
     * @dev Calculate protocol fee for a given amount
     */
    function calculateProtocolFee(uint256 amount) public pure returns (uint256) {
        return (amount * PROTOCOL_FEE_BASIS_POINTS) / BASIS_POINTS;
    }

    /**
     * @dev Get the hash of a payment intent for signature verification
     */
    function getPaymentHash(PaymentIntent calldata _intent) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            PAYMENT_INTENT_TYPEHASH,
            _intent.id,
            _intent.sender,
            _intent.recipient,
            _intent.amount,
            _intent.protocolFee,
            _intent.deadline,
            _intent.nonce
        )));
    }

    /**
     * @dev Check if a payment has been processed
     */
    function isPaymentProcessed(bytes32 paymentId) external view returns (bool) {
        return processedPayments[paymentId];
    }

    /**
     * @dev Get current nonce for an address
     */
    function getCurrentNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    // Internal validation functions
    function _validatePaymentIntent(PaymentIntent calldata _intent) internal view {
        if (_intent.id == bytes32(0)) revert InvalidPaymentId();
        if (processedPayments[_intent.id]) revert PaymentAlreadyProcessed();
        if (block.timestamp > _intent.deadline) revert PaymentExpired();
        if (_intent.recipient == address(0)) revert InvalidRecipient();
        if (_intent.amount == 0) revert InvalidAmount();
        if (_intent.nonce != nonces[_intent.sender]) revert InvalidSignature();
    }

    function _validateSignature(PaymentIntent calldata _intent) internal view {
        if (_intent.signature.length != 65) revert InvalidSignature();

        // Get the EIP-712 hash of the payment intent
        bytes32 hash = getPaymentHash(_intent);
        
        // Recover signer from signature
        address signer = hash.recover(_intent.signature);
        
        // Verify signer matches intent.sender
        if (signer != _intent.sender) revert InvalidSignature();
    }

    // Admin functions
    function updateProtocolFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Invalid recipient");
        address oldRecipient = protocolFeeRecipient;
        protocolFeeRecipient = _newRecipient;
        emit ProtocolFeeRecipientUpdated(oldRecipient, _newRecipient);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency function to withdraw stuck tokens
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
}
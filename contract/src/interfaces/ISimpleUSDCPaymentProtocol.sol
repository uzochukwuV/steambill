// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

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

   function permitTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails memory transferDetails,
        address owner,
        bytes calldata signature
    ) external;
}
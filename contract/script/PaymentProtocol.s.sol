// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {SimpleUSDCPaymentProtocol} from "../src/PaymentProtocol.sol";

contract PaymentProtocolScript is Script {
    SimpleUSDCPaymentProtocol public paymentProtocol;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        paymentProtocol = new SimpleUSDCPaymentProtocol(address(this), 0x000000000022D473030F116dDEE9F6B43aC78BA3, 0x000000000022D473030F116dDEE9F6B43aC78BA3);

        vm.stopBroadcast();
    }
}

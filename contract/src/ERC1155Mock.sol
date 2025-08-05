// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract ERC1155Mock is ERC1155{
    constructor ()ERC1155("") {

    }

    function mint(address to, uint256 id, uint256 value, bytes memory data) external {
        _mint( to,  id,  value,  data);
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ERC721Mock is ERC721{
    constructor ()ERC721("", "") {

    }

    function mint(address to, uint256 id) external {
        _mint( to,  id);
    }
}
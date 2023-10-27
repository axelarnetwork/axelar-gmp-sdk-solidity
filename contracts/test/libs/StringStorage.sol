// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { StringStorage } from '../../libs/StringStorage.sol';

contract TestStringUtils {
    using StringStorage for string;

    function store(uint256 slot, string calldata str) external {
        str.store(slot);
    }

    function load(uint256 slot) external view returns (string memory str) {
        str.load(slot);
    }
}

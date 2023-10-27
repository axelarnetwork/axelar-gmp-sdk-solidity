// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { StringStorage } from '../../libs/StringStorage.sol';

contract TestStringStorage {
    using StringStorage for string;

    function store(uint256 slot, string calldata str) external {
        str.store(slot);
    }

    function load(uint256 slot) external view returns (string memory str) {
        str = StringStorage.load(slot);
    }

    function del(uint256 slot) external {
        StringStorage.del(slot);
    }
}

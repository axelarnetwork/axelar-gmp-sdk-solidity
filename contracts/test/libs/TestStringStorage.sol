// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { StringStorage } from '../../libs/StringStorage.sol';

contract TestStringStorage {
    function set(bytes32 slot, string calldata value) external {
        StringStorage.set(slot, value);
    }

    function get(bytes32 slot) external view returns (string memory value) {
        value = StringStorage.get(slot);
    }

    function clear(bytes32 slot) external {
        StringStorage.clear(slot);
    }
}

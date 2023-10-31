// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { StringStorage } from '../../libs/StringStorage.sol';

contract TestStringStorage {
    using StringStorage for string;

    function setString(bytes32 slot, string calldata str) external {
        StringStorage.set(str, slot);
    }

    function getString(bytes32 slot) external view returns (string memory str) {
        str = StringStorage.get(slot);
    }

    function deleteString(bytes32 slot) external {
        StringStorage.del(slot);
    }
}

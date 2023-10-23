// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { StringStorage } from '../../libs/StringStorage.sol';

contract StringStorageTest {
    function storeString(uint256 slot, string calldata str) external {
        StringStorage.storeString(slot, str);
    }

    function getString(uint256 slot) external view returns (string memory str) {
        str = StringStorage.loadString(slot);
    }


    function deleteString(uint256 slot) external {
        StringStorage.deleteString(slot);
    }
}

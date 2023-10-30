// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library StringStorage {
    struct Wrapper {
        string value;
    }

    function set(bytes32 slot, string memory value) internal {
        _getStorageStruct(slot).value = value;
    }

    function get(bytes32 slot) internal view returns (string memory value) {
        value = _getStorageStruct(slot).value;
    }

    function clear(bytes32 slot) internal {
        delete _getStorageStruct(slot).value;
    }

    function _getStorageStruct(bytes32 slot) internal pure returns (Wrapper storage wrapper) {
        assembly {
            wrapper.slot := slot
        }
    }
}

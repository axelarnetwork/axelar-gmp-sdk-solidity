// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library StringStorage {
    struct Wrapper {
        string value;
    }

    function set(string memory str, bytes32 slot) internal {
        _getStringStorage(slot).value = str;
    }

    function get(bytes32 slot) internal view returns (string memory str) {
        str = _getStringStorage(slot).value;
    }

    function del(bytes32 slot) internal {
        delete _getStringStorage(slot).value;
    }

    function _getStringStorage(bytes32 slot) internal pure returns (Wrapper storage wrapper) {
        assembly {
            wrapper.slot := slot
        }
    }
}

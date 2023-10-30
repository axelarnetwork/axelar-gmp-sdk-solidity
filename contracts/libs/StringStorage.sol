// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library StringStorage {
    struct Wrapper {
        string value;
    }

    function storeString(string memory str, bytes32 slot) internal {
        _getStringStorage(slot).value = str;
    }

    function loadString(bytes32 slot) internal view returns (string memory str) {
        str = _getStringStorage(slot).value;
    }

    function deleteString(bytes32 slot) internal {
        delete _getStringStorage(slot).value;
    }

    function _getStringStorage(bytes32 slot) internal pure returns (Wrapper storage wrapper) {
        assembly {
            wrapper.slot := slot
        }
    }
}

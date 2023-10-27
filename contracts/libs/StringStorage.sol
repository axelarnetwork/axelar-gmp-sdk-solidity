// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library StringStorage {
    struct Wrapper {
        string value;
    }

    function store(string memory str, uint256 slot) internal {
        _getStringStorage(slot).value = str;
    }

    function load(string memory str, uint256 slot) internal view {
        str = _getStringStorage(slot).value;
    }

    function _getStringStorage(uint256 slot) internal pure returns (Wrapper storage wrapper) {
        assembly {
            wrapper.slot := slot
        }
    }
}
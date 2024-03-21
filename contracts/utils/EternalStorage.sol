// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

/**
 * @title EternalStorage
 * @dev This contract holds all the necessary state variables to carry out the storage of any contract.
 */
contract EternalStorage {
    mapping(bytes32 => bool) private _boolStorage;

    // *** Getter Methods ***
    function getBool(bytes32 key) public view returns (bool) {
        return _boolStorage[key];
    }

    // *** Setter Methods ***
    function _setBool(bytes32 key, bool value) internal {
        _boolStorage[key] = value;
    }

    // *** Delete Methods ***
    function _deleteBool(bytes32 key) internal {
        delete _boolStorage[key];
    }
}

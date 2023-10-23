// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library StringStorage {
    function storeString(uint256 slot, string memory str) internal {
        uint256 length = bytes(str).length;
        assembly {
            sstore(slot, length)
        }
        length /= 32;
        for(uint256 i = 1; i <= length; ++i) {
            assembly {
                sstore(add(slot, i), mload(add(str, mul(i, 32))))
            }
        }
    }

    function loadString(uint256 slot) internal view returns (string memory str) {
        uint256 length;
        assembly {
            length := sload(slot)
        }
        str = new string(length);
        length /= 32;
        for(uint256 i = 1 ; i <= length; ++i) {
            assembly {
                mstore(add(str, mul(i, 32)), sload(add(slot, i)))
            }
        }
    }

    function deleteString(uint256 slot) internal {
        uint256 length;
        assembly {
            length := sload(slot)
            sstore(slot, 0)
        }
        for(uint256 i = 1 ; i <= length; ++i) {
            assembly {
                sstore(sload(add(slot, i)), 0)
            }
        }
    }
}
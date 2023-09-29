// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { INoReentrancy } from '../interfaces/INoReentrancy.sol';

/**
 * @title NoReEntrancy
 * @notice This contract provides a mechanism to halt the execution of specific functions
 * if a pause condition is activated.
 */
contract NoReentrancy is INoReentrancy {
    // uint256(keccak256('NoReentrancy:entered')) - 1
    uint256 internal constant ENTERED_SLOT = 0xc53920124e19af3581a129b263d0dbc87702a93cab8b8e343ad19817772c085b;
    uint256 internal constant NOT_ENTERED = 1;
    uint256 internal constant HAS_ENTERED = 2;

    /**
     * @notice A modifier that throws a ReEntrancy custom error if the contract is entered
     * @dev This modifier should be used with functions that can be entered twice
     */
    modifier noReentrancy() {
        if (hasEntered()) revert Reentrancy();
        _setEntered(HAS_ENTERED);
        _;
        _setEntered(NOT_ENTERED);
    }

    /**
     * @notice Check if the contract is already executing.
     * @return entered A boolean representing the entered status. True if already executing, false otherwise.
     */
    function hasEntered() public view returns (bool entered) {
        assembly {
            entered := eq(sload(ENTERED_SLOT), HAS_ENTERED)
        }
    }

    /**
     * @notice Sets the entered status of the contract
     * @param entered A boolean representing the entered status. True if already executing, false otherwise.
     */
    function _setEntered(uint256 entered) internal {
        assembly {
            sstore(ENTERED_SLOT, entered)
        }
    }
}

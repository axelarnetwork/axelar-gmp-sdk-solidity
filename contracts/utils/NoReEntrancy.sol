// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { INoReEntrancy } from '../interfaces/INoReEntrancy.sol';

/**
 * @title Pausable
 * @notice This contract provides a mechanism to halt the execution of specific functions
 * if a pause condition is activated.
 */
contract NoReEntrancy is INoReEntrancy {
    // uint256(keccak256('entered')) - 1
    uint256 internal constant ENTERED_SLOT = 0x01f33dd720a8dea3c4220dc5074a2239fb442c4c775306a696f97a7c54f785fc;

    /**
     * @notice A modifier that throws a Paused custom error if the contract is paused
     * @dev This modifier should be used with functions that can be paused
     */
    modifier noReEntrancy() {
        if (_hasEntered()) revert ReEntrancy();
        _setEntered(true);
        _;
        _setEntered(false);
    }

    /**
     * @notice Check if the contract is already executing.
     * @return entered A boolean representing the entered status. True if already executing, false otherwise.
     */
    function _hasEntered() internal view returns (bool entered) {
        assembly {
            entered := sload(ENTERED_SLOT)
        }
    }

    /**
     * @notice Sets the entered status of the contract
     * @param entered A boolean representing the entered status. True if already executing, false otherwise.
     */
    function _setEntered(bool entered) internal {
        assembly {
            sstore(ENTERED_SLOT, entered)
        }
    }
}

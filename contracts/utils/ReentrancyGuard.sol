// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IReentrancyGuard } from '../interfaces/IReentrancyGuard.sol';

/**
 * @title ReentrancyGuard
 * @notice This contract provides a mechanism to halt the execution of specific functions
 * if a pause condition is activated.
 */
contract ReentrancyGuard is IReentrancyGuard {
    // uint256(keccak256('ReentrancyGuard:entered')) - 1
    uint256 internal constant ENTERED_SLOT = 0x1a771c70cada93a906f955a7dec24a83d7954ba2f75256be4febcf62b395d532;
    uint256 internal constant NOT_ENTERED = 1;
    uint256 internal constant ENTERED = 2;

    /**
     * @notice A modifier that throws a ReEntrancy custom error if the contract is entered
     * @dev This modifier should be used with functions that can be entered twice
     */
    modifier noReEntrancy() {
        if (_hasEntered()) revert ReentrantCall();
        _setEntered(ENTERED);
        _;
        _setEntered(NOT_ENTERED);
    }

    /**
     * @notice Check if the contract is already executing.
     * @return entered A boolean representing the entered status. True if already executing, false otherwise.
     */
    function _hasEntered() internal view returns (bool entered) {
        assembly {
            entered := eq(sload(ENTERED_SLOT), ENTERED)
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

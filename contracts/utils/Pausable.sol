// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IPausable } from '../interfaces/IPausable.sol';

/**
 * @title Pausable
 * @notice This contract provides a mechanism to halt the execution of specific functions
 * if a pause condition is activated.
 */
contract Pausable is IPausable {
    // uint256(keccak256('paused')) - 1
    uint256 internal constant PAUSE_SLOT = 0xee35723ac350a69d2a92d3703f17439cbaadf2f093a21ba5bf5f1a53eb2a14d8;

    /**
     * @notice A modifier that throws a Paused custom error if the contract is paused
     * @dev This modifier should be used with functions that can be paused
     */
    modifier notPaused() {
        if (isPaused()) revert Paused();
        _;
    }

    /**
     * @notice Check if the contract is paused
     * @return paused A boolean representing the pause status. True if paused, false otherwise.
     */
    function isPaused() public view returns (bool paused) {
        assembly {
            paused := sload(PAUSE_SLOT)
        }
    }

    /**
     * @notice Sets the pause status of the contract
     * @dev This is an internal function, meaning it can only be called from within the contract itself
     * or from derived contracts.
     * @param paused The new pause status
     */
    function _setPaused(bool paused) internal {
        assembly {
            sstore(PAUSE_SLOT, paused)
        }

        emit PausedSet(paused);
    }
}

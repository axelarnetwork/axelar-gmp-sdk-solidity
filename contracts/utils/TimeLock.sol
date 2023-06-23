// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ITimeLock } from '../interfaces/ITimeLock.sol';

/**
 * @title TimeLock
 * @author Kiryl Yermakou
 * @dev A contract that enables function execution after a certain time has passed.
 * Implements the ITimeLock interface.
 */
contract TimeLock is ITimeLock {
    bytes32 internal constant PREFIX_TIME_LOCK = keccak256('time-lock');

    uint256 public immutable MINIMUM_TIME_LOCK_DELAY;

    /**
     * @notice The constructor for the TimeLock
     * @param minimumTimeDelay The minimum time delay that must pass for the TimeLock to be executed
     */
    constructor(uint256 minimumTimeDelay) {
        MINIMUM_TIME_LOCK_DELAY = minimumTimeDelay;
    }

    /**
     * @notice Returns the timestamp at which the TimeLock may be executed.
     * @param hash The hash of the timelock
     * @return uint The timestamp at which the timelock with the given hash can be executed
     */
    function getTimeLock(bytes32 hash) external view override returns (uint256) {
        return _getTimeLockEta(hash);
    }

    /**
     * @notice Schedules a new timelock.
     * @dev If the timestamp provided is less than the current block timestamp added to the minimum time delay,
     * the timestamp is automatically set to the current block timestamp plus the minimum time delay.
     * @param hash The hash of the new timelock
     * @param eta The timestamp at which the new timelock can be executed
     * @return uint The timestamp at which the new timelock can be executed
     */
    function _scheduleTimeLock(bytes32 hash, uint256 eta) internal returns (uint256) {
        if (hash == 0) revert InvalidTimeLockHash();
        if (_getTimeLockEta(hash) != 0) revert TimeLockAlreadyScheduled();

        uint256 minimumEta = block.timestamp + MINIMUM_TIME_LOCK_DELAY;

        if (eta < minimumEta) eta = minimumEta;

        _setTimeLockEta(hash, eta);

        return eta;
    }

    /**
     * @notice Cancels an existing timelock by setting its eta to zero.
     * @param hash The hash of the timelock to cancel
     */
    function _cancelTimeLock(bytes32 hash) internal {
        if (hash == 0) revert InvalidTimeLockHash();

        _setTimeLockEta(hash, 0);
    }

    /**
     * @notice Executes an existing timelock and sets its eta back to zero.
     * @dev To execute, the timelock must currently exist and the required time delay
     * must have passed.
     * @param hash The hash of the timelock to execute
     */
    function _executeTimeLock(bytes32 hash) internal {
        uint256 eta = _getTimeLockEta(hash);

        if (hash == 0 || eta == 0) revert InvalidTimeLockHash();

        if (block.timestamp < eta) revert TimeLockNotReady();

        _setTimeLockEta(hash, 0);
    }

    /**
     * @dev Returns the timestamp at which the timelock with the given hash can be executed
     * @param hash The hash of the timelock
     * @return eta The timestamp at which the timelock with the given hash can be executed
     */
    function _getTimeLockEta(bytes32 hash) private view returns (uint256 eta) {
        bytes32 key = keccak256(abi.encodePacked(PREFIX_TIME_LOCK, hash));

        assembly {
            eta := sload(key)
        }
    }

    /**
     * @dev Sets a new unlock timestamp for the timelock with the given hash
     * @param hash The hash of the timelock
     * @param eta The new unlock timestamp for the timelock
     */
    function _setTimeLockEta(bytes32 hash, uint256 eta) private {
        if (hash == 0) revert InvalidTimeLockHash();

        bytes32 key = keccak256(abi.encodePacked(PREFIX_TIME_LOCK, hash));

        assembly {
            sstore(key, eta)
        }
    }
}

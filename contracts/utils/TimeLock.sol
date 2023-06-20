// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ITimeLock } from '../interfaces/ITimeLock.sol';

contract TimeLock is ITimeLock {
    bytes32 internal constant PREFIX_TIME_LOCK = keccak256('time-lock');

    uint256 public immutable MINIMUM_TIME_LOCK_DELAY;

    constructor(uint256 minimumTimeDelay) {
        MINIMUM_TIME_LOCK_DELAY = minimumTimeDelay;
    }

    function getTimeLock(bytes32 hash) external view override returns (uint256) {
        return _getTimeLockEta(hash);
    }

    function _scheduleTimeLock(bytes32 hash, uint256 eta) internal {
        if (hash == 0) revert InvalidTimeLockHash();
        if (_getTimeLockEta(hash) != 0) revert TimeLockAlreadyScheduled();

        uint256 minimumEta = block.timestamp + MINIMUM_TIME_LOCK_DELAY;

        if (eta < minimumEta) eta = minimumEta;

        _setTimeLockEta(hash, eta);
    }

    function _cancelTimeLock(bytes32 hash) internal {
        if (hash == 0) revert InvalidTimeLockHash();

        _setTimeLockEta(hash, 0);
    }

    function _executeTimeLock(bytes32 hash) internal {
        uint256 eta = _getTimeLockEta(hash);

        if (hash == 0 || eta == 0) revert InvalidTimeLockHash();

        if (block.timestamp < eta) revert TimeLockNotReady();

        _setTimeLockEta(hash, 0);
    }

    function _getTimeLockEta(bytes32 hash) private view returns (uint256 eta) {
        bytes32 key = keccak256(abi.encodePacked(PREFIX_TIME_LOCK, hash));

        assembly {
            eta := sload(key)
        }
    }

    function _setTimeLockEta(bytes32 hash, uint256 eta) private {
        if (hash == 0) revert InvalidTimeLockHash();

        bytes32 key = keccak256(abi.encodePacked(PREFIX_TIME_LOCK, hash));

        assembly {
            sstore(key, eta)
        }
    }
}

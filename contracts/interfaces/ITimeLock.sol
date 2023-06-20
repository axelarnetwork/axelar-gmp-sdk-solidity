// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ITimeLock } from '../interfaces/ITimeLock.sol';

interface ITimeLock {
    error InvalidTimeLockHash();
    error TimeLockAlreadyScheduled();
    error TimeLockNotReady();

    function MINIMUM_TIME_LOCK_DELAY() external view returns (uint256);

    function getTimeLock(bytes32 hash) external view returns (uint256);
}

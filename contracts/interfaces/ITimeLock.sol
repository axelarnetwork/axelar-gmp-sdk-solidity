// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ITimeLock {
    error InvalidTimeLockHash();
    error TimeLockAlreadyScheduled();
    error TimeLockNotReady();

    function minimumTimeLockDelay() external view returns (uint256);

    function getTimeLock(bytes32 hash) external view returns (uint256);
}

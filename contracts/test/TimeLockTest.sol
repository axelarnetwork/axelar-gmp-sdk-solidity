// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { TimeLock } from '../utils/TimeLock.sol';

contract TimeLockTest is TimeLock {
    uint256 public num;

    event NumUpdated(uint256 newNum);

    // solhint-disable-next-line no-empty-blocks
    constructor(uint256 _minimumTimeDelay) TimeLock(_minimumTimeDelay) {}

    function getNum() external view returns (uint256) {
        return num;
    }

    function scheduleSetNum(bytes32 _hash, uint256 _eta) external {
        _scheduleTimeLock(_hash, _eta);
    }

    function cancelSetNum(bytes32 _hash) external {
        _cancelTimeLock(_hash);
    }

    function setNum(bytes32 _hash, uint256 _newNum) external {
        _executeTimeLock(_hash);

        num = _newNum;

        emit NumUpdated(_newNum);
    }
}

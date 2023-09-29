// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Pausable } from '../../utils/Pausable.sol';

contract PausableTest is Pausable {
    event TestEvent();

    function setPaused(bool paused) external {
        _setPaused(paused);
    }

    function testPaused() external notPaused {
        emit TestEvent();
    }
}

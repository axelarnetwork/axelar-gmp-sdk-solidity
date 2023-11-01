// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Pausable } from '../../utils/Pausable.sol';

contract TestPausable is Pausable {
    event TestEvent();

    function pause() external {
        _pause();
    }

    function unpause() external {
        _unpause();
    }

    function testPaused() external whenNotPaused {
        emit TestEvent();
    }

    function testNotPaused() external whenPaused {
        emit TestEvent();
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ReentrancyGuard } from '../../utils/ReentrancyGuard.sol';

contract TestReentrancyGuard is ReentrancyGuard {
    uint256 public value;

    constructor() {
        require(ENTERED_SLOT == uint256(keccak256('ReentrancyGuard:entered')) - 1, 'invalid constant');
    }

    function testFunction() external noReEntrancy {
        value = 1;
        this.callback();
        value = 2;
    }

    function testFunction2() external noReEntrancy {
        value = 2;
    }

    function callback() external noReEntrancy {}
}

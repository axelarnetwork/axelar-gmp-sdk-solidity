// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { NoReEntrancy } from '../../utils/NoReEntrancy.sol';

contract TestNoReEntrancy is NoReEntrancy {
    uint256 public value;

    constructor() {
        require(ENTERED_SLOT == uint256(keccak256('NoReEntrancy:entered')) - 1, 'invalid constant');
    }

    function testFunction() external noReEntrancy {
        value = 1;
        this.callback();
        value = 2;
    }

    function callback() external noReEntrancy {}
}

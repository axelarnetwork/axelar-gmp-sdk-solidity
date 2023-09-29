// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Operatable } from '../../utils/Operatable.sol';

contract OperatorableTest is Operatable {
    uint256 public nonce;

    constructor(address operator) {
        _setOperator(operator);
    }

    function testOperatorable() external onlyOperator {
        nonce++;
    }
}

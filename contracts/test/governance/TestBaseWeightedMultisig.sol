// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { BaseWeightedMultisig } from '../../governance/BaseWeightedMultisig.sol';

contract TestBaseWeightedMultisig is BaseWeightedMultisig {
    constructor(uint256 oldSignersRetention) BaseWeightedMultisig(oldSignersRetention) {}

    function rotateSigners(WeightedSigners memory newSigners) external {
        _rotateSigners(newSigners);
    }
}

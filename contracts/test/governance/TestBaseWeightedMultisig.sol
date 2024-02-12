// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { BaseWeightedMultisig } from '../../governance/BaseWeightedMultisig.sol';

contract TestBaseWeightedMultisig is BaseWeightedMultisig {
    constructor(uint256 oldSignersRetention) BaseWeightedMultisig(oldSignersRetention) {
        if (BASE_WEIGHTED_STORAGE_LOCATION != keccak256('WeightedMultisig.Storage')) {
            revert('WeightedMultisig.Storage');
        }
    }

    function rotateSigners(WeightedSigners memory newSigners) external {
        _rotateSigners(newSigners);
    }
}

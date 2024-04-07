// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { BaseWeightedMultisig } from '../../governance/BaseWeightedMultisig.sol';
import { WeightedSigners } from '../../types/WeightedSigners.sol';

contract TestBaseWeightedMultisig is BaseWeightedMultisig {
    constructor(uint256 previousSignersRetention_, bytes32 domainSeparator_)
        BaseWeightedMultisig(previousSignersRetention_, domainSeparator_)
    {
        if (BASE_WEIGHTED_MULTISIG_SLOT != bytes32(uint256(keccak256('BaseWeightedMultisig.Slot')) - 1)) {
            revert('BaseWeightedMultisig.Slot');
        }
    }

    function rotateSigners(WeightedSigners memory newSigners) external {
        _rotateSigners(newSigners);
    }
}

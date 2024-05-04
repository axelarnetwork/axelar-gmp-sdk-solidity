// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { BaseWeightedMultisig } from '../../governance/BaseWeightedMultisig.sol';
import { Proof, WeightedSigners } from '../../types/WeightedMultisigTypes.sol';

contract TestBaseWeightedMultisig is BaseWeightedMultisig {
    event DummyEvent();

    constructor(
        uint256 previousSignersRetention_,
        bytes32 domainSeparator_,
        WeightedSigners memory initialSigners
    ) BaseWeightedMultisig(previousSignersRetention_, domainSeparator_, 0) {
        if (BASE_WEIGHTED_MULTISIG_SLOT != bytes32(uint256(keccak256('BaseWeightedMultisig.Slot')) - 1)) {
            revert('BaseWeightedMultisig.Slot');
        }

        _rotateSigners(initialSigners, false);
    }

    function rotateSigners(WeightedSigners calldata newSigners) external {
        _rotateSigners(newSigners, false);
    }

    function validateProof(bytes32 dataHash, Proof calldata proof) external view returns (bool isLatestSigners) {
        return _validateProof(dataHash, proof);
    }

    // use a non-view method to allow gas reporting in tests
    function validateProofCall(bytes32 dataHash, Proof calldata proof) external returns (bool isLatestSigners) {
        // emit an event to avoid compiler warning about making this into a view
        emit DummyEvent();

        return _validateProof(dataHash, proof);
    }
}

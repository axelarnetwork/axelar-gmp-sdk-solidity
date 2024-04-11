// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { BaseWeightedMultisig } from '../../governance/BaseWeightedMultisig.sol';
import { Proof, WeightedSigners } from '../../types/WeightedMultisigTypes.sol';

contract TestBaseWeightedMultisig is BaseWeightedMultisig {
    event DummyEvent();

    constructor(
        uint256 previousSignersRetention_,
        bytes32 domainSeparator_,
        uint256 minimumRotationDelay_
    ) BaseWeightedMultisig(previousSignersRetention_, domainSeparator_, minimumRotationDelay_) {
        if (BASE_WEIGHTED_MULTISIG_SLOT != bytes32(uint256(keccak256('BaseWeightedMultisig.Slot')) - 1)) {
            revert('BaseWeightedMultisig.Slot');
        }
    }

    function rotateSigners(WeightedSigners memory newSigners) external {
        _rotateSigners(newSigners, false);
    }

    // use a non-view method to allow gas reporting in tests
    function validateProof(bytes32 dataHash, bytes calldata proof) external returns (bool isLatestSigners) {
        // emit an event to avoid compiler warning about making this into a view
        emit DummyEvent();

        Proof memory proofData = abi.decode(proof, (Proof));

        return _validateProof(dataHash, proofData);
    }
}

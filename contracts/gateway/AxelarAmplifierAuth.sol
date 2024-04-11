// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarAmplifierAuth } from '../interfaces/IAxelarAmplifierAuth.sol';

import { BaseWeightedMultisig } from '../governance/BaseWeightedMultisig.sol';
import { Ownable } from '../utils/Ownable.sol';
import { Proof, WeightedSigners } from '../types/WeightedMultisigTypes.sol';

/**
 * @title AxelarAmplifierAuth Contract
 * @dev This contract is used by the Axelar Amplifier Gateway to verify signed commands.
 * It inherits the BaseWeightedMultisig contract and allows the gateway to issue signer rotations.
 */
contract AxelarAmplifierAuth is Ownable, BaseWeightedMultisig, IAxelarAmplifierAuth {
    /**
     * @notice Initializes the contract.
     * @dev Ownership of this contract should be transferred to the Gateway contract after deployment.
     * @param owner_ The owner of the contract
     * @param domainSeparator_ The domain separator for the signer proof
     * @param initialSigners The initial weighted signers to be added to the auth contract
     */
    constructor(
        address owner_,
        bytes32 domainSeparator_,
        uint256 previousSignersRetention_,
        bytes[] memory initialSigners
    ) Ownable(owner_) BaseWeightedMultisig(previousSignersRetention_, domainSeparator_) {
        uint256 length = initialSigners.length;

        for (uint256 i; i < length; ++i) {
            WeightedSigners memory signers = abi.decode(initialSigners[i], (WeightedSigners));

            _rotateSigners(signers, false);
        }
    }

    /**
     * @notice Rotate to a new set of weighted signers
     * @param newSigners The ABI encoded WeightedSigners
     * @param applyRotationDelay True if rotation delay should be applied
     */
    function rotateSigners(bytes calldata newSigners, bool applyRotationDelay) external onlyOwner {
        WeightedSigners memory signers = abi.decode(newSigners, (WeightedSigners));

        _rotateSigners(signers, applyRotationDelay);
    }

    /**
     * @notice This function takes dataHash and proof data and reverts if proof is invalid
     * @param dataHash The hash of the message that was signed
     * @param proof The data containing signers with signatures
     * @return isLatestSigners True if provided signers are the current ones
     */
    function validateProof(bytes32 dataHash, bytes calldata proof) external view returns (bool isLatestSigners) {
        Proof memory proofData = abi.decode(proof, (Proof));

        return _validateProof(dataHash, proofData);
    }
}

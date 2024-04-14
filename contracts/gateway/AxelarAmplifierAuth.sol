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
     * @param initialSigners The initial signers
     */
    constructor(
        address owner_,
        uint256 previousSignersRetention_,
        bytes32 domainSeparator_,
        WeightedSigners memory initialSigners
    ) Ownable(owner_) BaseWeightedMultisig(previousSignersRetention_, domainSeparator_) {
        _rotateSigners(initialSigners);
    }

    /**
     * @notice Rotate to a new set of weighted signers
     * @param newSigners The ABI encoded WeightedSigners
     */
    function rotateSigners(WeightedSigners calldata newSigners) external onlyOwner {
        _rotateSigners(newSigners);
    }

    /**
     * @notice This function takes dataHash and proof data and reverts if proof is invalid
     * @param dataHash The hash of the message that was signed
     * @param proof The data containing signers with signatures
     * @return isLatestSigners True if provided signers are the current ones
     */
    function validateProof(bytes32 dataHash, Proof calldata proof) external view returns (bool isLatestSigners) {
        return _validateProof(dataHash, proof);
    }
}

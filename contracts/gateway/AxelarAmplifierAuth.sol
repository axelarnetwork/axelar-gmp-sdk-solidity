// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarAmplifierAuth } from '../interfaces/IAxelarAmplifierAuth.sol';
// import { IAxelarAmplifierGatewayAuth } from '../interfaces/IAxelarAmplifierGatewayAuth.sol';

import { BaseWeightedMultisig } from '../governance/BaseWeightedMultisig.sol';
import { Ownable } from '../utils/Ownable.sol';
import { WeightedSigners } from '../types/WeightedMultisigTypes.sol';

/**
 * @title AxelarAmplifierAuth Contract
 * @dev This contract is used by the Axelar Gateway to verify signed commands. It inherits the BaseWeightedMultisig contract
 * with added functionality to approve and execute multisig proposals.
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

            _rotateSigners(signers);
        }
    }

    /**
     * @notice Rotate to a new set of weighted signers
     * @param newSigners The ABI encoded WeightedSigners
     */
    function rotateSigners(bytes calldata newSigners) external onlyOwner {
        WeightedSigners memory signers = abi.decode(newSigners, (WeightedSigners));

        _rotateSigners(signers);
    }

    /**
     * @notice This function takes dataHash and proof data and reverts if proof is invalid
     * @param dataHash The hash of the message that was signed
     * @param proof The data containing signers with signatures
     * @return isLatestSigners True if provided signers are the current ones
     */
    function validateProof(bytes32 dataHash, bytes calldata proof) external view returns (bool isLatestSigners) {
        return _validateProof(dataHash, proof);
    }
}

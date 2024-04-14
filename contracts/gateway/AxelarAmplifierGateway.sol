// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarAmplifierGateway } from '../interfaces/IAxelarAmplifierGateway.sol';

import { CommandType, Message } from '../types/AmplifierGatewayTypes.sol';
import { WeightedSigners, Proof } from '../types/WeightedMultisigTypes.sol';

import { BaseWeightedMultisig } from '../governance/BaseWeightedMultisig.sol';
import { BaseAmplifierGateway } from './BaseAmplifierGateway.sol';

contract AxelarAmplifierGateway is BaseAmplifierGateway, BaseWeightedMultisig, IAxelarAmplifierGateway {
    constructor(
        uint256 previousSignersRetention_,
        bytes32 domainSeparator_,
        WeightedSigners memory initialSigners
    ) BaseWeightedMultisig(previousSignersRetention_, domainSeparator_) {
        _rotateSigners(initialSigners);
    }

    /**********************\
    |* External Functions *|
    \**********************/

    /**
     * @notice Approves an array of messages, signed by the Axelar signers.
     * @param  messages The array of messages to verify.
     * @param  proof The proof signed by the Axelar signers for this command.
     */
    function approveMessages(Message[] calldata messages, Proof calldata proof) external {
        bytes32 dataHash = _computeDataHash(CommandType.ApproveMessages, abi.encode(messages));

        _validateProof(dataHash, proof);

        _approveMessages(messages);
    }

    /**
     * @notice Update the signer data for the auth module.
     * @param  newSigners The data for the new signers.
     * @param  proof The proof signed by the Axelar verifiers for this command.
     */
    function rotateSigners(WeightedSigners calldata newSigners, Proof calldata proof) external {
        bytes memory newSignersData = abi.encode(newSigners);
        bytes32 dataHash = _computeDataHash(CommandType.RotateSigners, newSignersData);
        bytes32 commandId = dataHash;

        if (isCommandExecuted(commandId)) {
            revert CommandAlreadyExecuted(commandId);
        }

        bool isLatestSigners = _validateProof(dataHash, proof);
        if (!isLatestSigners) {
            revert NotLatestSigners();
        }

        _commandExecuted(commandId);

        _rotateSigners(newSigners);

        // slither-disable-next-line reentrancy-events
        emit Rotated(newSignersData);
    }

    /**********************\
    |* Internal Functions *|
    \**********************/

    /**
     * @dev This function computes the data hash that is used for signing
     * @param commandType The type of command
     * @param data The data that is being signed
     * @return The hash of the data
     */
    function _computeDataHash(CommandType commandType, bytes memory data) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(commandType, data));
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarAmplifierGateway } from '../interfaces/IAxelarAmplifierGateway.sol';
import { IBaseAmplifierGateway } from '../interfaces/IBaseAmplifierGateway.sol';

import { CommandType, Message } from '../types/AmplifierGatewayTypes.sol';
import { WeightedSigners, Proof } from '../types/WeightedMultisigTypes.sol';

import { BaseWeightedMultisig } from '../governance/BaseWeightedMultisig.sol';
import { BaseAmplifierGateway } from './BaseAmplifierGateway.sol';
import { Upgradable } from '../upgradable/Upgradable.sol';

contract AxelarAmplifierGateway is BaseAmplifierGateway, BaseWeightedMultisig, Upgradable, IAxelarAmplifierGateway {
    constructor(uint256 previousSignersRetention_, bytes32 domainSeparator_)
        BaseWeightedMultisig(previousSignersRetention_, domainSeparator_)
    {}

    /**********************\
    |* External Functions *|
    \**********************/

    function contractId() external pure returns (bytes32) {
        return keccak256('axelar-amplifier-gateway');
    }

    /**
     * @notice Approves an array of messages, signed by the Axelar signers.
     * @param  messages The array of messages to verify.
     * @param  proof The proof signed by the Axelar signers for this command.
     */
    function approveMessages(Message[] calldata messages, Proof calldata proof) external {
        bytes32 dataHash = keccak256(abi.encode(CommandType.ApproveMessages, messages));

        _validateProof(dataHash, proof);

        _approveMessages(messages);
    }

    /**
     * @notice Rotate the weighted signers, signed off by the latest Axelar signers.
     * @param  newSigners The data for the new signers.
     * @param  proof The proof signed by the Axelar verifiers for this command.
     */
    function rotateSigners(WeightedSigners memory newSigners, Proof calldata proof) external {
        bytes32 dataHash = keccak256(abi.encode(CommandType.RotateSigners, newSigners));
        bytes32 commandId = keccak256(abi.encodePacked(CommandType.RotateSigners, abi.encode(newSigners))); // TODO: optimize

        if (isCommandExecuted(commandId)) {
            revert CommandAlreadyExecuted(commandId);
        }

        bool isLatestSigners = _validateProof(dataHash, proof);
        if (!isLatestSigners) {
            revert NotLatestSigners();
        }

        _markCommandExecuted(commandId);

        _rotateSigners(newSigners);
    }

    /**
     * @notice This function takes dataHash and proof and reverts if proof is invalid
     * @param dataHash The hash of the data being signed
     * @param proof The proof from Axelar signers
     * @return isLatestSigners True if provided signers are the current ones
     */
    function validateProof(bytes32 dataHash, Proof calldata proof) external view returns (bool isLatestSigners) {
        return _validateProof(dataHash, proof);
    }

    /**
     * @notice Compute the commandId for a `Message`.
     * @param sourceChain The name of the source chain as registered on Axelar.
     * @param messageId The unique message id for the message.
     * @return The commandId for the message.
     */
    function messageToCommandId(string calldata sourceChain, string calldata messageId)
        public
        pure
        override(BaseAmplifierGateway, IBaseAmplifierGateway)
        returns (bytes32)
    {
        // Axelar prevents `sourceChain` to contain '_',
        // hence we can use it as a separator with abi.encodePacked to avoid ambiguous encodings
        return keccak256(abi.encodePacked(CommandType.ApproveMessages, sourceChain, '_', messageId));
    }

    /*****************\
    |* Upgradability *|
    \*****************/

    /**
     * @notice Internal function to set up the contract with initial data
     * @param data Initialization data for the contract
     * @dev This function should be implemented in derived contracts.
     */
    function _setup(bytes calldata data) internal override {
        WeightedSigners[] memory signers = abi.decode(data, (WeightedSigners[]));

        for (uint256 i = 0; i < signers.length; i++) {
            _rotateSigners(signers[i]);
        }
    }
}

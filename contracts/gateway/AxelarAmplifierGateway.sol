// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarAmplifierGateway } from '../interfaces/IAxelarAmplifierGateway.sol';
import { IAxelarAmplifierGatewayAuth } from '../interfaces/IAxelarAmplifierGatewayAuth.sol';
import { CommandType, Message } from '../types/AmplifierGatewayTypes.sol';

contract AxelarAmplifierGateway is IAxelarAmplifierGateway {
    /// @dev This slot contains all the storage for this contract in an upgrade-compatible manner
    // keccak256('AxelarAmplifierGateway.Slot') - 1;
    bytes32 internal constant AXELAR_AMPLIFIER_GATEWAY_SLOT =
        0xca458dc12368669a3b8c292bc21c1b887ab1aa386fa3fcc1ed972afd74a330ca;

    struct AxelarAmplifierGatewayStorage {
        mapping(bytes32 => bool) commands;
        mapping(bytes32 => bool) approvals;
    }

    IAxelarAmplifierGatewayAuth public immutable authModule;

    constructor(address authModule_) {
        if (authModule_.code.length == 0) revert InvalidAuthModule();

        authModule = IAxelarAmplifierGatewayAuth(authModule_);
    }

    /******************\
    |* Public Methods *|
    \******************/

    function callContract(
        string calldata destinationChain,
        string calldata destinationContractAddress,
        bytes calldata payload
    ) external {
        emit ContractCall(msg.sender, destinationChain, destinationContractAddress, keccak256(payload), payload);
    }

    function isContractCallApproved(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) external view override returns (bool) {
        return _isContractCallApproved(commandId, sourceChain, sourceAddress, contractAddress, payloadHash);
    }

    function isMessageApproved(
        string calldata messageId,
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) external view override returns (bool) {
        bytes32 commandId = messageToCommandId(sourceChain, messageId);
        return _isContractCallApproved(commandId, sourceChain, sourceAddress, contractAddress, payloadHash);
    }

    function validateContractCall(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external override returns (bool valid) {
        valid = _validateContractCall(commandId, sourceChain, sourceAddress, payloadHash);
    }

    function validateMessage(
        string calldata messageId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external override returns (bool valid) {
        bytes32 commandId = messageToCommandId(sourceChain, messageId);
        valid = _validateContractCall(commandId, sourceChain, sourceAddress, payloadHash);
    }

    function isCommandExecuted(bytes32 commandId) public view override returns (bool) {
        return _storage().commands[commandId];
    }

    /**
     * @notice Compute the commandId for a `Message`.
     * @param sourceChain The name of the source chain as registered on Axelar.
     * @param messageId The unique message id for the message.
     * @return The commandId for the message.
     */
    function messageToCommandId(string calldata sourceChain, string calldata messageId) public pure returns (bytes32) {
        // Axelar prevents `sourceChain` to contain '_',
        // hence we can use it as a separator with abi.encodePacked to avoid ambiguous encodings
        return keccak256(abi.encodePacked(CommandType.ApproveMessages, sourceChain, '_', messageId));
    }

    /**********************\
    |* External Functions *|
    \**********************/

    /**
     * @notice Approves an array of messages, signed by the Axelar signers.
     * @param  messages The array of messages to verify.
     * @param  proof The proof signed by the Axelar signers for this command.
     */
    function approveMessages(Message[] calldata messages, bytes calldata proof) external {
        bytes32 dataHash = _computeDataHash(CommandType.ApproveMessages, abi.encode(messages));

        _verifyProof(dataHash, proof);

        uint256 length = messages.length;
        if (length == 0) revert InvalidMessages();

        for (uint256 i; i < length; ++i) {
            Message calldata message = messages[i];
            bytes32 commandId = messageToCommandId(message.sourceChain, message.messageId);

            // Ignore if message has already been approved
            if (isCommandExecuted(commandId)) {
                continue;
            }

            _approveMessage(commandId, message);

            _storage().commands[commandId] = true;

            // slither-disable-next-line reentrancy-events
            emit Executed(commandId);
        }
    }

    /**
     * @notice Update the signer data for the auth module.
     * @param  newSignersData The data for the new signers.
     * @param  proof The proof signed by the Axelar verifiers for this command.
     */
    function rotateSigners(bytes calldata newSignersData, bytes calldata proof) external {
        bytes32 dataHash = _computeDataHash(CommandType.RotateSigners, newSignersData);
        bytes32 commandId = dataHash;

        if (isCommandExecuted(commandId)) {
            revert CommandAlreadyExecuted(commandId);
        }

        bool isLatestSigners = _verifyProof(dataHash, proof);
        if (!isLatestSigners) {
            revert NotLatestSigners();
        }

        authModule.rotateSigners(newSignersData);

        // slither-disable-next-line reentrancy-events
        emit SignersRotated(newSignersData);
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

    /**
     * @dev This function verifies the proof data for a given data hash
     * @param dataHash The hash of the data that was signed
     * @param proof The data containing signers with signatures
     * @return isLatestSigners True if the proof is signed by the latest signers
     */
    function _verifyProof(bytes32 dataHash, bytes calldata proof) internal view returns (bool isLatestSigners) {
        return authModule.validateProof(dataHash, proof);
    }

    function _isContractCallApproved(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) internal view returns (bool) {
        bytes32 key = _getIsContractCallApprovedKey(
            commandId,
            sourceChain,
            sourceAddress,
            contractAddress,
            payloadHash
        );
        return _storage().approvals[key];
    }

    function _validateContractCall(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) internal returns (bool valid) {
        bytes32 key = _getIsContractCallApprovedKey(commandId, sourceChain, sourceAddress, msg.sender, payloadHash);
        valid = _storage().approvals[key];

        if (valid) {
            delete _storage().approvals[key];

            emit ContractCallExecuted(commandId);
        }
    }

    function _approveMessage(bytes32 commandId, Message calldata message) internal {
        bytes32 key = _getIsContractCallApprovedKey(
            commandId,
            message.sourceChain,
            message.sourceAddress,
            message.contractAddress,
            message.payloadHash
        );
        _storage().approvals[key] = true;

        emit ContractCallApproved(
            commandId,
            message.messageId,
            message.sourceChain,
            message.sourceAddress,
            message.contractAddress,
            message.payloadHash
        );
    }

    /********************\
    |* Pure Key Getters *|
    \********************/

    function _getIsContractCallApprovedKey(
        bytes32 commandId,
        string memory sourceChain,
        string memory sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(commandId, sourceChain, sourceAddress, contractAddress, payloadHash));
    }

    /**
     * @notice Gets the specific storage location for preventing upgrade collisions
     * @return slot containing the AxelarAmplifierGatewayStorage struct
     */
    function _storage() private pure returns (AxelarAmplifierGatewayStorage storage slot) {
        assembly {
            slot.slot := AXELAR_AMPLIFIER_GATEWAY_SLOT
        }
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IBaseAmplifierGateway } from '../interfaces/IBaseAmplifierGateway.sol';

import { Message } from '../types/AmplifierGatewayTypes.sol';

abstract contract BaseAmplifierGateway is IBaseAmplifierGateway {
    /// @dev This slot contains the storage for this contract in an upgrade-compatible manner
    /// keccak256('BaseAmplifierGateway.Slot') - 1;
    bytes32 internal constant BASE_AMPLIFIER_GATEWAY_SLOT =
        0x978b1ab9e384397ce0aab28eec0e3c25603b3210984045ad0e0f0a50d88cfc55;

    bytes32 internal constant MESSAGE_NONEXISTENT = 0;
    bytes32 internal constant MESSAGE_EXECUTED = bytes32(uint256(1));

    struct BaseAmplifierGatewayStorage {
        mapping(bytes32 => bytes32) approvals;
    }

    constructor() {}

    /******************\
    |* Public Methods *|
    \******************/

    /**
     * @notice Sends a message to the specified destination chain and address with a given payload.
     * This function is the entry point for general message passing between chains.
     * @param destinationChain The chain where the destination contract exists. A registered chain name on Axelar must be used here
     * @param destinationContractAddress The address of the contract to call on the destination chain
     * @param payload The payload to be sent to the destination contract, usually representing an encoded function call with arguments
     */
    function callContract(
        string calldata destinationChain,
        string calldata destinationContractAddress,
        bytes calldata payload
    ) external {
        emit ContractCall(msg.sender, destinationChain, destinationContractAddress, keccak256(payload), payload);
    }

    /**
     * @notice Checks if a message is approved.
     * @dev Determines whether a given message, identified by the sourceChain and messageId, is approved.
     * @param sourceChain The name of the source chain.
     * @param messageId The unique identifier of the message.
     * @param sourceAddress The address of the sender on the source chain.
     * @param contractAddress The address of the contract where the call will be executed.
     * @param payloadHash The keccak256 hash of the payload data.
     * @return True if the contract call is approved, false otherwise.
     */
    function isMessageApproved(
        string calldata sourceChain,
        string calldata messageId,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) external view override returns (bool) {
        bytes32 commandId = messageToCommandId(sourceChain, messageId);
        return _isContractCallApproved(commandId, sourceChain, sourceAddress, contractAddress, payloadHash);
    }

    /**
     * @notice Checks if a message is executed.
     * @dev Determines whether a given message, identified by the sourceChain and messageId is executed.
     * @param sourceChain The name of the source chain.
     * @param messageId The unique identifier of the message.
     * @return True if the message is executed, false otherwise.
     */
    function isMessageExecuted(string calldata sourceChain, string calldata messageId) external view returns (bool) {
        return _baseAmplifierGatewayStorage().approvals[messageToCommandId(sourceChain, messageId)] == MESSAGE_EXECUTED;
    }

    /**
     * @notice Validates if a message is approved. If message was in approved status, status is updated to executed to avoid replay.
     * @param sourceChain The name of the source chain.
     * @param messageId The unique identifier of the message.
     * @param sourceAddress The address of the sender on the source chain.
     * @param payloadHash The keccak256 hash of the payload data.
     * @return valid True if the message is approved, false otherwise.
     */
    function validateMessage(
        string calldata sourceChain,
        string calldata messageId,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external override returns (bool valid) {
        bytes32 commandId = messageToCommandId(sourceChain, messageId);
        valid = _validateContractCall(commandId, sourceChain, sourceAddress, payloadHash);
    }

    /**
     * @notice Compute the commandId for a message.
     * @param sourceChain The name of the source chain as registered on Axelar.
     * @param messageId The unique message id for the message.
     * @return The commandId for the message.
     */
    function messageToCommandId(string calldata sourceChain, string calldata messageId) public pure returns (bytes32) {
        // Axelar prevents `sourceChain` to contain '_',
        // hence we can use it as a separator with abi.encodePacked to avoid ambiguous encodings
        return keccak256(abi.encodePacked(sourceChain, '_', messageId));
    }

    /*************************\
    |* Legacy Public Methods *|
    \*************************/

    /// @dev The below methods are available for backwards compatibility with AxelarExecutable

    function isCommandExecuted(bytes32 commandId) public view override returns (bool) {
        return _baseAmplifierGatewayStorage().approvals[commandId] != MESSAGE_NONEXISTENT;
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

    function validateContractCall(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external override returns (bool valid) {
        valid = _validateContractCall(commandId, sourceChain, sourceAddress, payloadHash);
    }

    /*************************\
    |* Integration Functions *|
    \*************************/

    /**
     * @notice Approves an array of messages.
     * @param  messages The array of messages to verify.
     */
    function _approveMessages(Message[] calldata messages) internal {
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
        }
    }

    /**********************\
    |* Internal Functions *|
    \**********************/

    function _isContractCallApproved(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) internal view returns (bool) {
        bytes32 messageHash = _messageApprovalHash(commandId, sourceChain, sourceAddress, contractAddress, payloadHash);
        return _baseAmplifierGatewayStorage().approvals[commandId] == messageHash;
    }

    function _validateContractCall(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) internal returns (bool valid) {
        bytes32 messageHash = _messageApprovalHash(commandId, sourceChain, sourceAddress, msg.sender, payloadHash);
        valid = _baseAmplifierGatewayStorage().approvals[commandId] == messageHash;

        if (valid) {
            _baseAmplifierGatewayStorage().approvals[commandId] = MESSAGE_EXECUTED;

            emit MessageExecuted(commandId);
        }
    }

    function _approveMessage(bytes32 commandId, Message calldata message) internal {
        bytes32 messageHash = _messageApprovalHash(
            commandId,
            message.sourceChain,
            message.sourceAddress,
            message.contractAddress,
            message.payloadHash
        );
        _baseAmplifierGatewayStorage().approvals[commandId] = messageHash;

        emit MessageApproved(
            commandId,
            message.sourceChain,
            message.messageId,
            message.sourceAddress,
            message.contractAddress,
            message.payloadHash
        );
    }

    /********************\
    |* Pure Key Getters *|
    \********************/

    function _messageApprovalHash(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(commandId, sourceChain, sourceAddress, contractAddress, payloadHash));
    }

    /**
     * @notice Gets the specific storage location for preventing upgrade collisions
     * @return slot containing the storage struct
     */
    function _baseAmplifierGatewayStorage() private pure returns (BaseAmplifierGatewayStorage storage slot) {
        assembly {
            slot.slot := BASE_AMPLIFIER_GATEWAY_SLOT
        }
    }
}

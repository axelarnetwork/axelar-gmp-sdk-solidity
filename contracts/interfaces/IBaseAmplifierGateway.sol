// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGMPGateway } from './IAxelarGMPGateway.sol';

/**
 * @title IBaseAmplifierGateway
 * @dev Interface for the Base Axelar Amplifier Gateway that supports cross-chain messaging.
 */
interface IBaseAmplifierGateway is IAxelarGMPGateway {
    /**********\
    |* Errors *|
    \**********/

    error InvalidMessages();

    /**
     * @notice Emitted when a cross-chain message is approved.
     * @param commandId The identifier of the command to execute.
     * @param sourceChain The name of the source chain from whence the command came.
     * @param messageId The message id for the message.
     * @param sourceAddress The address of the sender on the source chain.
     * @param contractAddress The address of the contract where the call will be executed.
     * @param payloadHash The keccak256 hash of the approved payload data.
     */
    event MessageApproved(
        bytes32 indexed commandId,
        string sourceChain,
        string messageId,
        string sourceAddress,
        address indexed contractAddress,
        bytes32 indexed payloadHash
    );

    /**
     * @notice Emitted when a message has been executed.
     * @dev Logs the execution of an approved message.
     * `sourceChain` and `messageId` aren't included in the event due to backwards compatibility with `validateContractCall`.
     * @param commandId The commandId for the message that was executed.
     */
    event MessageExecuted(bytes32 indexed commandId);

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
    ) external view returns (bool);

    /**
     * @notice Checks if a message is executed.
     * @dev Determines whether a given message, identified by the sourceChain and messageId is executed.
     * @param sourceChain The name of the source chain.
     * @param messageId The unique identifier of the message.
     * @return True if the message is executed, false otherwise.
     */
    function isMessageExecuted(string calldata sourceChain, string calldata messageId) external view returns (bool);

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
    ) external returns (bool valid);

    /**
     * @notice Compute the commandId for a message.
     * @param sourceChain The name of the source chain as registered on Axelar.
     * @param messageId The unique message id for the message.
     * @return The commandId for the message.
     */
    function messageToCommandId(string calldata sourceChain, string calldata messageId) external pure returns (bytes32);
}

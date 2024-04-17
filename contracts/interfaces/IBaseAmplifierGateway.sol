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
     * @notice Emitted when a contract call has been executed.
     * @dev Logs the execution of an approved contract call.
     * @param commandId The identifier of the command that was executed.
     */
    event ContractCallExecuted(bytes32 indexed commandId);

    /**
     * @notice Emitted when a cross-chain contract call is approved.
     * @param commandId The identifier of the command to execute.
     * @param messageId The message id for the message.
     * @param sourceChain The name of the source chain from whence the command came.
     * @param sourceAddress The address of the sender on the source chain.
     * @param contractAddress The address of the contract where the call will be executed.
     * @param payloadHash The keccak256 hash of the approved payload data.
     */
    event ContractCallApproved(
        bytes32 indexed commandId,
        string messageId,
        string sourceChain,
        string sourceAddress,
        address indexed contractAddress,
        bytes32 indexed payloadHash
    );

    /**
     * @notice Checks if a contract call is approved.
     * @dev Determines whether a given contract call, identified by the commandId and payloadHash, is approved.
     * @param messageId The unique identifier of the message.
     * @param sourceChain The name of the source chain.
     * @param sourceAddress The address of the sender on the source chain.
     * @param contractAddress The address of the contract where the call will be executed.
     * @param payloadHash The keccak256 hash of the payload data.
     * @return True if the contract call is approved, false otherwise.
     */
    function isMessageApproved(
        string calldata messageId,
        string calldata sourceChain,
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
     * @notice Validates and approves a contract call using messageId.
     * @dev Validates the given contract call information and marks it as approved if valid.
     * @param messageId The unique identifier of the message.
     * @param sourceChain The name of the source chain.
     * @param sourceAddress The address of the sender on the source chain.
     * @param payloadHash The keccak256 hash of the payload data.
     * @return True if the contract call is validated and approved, false otherwise.
     */
    function validateMessage(
        string calldata messageId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external returns (bool);

    /**
     * @notice Compute the commandId for a `Message`.
     * @param sourceChain The name of the source chain as registered on Axelar.
     * @param messageId The unique message id for the message.
     * @return The commandId for the message.
     */
    function messageToCommandId(string calldata sourceChain, string calldata messageId) external pure returns (bytes32);
}

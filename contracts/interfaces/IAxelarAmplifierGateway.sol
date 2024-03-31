// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGMPGateway } from './IAxelarGMPGateway.sol';

/**
 * @title IAxelarAmplifierGateway
 * @dev Interface for the Axelar Gateway that supports general message passing and contract call execution.
 */
interface IAxelarAmplifierGateway is IAxelarGMPGateway {
    /*********\
    |* Types *|
    \*********/

    enum CommandType {
        ApproveContractCall,
        TransferOperatorship
    }

    struct ContractCallApprovalParams {
        string sourceChain;
        string sourceAddress;
        address contractAddress;
        bytes32 payloadHash;
    }

    struct TransferOperatorshipParams {
        bytes32 nonce;
        bytes newOperators;
    }

    struct Command {
        CommandType commandType;
        string messageId;
        bytes params; // ABI encoded ContractCallApprovalParams | TransferOperatorshipParams
    }

    struct CommandBatch {
        // Amplifier domain separator
        // keccak256(chain_name || amplifier_router_address || axelar_chain_id)
        bytes32 domainSeparator;
        Command[] commands;
    }

    struct SignedCommandBatch {
        CommandBatch batch;
        bytes proof;
    }

    /**********\
    |* Errors *|
    \**********/

    error InvalidAuthModule();
    error NotSelf();
    error InvalidChainId();
    error InvalidCommands();
    error InvalidCommand();
    error InvalidDomainSeparator();

    /**
     * @notice Emitted when a contract call has been executed.
     * @dev Logs the execution of an approved contract call.
     * @param commandId The identifier of the command that was executed.
     */
    event ContractCallExecuted(bytes32 indexed commandId);

    /**
     * @notice Emitted when a command has been executed.
     * @dev Logs successful execution of a command.
     * @param commandId The identifier of the executed command.
     * @param messageId The message id for the message.
     */
    event Executed(bytes32 indexed commandId, string messageId);

    /**
     * @notice Emitted when a contract call is approved.
     * @dev Logs the approval of a contract call that originated from another chain.
     * @param commandId The identifier of the command to execute.
     * @param sourceChain The name of the source chain from whence the command came.
     * @param sourceAddress The address of the sender on the source chain.
     * @param contractAddress The address of the contract where the call will be executed.
     * @param payloadHash The keccak256 hash of the approved payload data.
     * @param messageId The message id for the message.
     */
    event ContractCallApproved(
        bytes32 indexed commandId,
        string sourceChain,
        string sourceAddress,
        address indexed contractAddress,
        bytes32 indexed payloadHash,
        string messageId
    );

    /**
     * @notice Emitted when operatorship is transferred to a new set.
     * @dev Logs the transfer of operatorship to a new set of operators.
     * @param newOperatorsData The encoded new operators.
     */
    event OperatorshipTransferred(bytes newOperatorsData);

    /**
     * @notice Executes a signed batch of commands created by verifiers on Axelar.
     * @param  signedBatch The signed batch.
     */
    function execute(SignedCommandBatch calldata signedBatch) external;

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
     * @notice Validates and approves a contract call.
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
}

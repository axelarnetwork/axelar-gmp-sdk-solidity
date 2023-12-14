// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IAxelarGMPGateway
 * @dev Interface for the Axelar Gateway that supports general message passing and contract call execution.
 */
interface IAxelarGMPGateway {
    /**
     * @notice Emitted when a contract call is made through the gateway.
     * @dev Logs the attempt to call a contract on another chain.
     * @param sender The address of the sender who initiated the contract call.
     * @param destinationChain The name of the destination chain.
     * @param destinationContractAddress The address of the contract on the destination chain.
     * @param payloadHash The keccak256 hash of the sent payload data.
     * @param payload The payload data used for the contract call.
     */
    event ContractCall(
        address indexed sender,
        string destinationChain,
        string destinationContractAddress,
        bytes32 indexed payloadHash,
        bytes payload
    );

    /**
     * @notice Emitted when a command has been executed.
     * @dev Logs successful execution of a command.
     * @param commandId The identifier of the executed command.
     */
    event Executed(bytes32 indexed commandId);

    /**
     * @notice Emitted when a contract call is approved.
     * @dev Logs the approval of a contract call that originated from another chain.
     * @param commandId The identifier of the command to execute.
     * @param sourceChain The name of the source chain from whence the command came.
     * @param sourceAddress The address of the sender on the source chain.
     * @param contractAddress The address of the contract where the call will be executed.
     * @param payloadHash The keccak256 hash of the approved payload data.
     * @param sourceTxHash The hash of the source transaction on the source chain.
     * @param sourceEventIndex The index of the event in the source transaction logs.
     */
    event ContractCallApproved(
        bytes32 indexed commandId,
        string sourceChain,
        string sourceAddress,
        address indexed contractAddress,
        bytes32 indexed payloadHash,
        bytes32 sourceTxHash,
        uint256 sourceEventIndex
    );

    /**
     * @notice Emitted when a contract call has been executed.
     * @dev Logs the execution of an approved contract call.
     * @param commandId The identifier of the command that was executed.
     */
    event ContractCallExecuted(bytes32 indexed commandId);

    /**
     * @notice Sends a contract call to another chain.
     * @dev Initiates a cross-chain contract call through the gateway to the specified destination chain and contract.
     * @param destinationChain The name of the destination chain.
     * @param contractAddress The address of the contract on the destination chain.
     * @param payload The payload data to be used in the contract call.
     */
    function callContract(
        string calldata destinationChain,
        string calldata contractAddress,
        bytes calldata payload
    ) external;

    /**
     * @notice Checks if a contract call is approved.
     * @dev Determines whether a given contract call, identified by the commandId and payloadHash, is approved.
     * @param commandId The identifier of the command to check.
     * @param sourceChain The name of the source chain.
     * @param sourceAddress The address of the sender on the source chain.
     * @param contractAddress The address of the contract where the call will be executed.
     * @param payloadHash The keccak256 hash of the payload data.
     * @return True if the contract call is approved, false otherwise.
     */
    function isContractCallApproved(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash
    ) external view returns (bool);

    /**
     * @notice Validates and approves a contract call.
     * @dev Validates the given contract call information and marks it as approved if valid.
     * @param commandId The identifier of the command to validate.
     * @param sourceChain The name of the source chain.
     * @param sourceAddress The address of the sender on the source chain.
     * @param payloadHash The keccak256 hash of the payload data.
     * @return True if the contract call is validated and approved, false otherwise.
     */
    function validateContractCall(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external returns (bool);

    /**
     * @notice Checks if a command has been executed.
     * @dev Determines whether a command, identified by the commandId, has been executed.
     * @param commandId The identifier of the command to check.
     * @return True if the command has been executed, false otherwise.
     */
    function isCommandExecuted(bytes32 commandId) external view returns (bool);
}

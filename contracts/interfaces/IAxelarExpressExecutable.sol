// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarExecutable } from './IAxelarExecutable.sol';

/**
 * @title IAxelarExpressExecutable
 * @notice Interface for the Axelar Express Executable contract.
 */
interface IAxelarExpressExecutable is IAxelarExecutable {
    // Custom errors
    error AlreadyExecuted();
    error InsufficientValue();

    /**
     * @notice Emitted when an express execution is successfully performed.
     * @param commandId The unique identifier for the command.
     * @param sourceChain The source chain.
     * @param sourceAddress The source address.
     * @param payloadHash The hash of the payload.
     * @param expressExecutor The address of the express executor.
     */
    event ExpressExecuted(
        bytes32 indexed commandId,
        string sourceChain,
        string sourceAddress,
        bytes32 payloadHash,
        address indexed expressExecutor
    );

    /**
     * @notice Emitted when an express execution is fulfilled.
     * @param commandId The commandId for the contractCall.
     * @param sourceChain The source chain.
     * @param sourceAddress The source address.
     * @param payloadHash The hash of the payload.
     * @param expressExecutor The address of the express executor.
     */
    event ExpressExecutionFulfilled(
        bytes32 indexed commandId,
        string sourceChain,
        string sourceAddress,
        bytes32 payloadHash,
        address indexed expressExecutor
    );

    /**
     * @notice Returns the express executor for a given command.
     * @param commandId The commandId for the contractCall.
     * @param sourceChain The source chain.
     * @param sourceAddress The source address.
     * @param payloadHash The hash of the payload.
     * @return expressExecutor The address of the express executor.
     */
    function getExpressExecutor(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external view returns (address expressExecutor);

    /**
     * @notice Express executes a contract call.
     * @param commandId The commandId for the contractCall.
     * @param sourceChain The source chain.
     * @param sourceAddress The source address.
     * @param payload The payload data.
     */
    function expressExecute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external payable;
}

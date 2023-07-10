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
    error ExpressExecutorAlreadySet();

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
     * @notice Emitted when an express execution with a token is successfully performed.
     * @param commandId The unique identifier for the command.
     * @param sourceChain The source chain.
     * @param sourceAddress The source address.
     * @param payloadHash The hash of the payload.
     * @param symbol The token symbol.
     * @param amount The amount of tokens.
     * @param expressExecutor The address of the express executor.
     */
    event ExpressExecutedWithToken(
        bytes32 indexed commandId,
        string sourceChain,
        string sourceAddress,
        bytes32 payloadHash,
        string symbol,
        uint256 indexed amount,
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
     * @notice Emitted when an express execution with a token is fulfilled.
     * @param commandId The commandId for the contractCallWithToken.
     * @param sourceChain The source chain.
     * @param sourceAddress The source address.
     * @param payloadHash The hash of the payload.
     * @param symbol The token symbol.
     * @param amount The amount of tokens.
     * @param expressExecutor The address of the express executor.
     */
    event ExpressExecutionWithTokenFulfilled(
        bytes32 indexed commandId,
        string sourceChain,
        string sourceAddress,
        bytes32 payloadHash,
        string symbol,
        uint256 indexed amount,
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
     * @notice Returns the express executor with token for a given command.
     * @param commandId The commandId for the contractCallWithToken.
     * @param sourceChain The source chain.
     * @param sourceAddress The source address.
     * @param payloadHash The hash of the payload.
     * @param symbol The token symbol.
     * @param amount The amount of tokens.
     * @return expressExecutor The address of the express executor.
     */
    function getExpressExecutorWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash,
        string calldata symbol,
        uint256 amount
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

    /**
     * @notice Express executes a contract call with token.
     * @param commandId The commandId for the contractCallWithToken.
     * @param sourceChain The source chain.
     * @param sourceAddress The source address.
     * @param payload The payload data.
     * @param symbol The token symbol.
     * @param amount The amount of token.
     */
    function expressExecuteWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external payable;
}

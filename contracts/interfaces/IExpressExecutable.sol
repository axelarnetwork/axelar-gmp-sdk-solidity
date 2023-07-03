// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarExecutable } from './IAxelarExecutable.sol';

interface IExpressExecutable is IAxelarExecutable {
    error AlreadyExecuted();
    error InsufficientValue();

    event ExpressExecuted(
        bytes32 indexed commandId,
        string sourceChain,
        string sourceAddress,
        bytes payload,
        address indexed expressExecutor
    );

    event ExpressExecutedWithToken(
        bytes32 indexed commandId,
        string sourceChain,
        string sourceAddress,
        bytes payload,
        string symbol,
        uint256 indexed amount,
        address indexed expressExecutor
    );

    event ExpressExecutionFulfilled(
        bytes32 indexed commandId,
        string sourceChain,
        string sourceAddress,
        bytes payload,
        address indexed expressExecutor
    );

    event ExpressExecutionWithTokenFulfilled(
        bytes32 indexed commandId,
        string sourceChain,
        string sourceAddress,
        bytes payload,
        string symbol,
        uint256 indexed amount,
        address indexed expressExecutor
    );

    function getExpressCaller(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external view returns (address expressExecutor);

    function getExpressCallerWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external view returns (address expressExecutor);

    function expressExecute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external payable;

    function expressExecuteWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external payable;
}

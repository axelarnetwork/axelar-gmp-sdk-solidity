// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IExpressExecutable } from '../interfaces/IExpressExecutable.sol';

interface IExpressRegistry {
    error InvalidGateway();
    error NotExpressProxy();
    error AlreadyExpressCalled();

    event ExpressCallWithToken(
        address expressCaller,
        string sourceChain,
        string sourceAddress,
        bytes32 payloadHash,
        string tokenSymbol,
        uint256 amount
    );

    event ExpressCallWithTokenCompleted(
        address expressCaller,
        bytes32 commandId,
        string sourceChain,
        string sourceAddress,
        bytes32 payloadHash,
        string tokenSymbol,
        uint256 amount
    );

    function gateway() external returns (IAxelarGateway);

    function proxyCodeHash() external returns (bytes32);

    function registerExpressCallWithToken(
        address caller,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash,
        string calldata tokenSymbol,
        uint256 amount
    ) external;

    function processCallWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external;
}

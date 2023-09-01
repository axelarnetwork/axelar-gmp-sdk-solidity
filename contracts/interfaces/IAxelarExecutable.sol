// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGateway } from './IAxelarGateway.sol';

interface IAxelarExecutable {
    error InvalidAddress(); // Should throw Address
    error NotApprovedByGateway();

    function gateway() external view returns (IAxelarGateway);

    function execute(
        bytes32 commandId,
        string calldata sourceChain, // check string related security, probably better to use a type with fixed size bytes
        string calldata sourceAddress, // check string related security, probably better to use bytes
        bytes calldata payload
    ) external;

    function executeWithToken(
        bytes32 commandId,
        string calldata sourceChain, // check string related security, probably better to use a type with fixed size bytes
        string calldata sourceAddress, // check string related security, probably better to use bytes
        bytes calldata payload,
        string calldata tokenSymbol, // check string related security, probably better to use a type with fixed size bytes
        uint256 amount
    ) external;
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGMPExecutable } from './IAxelarGMPExecutable.sol';

/**
 * @title IAxelarGMPExecutableWithToken
 * @dev Interface for a contract that can execute commands from Axelar Gateway involving token transfers.
 * It extends IAxelarGMPExecutable to include token-related functionality.
 */
interface IAxelarGMPExecutableWithToken is IAxelarGMPExecutable {
    /**
     * @notice Sends a contract call to another chain.
     * @dev Initiates a cross-chain contract call through the gateway to the specified destination chain and contract.
     * @param destinationChain The name of the destination chain.
     * @param contractAddress The address of the contract on the destination chain.
     * @param payload The payload data to be used in the contract call.
     * @param symbol The gateway-registered symbol of the token to be transferred.
     * @param amount The amount of tokens to be transferred.
     */
    function callContractWithToken(
        string calldata destinationChain,
        string calldata contractAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external;

    /**
     * @notice Executes the specified command sent from another chain and includes a token transfer.
     * @dev This function should be implemented to handle incoming commands that include token transfers.
     * It will be called by an implementation of `IAxelarGMPGatewayWithToken`.
     * @param commandId The identifier of the command to execute.
     * @param sourceChain The name of the source chain from where the command originated.
     * @param sourceAddress The address on the source chain that sent the command.
     * @param payload The payload of the command to be executed.
     * @param tokenSymbol The symbol of the token to be transferred with this command.
     * @param amount The amount of tokens to be transferred with this command.
     */
    function executeWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external;
}

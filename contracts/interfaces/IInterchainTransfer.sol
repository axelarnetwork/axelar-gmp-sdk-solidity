// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IInterchainTransferSent
 * @dev Interface for tracking asset value transfers using General Message Passing (GMP) calls in the Axelar Network.
 * This interface defines an event that should be emitted when a GMP transfer is sent,
 * allowing for standardized volume tracking across different implementations.
 */
interface IInterchainTransferSent {
    /**
     * @dev Emitted when a GMP transfer is sent, providing details for volume tracking.
     * @param destinationChain The Axelar chain identifier of the destination chain.
     * @param destinationContractAddress The address of the contract on the destination chain that receives the transfer.
     * @param recipient The address of the final recipient of the transferred assets on the destination chain.
     * @param token The address of the token contract on the source chain.
     * @param amount The amount (in atomic units) of tokens transferred.
     */
    event InterchainTransferSent(
        string destinationChain,
        string destinationContractAddress,
        address indexed sender,
        bytes recipient,
        address indexed token,
        uint256 amount
    );
}

/**
 * @title IInterchainTransferReceived
 * @dev Interface for tracking asset value transfers using General Message Passing (GMP) calls in the Axelar Network.
 * This interface defines an event that should be emitted when a GMP transfer is received,
 * allowing for standardized volume tracking across different implementations.
 */
interface IInterchainTransferReceived {
    /**
     * @dev Emitted when an interchain transfer is received, providing details for volume tracking.
     * @param sourceChain The Axelar chain identifier of the source chain.
     * @param sourceAddress The address of the contract that initiated the transfer on the source chain.
     * @param sender The address of the sender in case it is different from the source contract address
     * @param recipient The address of the final recipient of the transferred assets on the destination chain.
     * @param token The address of the token contract on the destination chain.
     * @param amount The amount (in atomic units) of tokens received.
     */
    event InterchainTransferReceived(
        string sourceChain,
        string sourceAddress,
        bytes sender,
        address indexed recipient,
        address indexed token,
        uint256 amount
    );
}

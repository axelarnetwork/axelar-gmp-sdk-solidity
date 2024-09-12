// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IAxelarGMPTransfer
 * @dev Interface for tracking asset value transfers using General Message Passing (GMP) calls in the Axelar Network.
 * This interface defines an event that should be emitted when a GMP transfer occurs,
 * allowing for standardized volume tracking across different implementations.
 */
interface IAxelarGMPTransfer {
    /**
     * @dev Emitted when a GMP transfer occurs, providing details for volume tracking.
     * @param sender The address of the caller that initiated the transfer on the source chain.
     * @param sourceChain The Axelar chain identifier of the source chain.
     * @param destinationChain The Axelar chain identifier of the destination chain.
     * @param destinationAddress The address of the contract on the destination chain that receives the transfer.
     * @param recipientAddress The address of the final recipient of the transferred assets on the destination chain.
     * @param tokenAddress The address of the token contract on the source chain.
     * @param amount The amount (in atomic units) of tokens transferred.
     * @param decimals The number of decimal places for the token.
     */
    event AxelarGMPTransfer(
        address indexed sender,
        string sourceChain,
        string destinationChain,
        string destinationAddress,
        string recipientAddress,
        string tokenAddress,
        uint256 amount,
        uint256 decimals
    );
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IAxelarGMPVolume
 * @dev Interface for tracking volume of General Message Passing (GMP) calls in the Axelar network.
 * This interface defines an event that should be emitted when a GMP transfer occurs,
 * allowing for standardized volume tracking across different implementations.
 */
interface IAxelarGMPVolume {
    /**
     * @dev Emitted when a GMP transfer occurs, providing details for volume tracking.
     * @param sourceChain The name or identifier of the source chain where the transfer originated.
     * @param destinationChain The name or identifier of the destination chain where the transfer is received.
     * @param sourceAddress The address on the source chain that initiated the transfer.
     * @param destinationAddress The address on the destination chain that receives the transfer.
     * @param tokenAddress The address of the token contract being transferred.
     * @param amount The amount of tokens transferred.
     * @param decimals The number of decimals for the transferred token.
     */
    event GMPVolume(
        string sourceChain,
        string destinationChain,
        string sourceAddress,
        string destinationAddress,
        string tokenAddress,
        uint256 amount,
        uint256 decimals
    );
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IAxelarGMPTracker {
    event GMPTracker(
        string sourceChain,
        string destinationChain,
        string sourceAddress,
        string destinationAddress,
        string tokenAddress,
        uint256 amount
        uint256 decimals
    );
}

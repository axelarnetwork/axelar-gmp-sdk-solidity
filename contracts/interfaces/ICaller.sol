// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ICaller {
    error InvalidContract(address target, bytes data);
    error InsufficientBalance(uint256 amount);
    error ExecutionFailed(bytes data);
}

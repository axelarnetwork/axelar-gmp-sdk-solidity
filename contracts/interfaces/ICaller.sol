// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ICaller {
    // check: when is it called?
    error InvalidContract(address target); // rename to AddressEmptyCode will make it more meaningful?
    error InsufficientBalance(); // can log current balance with 
    error ExecutionFailed(); // can log returned data
}

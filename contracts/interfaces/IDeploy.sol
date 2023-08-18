// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IDeploy Interface
 * @notice This interface represents the contract responsible for deploying and initializing new contracts
 * using the `CREATE3` technique.
 */
interface IDeploy {
    error EmptyBytecode();
    error AlreadyDeployed();
    error DeployFailed();
}

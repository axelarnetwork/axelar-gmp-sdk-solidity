// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title ICreate3Deployer Interface
 * @notice This interface represents the contract responsible for deploying and initializing new contracts
 * using the `CREATE3` technique.
 */
interface ICreate3 {
    error Create3EmptyBytecode();
    error Create3AlreadyDeployed();
    error Create3DeployFailed();
}

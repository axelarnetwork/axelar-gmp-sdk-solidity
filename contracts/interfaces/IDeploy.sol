// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IDeploy Interface
 * @notice This interface represents the errors of contract responsible for deploying new contracts.
 */
interface IDeploy {
    error EmptyBytecode();
    error AlreadyDeployed();
    error DeployFailed();
}

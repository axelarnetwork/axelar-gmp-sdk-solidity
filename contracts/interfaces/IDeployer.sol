// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IDeploy } from './IDeploy.sol';

/**
 * @title IDeployer Interface
 * @notice This interface defines the contract responsible for deploying and optionally initializing new contracts
 *  via a specified deployment method.
 */
interface IDeployer is IDeploy {
    error DeployInitFailed();

    event Deployed(address indexed deployedAddress, address indexed sender, bytes32 indexed salt, bytes32 bytecodeHash);

    /**
     * @notice Deploys a contract using a deployment method defined by derived contracts.
     * @param bytecode The bytecode of the contract to be deployed
     * @param salt A salt to influence the contract address
     * @return deployedAddress_ The address of the deployed contract
     */
    function deploy(bytes memory bytecode, bytes32 salt) external payable returns (address deployedAddress_);

    /**
     * @notice Deploys a contract using a deployment method defined by derived contracts and initializes it.
     * @param bytecode The bytecode of the contract to be deployed
     * @param salt A salt to influence the contract address
     * @param init Init data used to initialize the deployed contract
     * @return deployedAddress_ The address of the deployed contract
     */
    function deployAndInit(
        bytes memory bytecode,
        bytes32 salt,
        bytes calldata init
    ) external payable returns (address deployedAddress_);

    /**
     * @notice Returns the address where a contract will be stored if deployed via {deploy} or {deployAndInit} by `sender`.
     * @param bytecode The bytecode of the contract
     * @param sender The address that will deploy the contract
     * @param salt The salt that will be used to influence the contract address
     * @return deployedAddress_ The address that the contract will be deployed to
     */
    function deployedAddress(
        bytes calldata bytecode,
        address sender,
        bytes32 salt
    ) external view returns (address deployedAddress_);
}

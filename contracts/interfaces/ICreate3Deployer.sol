// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title ICreate3Deployer Interface
 * @notice This interface represents the contract responsible for deploying and initializing new contracts
 * using the `CREATE3` technique.
 */
interface ICreate3Deployer {
    error FailedInit();

    event Deployed(bytes32 indexed bytecodeHash, bytes32 indexed salt, address indexed deployedAddress);

    /**
     * @notice Deploys a contract using `CREATE3`.
     * @param bytecode The bytecode of the contract to be deployed
     * @param salt A salt to further randomize the contract address
     * @return deployedAddress_ The address of the deployed contract
     */
    function deploy(bytes calldata bytecode, bytes32 salt) external payable returns (address deployedAddress_);

    /**
     * @notice Deploys a contract using `CREATE3` and initializes it.
     * @param bytecode The bytecode of the contract to be deployed
     * @param salt A salt to further randomize the contract address
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
     * @param sender The address that will deploy the contract via `CREATE3`
     * @param salt The salt that will be used to further randomize the contract address
     * @return address The address that the contract will be deployed to using `CREATE3`
     */
    function deployedAddress(address sender, bytes32 salt) external view returns (address);
}

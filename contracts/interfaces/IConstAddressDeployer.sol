// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IConstAddressDeployer Interface
 * @notice This interface defines the contract responsible for deploying and optionally initializing new contracts
 * using the `CREATE2` method.
 */
// slither-disable-next-line missing-inheritance
interface IConstAddressDeployer {
    error EmptyBytecode();
    error FailedDeploy();
    error FailedInit();

    event Deployed(bytes32 indexed bytecodeHash, bytes32 indexed salt, address indexed deployedAddress);

    /**
     * @notice Deploys a contract using `CREATE2`.
     * @param bytecode The bytecode of the contract to be deployed
     * @param salt A salt to further randomize the contract address
     * @return deployedAddress_ The address of the deployed contract
     */
    function deploy(bytes memory bytecode, bytes32 salt) external returns (address deployedAddress_);

    /**
     * @notice Deploys a contract using `CREATE2` and initializes it.
     * @param bytecode The bytecode of the contract to be deployed
     * @param salt A salt to further randomize the contract address
     * @param init Init data used to initialize the deployed contract
     * @return deployedAddress_ The address of the deployed contract
     */
    function deployAndInit(
        bytes memory bytecode,
        bytes32 salt,
        bytes calldata init
    ) external returns (address deployedAddress_);

    /**
     * @notice Returns the address where a contract will be stored if deployed via {deploy} or {deployAndInit} by `sender`.
     * @param bytecode The bytecode of the contract
     * @param sender The address that will deploy the contract via `CREATE2`
     * @param salt The salt that will be used to further randomize the contract address
     * @return deployedAddress_ The address that the contract will be deployed to using `CREATE2`
     */
    function deployedAddress(
        bytes calldata bytecode,
        address sender,
        bytes32 salt
    ) external view returns (address deployedAddress_);
}

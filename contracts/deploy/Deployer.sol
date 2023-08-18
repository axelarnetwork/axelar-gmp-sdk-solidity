// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IDeployer } from '../interfaces/IDeployer.sol';
import { SafeNativeTransfer } from '../utils/SafeTransfer.sol';

/**
 * @title Deployer Contract
 * @notice This contract is responsible for deploying and initializing new contracts using either the `CREATE2`
 * method which computes the deployed contract address from the bytecode, deployer address, and deployment
 * salt, or the `CREATE3` method which computes the deployed contract address from the deployer address and
 * deployment salt.
 */
abstract contract Deployer is IDeployer {
    using SafeNativeTransfer for address;

    /**
     * @notice Deploys a contract using a deployment method defined by derived contracts.
     * @dev The address where the contract will be deployed can be known in
     * advance via {deployedAddress}.
     *
     * The bytecode for a contract can be obtained from Solidity with
     * `type(contractName).creationCode`.
     *
     * Requirements:
     *
     * - `bytecode` must not be empty.
     * - `salt` must have not been used for `bytecode` already by the same `msg.sender`.
     *
     * @param bytecode The bytecode of the contract to be deployed
     * @param salt A salt to influence the contract address
     * @return deployedAddress_ The address of the deployed contract
     */
    function deploy(bytes memory bytecode, bytes32 salt) external payable returns (address deployedAddress_) {
        bytes32 deploySalt = keccak256(abi.encode(msg.sender, salt));
        deployedAddress_ = _deploy(bytecode, deploySalt);

        emit Deployed(deployedAddress_, msg.sender, salt, keccak256(bytecode));
    }

    /**
     * @notice Deploys a contract using a deployment method defined by derived contracts and initializes it.
     * @dev The address where the contract will be deployed can be known in advance
     * via {deployedAddress}.
     *
     * The bytecode for a contract can be obtained from Solidity with
     * `type(contractName).creationCode`.
     *
     * Requirements:
     *
     * - `bytecode` must not be empty.
     * - `salt` must have not been used for `bytecode` already by the same `msg.sender`.
     * - `init` is used to initialize the deployed contract as an option to not have the
     *    constructor args affect the address derived by `CREATE2`.
     *
     * @param bytecode The bytecode of the contract to be deployed
     * @param salt A salt to influence the contract address
     * @param init Init data used to initialize the deployed contract
     * @return deployedAddress_ The address of the deployed contract
     */
    function deployAndInit(
        bytes memory bytecode,
        bytes32 salt,
        bytes calldata init
    ) external payable returns (address deployedAddress_) {
        bytes32 deploySalt = keccak256(abi.encode(msg.sender, salt));
        deployedAddress_ = _deploy(bytecode, deploySalt);

        emit Deployed(deployedAddress_, msg.sender, salt, keccak256(bytecode));

        (bool success, ) = deployedAddress_.call(init);
        if (!success) revert DeployInitFailed();
    }

    /**
     * @notice Returns the address where a contract will be stored if deployed via {deploy} or {deployAndInit} by `sender`.
     * @dev Any change in the `bytecode`, `sender`, or `salt` will result in a new deployed address (except for the `CREATE3`
     * method where `bytecode` changes will not affect the deployed address).
     * @param bytecode The bytecode of the contract to be deployed
     * @param sender The address that will deploy the contract via the deployment method
     * @param salt The salt that will be used to further randomize the contract address
     * @return deployedAddress_ The address that the contract will be deployed to
     */
    function deployedAddress(
        bytes memory bytecode,
        address sender,
        bytes32 salt
    ) public view returns (address) {
        bytes32 deploySalt = keccak256(abi.encode(sender, salt));
        return _deployedAddress(bytecode, deploySalt);
    }

    // false detection from slither
    // slither-disable-next-line dead-code
    function _deploy(
        bytes memory, /* bytecode */
        bytes32 /* deploySalt */
    ) internal virtual returns (address) {
        return address(0);
    }

    // false detection from slither
    // slither-disable-next-line dead-code
    function _deployedAddress(
        bytes memory, /* bytecode */
        bytes32 /* deploySalt */
    ) internal view virtual returns (address) {
        return address(0);
    }
}

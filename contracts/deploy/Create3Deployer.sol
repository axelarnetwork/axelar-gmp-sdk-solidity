// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ICreate3Deployer } from '../interfaces/ICreate3Deployer.sol';
import { Create3 } from './Create3.sol';
import { SafeNativeTransfer } from '../utils/SafeTransfer.sol';

/**
 * @title Create3Deployer Contract
 * @notice This contract is responsible for deploying and initializing new contracts using the `CREATE3` technique
 * which ensures that only the sender address and salt influence the deployed address, not the contract bytecode.
 */

contract Create3Deployer is ICreate3Deployer {
    using SafeNativeTransfer for address;

    /**
     * @notice Deploys a contract using `CREATE3`.
     * @dev The address where the contract will be deployed can be known in advance via {deployedAddress}.
     *
     * The bytecode for a contract can be obtained from Solidity with
     * `type(contractName).creationCode`.
     *
     * Requirements:
     *
     * - `bytecode` must not be empty.
     * - `salt` must not have been used already by the same `msg.sender`.
     *
     * @param bytecode The bytecode of the contract to be deployed
     * @param salt A salt to further randomize the contract address
     * @return deployedAddress_ The address of the deployed contract
     */
    function deploy(bytes calldata bytecode, bytes32 salt) external payable returns (address deployedAddress_) {
        emit Deployed(keccak256(bytecode), salt, deployedAddress_);

        bytes32 deploySalt = keccak256(abi.encode(msg.sender, salt));

        if (msg.value > 0) {
            deployedAddress(msg.sender, salt).safeNativeTransfer(msg.value);
        }

        deployedAddress_ = Create3.deploy(deploySalt, bytecode);
    }

    /**
     * @notice Deploys a contract using `CREATE3` and initialize it.
     * @dev The address where the contract will be deployed can be known in advance via {deployedAddress}.
     *
     * The bytecode for a contract can be obtained from Solidity with
     * `type(contractName).creationCode`.
     *
     * Requirements:
     *
     * - `bytecode` must not be empty.
     * - `salt` must not have been used already by the same `msg.sender`.
     * - `init` is used to initialize the deployed contract
     *
     * @param bytecode The bytecode of the contract to be deployed
     * @param salt A salt to further randomize the contract address
     * @param init Init data used to initialize the deployed contract
     * @return deployedAddress_ The address of the deployed contract
     */
    function deployAndInit(
        bytes memory bytecode,
        bytes32 salt,
        bytes calldata init
    ) external payable returns (address deployedAddress_) {
        emit Deployed(keccak256(bytecode), salt, deployedAddress_);

        bytes32 deploySalt = keccak256(abi.encode(msg.sender, salt));

        if (msg.value > 0) {
            deployedAddress(msg.sender, salt).safeNativeTransfer(msg.value);
        }

        deployedAddress_ = Create3.deploy(deploySalt, bytecode);

        (bool success, ) = deployedAddress_.call(init);
        if (!success) revert FailedInit();
    }

    /**
     * @notice Returns the address where a contract will be stored if deployed via {deploy} or {deployAndInit} by `sender`.
     * @dev Any change in `sender` or `salt` will result in a new destination address.
     * @param sender The address that will deploy the contract via `CREATE3`
     * @param salt The salt that will be used to further randomize the contract address
     * @return address The address that the contract will be deployed to using `CREATE3`
     */
    function deployedAddress(address sender, bytes32 salt) public view returns (address) {
        bytes32 deploySalt = keccak256(abi.encode(sender, salt));
        return Create3.deployedAddress(address(this), deploySalt);
    }
}

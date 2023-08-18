// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ICreative } from '../interfaces/ICreative.sol';
import { ContractAddress } from '../utils/ContractAddress.sol';
import { SafeNativeTransfer } from '../utils/SafeTransfer.sol';
import { CreateDeploy } from './CreateDeploy.sol';

/**
 * @title Create3 contract
 * @notice This contract can be used to deploy a contract with a deterministic address that depends only on
 * the deployer address and deployment salt, not the contract bytecode and constructor parameters.
 */
contract Create3 is ICreative {
    using ContractAddress for address;
    using SafeNativeTransfer for address;

    // slither-disable-next-line too-many-digits
    bytes32 internal constant DEPLOYER_BYTECODE_HASH = keccak256(type(CreateDeploy).creationCode);

    /**
     * @notice Deploys a new contract using the `CREATE3` method.
     * @dev This function first deploys the DeployCreate contract using
     * the `CREATE2` opcode and then utilizes the DeployCreate to deploy the
     * new contract with the `CREATE` opcode.
     * @param bytecode The bytecode of the contract to be deployed
     * @param deploySalt A salt to further randomize the contract address
     * @return deployed The address of the deployed contract
     */
    function _create3(bytes memory bytecode, bytes32 deploySalt) internal returns (address deployed) {
        deployed = _create3Address(deploySalt);

        if (bytecode.length == 0) revert EmptyBytecode();
        if (deployed.isContract()) revert AlreadyDeployed();

        if (msg.value > 0) {
            deployed.safeNativeTransfer(msg.value);
        }

        // Deploy using create2
        CreateDeploy create = new CreateDeploy{ salt: deploySalt }();

        if (address(create) == address(0)) revert DeployFailed();

        // Deploy using create
        create.deploy(bytecode);
    }

    /**
     * @notice Compute the deployed address that will result from the `CREATE3` method.
     * @param deploySalt A salt to further randomize the contract address
     * @return deployed The deterministic contract address if it was deployed
     */
    function _create3Address(bytes32 deploySalt) internal view returns (address deployed) {
        address deployer = address(
            uint160(uint256(keccak256(abi.encodePacked(hex'ff', address(this), deploySalt, DEPLOYER_BYTECODE_HASH))))
        );

        deployed = address(uint160(uint256(keccak256(abi.encodePacked(hex'd6_94', deployer, hex'01')))));
    }
}

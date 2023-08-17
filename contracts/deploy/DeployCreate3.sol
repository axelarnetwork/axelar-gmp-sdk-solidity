// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IDeploy } from '../interfaces/IDeploy.sol';
import { ContractAddress } from '../utils/ContractAddress.sol';
import { SafeNativeTransfer } from '../utils/SafeTransfer.sol';
import { DeployCreate } from './DeployCreate.sol';

/**
 * @title DeployCreate3 contract
 * @notice This contract can be used to deploy a contract with a deterministic address that only
 * depends on the sender and salt, not the contract bytecode and constructor parameters.
 */
contract DeployCreate3 is IDeploy {
    using ContractAddress for address;
    using SafeNativeTransfer for address;

    // slither-disable-next-line too-many-digits
    bytes32 internal constant DEPLOYER_BYTECODE_HASH = keccak256(type(DeployCreate).creationCode);

    /**
     * @notice Deploys a new contract using the CREATE3 method.
     * @dev This function first deploys the CreateDeployer contract using
     * the CREATE2 opcode and then utilizes the CreateDeployer to deploy the
     * new contract with the CREATE opcode.
     * @param bytecode The bytecode of the contract to be deployed
     * @param deploySalt A salt to further randomize the contract address
     * @return deployed The address of the deployed contract
     */
    function _deployCreate3(bytes memory bytecode, bytes32 deploySalt) internal returns (address deployed) {
        deployed = _create3Address(deploySalt);

        if (bytecode.length == 0) revert EmptyBytecode();
        if (deployed.isContract()) revert AlreadyDeployed();

        if (msg.value > 0) {
            deployed.safeNativeTransfer(msg.value);
        }

        // Deploy using create2
        DeployCreate deployer = new DeployCreate{ salt: deploySalt }();

        if (address(deployer) == address(0)) revert DeployFailed();

        deployer.deploy(bytecode);
    }

    /**
     * @notice Compute the deployed address that will result from the CREATE3 method.
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

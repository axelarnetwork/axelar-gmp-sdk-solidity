// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ICreate3 } from '../interfaces/ICreate3.sol';
import { ContractAddress } from '../utils/ContractAddress.sol';
import { Create } from './Create.sol';

/**
 * @title Create3 contract
 * @notice This contract can be used to deploy a contract with a deterministic address that only
 * depends on the sender and salt, not the contract bytecode and constructor parameters.
 */
contract Create3 is ICreate3 {
    using ContractAddress for address;

    // slither-disable-next-line too-many-digits
    bytes32 internal constant DEPLOYER_BYTECODE_HASH = keccak256(type(Create).creationCode);

    /**
     * @notice Deploys a new contract using the CREATE3 method.
     * @dev This function first deploys the CreateDeployer contract using
     * the CREATE2 opcode and then utilizes the CreateDeployer to deploy the
     * new contract with the CREATE opcode.
     * @param salt A salt to further randomize the contract address
     * @param bytecode The bytecode of the contract to be deployed
     * @return deployed The address of the deployed contract
     */
    function create3Deploy(bytes32 salt, bytes memory bytecode) internal returns (address deployed) {
        deployed = create3Address(address(this), salt);

        if (bytecode.length == 0) revert Create3DeployFailed();
        if (deployed.isContract()) revert Create3AlreadyDeployed();

        // Deploy using create2
        Create deployer = new Create{ salt: salt }();

        if (address(deployer) == address(0)) revert Create3DeployFailed();

        deployer.createDeploy(bytecode);
    }

    /**
     * @notice Compute the deployed address that will result from the CREATE3 method.
     * @param salt A salt to further randomize the contract address
     * @param sender The sender address which would deploy the contract
     * @return deployed The deterministic contract address if it was deployed
     */
    function create3Address(address sender, bytes32 salt) internal pure returns (address deployed) {
        address deployer = address(
            uint160(uint256(keccak256(abi.encodePacked(hex'ff', sender, salt, DEPLOYER_BYTECODE_HASH))))
        );

        deployed = address(uint160(uint256(keccak256(abi.encodePacked(hex'd6_94', deployer, hex'01')))));
    }
}

// SPDX-License-Identifier: MIT

import { CreateDeploy } from './CreateDeploy.sol';

pragma solidity ^0.8.0;

/**
 * @title Create3Address contract
 * @notice This contract can be used to deploy a contract with a deterministic address that depends only on
 * the deployer address and deployment salt, not the contract bytecode and constructor parameters.
 */
contract Create3Address {
    // keccak256(type(CreateDeploy).creationCode)
    bytes32 internal constant DEPLOYER_BYTECODE_HASH = 0xf9bf726c56f6eb7a6a041cc888f1adb1231fafec3ca5392bf47fa10cf8df67fd;

    /**
     * @notice Compute the deployed address that will result from the `CREATE3` method.
     * @param deploySalt A salt to influence the contract address
     * @return deployed The deterministic contract address if it was deployed
     */
    function _create3Address(bytes32 deploySalt) internal view returns (address deployed) {
        address deployer = address(
            uint160(uint256(keccak256(abi.encodePacked(hex'ff', address(this), deploySalt, DEPLOYER_BYTECODE_HASH))))
        );

        deployed = address(uint160(uint256(keccak256(abi.encodePacked(hex'd6_94', deployer, hex'01')))));
    }
}

// SPDX-License-Identifier: MIT

import { CreateDeploy } from './CreateDeploy.sol';

pragma solidity ^0.8.0;

/**
 * @title Create3Address contract
 * @notice This contract can be used to predict the deterministic deployment address of a contract deployed with the `CREATE3` technique.
 */
contract Create3Address {
    /// @dev bytecode hash of the CreateDeploy helper contract
    bytes32 internal immutable createDeployBytecodeHash;

    constructor() {
        createDeployBytecodeHash = keccak256(type(CreateDeploy).creationCode);
    }

    /**
     * @notice Compute the deployed address that will result from the `CREATE3` method.
     * @param deploySalt A salt to influence the contract address
     * @return deployed The deterministic contract address if it was deployed
     */
    function _create3Address(bytes32 deploySalt) internal view returns (address deployed) {
        address deployer = address(
            uint160(uint256(keccak256(abi.encodePacked(hex'ff', address(this), deploySalt, createDeployBytecodeHash))))
        );

        deployed = address(uint160(uint256(keccak256(abi.encodePacked(hex'd6_94', deployer, hex'01')))));
    }
}

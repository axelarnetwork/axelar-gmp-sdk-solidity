// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { DeployerBase } from './DeployerBase.sol';
import { DeployCreate3 } from './DeployCreate3.sol';

/**
 * @title Create3Deployer Contract
 * @notice This contract is responsible for deploying and initializing new contracts using the `CREATE3` method
 * which computes the deployed contract address based on the deployer address and deployment salt.
 */
contract Create3Deployer is DeployCreate3, DeployerBase {
    function _deploy(bytes memory bytecode, bytes32 deploySalt) internal override returns (address) {
        return _deployCreate3(bytecode, deploySalt);
    }

    function _deployedAddress(
        bytes memory, /* bytecode */
        bytes32 deploySalt
    ) internal view override returns (address) {
        return _create3Address(deploySalt);
    }
}

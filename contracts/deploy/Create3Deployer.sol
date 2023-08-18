// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Deployer } from './Deployer.sol';
import { Create3 } from './Create3.sol';

/**
 * @title Create3Deployer Contract
 * @notice This contract is responsible for deploying and initializing new contracts using the `CREATE3` method
 * which computes the deployed contract address based on the deployer address and deployment salt.
 */
contract Create3Deployer is Create3, Deployer {
    function _deploy(bytes memory bytecode, bytes32 deploySalt) internal override returns (address) {
        return _create3(bytecode, deploySalt);
    }

    function _deployedAddress(
        bytes memory, /* bytecode */
        bytes32 deploySalt
    ) internal view override returns (address) {
        return _create3Address(deploySalt);
    }
}

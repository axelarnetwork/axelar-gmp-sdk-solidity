// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Deployer } from './Deployer.sol';
import { Create2 } from './Create2.sol';

/**
 * @title Create2Deployer Contract
 * @notice This contract is responsible for deploying and initializing new contracts using the `CREATE2` method
 * which computes the deployed contract address based on the bytecode, deployer address, and deployment salt.
 */
contract Create2Deployer is Create2, Deployer {
    function _deploy(bytes memory bytecode, bytes32 deploySalt) internal override returns (address) {
        return _create2(bytecode, deploySalt);
    }

    function _deployedAddress(bytes memory bytecode, bytes32 deploySalt) internal view override returns (address) {
        return _create2Address(bytecode, deploySalt);
    }
}

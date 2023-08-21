// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Create2Deployer } from './Create2Deployer.sol';

/**
 * @title ConstAddressDeployer Contract
 * @dev This contract is deprecated in favour of Create2Deployer and exported for backwards compatibility.
 * @notice This contract is responsible for deploying and initializing new contracts using the `CREATE2` method
 * which computes the deployed contract address based on the bytecode, deployer address, and deployment salt.
 */
contract ConstAddressDeployer is Create2Deployer {

}

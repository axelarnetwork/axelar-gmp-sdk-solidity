// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IDeploy } from '../interfaces/IDeploy.sol';
import { ContractAddress } from '../libs/ContractAddress.sol';

/**
 * @title Create2 contract
 * @notice This contract can be used to deploy a contract with a deterministic address that depends on
 * the contract bytecode, deployer address, and deployment salt.
 */
contract Create2 is IDeploy {
    using ContractAddress for address;

    /**
     * @notice Deploys a new contract using the `CREATE2` method.
     * @dev This function deploys the contract using `CREATE2` opcode.
     * @param bytecode The bytecode of the contract to be deployed
     * @param deploySalt A salt to influence the contract address
     * @return deployed The address of the deployed contract
     */
    function _create2(bytes memory bytecode, bytes32 deploySalt) internal returns (address deployed) {
        deployed = _create2Address(bytecode, deploySalt);

        if (bytecode.length == 0) revert EmptyBytecode();
        if (deployed.isContract()) revert AlreadyDeployed();

        assembly {
            deployed := create2(0, add(bytecode, 32), mload(bytecode), deploySalt)
        }

        if (deployed == address(0)) revert DeployFailed();
    }

    /**
     * @notice Computes the deployed address that will result from the `CREATE2` method.
     * @param bytecode The bytecode of the contract to be deployed
     * @param deploySalt A salt to influence the contract address
     * @return address The deterministic contract address if it was deployed
     */
    function _create2Address(bytes memory bytecode, bytes32 deploySalt) internal view returns (address) {
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                hex'ff',
                                address(this),
                                deploySalt,
                                keccak256(bytecode) // init code hash
                            )
                        )
                    )
                )
            );
    }
}

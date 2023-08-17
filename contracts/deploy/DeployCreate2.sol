// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IDeploy } from '../interfaces/IDeploy.sol';
import { ContractAddress } from '../utils/ContractAddress.sol';
import { SafeNativeTransfer } from '../utils/SafeTransfer.sol';

/**
 * @title Create3 contract
 * @notice This contract can be used to deploy a contract with a deterministic address that only
 * depends on the sender and salt, not the contract bytecode and constructor parameters.
 */
contract DeployCreate2 is IDeploy {
    using ContractAddress for address;
    using SafeNativeTransfer for address;

    /**
     * @notice Deploys a new contract using the CREATE3 method.
     * @dev This function first deploys the contract using CREATE2 opcode
     * @param bytecode The bytecode of the contract to be deployed
     * @param deploySalt A salt to further randomize the contract address
     * @return deployed The address of the deployed contract
     */

    function _deployCreate2(bytes memory bytecode, bytes32 deploySalt) internal returns (address deployed) {
        deployed = _create2Address(bytecode, deploySalt);

        if (bytecode.length == 0) revert EmptyBytecode();
        if (deployed.isContract()) revert AlreadyDeployed();

        if (msg.value > 0) {
            deployed.safeNativeTransfer(msg.value);
        }

        // solhint-disable-next-line no-inline-assembly
        assembly {
            deployed := create2(0, add(bytecode, 32), mload(bytecode), deploySalt)
        }

        if (deployed == address(0)) revert DeployFailed();
    }

    /**
     * @notice Compute the deployed address that will result from the CREATE3 method.
     * @param bytecode The bytecode of the contract to be deployed
     * @param deploySalt A salt to further randomize the contract address
     * @return deployed The deterministic contract address if it was deployed
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

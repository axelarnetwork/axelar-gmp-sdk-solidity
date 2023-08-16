// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ICreate2Deployer } from '../interfaces/ICreate2Deployer.sol';
import { SafeNativeTransfer } from '../utils/SafeTransfer.sol';

/**
 * @title Create2Deployer Contract
 * @notice This contract is responsible for deploying and initializing new contracts using the `CREATE2` method
 * which computes the deployed contract address based on the bytecode, deployer address, and deployment salt.
 */
contract Create2Deployer is ICreate2Deployer {
    using SafeNativeTransfer for address;

    /**
     * @notice Deploys a contract using `CREATE2`.
     * @dev The address where the contract will be deployed can be known in
     * advance via {deployedAddress}.
     *
     * The bytecode for a contract can be obtained from Solidity with
     * `type(contractName).creationCode`.
     *
     * Requirements:
     *
     * - `bytecode` must not be empty.
     * - `salt` must have not been used for `bytecode` already by the same `msg.sender`.
     *
     * @param bytecode The bytecode of the contract to be deployed
     * @param salt A salt to further randomize the contract address
     * @return deployedAddress_ The address of the deployed contract
     */
    function deploy(bytes memory bytecode, bytes32 salt) external payable returns (address deployedAddress_) {
        deployedAddress_ = _deploy(bytecode, salt);
    }

    /**
     * @notice Deploys a contract using `CREATE2` and initialize it.
     * @dev The address where the contract will be deployed can be known in advance
     * via {deployedAddress}.
     *
     * The bytecode for a contract can be obtained from Solidity with
     * `type(contractName).creationCode`.
     *
     * Requirements:
     *
     * - `bytecode` must not be empty.
     * - `salt` must have not been used for `bytecode` already by the same `msg.sender`.
     * - `init` is used to initialize the deployed contract
     *    as an option to not have the constructor args affect the address derived by `CREATE2`.
     *
     * @param bytecode The bytecode of the contract to be deployed
     * @param salt A salt to further randomize the contract address
     * @param init Init data used to initialize the deployed contract
     * @return deployedAddress_ The address of the deployed contract
     */
    function deployAndInit(
        bytes memory bytecode,
        bytes32 salt,
        bytes calldata init
    ) external payable returns (address deployedAddress_) {
        deployedAddress_ = _deploy(bytecode, salt);

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = deployedAddress_.call(init);
        if (!success) revert Create2FailedInit();
    }

    /**
     * @notice Returns the address where a contract will be stored if deployed via {deploy} or {deployAndInit} by `sender`.
     * @dev Any change in the `bytecode`, `sender`, or `salt` will result in a new destination address.
     * @param bytecode The bytecode of the contract to be deployed
     * @param sender The address that will deploy the contract via `CREATE2`
     * @param salt The salt that will be used to further randomize the contract address
     * @return deployedAddress_ The address that the contract will be deployed to using `CREATE2`
     */
    function deployedAddress(
        bytes memory bytecode,
        address sender,
        bytes32 salt
    ) public view returns (address deployedAddress_) {
        bytes32 deploySalt = keccak256(abi.encode(sender, salt));
        deployedAddress_ = address(
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

    /**
     * @dev Internal function that deploys a contract with the provided bytecode and salt using
     * the `CREATE2` opcode.
     */
    function _deploy(bytes memory bytecode, bytes32 salt) internal returns (address deployedAddress_) {
        if (bytecode.length == 0) revert Create2EmptyBytecode();

        bytes32 deploySalt = keccak256(abi.encode(msg.sender, salt));
        address expectedAddress = deployedAddress(bytecode, msg.sender, salt);

        emit Deployed(expectedAddress, msg.sender, salt, keccak256(bytecode));

        if (msg.value > 0) {
            expectedAddress.safeNativeTransfer(msg.value);
        }

        // solhint-disable-next-line no-inline-assembly
        assembly {
            deployedAddress_ := create2(0, add(bytecode, 32), mload(bytecode), deploySalt)
        }

        if (deployedAddress_ == address(0)) revert Create2FailedDeploy();
    }
}

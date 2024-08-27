// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGMPExecutableBase } from '../interfaces/IAxelarGMPExecutableBase.sol';

/**
 * @title AxelarGMPExecutableBase
 * @dev Abstract contract to be inherited by contracts that need to execute cross-chain commands via Axelar's Gateway.
 * It provides a reference to the Axelar Gateway contract and includes a base implementation of the constructor and
 * an internal function for command execution, to be overridden by child contracts.
 */
abstract contract AxelarGMPExecutableBase is IAxelarGMPExecutableBase {
    /// @dev Reference to the Axelar Gateway contract.
    address public immutable gatewayAddress;

    /**
     * @dev Contract constructor that sets the Axelar Gateway address.
     * Reverts if the provided address is the zero address.
     * @param gateway_ The address of the Axelar Gateway contract.
     */
    constructor(address gateway_) {
        if (gateway_ == address(0)) revert InvalidAddress();

        gatewayAddress = gateway_;
    }

    /**
     * @dev Internal virtual function to be overridden by child contracts to execute the command.
     * It allows child contracts to define their custom command execution logic.
     * @param commandId The identifier of the command to execute.
     * @param sourceChain The name of the source chain from which the command originated.
     * @param sourceAddress The address on the source chain that sent the command.
     * @param payload The payload of the command to be executed.
     */
    function _execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal virtual;
}

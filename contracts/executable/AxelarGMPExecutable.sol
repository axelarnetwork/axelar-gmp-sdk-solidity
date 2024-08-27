// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGMPGateway } from '../interfaces/IAxelarGMPGateway.sol';
import { IAxelarGMPExecutable } from '../interfaces/IAxelarGMPExecutable.sol';
import { AxelarGMPExecutableBase } from './AxelarGMPExecutableBase.sol';

/**
 * @title AxelarGMPExecutable
 * @dev Abstract contract to be inherited by contracts that need to execute cross-chain commands via Axelar's Gateway.
 * It implements the IAxelarGMPExecutable interface and extends AxelarGMPExecutableBase.
 */
abstract contract AxelarGMPExecutable is IAxelarGMPExecutable, AxelarGMPExecutableBase {
    /**
     * @dev Contract constructor that sets the Axelar Gateway address.
     * Reverts if the provided address is the zero address.
     * @param gateway_ The address of the Axelar Gateway contract.
     */
    constructor(address gateway_) AxelarGMPExecutableBase(gateway_) {}

    /**
     * @notice Executes the cross-chain command after validating it with the Axelar Gateway.
     * @dev This function ensures the call is approved by Axelar Gateway before execution.
     * It uses a hash of the payload for validation and internally calls _execute for the actual command execution.
     * Reverts if the validation fails.
     * @param commandId The identifier of the command to execute.
     * @param sourceChain The name of the source chain from which the command originated.
     * @param sourceAddress The address on the source chain that sent the command.
     * @param payload The payload of the command to be executed.
     */
    function execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external {
        bytes32 payloadHash = keccak256(payload);

        if (!gateway().validateContractCall(commandId, sourceChain, sourceAddress, payloadHash))
            revert NotApprovedByGateway();

        _execute(commandId, sourceChain, sourceAddress, payload);
    }

    /**
     * @notice Returns the address of the AxelarGMPGateway contract.
     * @return The Axelar GMP Gateway instance.
     */
    function gateway() public view returns (IAxelarGMPGateway) {
        return IAxelarGMPGateway(gatewayAddress);
    }
}

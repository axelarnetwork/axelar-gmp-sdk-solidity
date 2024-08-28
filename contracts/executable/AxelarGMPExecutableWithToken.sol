// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGMPGatewayWithToken } from '../interfaces/IAxelarGMPGatewayWithToken.sol';
import { IAxelarGMPExecutableWithToken } from '../interfaces/IAxelarGMPExecutableWithToken.sol';

/**
 * @title AxelarGMPExecutableWithToken
 * @dev Abstract contract to be inherited by contracts that need to execute cross-chain commands involving tokens via Axelar's Gateway.
 * It implements the IAxelarGMPExecutableWithToken interface.
 */
abstract contract AxelarGMPExecutableWithToken is IAxelarGMPExecutableWithToken {
    /// @dev Reference to the Axelar Gateway contract.
    address public immutable gatewayAddress;

    /**
     * @dev Contract constructor that sets the Axelar Gateway address for cross-chain token transfers.
     * Reverts if the provided address is the zero address.
     * @param gateway_ The address of the Axelar Gateway contract with token functionality.
     */
    constructor(address gateway_) {
        if (gateway_ == address(0)) revert InvalidAddress();

        gatewayAddress = gateway_;
    }

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

    /**
     * @notice Executes the cross-chain command with token transfer after validating it with the Axelar Gateway.
     * @dev This function ensures the call is approved by Axelar Gateway With Token before execution.
     * It uses a hash of the payload for validation and calls _executeWithToken for the actual command execution.
     * Reverts if the validation fails.
     * @param commandId The identifier of the command to execute.
     * @param sourceChain The name of the source chain from which the command originated.
     * @param sourceAddress The address on the source chain that sent the command.
     * @param payload The payload of the command to be executed.
     * @param tokenSymbol The symbol of the token to be transferred.
     * @param amount The amount of tokens to be transferred.
     */
    function executeWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external {
        bytes32 payloadHash = keccak256(payload);

        if (
            !gateway().validateContractCallAndMint(
                commandId,
                sourceChain,
                sourceAddress,
                payloadHash,
                tokenSymbol,
                amount
            )
        ) revert NotApprovedByGateway();

        _executeWithToken(commandId, sourceChain, sourceAddress, payload, tokenSymbol, amount);
    }

    /**
     * @dev Internal virtual function to be overridden by child contracts to execute the command with token transfer.
     * It allows child contracts to define their custom command execution logic involving tokens.
     * @param commandId The identifier of the command to execute.
     * @param sourceChain The name of the source chain from which the command originated.
     * @param sourceAddress The address on the source chain that sent the command.
     * @param payload The payload of the command to be executed.
     * @param tokenSymbol The symbol of the token to be transferred.
     * @param amount The amount of tokens to be transferred.
     */
    function _executeWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) internal virtual;

    /**
     * @notice Returns the address of the IAxelarGMPGatewayWithToken contract.
     * @return The Axelar GMP Gateway With Token instance.
     */
    function gateway() public view returns (IAxelarGMPGatewayWithToken) {
        return IAxelarGMPGatewayWithToken(gatewayAddress);
    }
}

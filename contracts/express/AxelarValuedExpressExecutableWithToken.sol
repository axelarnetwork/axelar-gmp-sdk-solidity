// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarValuedExpressExecutable } from './AxelarValuedExpressExecutable.sol';
import { IAxelarGatewayWithToken } from '../interfaces/IAxelarGatewayWithToken.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { IAxelarValuedExpressExecutable } from '../interfaces/IAxelarValuedExpressExecutable.sol';
import { IAxelarValuedExpressExecutableWithToken } from '../interfaces/IAxelarValuedExpressExecutableWithToken.sol';
import { SafeTokenTransferFrom, SafeTokenTransfer } from '../libs/SafeTransfer.sol';
import { SafeNativeTransfer } from '../libs/SafeNativeTransfer.sol';

abstract contract AxelarValuedExpressExecutableWithToken is
    AxelarValuedExpressExecutable,
    IAxelarValuedExpressExecutableWithToken
{
    using SafeTokenTransfer for IERC20;
    using SafeTokenTransferFrom for IERC20;
    using SafeNativeTransfer for address payable;

    constructor(address gateway_) AxelarValuedExpressExecutable(gateway_) {}

    // Returns the amount of token that this call is worth. If `tokenAddress` is `0`, then value is in terms of the native token, otherwise it's in terms of the token address.
    function contractCallValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    )
        public
        view
        virtual
        override(AxelarValuedExpressExecutable, IAxelarValuedExpressExecutable)
        returns (address tokenAddress, uint256 value);

    // Returns the amount of token that this call is worth. If `tokenAddress` is `0`, then value is in terms of the native token, otherwise it's in terms of the token address.
    // The returned call value is in addition to the `amount` of token `symbol` being transferred with the call.
    function contractCallWithTokenValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) public view virtual returns (address tokenAddress, uint256 value);

    function executeWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external override {
        bytes32 payloadHash = keccak256(payload);
        if (
            !gatewayWithToken().validateContractCallAndMint(
                commandId,
                sourceChain,
                sourceAddress,
                payloadHash,
                tokenSymbol,
                amount
            )
        ) revert NotApprovedByGateway();

        address expressExecutor = _popExpressExecutorWithToken(
            commandId,
            sourceChain,
            sourceAddress,
            payloadHash,
            tokenSymbol,
            amount
        );

        if (expressExecutor == address(0)) {
            _executeWithToken(commandId, sourceChain, sourceAddress, payload, tokenSymbol, amount);
            return;
        }

        // slither-disable-next-line reentrancy-events
        emit ExpressExecutionWithTokenFulfilled(
            commandId,
            sourceChain,
            sourceAddress,
            payloadHash,
            tokenSymbol,
            amount,
            expressExecutor
        );

        {
            (address tokenAddress, uint256 value) = contractCallWithTokenValue(
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount
            );
            _transferToExecutor(expressExecutor, tokenAddress, value);
        }

        {
            address gatewayToken = gatewayWithToken().tokenAddresses(tokenSymbol);
            IERC20(gatewayToken).safeTransfer(expressExecutor, amount);
        }
    }

    function expressExecuteWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external payable virtual {
        if (gatewayWithToken().isCommandExecuted(commandId)) revert AlreadyExecuted();

        address expressExecutor = msg.sender;
        bytes32 payloadHash = keccak256(payload);

        emit ExpressExecutedWithToken(
            commandId,
            sourceChain,
            sourceAddress,
            payloadHash,
            symbol,
            amount,
            expressExecutor
        );

        _setExpressExecutorWithToken(
            commandId,
            sourceChain,
            sourceAddress,
            payloadHash,
            symbol,
            amount,
            expressExecutor
        );

        {
            (address tokenAddress, uint256 value) = contractCallWithTokenValue(
                sourceChain,
                sourceAddress,
                payload,
                symbol,
                amount
            );
            _transferFromExecutor(expressExecutor, tokenAddress, value);
        }

        {
            address gatewayToken = gatewayWithToken().tokenAddresses(symbol);
            IERC20(gatewayToken).safeTransferFrom(expressExecutor, address(this), amount);
        }

        _executeWithToken(commandId, sourceChain, sourceAddress, payload, symbol, amount);
    }

    /**
     * @notice Returns the express executor with token for a given command.
     * @param commandId The commandId for the contractCallWithToken.
     * @param sourceChain The source chain.
     * @param sourceAddress The source address.
     * @param payloadHash The hash of the payload.
     * @param symbol The token symbol.
     * @param amount The amount of tokens.
     * @return expressExecutor The address of the express executor.
     */
    function getExpressExecutorWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash,
        string calldata symbol,
        uint256 amount
    ) external view returns (address expressExecutor) {
        expressExecutor = _getExpressExecutorWithToken(
            commandId,
            sourceChain,
            sourceAddress,
            payloadHash,
            symbol,
            amount
        );
    }

    /**
     * @dev Internal virtual function to be overridden by child contracts to execute the command with token transfer.
     * It allows child contracts to define their custom command execution logic involving tokens.
     * @param commandId The unique identifier of the cross-chain message being executed.
     * @param sourceChain The name of the source chain from which the message originated.
     * @param sourceAddress The address on the source chain that sent the message.
     * @param payload The payload of the message payload.
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
     * @notice Returns the address of the IAxelarGatewayWithToken contract.
     * @return The Axelar Gateway with Token instance.
     */
    function gatewayWithToken() internal view returns (IAxelarGatewayWithToken) {
        return IAxelarGatewayWithToken(gatewayAddress);
    }
}

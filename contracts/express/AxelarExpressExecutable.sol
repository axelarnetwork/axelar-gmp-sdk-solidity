// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarGMPExecutable } from '../executable/AxelarGMPExecutable.sol';
import { AxelarGMPExecutableWithToken } from '../executable/AxelarGMPExecutableWithToken.sol';
import { IAxelarGMPExecutable } from '../interfaces/IAxelarGMPExecutable.sol';
import { IAxelarGMPExecutableWithToken } from '../interfaces/IAxelarGMPExecutableWithToken.sol';
import { ExpressExecutorTracker } from './ExpressExecutorTracker.sol';
import { SafeTokenTransferFrom, SafeTokenTransfer } from '../libs/SafeTransfer.sol';
import { IERC20 } from '../interfaces/IERC20.sol';

abstract contract AxelarExpressExecutable is ExpressExecutorTracker, AxelarGMPExecutableWithToken {
    using SafeTokenTransfer for IERC20;
    using SafeTokenTransferFrom for IERC20;

    constructor(address gateway_) AxelarGMPExecutableWithToken(gateway_) {}

    function execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external override(AxelarGMPExecutable, IAxelarGMPExecutable) {
        bytes32 payloadHash = keccak256(payload);

        if (!gateway().validateContractCall(commandId, sourceChain, sourceAddress, payloadHash))
            revert NotApprovedByGateway();

        address expressExecutor = _popExpressExecutor(commandId, sourceChain, sourceAddress, payloadHash);

        if (expressExecutor != address(0)) {
            // slither-disable-next-line reentrancy-events
            emit ExpressExecutionFulfilled(commandId, sourceChain, sourceAddress, payloadHash, expressExecutor);
        } else {
            _execute(commandId, sourceChain, sourceAddress, payload);
        }
    }

    function executeWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external override(AxelarGMPExecutableWithToken, IAxelarGMPExecutableWithToken) {
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

        if (expressExecutor != address(0)) {
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

            address gatewayToken = gatewayWithToken().tokenAddresses(tokenSymbol);
            IERC20(gatewayToken).safeTransfer(expressExecutor, amount);
        } else {
            _executeWithToken(commandId, sourceChain, sourceAddress, payload, tokenSymbol, amount);
        }
    }

    function expressExecute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external payable virtual {
        if (gateway().isCommandExecuted(commandId)) revert AlreadyExecuted();

        address expressExecutor = msg.sender;
        bytes32 payloadHash = keccak256(payload);

        emit ExpressExecuted(commandId, sourceChain, sourceAddress, payloadHash, expressExecutor);

        _setExpressExecutor(commandId, sourceChain, sourceAddress, payloadHash, expressExecutor);

        _execute(commandId, sourceChain, sourceAddress, payload);
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
        address gatewayToken = gatewayWithToken().tokenAddresses(symbol);
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

        IERC20(gatewayToken).safeTransferFrom(expressExecutor, address(this), amount);

        _executeWithToken(commandId, sourceChain, sourceAddress, payload, symbol, amount);
    }
}

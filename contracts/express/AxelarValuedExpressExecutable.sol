// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { ExpressExecutorTracker } from './ExpressExecutorTracker.sol';

import { SafeTokenTransferFrom, SafeTokenTransfer, SafeNativeTransfer } from '../utils/SafeTransfer.sol';
import { IERC20 } from '../interfaces/IERC20.sol';

abstract contract AxelarValuedExpressExecutable is ExpressExecutorTracker {
    using SafeTokenTransfer for IERC20;
    using SafeTokenTransferFrom for IERC20;
    using SafeNativeTransfer for address payable;

    IAxelarGateway public immutable gateway;

    constructor(address gateway_) {
        if (gateway_ == address(0)) revert InvalidAddress();

        gateway = IAxelarGateway(gateway_);
    }

    // Returns the amount of native token that that this call is worth.
    function contractCallValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) public view virtual returns (address tokenAddress, uint256 value);

    // Returns the amount of token that that this call is worth. If `native` is true then native token is used, otherwise the token specified by `symbol` is used.
    function contractCallWithTokenValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) public view virtual returns (address tokenAddress, uint256 value);

    function execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external {
        bytes32 payloadHash = keccak256(payload);

        if (!gateway.validateContractCall(commandId, sourceChain, sourceAddress, payloadHash))
            revert NotApprovedByGateway();

        address expressExecutor = _popExpressExecutor(commandId, sourceChain, sourceAddress, payloadHash);

        if (expressExecutor == address(0)) {
            _execute(sourceChain, sourceAddress, payload);
            return;
        }

        (address tokenAddress, uint256 value) = contractCallValue(sourceChain, sourceAddress, payload);
        if (tokenAddress == address(0)) {
            payable(expressExecutor).safeNativeTransfer(value);
        } else {
            IERC20(tokenAddress).safeTransfer(expressExecutor, value);
        }
        emit ExpressExecutionFulfilled(commandId, sourceChain, sourceAddress, payload, expressExecutor);
    }

    function executeWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external {
        address expressExecutor;
        {
            bytes32 payloadHash = keccak256(payload);
            if (
                !gateway.validateContractCallAndMint(
                    commandId,
                    sourceChain,
                    sourceAddress,
                    payloadHash,
                    tokenSymbol,
                    amount
                )
            ) revert NotApprovedByGateway();

            expressExecutor = _popExpressExecutorWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payloadHash,
                tokenSymbol,
                amount
            );
        }

        if (expressExecutor == address(0)) {
            _executeWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount);
            return;
        }

        (address tokenAddress, uint256 value) = contractCallWithTokenValue(
            sourceChain,
            sourceAddress,
            payload,
            tokenSymbol,
            amount
        );
        {
            address gatewayToken = gateway.tokenAddresses(tokenSymbol);

            if (tokenAddress == gatewayToken) {
                IERC20(gatewayToken).safeTransfer(expressExecutor, value + amount);
            } else {
                IERC20(gatewayToken).safeTransfer(expressExecutor, amount);
                if (tokenAddress == address(0)) {
                    payable(expressExecutor).safeNativeTransfer(value);
                } else {
                    IERC20(tokenAddress).safeTransfer(expressExecutor, value);
                }
            }
        }
        emit ExpressExecutionWithTokenFulfilled(
            commandId,
            sourceChain,
            sourceAddress,
            payload,
            tokenSymbol,
            amount,
            expressExecutor
        );
    }

    function expressExecute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external payable virtual {
        if (gateway.isCommandExecuted(commandId)) revert AlreadyExecuted();

        (address tokenAddress, uint256 value) = contractCallValue(sourceChain, sourceAddress, payload);
        address expressExecutor = msg.sender;

        if (tokenAddress == address(0)) {
            if (value != msg.value) revert InsufficientValue();
        } else if (value > 0) {
            IERC20(tokenAddress).safeTransferFrom(expressExecutor, address(this), value);
        }

        _setExpressExecutor(commandId, sourceChain, sourceAddress, keccak256(payload), expressExecutor);
        _execute(sourceChain, sourceAddress, payload);
        emit ExpressExecuted(commandId, sourceChain, sourceAddress, payload, expressExecutor);
    }

    function expressExecuteWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external payable virtual {
        if (gateway.isCommandExecuted(commandId)) revert AlreadyExecuted();
        address expressExecutor = msg.sender;
        (address tokenAddress, uint256 value) = contractCallWithTokenValue(
            sourceChain,
            sourceAddress,
            payload,
            symbol,
            amount
        );
        {
            address gatewayToken = gateway.tokenAddresses(symbol);

            if (tokenAddress == gatewayToken) {
                IERC20(gatewayToken).safeTransferFrom(expressExecutor, address(this), amount + value);
            } else {
                IERC20(gatewayToken).safeTransferFrom(expressExecutor, address(this), amount);
                if (tokenAddress == address(0)) {
                    if (value != msg.value) revert InsufficientValue();
                } else if (value > 0) {
                    IERC20(tokenAddress).safeTransferFrom(expressExecutor, address(this), value);
                }
            }
        }
        _setExpressExecutorWithToken(
            commandId,
            sourceChain,
            sourceAddress,
            keccak256(payload),
            symbol,
            amount,
            expressExecutor
        );
        _executeWithToken(sourceChain, sourceAddress, payload, symbol, amount);
        emit ExpressExecutedWithToken(commandId, sourceChain, sourceAddress, payload, symbol, amount, expressExecutor);
    }

    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload // solhint-disable-next-line no-empty-blocks
    ) internal virtual {}

    function _executeWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount // solhint-disable-next-line no-empty-blocks
    ) internal virtual {}
}

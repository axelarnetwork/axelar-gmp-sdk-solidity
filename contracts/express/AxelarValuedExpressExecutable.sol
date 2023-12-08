// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { IAxelarValuedExpressExecutable } from '../interfaces/IAxelarValuedExpressExecutable.sol';
import { SafeTokenTransferFrom, SafeTokenTransfer } from '../libs/SafeTransfer.sol';
import { SafeNativeTransfer } from '../libs/SafeNativeTransfer.sol';
import { ExpressExecutorTracker } from './ExpressExecutorTracker.sol';

abstract contract AxelarValuedExpressExecutable is ExpressExecutorTracker, IAxelarValuedExpressExecutable {
    using SafeTokenTransfer for IERC20;
    using SafeTokenTransferFrom for IERC20;
    using SafeNativeTransfer for address payable;

    IAxelarGateway public immutable gateway;

    constructor(address gateway_) {
        if (gateway_ == address(0)) revert InvalidAddress();

        gateway = IAxelarGateway(gateway_);
    }

    // Returns the amount of token that this call is worth. If `tokenAddress` is `0`, then value is in terms of the native token, otherwise it's in terms of the token address.
    function contractCallValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) public view virtual returns (address tokenAddress, uint256 value);

    // Returns the amount of token that this call is worth. If `tokenAddress` is `0`, then value is in terms of the native token, otherwise it's in terms of the token address.
    // The returned call value is in addition to the `amount` of token `symbol` being transferred with the call.
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

        // slither-disable-next-line reentrancy-events
        emit ExpressExecutionFulfilled(commandId, sourceChain, sourceAddress, payloadHash, expressExecutor);

        {
            (address tokenAddress, uint256 value) = contractCallValue(sourceChain, sourceAddress, payload);
            _transferToExecutor(expressExecutor, tokenAddress, value);
        }
    }

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
            !gateway.validateContractCallAndMint(
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
            _executeWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount);
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
            address gatewayToken = gateway.tokenAddresses(tokenSymbol);
            IERC20(gatewayToken).safeTransfer(expressExecutor, amount);
        }
    }

    function expressExecute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external payable virtual {
        if (gateway.isCommandExecuted(commandId)) revert AlreadyExecuted();

        address expressExecutor = msg.sender;
        bytes32 payloadHash = keccak256(payload);

        emit ExpressExecuted(commandId, sourceChain, sourceAddress, payloadHash, expressExecutor);

        _setExpressExecutor(commandId, sourceChain, sourceAddress, payloadHash, expressExecutor);

        {
            (address tokenAddress, uint256 value) = contractCallValue(sourceChain, sourceAddress, payload);
            _transferFromExecutor(expressExecutor, tokenAddress, value);
        }

        _execute(sourceChain, sourceAddress, payload);
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
            address gatewayToken = gateway.tokenAddresses(symbol);
            IERC20(gatewayToken).safeTransferFrom(expressExecutor, address(this), amount);
        }

        _executeWithToken(sourceChain, sourceAddress, payload, symbol, amount);
    }

    function _transferToExecutor(
        address expressExecutor,
        address tokenAddress,
        uint256 value
    ) internal {
        if (value == 0) return;

        if (tokenAddress == address(0)) {
            payable(expressExecutor).safeNativeTransfer(value);
        } else {
            IERC20(tokenAddress).safeTransfer(expressExecutor, value);
        }
    }

    function _transferFromExecutor(
        address expressExecutor,
        address tokenAddress,
        uint256 value
    ) internal {
        if (value == 0) return;

        if (tokenAddress == address(0)) {
            if (value != msg.value) revert InsufficientValue();
        } else {
            IERC20(tokenAddress).safeTransferFrom(expressExecutor, address(this), value);
        }
    }

    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal virtual {}

    function _executeWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) internal virtual {}
}

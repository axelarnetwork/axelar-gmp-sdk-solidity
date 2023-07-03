// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { AxelarExpressExecutableStorage } from './AxelarExpressExecutableStorage.sol';

import { SafeTokenTransferFrom, SafeTokenTransfer, SafeNativeTransfer } from '../utils/SafeTransfer.sol';
import { IERC20 } from '../interfaces/IERC20.sol';

abstract contract AxelarExpressExecutable is AxelarExpressExecutableStorage {
    using SafeTokenTransfer for IERC20;
    using SafeTokenTransferFrom for IERC20;
    using SafeNativeTransfer for address payable;

    IAxelarGateway public immutable gateway;

    constructor(address gateway_) {
        if (gateway_ == address(0)) revert InvalidAddress();

        gateway = IAxelarGateway(gateway_);
    }

    function execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external {
        bytes32 payloadHash = keccak256(payload);

        if (!gateway.validateContractCall(commandId, sourceChain, sourceAddress, payloadHash))
            revert NotApprovedByGateway();
        address expressExecutor = _popExpressCaller(commandId, sourceChain, sourceAddress, payload);
        if (expressExecutor != address(0)) {
            emit ExpressExecutionFulfilled(commandId, sourceChain, sourceAddress, payload, expressExecutor);
        } else {
            _execute(sourceChain, sourceAddress, payload);
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
        }
        address expressExecutor = _popExpressCallerWithToken(
            commandId,
            sourceChain,
            sourceAddress,
            payload,
            tokenSymbol,
            amount
        );
        if (expressExecutor != address(0)) {
            address gatewayToken = gateway.tokenAddresses(tokenSymbol);
            IERC20(gatewayToken).safeTransfer(expressExecutor, amount);
            emit ExpressExecutionWithTokenFulfilled(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
                expressExecutor
            );
        } else {
            _executeWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount);
        }
    }

    function expressExecute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external payable {
        if (gateway.isCommandExecuted(commandId)) revert AlreadyExecuted();

        address expressExecutor = msg.sender;

        _setExpressCaller(commandId, sourceChain, sourceAddress, payload, expressExecutor);
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
    ) external payable {
        if (gateway.isCommandExecuted(commandId)) revert AlreadyExecuted();
        address expressExecutor = msg.sender;
        address gatewayToken = gateway.tokenAddresses(symbol);
        IERC20(gatewayToken).safeTransferFrom(expressExecutor, address(this), amount);
        _setExpressCallerWithToken(commandId, sourceChain, sourceAddress, payload, symbol, amount, expressExecutor);
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

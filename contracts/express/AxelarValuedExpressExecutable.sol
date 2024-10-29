// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarExecutable } from '../executable/AxelarExecutable.sol';
import { IAxelarExecutable } from '../interfaces/IAxelarExecutable.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { IAxelarValuedExpressExecutable } from '../interfaces/IAxelarValuedExpressExecutable.sol';
import { SafeTokenTransferFrom, SafeTokenTransfer } from '../libs/SafeTransfer.sol';
import { SafeNativeTransfer } from '../libs/SafeNativeTransfer.sol';
import { ExpressExecutorTracker } from './ExpressExecutorTracker.sol';

abstract contract AxelarValuedExpressExecutable is
    ExpressExecutorTracker,
    AxelarExecutable,
    IAxelarValuedExpressExecutable
{
    using SafeTokenTransfer for IERC20;
    using SafeTokenTransferFrom for IERC20;
    using SafeNativeTransfer for address payable;

    constructor(address gateway_) AxelarExecutable(gateway_) {}

    // Returns the amount of token that this call is worth. If `tokenAddress` is `0`, then value is in terms of the native token, otherwise it's in terms of the token address.
    function contractCallValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) public view virtual returns (address tokenAddress, uint256 value);

    function execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external override(AxelarExecutable, IAxelarExecutable) {
        bytes32 payloadHash = keccak256(payload);

        if (!gateway().validateContractCall(commandId, sourceChain, sourceAddress, payloadHash))
            revert NotApprovedByGateway();

        address expressExecutor = _popExpressExecutor(commandId, sourceChain, sourceAddress, payloadHash);

        if (expressExecutor == address(0)) {
            _execute(commandId, sourceChain, sourceAddress, payload);
            return;
        }

        // slither-disable-next-line reentrancy-events
        emit ExpressExecutionFulfilled(commandId, sourceChain, sourceAddress, payloadHash, expressExecutor);

        {
            (address tokenAddress, uint256 value) = contractCallValue(sourceChain, sourceAddress, payload);
            _transferToExecutor(expressExecutor, tokenAddress, value);
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

        {
            (address tokenAddress, uint256 value) = contractCallValue(sourceChain, sourceAddress, payload);
            _transferFromExecutor(expressExecutor, tokenAddress, value);
        }

        _execute(commandId, sourceChain, sourceAddress, payload);
    }

    /**
     * @notice Returns the express executor for a given command.
     * @param commandId The commandId for the contractCall.
     * @param sourceChain The source chain.
     * @param sourceAddress The source address.
     * @param payloadHash The hash of the payload.
     * @return expressExecutor The address of the express executor.
     */
    function getExpressExecutor(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external view returns (address expressExecutor) {
        expressExecutor = _getExpressExecutor(commandId, sourceChain, sourceAddress, payloadHash);
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
}

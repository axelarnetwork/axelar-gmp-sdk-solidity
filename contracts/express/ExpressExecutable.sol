// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IExpressExecutable } from '../interfaces/IExpressExecutable.sol';

import { SafeTokenTransferFrom, SafeTokenTransfer, SafeNativeTransfer } from '../utils/SafeTransfer.sol';
import { IERC20 } from '../interfaces/IERC20.sol';

abstract contract ExpressExecutable is IExpressExecutable {
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
        address expressCaller = _popExpressCaller(commandId, sourceChain, sourceAddress, payload);
        if (expressCaller != address(0)) {
            emit ExpressExecutionFulfilled(commandId, sourceChain, sourceAddress, payload, expressCaller);
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
        address expressCaller = _popExpressCallerWithToken(
            commandId,
            sourceChain,
            sourceAddress,
            payload,
            tokenSymbol,
            amount
        );
        if (expressCaller != address(0)) {
            {
                address gatewayToken = gateway.tokenAddresses(tokenSymbol);
                IERC20(gatewayToken).safeTransfer(expressCaller, amount);
            }
            emit ExpressExecutionWithTokenFulfilled(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount,
                expressCaller
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

        address expressCaller = msg.sender;

        _setExpressCaller(commandId, sourceChain, sourceAddress, payload, expressCaller);
        _execute(sourceChain, sourceAddress, payload);
        emit ExpressExecuted(commandId, sourceChain, sourceAddress, payload, expressCaller);
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
        address expressCaller = msg.sender;
        {
            address gatewayToken = gateway.tokenAddresses(symbol);
            IERC20(gatewayToken).safeTransferFrom(expressCaller, address(this), amount);
        }
        _setExpressCallerWithToken(commandId, sourceChain, sourceAddress, payload, symbol, amount, expressCaller);
        _executeWithToken(sourceChain, sourceAddress, payload, symbol, amount);
        emit ExpressExecutedWithToken(commandId, sourceChain, sourceAddress, payload, symbol, amount, expressCaller);
    }

    function _expressExecutionSlot(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal pure returns (uint256 slot) {
        // TODO: maybe add some salt although i doubt it will be an issue.
        slot = uint256(keccak256(abi.encode(commandId, sourceChain, sourceAddress, payload))) - 1;
    }

    function _expressExecutedWithTokenSlot(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) internal pure returns (uint256 slot) {
        // TODO: maybe add some salt although i doubt it will be an issue.
        slot = uint256(keccak256(abi.encode(commandId, sourceChain, sourceAddress, payload, symbol, amount))) - 1;
    }

    function getExpressCaller(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) public view returns (address expressCaller) {
        uint256 slot = _expressExecutionSlot(commandId, sourceChain, sourceAddress, payload);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            expressCaller := sload(slot)
        }
    }

    function getExpressCallerWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) public view returns (address expressCaller) {
        uint256 slot = _expressExecutedWithTokenSlot(commandId, sourceChain, sourceAddress, payload, symbol, amount);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            expressCaller := sload(slot)
        }
    }

    function _setExpressCaller(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        address expressCaller
    ) private {
        uint256 slot = _expressExecutionSlot(commandId, sourceChain, sourceAddress, payload);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, expressCaller)
        }
    }

    function _setExpressCallerWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount,
        address expressCaller
    ) private {
        uint256 slot = _expressExecutedWithTokenSlot(commandId, sourceChain, sourceAddress, payload, symbol, amount);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, expressCaller)
        }
    }

    function _popExpressCaller(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) private returns (address expressCaller) {
        uint256 slot = _expressExecutionSlot(commandId, sourceChain, sourceAddress, payload);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            expressCaller := sload(slot)
            if expressCaller {
                sstore(slot, 0)
            }
        }
    }

    function _popExpressCallerWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) private returns (address expressCaller) {
        uint256 slot = _expressExecutedWithTokenSlot(commandId, sourceChain, sourceAddress, payload, symbol, amount);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            expressCaller := sload(slot)
            if expressCaller {
                sstore(slot, 0)
            }
        }
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

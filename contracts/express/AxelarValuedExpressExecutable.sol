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

    /**
     * @notice Returns the amount of token that this call is worth.
     * @param sourceChain The chain where the call originated
     * @param sourceAddress The address where the call originated
     * @param payload The call payload
     * @return tokenAddress The address of the token
     * @return value The value of the token
     */
    function contractCallValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) public view virtual returns (address tokenAddress, uint256 value);

    /**
     * @notice Returns the amount of token that this call is worth.
     * @param sourceChain The chain where the call originated
     * @param sourceAddress The address where the call originated
     * @param payload The call payload
     * @param symbol The token symbol
     * @param amount The token amount
     * @return tokenAddress The address of the token
     * @return value The value of the token
     */
    function contractCallWithTokenValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) public view virtual returns (address tokenAddress, uint256 value);

    /**
     * @notice Executes the call with the given payload.
     * @param commandId The command id
     * @param sourceChain The chain where the call originated
     * @param sourceAddress The address where the call originated
     * @param payload The call payload
     */
    function execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external virtual {
        bytes32 payloadHash = keccak256(payload);

        if (!gateway.validateContractCall(commandId, sourceChain, sourceAddress, payloadHash))
            revert NotApprovedByGateway();

        address expressExecutor = _popExpressExecutor(commandId, sourceChain, sourceAddress, payloadHash);

        if (expressExecutor == address(0)) {
            (address tokenAddress, uint256 value) = _produceValue(sourceChain, sourceAddress, payload);

            _processValue(sourceChain, sourceAddress, payload, tokenAddress, value, '');
            return;
        }

        // slither-disable-next-line reentrancy-events
        emit ExpressExecutionFulfilled(commandId, sourceChain, sourceAddress, payloadHash, expressExecutor);

        {
            (address tokenAddress, uint256 value) = contractCallValue(sourceChain, sourceAddress, payload);

            _produceValueToExecutor(expressExecutor, tokenAddress, value);
        }
    }

    /**
     * @notice Executes the call with the given payload and token.
     * @param commandId The command id
     * @param sourceChain The chain where the call originated
     * @param sourceAddress The address where the call originated
     * @param payload The call payload
     * @param tokenSymbol The token symbol
     * @param amount The token amount
     */
    function executeWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external virtual {
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
            address tokenAddress = gateway.tokenAddresses(tokenSymbol);

            _processValue(sourceChain, sourceAddress, payload, tokenAddress, amount, tokenSymbol);
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
            _produceValueToExecutor(expressExecutor, tokenAddress, value);
        }

        {
            address gatewayToken = gateway.tokenAddresses(tokenSymbol);
            IERC20(gatewayToken).safeTransfer(expressExecutor, amount);
        }
    }

    /**
     * @notice Express executes the call with the given payload.
     * @param commandId The command id
     * @param sourceChain The chain where the call originated
     * @param sourceAddress The address where the call originated
     * @param payload The call payload
     */
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

        (address tokenAddress, uint256 amount) = contractCallValue(sourceChain, sourceAddress, payload);
        _transferFromExecutor(expressExecutor, tokenAddress, amount);

        _processValue(sourceChain, sourceAddress, payload, tokenAddress, amount, '');
    }

    /**
     * @notice Express executes the call with the given payload and token.
     * @param commandId The command id
     * @param sourceChain The chain where the call originated
     * @param sourceAddress The address where the call originated
     * @param payload The call payload
     * @param symbol The token symbol
     * @param amount The token amount
     */
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

        address gatewayToken = gateway.tokenAddresses(symbol);
        IERC20(gatewayToken).safeTransferFrom(expressExecutor, address(this), amount);

        _processValue(sourceChain, sourceAddress, payload, gatewayToken, amount, symbol);
    }

    /**
     * @notice Gets the token address and value from the payload.
     * @dev This function should be implemented by the child contract.
     *      and used in the contractCallValue and _produceValue functions.
     * @param payload The call payload
     * @return tokenAddress The address of the token
     * @return value The value of the token
     */
    function _decodeTokenValue(bytes calldata payload)
        internal
        view
        virtual
        returns (address tokenAddress, uint256 value);

    /**
     * @notice Produces the value of the call.
     * @dev This function is called in the non-express GMP flow.
     * @dev This could be a mint, unlock, or any other operation that produces value.
     * @param sourceChain The chain where the call originated
     * @param sourceAddress The address where the call originated
     * @param payload The call payload
     * @return tokenAddress The address of the token
     * @return value The value of the token
     */
    function _produceValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal virtual returns (address tokenAddress, uint256 value);

    /**
     * @notice Transfers the value of the call from the executor to the contract.
     * @dev This function is called in the express GMP flow.
     * @param expressExecutor The address of the executor
     * @param tokenAddress The address of the token
     * @param value The value of the token
     */
    function _transferFromExecutor(
        address expressExecutor,
        address tokenAddress,
        uint256 value
    ) internal virtual {
        if (value == 0) return;

        if (tokenAddress == address(0)) {
            if (msg.value < value) revert InsufficientValue();
        } else {
            IERC20(tokenAddress).safeTransferFrom(expressExecutor, address(this), value);
        }
    }

    /**
     * @notice Returns the token to the express executor.
     * @dev This function is called in the express GMP flow.
     * @param expressExecutor The address of the executor
     * @param tokenAddress The address of the token
     * @param value The value of the token
     */
    function _produceValueToExecutor(
        address expressExecutor,
        address tokenAddress,
        uint256 value
    ) internal virtual {
        if (value == 0) return;

        if (tokenAddress == address(0)) {
            payable(expressExecutor).safeNativeTransfer(value);
        } else {
            IERC20(tokenAddress).safeTransfer(expressExecutor, value);
        }
    }

    /**
     * @notice Processes the value of the express or normal call.
     * @dev This function assumes that token value has already been transferred to the contract.
     * @param sourceChain The chain where the call originated
     * @param sourceAddress The address where the call originated
     * @param payload The call payload
     * @param tokenAddress The address of the token
     * @param amount The value of the token
     * @param tokenSymbol The token symbol for the gateway tokens
     */
    function _processValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        address tokenAddress,
        uint256 amount,
        string memory tokenSymbol
    ) internal virtual;
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IExpressExecutable } from '../interfaces/IExpressExecutable.sol';
import { IExpressRegistry } from '../interfaces/IExpressRegistry.sol';

contract ExpressRegistry is IExpressRegistry {
    IAxelarGateway public immutable gateway;
    // Can't use immutable for proxy to keep consistent codehash
    IExpressExecutable public proxy;

    mapping(bytes32 => address) private expressCallsWithToken;

    constructor(address gateway_) {
        if (gateway_ == address(0)) revert InvalidGateway();

        gateway = IAxelarGateway(gateway_);
        proxy = IExpressExecutable(msg.sender);
    }

    modifier onlyProxy() {
        if (msg.sender != address(proxy)) revert NotExpressProxy();

        _;
    }

    function registerExpressCallWithToken(
        address expressCaller,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash,
        string calldata tokenSymbol,
        uint256 amount
    ) external onlyProxy {
        (bytes32 slot, address existingExpressCaller) = _getExpressCallWithToken(
            sourceChain,
            sourceAddress,
            msg.sender,
            payloadHash,
            tokenSymbol,
            amount
        );

        if (existingExpressCaller != address(0)) revert AlreadyExpressCalled();

        _setExpressCallWithToken(slot, expressCaller);

        emit ExpressCallWithToken(expressCaller, sourceChain, sourceAddress, payloadHash, tokenSymbol, amount);
    }

    function processCallWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external onlyProxy {
        bytes32 payloadHash = keccak256(payload);
        (bytes32 slot, address expressCaller) = _getExpressCallWithToken(
            sourceChain,
            sourceAddress,
            msg.sender,
            payloadHash,
            tokenSymbol,
            amount
        );

        if (
            gateway.isContractCallAndMintApproved(
                commandId,
                sourceChain,
                sourceAddress,
                address(proxy),
                payloadHash,
                tokenSymbol,
                amount
            ) && expressCaller != address(0)
        ) _setExpressCallWithToken(slot, address(0));

        IExpressExecutable(msg.sender).completeExecuteWithToken(
            expressCaller,
            commandId,
            sourceChain,
            sourceAddress,
            payload,
            tokenSymbol,
            amount
        );

        emit ExpressCallWithTokenCompleted(
            expressCaller,
            commandId,
            sourceChain,
            sourceAddress,
            payloadHash,
            tokenSymbol,
            amount
        );
    }

    function _getExpressCallWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes32 payloadHash,
        string calldata symbol,
        uint256 amount
    ) internal view returns (bytes32 slot, address expressCaller) {
        slot = keccak256(abi.encode(sourceChain, sourceAddress, contractAddress, payloadHash, symbol, amount));
        expressCaller = expressCallsWithToken[slot];
    }

    function _setExpressCallWithToken(bytes32 slot, address expressCaller) internal {
        expressCallsWithToken[slot] = expressCaller;
    }
}

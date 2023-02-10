// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IExpressProxy } from '../interfaces/IExpressProxy.sol';
import { IExpressRegistry } from '../interfaces/IExpressRegistry.sol';

contract ExpressRegistry is IExpressRegistry {
    IAxelarGateway public immutable gateway;
    bytes32 public immutable proxyCodeHash;

    mapping(bytes32 => address) private expressCallsWithToken;

    constructor(address gateway_, address proxy_) {
        if (gateway_ == address(0)) revert InvalidGateway();

        gateway = IAxelarGateway(gateway_);
        proxyCodeHash = proxy_.codehash;
    }

    function registerExpressCallWithToken(
        address expressCaller,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash,
        string calldata tokenSymbol,
        uint256 amount
    ) external {
        _onlyProxy();

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
    }

    function processExecuteWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external {
        _onlyProxy();

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
                msg.sender,
                payloadHash,
                tokenSymbol,
                amount
            ) && expressCaller != address(0)
        ) _setExpressCallWithToken(slot, address(0));

        IExpressProxy(msg.sender).completeExecuteWithToken(
            expressCaller,
            commandId,
            sourceChain,
            sourceAddress,
            payload,
            tokenSymbol,
            amount
        );
    }

    /// @notice internal function instead of a modifier to avoid stack too deep error
    function _onlyProxy() internal view {
        address proxyRegistry = address(IExpressProxy(msg.sender).registry());

        if (msg.sender.codehash != proxyCodeHash || proxyRegistry != address(this)) revert NotExpressProxy();
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

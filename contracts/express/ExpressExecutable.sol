// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { IExpressExecutable } from '../interfaces/IExpressExecutable.sol';

abstract contract ExpressExecutable is IExpressExecutable {
    IAxelarGateway public immutable gateway;

    constructor(address gateway_) {
        if (gateway_ == address(0)) revert InvalidAddress();

        gateway = IAxelarGateway(gateway_);
    }

    function acceptExpressCallWithToken(
        address, /*caller*/
        string calldata, /*sourceChain*/
        string calldata, /*sourceAddress*/
        bytes32, /*payloadHash*/
        string calldata, /*tokenSymbol*/
        uint256 /*amount*/
    ) external virtual returns (bool) {
        return true;
    }

    /// @notice this function is shadowed by the proxy and can be called only internally
    function execute(
        bytes32,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external {
        _execute(sourceChain, sourceAddress, payload);
    }

    /// @notice this function is shadowed by the proxy and can be called only internally
    function executeWithToken(
        bytes32,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external {
        _executeWithToken(sourceChain, sourceAddress, payload, tokenSymbol, amount);
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

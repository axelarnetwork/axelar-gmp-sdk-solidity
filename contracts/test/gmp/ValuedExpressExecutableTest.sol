// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarValuedExpressExecutableWithToken } from '../../express/AxelarValuedExpressExecutableWithToken.sol';

contract AxelarValuedExpressExecutableTest is AxelarValuedExpressExecutableWithToken {
    event Executed(bytes32 commandId, string sourceChain, string sourceAddress, bytes payload);
    event ExecutedWithToken(
        bytes32 commandId,
        string sourceChain,
        string sourceAddress,
        bytes payload,
        string symbol,
        uint256 amount
    );

    uint256 public callValue;
    uint256 public callWithTokenValue;
    address public expressToken;

    constructor(address gateway_) AxelarValuedExpressExecutableWithToken(gateway_) {}

    function setExpressToken(address expressToken_) external {
        expressToken = expressToken_;
    }

    function setCallValue(uint256 callValue_) external {
        callValue = callValue_;
    }

    // Returns the amount of token (corresponding to `tokenAddress`) that this call is worth. If `tokenAddress` is address(0), then amount is in terms of the native token.
    function contractCallValue(
        string calldata, /*sourceChain*/
        string calldata, /*sourceAddress*/
        bytes calldata /*payload*/
    ) public view override returns (address tokenAddress, uint256 value) {
        value = callValue;
        tokenAddress = expressToken;
    }

    // Returns the amount of token (corresponding to `tokenAddress`) that this call is worth. If `tokenAddress` is address(0), then amount is in terms of the native token.
    function contractCallWithTokenValue(
        string calldata, /*sourceChain*/
        string calldata, /*sourceAddress*/
        bytes calldata, /*payload*/
        string calldata, /*symbol*/
        uint256 /*amount*/
    ) public view override returns (address tokenAddress, uint256 value) {
        value = callValue;
        tokenAddress = expressToken;
    }

    function _execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        emit Executed(commandId, sourceChain, sourceAddress, payload);
    }

    function _executeWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) internal override {
        emit ExecutedWithToken(commandId, sourceChain, sourceAddress, payload, symbol, amount);
    }
}

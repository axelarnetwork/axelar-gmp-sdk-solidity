// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarValuedExpressExecutable } from '../../express/AxelarValuedExpressExecutable.sol';

contract AxelarValuedExpressExecutableTest is AxelarValuedExpressExecutable {
    event Executed(string sourceChain, string sourceAddress, bytes payload);
    event ExecutedWithToken(string sourceChain, string sourceAddress, bytes payload, string symbol, uint256 amount);

    uint256 public callValue;
    uint256 public callWithTokenValue;
    address public expressToken;

    constructor(address gateway_) AxelarValuedExpressExecutable(gateway_) {}

    function setExpressToken(address expressToken_) external {
        expressToken = expressToken_;
    }

    function setCallValue(uint256 callValue_) external {
        callValue = callValue_;
    }

    // Returns the amount of native token that that this call is worth.
    function contractCallValue(
        string calldata, /*sourceChain*/
        string calldata, /*sourceAddress*/
        bytes calldata /*payload*/
    ) public view override returns (address tokenAddress, uint256 value) {
        value = callValue;
        tokenAddress = expressToken;
    }

    // Returns the amount of token that that this call is worth. If `native` is true then native token is used, otherwise the token specified by `symbol` is used.
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
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        emit Executed(sourceChain, sourceAddress, payload);
    }

    function _executeWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) internal override {
        emit ExecutedWithToken(sourceChain, sourceAddress, payload, symbol, amount);
    }
}

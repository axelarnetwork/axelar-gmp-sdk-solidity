// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarValuedExpressExecutable } from '../../express/AxelarValuedExpressExecutable.sol';

contract AxelarValuedExpressExecutableTest is AxelarValuedExpressExecutable {
    event ProcessedValueWithToken(
        string sourceChain,
        string sourceAddress,
        bytes payload,
        string symbol,
        address tokenAddress,
        uint256 amount
    );

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
        string calldata, /* sourceChain */
        string calldata, /* sourceAddress */
        bytes calldata payload
    ) public view override returns (address tokenAddress, uint256 value) {
        (tokenAddress, value) = _decodeTokenValue(payload);
    }

    // Returns the amount of token that that this call is worth. If `native` is true then native token is used, otherwise the token specified by `symbol` is used.
    function contractCallWithTokenValue(
        string calldata, /* sourceChain */
        string calldata, /* sourceAddress */
        bytes calldata payload,
        string calldata, /* symbol */
        uint256 /* amount */
    ) public view override returns (address tokenAddress, uint256 value) {
        (tokenAddress, value) = _decodeTokenValue(payload);
    }

    function _decodeTokenValue(
        bytes calldata /* payload */
    ) internal view override returns (address tokenAddress, uint256 value) {
        return (expressToken, callValue);
    }

    function _produceValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override returns (address tokenAddress, uint256 value) {}

    function _processValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        address tokenAddress,
        uint256 amount,
        string memory tokenSymbol
    ) internal override {
        emit ProcessedValueWithToken(sourceChain, sourceAddress, payload, tokenSymbol, tokenAddress, amount);
    }
}

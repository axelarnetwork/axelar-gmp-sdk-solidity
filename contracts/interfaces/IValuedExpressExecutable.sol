// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IExpressExecutable } from './IExpressExecutable.sol';

interface IValuedExpressExecutable is IExpressExecutable {
    function contractCallValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external view returns (address tokenAddress, uint256 value);

    // Returns the amount of token that that this call is worth. If `native` is true then native token is used, otherwise the token specified by `symbol` is used.
    function contractCallWithTokenValue(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external view returns (address tokenAddress, uint256 value);
}

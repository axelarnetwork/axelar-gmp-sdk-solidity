// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import { ExpressExecutable } from '../express/ExpressExecutable.sol';

// This should be owned by the microservice that is paying for gas.
contract ExpressExecutableTest is ExpressExecutable {
    uint256 public immutable callValue;
    uint256 public immutable callWithTokenValue;
    address public immutable expressToken;

    constructor(
        address gateway_,
        address expressToken_,
        uint256 callValue_,
        uint256 callWithTokenValue_
    ) ExpressExecutable(gateway_) {
        callValue = callValue_;
        callWithTokenValue = callWithTokenValue_;
        expressToken = expressToken_;
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
        value = callWithTokenValue;
        tokenAddress = expressToken;
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import { ExpressExecutable } from '../../express/ExpressExecutable.sol';

// This should be owned by the microservice that is paying for gas.
contract ExpressExecutableTest is ExpressExecutable {
    event Executed(string sourceChain, string sourceAddress, bytes payload);
    event ExecutedWithToken(string sourceChain, string sourceAddress, bytes payload, string symbol, uint256 amount);

    constructor(address gateway_) ExpressExecutable(gateway_) {}

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

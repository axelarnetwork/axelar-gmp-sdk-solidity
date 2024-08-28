// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarExpressExecutable } from '../../express/AxelarExpressExecutable.sol';
import { IAxelarGMPGateway } from '../../interfaces/IAxelarGMPGateway.sol';

contract AxelarExpressExecutableTest is AxelarExpressExecutable {
    event Executed(bytes32 commandId, string sourceChain, string sourceAddress, bytes payload);
    event ExecutedWithToken(
        bytes32 commandId,
        string sourceChain,
        string sourceAddress,
        bytes payload,
        string symbol,
        uint256 amount
    );

    constructor(address gateway_) AxelarExpressExecutable(gateway_) {}

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

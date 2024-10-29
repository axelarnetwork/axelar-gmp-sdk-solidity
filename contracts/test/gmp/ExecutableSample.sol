// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarExpressExecutableWithToken } from '../../express/AxelarExpressExecutableWithToken.sol';

contract ExecutableSample is AxelarExpressExecutableWithToken {
    string public value;
    string public sourceChain;
    string public sourceAddress;

    event Executed(bytes32 commandId, string sourceChain, string sourceAddress, bytes payload);
    event ExecutedWithToken(
        bytes32 commandId,
        string sourceChain,
        string sourceAddress,
        bytes payload,
        string symbol,
        uint256 amount
    );

    constructor(address gateway_) AxelarExpressExecutableWithToken(gateway_) {}

    // Call this function to update the value of this contract along with all its siblings'.
    function setRemoteValue(
        string calldata destinationChain,
        string calldata destinationAddress,
        string calldata value_
    ) external payable {
        bytes memory payload = abi.encode(value_);

        gatewayWithToken().callContract(destinationChain, destinationAddress, payload);
    }

    // Handles calls created by setAndSend. Updates this contract's value
    function _execute(
        bytes32 commandId_,
        string calldata sourceChain_,
        string calldata sourceAddress_,
        bytes calldata payload_
    ) internal override {
        (value) = abi.decode(payload_, (string));
        sourceChain = sourceChain_;
        sourceAddress = sourceAddress_;
        emit Executed(commandId_, sourceChain, sourceAddress, payload_);
    }

    function _executeWithToken(
        bytes32 commandId_,
        string calldata sourceChain_,
        string calldata sourceAddress_,
        bytes calldata payload_,
        string calldata tokenSymbol_,
        uint256 amount_
    ) internal override {
        emit ExecutedWithToken(commandId_, sourceChain_, sourceAddress_, payload_, tokenSymbol_, amount_);
    }
}

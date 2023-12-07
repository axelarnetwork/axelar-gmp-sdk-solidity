// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGmpGateway } from '../interfaces/IAxelarGmpGateway.sol';
import { IAxelarGmpExecutable } from '../interfaces/IAxelarGmpExecutable.sol';

contract AxelarGmpExecutable is IAxelarGmpExecutable {
    IAxelarGmpGateway public immutable gateway;

    constructor(address gateway_) {
        if (gateway_ == address(0)) revert InvalidAddress();

        gateway = IAxelarGmpGateway(gateway_);
    }

    function execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external {
        bytes32 payloadHash = keccak256(payload);

        if (!gateway.validateContractCall(commandId, sourceChain, sourceAddress, payloadHash))
            revert NotApprovedByGateway();

        _execute(sourceChain, sourceAddress, payload);
    }

    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal virtual {}
}

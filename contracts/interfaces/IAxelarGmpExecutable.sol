// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGmpGateway } from './IAxelarGmpGateway.sol';

interface IAxelarGmpExecutable {
    error InvalidAddress();
    error NotApprovedByGateway();

    function gateway() external view returns (IAxelarGmpGateway);

    function execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external;
}

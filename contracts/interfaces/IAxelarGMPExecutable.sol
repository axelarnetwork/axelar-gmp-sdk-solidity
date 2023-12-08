// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGMPGateway } from './IAxelarGMPGateway.sol';

interface IAxelarGMPExecutable {
    error InvalidAddress();
    error NotApprovedByGateway();

    function gateway() external view returns (IAxelarGMPGateway);

    function execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external;
}

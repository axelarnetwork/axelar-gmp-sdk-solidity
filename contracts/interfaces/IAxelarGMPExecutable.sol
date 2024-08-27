// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGMPGateway } from './IAxelarGMPGateway.sol';
import { IAxelarGMPExecutableBase } from './IAxelarGMPExecutableBase.sol';

/**
 * @title IAxelarGMPExecutable
 * @dev Interface for a contract that is executable by Axelar Gateway's cross-chain message passing.
 * It defines a standard interface to execute commands sent from another chain.
 */
interface IAxelarGMPExecutable is IAxelarGMPExecutableBase {
    /**
     * @notice Returns the address of the AxelarGMPGateway contract.
     * @return The Axelar GMP Gateway contract associated with this executable contract.
     */
    function gateway() external view returns (IAxelarGMPGateway);
}

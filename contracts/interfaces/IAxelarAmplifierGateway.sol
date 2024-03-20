// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGMPGateway } from './IAxelarGMPGateway.sol';

/**
 * @title IAxelarAmplifierGateway
 * @dev Interface for the Axelar Gateway that supports general message passing and contract call execution.
 */
interface IAxelarAmplifierGateway is IAxelarGMPGateway {
    /**
     * @notice Emitted when operatorship is transferred to a new set.
     * @dev Logs the transfer of operatorship to a new set of operators.
     * @param newOperatorsData The encoded new operators.
     */
    event OperatorshipTransferred(bytes newOperatorsData);
}

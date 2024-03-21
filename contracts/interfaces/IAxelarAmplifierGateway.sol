// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGMPGateway } from './IAxelarGMPGateway.sol';

/**
 * @title IAxelarAmplifierGateway
 * @dev Interface for the Axelar Gateway that supports general message passing and contract call execution.
 */
interface IAxelarAmplifierGateway is IAxelarGMPGateway {
    /**********\
    |* Errors *|
    \**********/

    error InvalidAuthModule();
    error NotSelf();
    error InvalidChainId();
    error InvalidCommands();
    error InvalidCommand(bytes32 commandHash);

    /**
     * @notice Emitted when operatorship is transferred to a new set.
     * @dev Logs the transfer of operatorship to a new set of operators.
     * @param newOperatorsData The encoded new operators.
     */
    event OperatorshipTransferred(bytes newOperatorsData);

    /**
     * @notice Executes a signed batch of commands created by verifiers on Axelar.
     * @param  batch The signed batch.
     */
    function execute(bytes calldata batch) external;
}

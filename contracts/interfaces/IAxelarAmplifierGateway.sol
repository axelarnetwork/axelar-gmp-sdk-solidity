// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IBaseAmplifierGateway } from './IBaseAmplifierGateway.sol';

import { WeightedSigners, Proof } from '../types/WeightedMultisigTypes.sol';
import { Message } from '../types/AmplifierGatewayTypes.sol';

/**
 * @title IAxelarAmplifierGateway
 * @dev Interface for the Axelar Gateway that supports general message passing and contract call execution.
 */
interface IAxelarAmplifierGateway is IBaseAmplifierGateway {
    error NotLatestSigners();

    /**
     * @notice Approves an array of messages, signed by the Axelar signers.
     * @param  messages The array of messages to verify.
     * @param  proof The proof signed by the Axelar signers for this command.
     */
    function approveMessages(Message[] calldata messages, Proof calldata proof) external;

    /**
     * @notice Update the signer data for the auth module, signed by the Axelar signers.
     * @param  newSigners The data for the new signers.
     * @param  proof The proof signed by the Axelar signers for this command.
     */
    function rotateSigners(WeightedSigners calldata newSigners, Proof calldata proof) external;
}

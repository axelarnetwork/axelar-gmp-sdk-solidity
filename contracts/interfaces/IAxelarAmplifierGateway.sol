// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IBaseAmplifierGateway } from './IBaseAmplifierGateway.sol';
import { IBaseWeightedMultisig } from './IBaseWeightedMultisig.sol';
import { IUpgradable } from './IUpgradable.sol';

import { WeightedSigners, Proof } from '../types/WeightedMultisigTypes.sol';
import { Message } from '../types/AmplifierGatewayTypes.sol';

/**
 * @title IAxelarAmplifierGateway
 * @dev Interface for the Axelar Gateway that supports general message passing.
 */
interface IAxelarAmplifierGateway is IBaseAmplifierGateway, IBaseWeightedMultisig, IUpgradable {
    error NotLatestSigners();
    error InvalidSender(address sender);

    event OperatorshipTransferred(address newOperator);

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
    function rotateSigners(WeightedSigners memory newSigners, Proof calldata proof) external;

    /**
     * @notice This function takes dataHash and proof and reverts if proof is invalid
     * @param dataHash The hash of the data being signed
     * @param proof The proof from Axelar signers
     * @return isLatestSigners True if provided signers are the current ones
     */
    function validateProof(bytes32 dataHash, Proof calldata proof) external view returns (bool isLatestSigners);

    /**
     * @notice Returns the address of the gateway operator.
     * @return The address of the operator.
     */
    function operator() external view returns (address);

    /**
     * @notice Transfer the operatorship to a new address.
     * @param newOperator The address of the new operator.
     */
    function transferOperatorship(address newOperator) external;
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IBaseWeightedMultisig } from './IBaseWeightedMultisig.sol';
import { ICaller } from './ICaller.sol';

/**
 * @title IMultisig Interface
 * @notice This interface extends IMultisigBase by adding an execute function for multisignature transactions.
 */
interface IInterchainMultisig is ICaller, IBaseWeightedMultisig {
    error InvalidProof();
    error AlreadyExecuted();

    struct InterCall {
        bytes32 chainNameHash;
        address target;
        bytes callData;
        uint256 nativeValue;
    }

    /**
     * @notice Executes an external contract call.
     * @notice This function is protected by the onlySigners requirement.
     * @dev Calls a target address with specified calldata and passing provided native value.
     * @param batch The batch of calls to execute
     * @param weightedSigners The weighted signers data
     * @param signatures The signatures data
     */
    function executeCalls(
        bytes calldata batch,
        bytes calldata weightedSigners,
        bytes[] calldata signatures
    ) external payable;

    /**
     * @notice Rotates the signers of the multisig
     * @param newSignersData The data to be passed to the rotateSigners function
     * @param weightedSigners The weighted signers data
     * @param signatures The signatures data
     * @dev This function is only callable by the contract itself after passing according proposal
     */
    function rotateSigners(
        bytes calldata newSignersData,
        bytes calldata weightedSigners,
        bytes[] calldata signatures
    ) external;

    /**
     * @notice Withdraws native token from the contract
     * @param transferData The data to be passed to the transfer function
     * @param weightedSigners The weighted signers data
     * @param signatures The signatures data
     * @dev This function is only callable by the contract itself after passing according proposal
     */
    function withdraw(
        bytes calldata transferData,
        bytes calldata weightedSigners,
        bytes[] calldata signatures
    ) external payable;
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IBaseWeightedMultisig } from './IBaseWeightedMultisig.sol';
import { ICaller } from './ICaller.sol';

/**
 * @title IMultisig Interface
 * @notice This interface extends IMultisigBase by adding an execute function for multisignature transactions.
 */
interface IInterchainMultisig is ICaller, IBaseWeightedMultisig {
    error NotSelf();
    error InvalidProof();
    error AlreadyExecuted();
    error InvalidPayloadType();
    error InvalidChainNameHash();
    error InvalidTarget();
    error InvalidRecipient();

    struct Call {
        string chainName;
        address executor;
        address target;
        bytes callData;
        uint256 nativeValue;
    }

    event BatchExecuted(bytes32 indexed messageHash, bytes32 indexed salt, uint256 indexed length);

    event CallExecuted(bytes32 indexed messageHash, address indexed target, bytes callData, uint256 nativeValue);

    /**
     * @notice Checks if a payload has been executed
     * @param payloadHash The hash of the payload payload
     * @return True if the payload has been executed
     */
    function isPayloadExecuted(bytes32 payloadHash) external view returns (bool);

    /**
     * @notice Executes an external contract call.
     * @notice This function is protected by the onlySigners requirement.
     * @dev Calls a target address with specified calldata and passing provided native value.
     * @param batch The batch of calls to execute
     * @param weightedSigners The weighted signers payload
     * @param signatures The signatures payload
     */
    function executeCalls(
        bytes calldata batch,
        bytes calldata weightedSigners,
        bytes[] calldata signatures
    ) external payable;
}

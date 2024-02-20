// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IBaseWeightedMultisig } from './IBaseWeightedMultisig.sol';
import { ICaller } from './ICaller.sol';

/**
 * @title IMultisig Interface
 * @notice This interface extends IMultisigBase by adding an execute function for multisignature transactions.
 */
interface IInterchainMultisig is ICaller, IBaseWeightedMultisig {
    error InvalidChainName();
    error NotSelf();
    error AlreadyExecuted();
    error InvalidPayloadType();
    error InvalidChainNameHash();
    error InvalidTarget();
    error InvalidVoidBatch();
    error EmptyBatch();
    error InvalidRecipient();

    struct Call {
        string chainName;
        address executor;
        address target;
        bytes callData;
        uint256 nativeValue;
    }

    event BatchExecuted(bytes32 indexed batchId, bytes32 indexed messageHash, uint256 indexed length);

    event CallExecuted(bytes32 indexed batchId, address indexed target, bytes callData, uint256 nativeValue);

    /**
     * @notice Checks if a payload has been executed
     * @param batchHash The hash of the payload payload
     * @return True if the payload has been executed
     */
    function isBatchExecuted(bytes32 batchHash) external view returns (bool);

    /**
     * @notice Executes an external contract call.
     * @notice This function is protected by the onlySigners requirement.
     * @dev Calls a target address with specified calldata and passing provided native value.
     * @param batchId The batchId of the multisig
     * @param calls The batch of calls to execute
     * @param proof The multisig proof data
     */
    function executeCalls(
        bytes32 batchId,
        Call[] calldata calls,
        bytes calldata proof
    ) external payable;
}

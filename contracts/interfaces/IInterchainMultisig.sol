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

    event BatchExecuted(
        bytes32 indexed batchId,
        bytes32 indexed batchHash,
        uint256 callsExecuted,
        uint256 indexed batchLength
    );

    event CallExecuted(bytes32 indexed batchId, address indexed target, bytes callData, uint256 nativeValue);

    /**
     * @notice Returns the hash of the chain name
     * @return The hash of the chain name
     */
    function chainNameHash() external view returns (bytes32);

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

    /**
     * @notice Rotates the signers of the multisig
     * @notice This function is protected by the onlySelf modifier.
     * @param newWeightedSigners The new weighted signers encoded as bytes
     * @dev This function is only callable by the contract itself after signature verification
     */
    function rotateSigners(WeightedSigners memory newWeightedSigners) external;

    /**
     * @notice Withdraws native token from the contract.
     * @notice This function is protected by the onlySelf modifier.
     * @param recipient The recipient of the native value
     * @param amount The amount of native value to withdraw
     * @dev This function is only callable by the contract itself after signature verification
     */
    function withdraw(address recipient, uint256 amount) external;

    /**
     * @notice This function can be used to void a batch id from being executed in the future. This can be helpful to void an already signed but not yet executed batch.
     * @notice This function is protected by the onlySelf modifier.
     * @dev This function is only callable by the contract itself after signature verification
     */
    function noop() external view;
}

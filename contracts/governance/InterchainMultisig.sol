// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IInterchainMultisig } from '../interfaces/IInterchainMultisig.sol';

import { SafeNativeTransfer } from '../libs/SafeNativeTransfer.sol';
import { Caller } from '../utils/Caller.sol';
import { BaseWeightedMultisig } from './BaseWeightedMultisig.sol';
import { Proof, WeightedSigners } from '../types/WeightedMultisigTypes.sol';

/**
 * @title InterchainMultisig Contract
 * @notice Weighted Multisig executor to call functions on any contract
 */
contract InterchainMultisig is Caller, BaseWeightedMultisig, IInterchainMultisig {
    // keccak256('InterchainMultisig.Slot') - 1
    bytes32 internal constant INTERCHAIN_MULTISIG_SLOT =
        0xee4c79745c2938ff2a269d76f8921d82df3b09446024c758a2e0e593fb2a65a7;

    using SafeNativeTransfer for address;

    bytes32 public immutable chainNameHash;

    struct InterchainMultisigStorage {
        mapping(bytes32 => bool) isBatchExecuted;
    }

    /**
     * @notice Contract constructor
     * @dev Sets the initial list of signers and corresponding threshold.
     * @param chainName The name of the chain
     * @param signers The weighted signers payload
     */
    constructor(
        string memory chainName,
        bytes32 domainSeparator_,
        WeightedSigners memory signers
    ) BaseWeightedMultisig(0, domainSeparator_, 0) {
        if (bytes(chainName).length == 0) revert InvalidChainName();

        chainNameHash = keccak256(bytes(chainName));

        _rotateSigners(signers, false);
    }

    modifier onlySelf() {
        if (msg.sender != address(this)) revert NotSelf();

        _;
    }

    /**
     * @notice Checks if a payload has been executed
     * @param batchId The hash of the payload payload
     * @return True if the payload has been executed
     */
    function isBatchExecuted(bytes32 batchId) external view returns (bool) {
        return _interchainMultisigStorage().isBatchExecuted[batchId];
    }

    /**
     * @notice Executes an external contract call.
     * @notice This function is protected by the onlySigners requirement.
     * @dev Executes a batch of calls with specified target addresses, calldata and native value.
     * @param batchId The batchId of the multisig
     * @param calls The batch of calls to execute
     * @param proof The multisig proof data
     * @dev The proof data should have signers, weights, threshold and signatures encoded
     * @dev The signers and signatures should be sorted by signer address in ascending order
     */
    function executeCalls(
        bytes32 batchId,
        Call[] calldata calls,
        Proof calldata proof
    ) external payable {
        InterchainMultisigStorage storage slot = _interchainMultisigStorage();
        bytes32 batchHash = keccak256(abi.encode(batchId, calls));
        uint256 callsLength = calls.length;

        _validateProof(batchHash, proof);

        if (slot.isBatchExecuted[batchId]) revert AlreadyExecuted();
        slot.isBatchExecuted[batchId] = true;

        uint256 callsExecuted = 0;

        for (uint256 i; i < callsLength; ++i) {
            Call calldata call = calls[i];

            // check if the call is for this contract and chain
            if (keccak256(bytes(call.chainName)) == chainNameHash && call.executor == address(this)) {
                // slither-disable-next-line reentrancy-events
                emit CallExecuted(batchId, call.target, call.callData, call.nativeValue);

                _call(call.target, call.callData, call.nativeValue);

                ++callsExecuted;
            }
        }

        if (callsExecuted == 0) revert EmptyBatch();

        emit BatchExecuted(batchId, batchHash, callsExecuted, callsLength);
    }

    /**
     * @notice This function takes dataHash and proof data and reverts if proof is invalid
     * @param dataHash The hash of the message that was signed
     * @param proof The data containing signers with signatures
     * @return isLatestSigners True if provided signers are the current ones
     */
    function validateProof(bytes32 dataHash, Proof calldata proof) external view returns (bool isLatestSigners) {
        return _validateProof(dataHash, proof);
    }

    /**
     * @notice Rotates the signers of the multisig
     * @notice This function is protected by the onlySelf modifier.
     * @param newSigners The new weighted signers encoded as bytes
     * @dev This function is only callable by the contract itself after signature verification
     */
    function rotateSigners(WeightedSigners memory newSigners) external onlySelf {
        _rotateSigners(newSigners, false);
    }

    /**
     * @notice Withdraws native token from the contract.
     * @notice This function is protected by the onlySelf modifier.
     * @param recipient The recipient of the native value
     * @param amount The amount of native value to withdraw
     * @dev This function is only callable by the contract itself after signature verification
     */
    function withdraw(address recipient, uint256 amount) external onlySelf {
        if (recipient == address(0)) revert InvalidRecipient();

        if (amount > address(this).balance) revert InsufficientBalance();

        recipient.safeNativeTransfer(amount);
    }

    /**
     * @notice This function can be used to void a batch id from being executed in the future. This can be helpful to void an already signed but not yet executed batch.
     * @notice This function is protected by the onlySelf modifier.
     * @dev This function is only callable by the contract itself after signature verification
     */
    function noop() external view onlySelf {}

    /**
     * @notice Allow contract to be able to receive native value
     */
    receive() external payable {}

    /**
     * @notice Get the storage slot for the InterchainMultisigStorage struct
     */
    function _interchainMultisigStorage() private pure returns (InterchainMultisigStorage storage slot) {
        assembly {
            slot.slot := INTERCHAIN_MULTISIG_SLOT
        }
    }
}

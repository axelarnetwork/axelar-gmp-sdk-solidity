// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IInterchainMultisig } from '../interfaces/IInterchainMultisig.sol';
import { SafeNativeTransfer } from '../libs/SafeNativeTransfer.sol';
import { ECDSA } from '../libs/ECDSA.sol';
import { Caller } from '../utils/Caller.sol';
import { BaseWeightedMultisig } from './BaseWeightedMultisig.sol';

/**
 * @title InterchainMultisig Contract
 * @notice Weighted Multisig executor to call functions on any contract
 */
contract InterchainMultisig is Caller, BaseWeightedMultisig, IInterchainMultisig {
    // keccak256('InterchainMultisig.Storage')
    bytes32 private constant INTERCHAIN_MULTISIG_STORAGE =
        0x5a9dc2248a56f285e6221da431581a5990380ebfa07727563571b2be1517a23e;

    using SafeNativeTransfer for address;

    bytes32 public immutable chainNameHash;

    struct InterchainMultisigStorage {
        mapping(bytes32 => bool) isPayloadExecuted;
    }

    /**
     * @notice Contract constructor
     * @dev Sets the initial list of signers and corresponding threshold.
     * @param chainName The name of the chain
     * @param weightedSigners The weighted signers payload
     */
    constructor(string memory chainName, WeightedSigners memory weightedSigners) BaseWeightedMultisig(0) {
        chainNameHash = keccak256(bytes(chainName));

        _rotateSigners(weightedSigners);
    }

    modifier onlySelf() {
        if (msg.sender != address(this)) revert NotSelf();

        _;
    }

    /**
     * @notice Checks if a payload has been executed
     * @param payloadHash The hash of the payload payload
     * @return True if the payload has been executed
     */
    function isPayloadExecuted(bytes32 payloadHash) external view returns (bool) {
        return _interchainMultisigStorage().isPayloadExecuted[payloadHash];
    }

    /**
     * @notice Executes an external contract call.
     * @notice This function is protected by the onlySigners requirement.
     * @dev Calls a target address with specified calldata and passing provided native value.
     * @param callBatch The batch of calls to execute
     * @param weightedSigners The weighted signers payload
     * @param signatures The signatures payload
     */
    function executeCalls(
        bytes calldata callBatch,
        bytes calldata weightedSigners,
        bytes[] calldata signatures
    ) external payable {
        bytes32 messageHash = ECDSA.toEthSignedMessageHash(keccak256(callBatch));
        validateProof(messageHash, weightedSigners, signatures);

        InterchainMultisigStorage storage slot = _interchainMultisigStorage();
        (
            bytes32 salt,
            Call[] memory calls
        ) = abi.decode(callBatch, (bytes32, Call[]));
        uint256 length = calls.length;

        emit BatchExecuted(messageHash, salt, length);

        if (slot.isPayloadExecuted[messageHash]) revert AlreadyExecuted();
        slot.isPayloadExecuted[messageHash] = true;

        for (uint256 i; i < length; ++i) {
            Call memory call = calls[i];

            // check if the call is for this contract and chain
            if (keccak256(bytes(call.chainName)) == chainNameHash && call.executor == address(this)) {
                if (call.target == address(0)) revert InvalidTarget();

                emit CallExecuted(messageHash, call.target, call.callData, call.nativeValue);

                _call(call.target, call.callData, call.nativeValue);
            }
        }
    }

    /**
     * @notice Rotates the signers of the multisig
     * @notice This function is protected by the onlySelf modifier.
     * @param newWeightedSigners The new weighted signers encoded as bytes
     * @dev This function is only callable by the contract itself after signature verification
     */
    function rotateSigners(WeightedSigners memory newWeightedSigners) external onlySelf {
        _rotateSigners(newWeightedSigners);
    }

    /**
     * @notice Withdraws native token from the contract.
     * @notice This function is protected by the onlySelf modifier.
     * @param recipient The recipient of the native value
     * @param amount The amount of native value to withdraw
     * @dev This function is only callable by the contract itself after signature verification
     */
    function withdraw(address recipient, uint256 amount) external payable onlySelf {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount > address(this).balance) revert InsufficientBalance();

        recipient.safeNativeTransfer(amount);
    }

    /**
     * @notice Allow contract to be able to receive native value
     */
    receive() external payable {}

    /**
     * @notice Get the storage slot for the InterchainMultisigStorage struct
     */
    function _interchainMultisigStorage() private pure returns (InterchainMultisigStorage storage slot) {
        assembly {
            slot.slot := INTERCHAIN_MULTISIG_STORAGE
        }
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IInterchainMultisig } from '../interfaces/IInterchainMultisig.sol';
import { BaseWeightedMultisig } from './BaseWeightedMultisig.sol';
import { SafeNativeTransfer } from '../libs/SafeNativeTransfer.sol';
import { Caller } from '../utils/Caller.sol';

/**
 * @title Multisig Contract
 * @notice An extension of MultisigBase that can call functions on any contract.
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
     * @param batch The batch of calls to execute
     * @param weightedSigners The weighted signers payload
     * @param signatures The signatures payload
     */
    function executeCalls(
        bytes calldata callBatch,
        bytes calldata weightedSigners,
        bytes[] calldata signatures
    ) external payable {
        bytes32 payloadHash = keccak256(batch);
        bool isLatestSigners = validateProof(payloadHash, weightedSigners, signatures);

        InterchainMultisigStorage storage slot = _interchainMultisigStorage();
        (
            ,
            /* bytes32 salt */
            InterCall[] memory calls
        ) = abi.decode(batch, (bytes32, InterCall[]));
        uint256 length = calls.length;

        if (slot.isPayloadExecuted[payloadHash]) revert AlreadyExecuted();
        slot.isPayloadExecuted[payloadHash] = true;

        for (uint256 i; i < length; ++i) {
            InterCall memory call = calls[i];
            // check if the call is for this contract and chain
            if (call.chainNameHash == chainNameHash && call.caller == address(this)) {
                bytes4 selector = abi.decode(call.callData, (bytes4));
                // check if the call is for signers rotation
                if (call.target == address(this) && selector == InterchainMultisig.rotateSigners.selector)
                    if (isLatestSigners)
                        // check if the call is from the latest signers and if so, mark them as not latest
                        isLatestSigners = false;
                        // or skip the call
                    else continue;

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
     * @notice Making contact able to receive native value
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

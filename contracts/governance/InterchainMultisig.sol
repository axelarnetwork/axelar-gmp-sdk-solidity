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
    bytes32 private constant INTERCHAIN_MULTISIG_INTERCHAINMULTISIGSTORAGE_LOCATION =
        0x5a9dc2248a56f285e6221da431581a5990380ebfa07727563571b2be1517a23e;

    using SafeNativeTransfer for address;

    bytes32 public immutable chainNameHash;

    enum PayloadType {
        ExecuteCalls,
        RotateSigners,
        Withdraw
    }

    struct InterchainMultisigStorage {
        mapping(bytes32 => bool) isPayloadExecuted;
    }

    /**
     * @notice Contract constructor
     * @dev Sets the initial list of signers and corresponding threshold.
     * @param chainName The name of the chain
     * @param weightedSigners The weighted signers payload
     */
    constructor(string memory chainName, bytes memory weightedSigners) {
        chainNameHash = keccak256(bytes(chainName));

        _rotateSigners(weightedSigners);
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
        bytes calldata batch,
        bytes calldata weightedSigners,
        bytes[] calldata signatures
    ) external payable {
        bytes32 payloadHash = keccak256(batch);
        _validateProof(payloadHash, weightedSigners, signatures);

        InterchainMultisigStorage storage $ = _interchainMultisigStorage();
        (
            PayloadType payloadType,
        /* bytes32 salt */
            ,
            InterCall[] memory calls
        ) = abi.decode(batch, (PayloadType, bytes32, InterCall[]));
        uint256 length = calls.length;

        if (payloadType != PayloadType.ExecuteCalls) revert InvalidPayloadType();
        if ($.isPayloadExecuted[payloadHash]) revert AlreadyExecuted();
        $.isPayloadExecuted[payloadHash] = true;

        for (uint256 i; i < length; ++i) {
            InterCall memory call = calls[i];
            if (call.chainNameHash == chainNameHash && call.caller == address(this))
                _call(call.target, call.callData, call.nativeValue);
        }
    }

    /**
     * @notice Rotates the signers of the multisig
     * @param newSignersPayload The payload to be passed to the rotateSigners function
     * @param weightedSigners The weighted signers payload
     * @param signatures The signatures payload
     * @dev This function is only callable by the contract itself after passing according proposal
     */
    function rotateSigners(
        bytes calldata newSignersPayload,
        bytes calldata weightedSigners,
        bytes[] calldata signatures
    ) external {
        bytes32 payloadHash = keccak256(newSignersPayload);
        bool isLatestSigners = _validateProof(payloadHash, weightedSigners, signatures);
        if (!isLatestSigners) revert InvalidProof();

        InterchainMultisigStorage storage $ = _interchainMultisigStorage();
        (
            PayloadType payloadType,
            /* bytes32 salt */
            ,
            bytes32 chainNameHash_,
            address target,
            bytes memory newWeightedSigners
        ) = abi.decode(newSignersPayload, (PayloadType, bytes32, bytes32, address, bytes));

        if (payloadType != PayloadType.RotateSigners) revert InvalidPayloadType();
        if (chainNameHash_ != chainNameHash) revert InvalidChainNameHash();
        if (target != address(this)) revert InvalidTarget();
        if ($.isPayloadExecuted[payloadHash]) revert AlreadyExecuted();
        $.isPayloadExecuted[payloadHash] = true;

        _rotateSigners(newWeightedSigners);
    }

    /**
     * @notice Withdraws native token from the contract.
     * @notice This function is protected by the onlySigners modifier.
     * @param transferPayload The payload for the transfer
     * @param weightedSigners The weighted signers payload
     * @param signatures The signatures payload
     * @dev This function is only callable by the contract itself after passing according proposal
     */
    function withdraw(
        bytes calldata transferPayload,
        bytes calldata weightedSigners,
        bytes[] calldata signatures
    ) external payable {
        bytes32 payloadHash = keccak256(transferPayload);
        _validateProof(keccak256(transferPayload), weightedSigners, signatures);

        InterchainMultisigStorage storage $ = _interchainMultisigStorage();
        (
            PayloadType payloadType,
        /* bytes32 salt */
            ,
            bytes32 chainNameHash_,
            address target,
            address recipient,
            uint256 amount
        ) = abi.decode(transferPayload, (PayloadType, bytes32, bytes32, address, address, uint256));

        if (payloadType != PayloadType.Withdraw) revert InvalidPayloadType();
        if (chainNameHash_ != chainNameHash) revert InvalidChainNameHash();
        if (target != address(this)) revert InvalidTarget();
        if ($.isPayloadExecuted[payloadHash]) revert AlreadyExecuted();
        $.isPayloadExecuted[payloadHash] = true;

        recipient.safeNativeTransfer(amount);
    }

    /**
     * @notice Making contact able to receive native value
     */
    receive() external payable {}

    /**
     * @notice Get the storage slot for the InterchainMultisigStorage struct
     */
    function _interchainMultisigStorage() private pure returns (InterchainMultisigStorage storage $) {
        assembly {
            $.slot := INTERCHAIN_MULTISIG_INTERCHAINMULTISIGSTORAGE_LOCATION
        }
    }
}

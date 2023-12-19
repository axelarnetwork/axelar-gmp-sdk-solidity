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

    struct InterchainMultisigStorage {
        mapping(bytes32 => bool) isCallExecuted;
    }

    /**
     * @notice Contract constructor
     * @dev Sets the initial list of signers and corresponding threshold.
     * @param chainName The name of the chain
     * @param weightedSigners The weighted signers data
     */
    constructor(string memory chainName, bytes memory weightedSigners) {
        chainNameHash = keccak256(bytes(chainName));

        _rotateSigners(weightedSigners);
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
    ) external payable {
        bytes32 dataHash = keccak256(batch);
        _validateProof(dataHash, weightedSigners, signatures);

        InterchainMultisigStorage storage $ = _interchainMultisigStorage();
        (
            ,
            /* bytes32 salt */
            InterCall[] memory calls
        ) = abi.decode(batch, (bytes32, InterCall[]));
        uint256 length = calls.length;

        if ($.isCallExecuted[dataHash]) revert AlreadyExecuted();
        $.isCallExecuted[dataHash] = true;

        for (uint256 i; i < length; ++i) {
            InterCall memory call = calls[i];
            if (call.chainNameHash == chainNameHash) _call(call.target, call.callData, call.nativeValue);
        }
    }

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
    ) external {
        bytes32 dataHash = keccak256(newSignersData);
        // if not the latest signers, revert
        if (!_validateProof(dataHash, weightedSigners, signatures)) revert InvalidProof();

        InterchainMultisigStorage storage $ = _interchainMultisigStorage();
        (
            ,
            /* bytes32 salt */
            bytes memory newWeightedSigners
        ) = abi.decode(newSignersData, (bytes32, bytes));

        if ($.isCallExecuted[dataHash]) revert AlreadyExecuted();
        $.isCallExecuted[dataHash] = true;

        _rotateSigners(newWeightedSigners);
    }

    /**
     * @notice Withdraws native token from the contract.
     * @notice This function is protected by the onlySigners modifier.
     * @param transferData The data for the transfer
     * @param weightedSigners The weighted signers data
     * @param signatures The signatures data
     * @dev This function is only callable by the contract itself after passing according proposal
     */
    function withdraw(
        bytes calldata transferData,
        bytes calldata weightedSigners,
        bytes[] calldata signatures
    ) external payable {
        bytes32 dataHash = keccak256(transferData);
        _validateProof(keccak256(transferData), weightedSigners, signatures);

        InterchainMultisigStorage storage $ = _interchainMultisigStorage();
        (
            ,
            /* bytes32 salt */
            address recipient,
            uint256 amount
        ) = abi.decode(transferData, (bytes32, address, uint256));

        if ($.isCallExecuted[dataHash]) revert AlreadyExecuted();
        $.isCallExecuted[dataHash] = true;

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

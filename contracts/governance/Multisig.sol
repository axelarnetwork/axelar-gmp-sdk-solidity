// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IMultisig } from '../interfaces/IMultisig.sol';
import { MultisigBase } from './MultisigBase.sol';
import { SafeNativeTransfer } from '../utils/SafeTransfer.sol';
import { Caller } from '../utils/Caller.sol';

/**
 * @title Multisig Contract
 * @notice An extension of MultisigBase that can call functions on any contract.
 */
contract Multisig is Caller, MultisigBase, IMultisig {
    using SafeNativeTransfer for address;

    /**
     * @notice Contract constructor
     * @dev Sets the initial list of signers and corresponding threshold.
     * @param accounts Address array of the signers
     * @param threshold Signature threshold required to validate a transaction
     */
    constructor(address[] memory accounts, uint256 threshold) MultisigBase(accounts, threshold) {}

    /**
     * @notice Executes an external contract call.
     * @dev Calls a target address with specified calldata and optionally sends value.
     * This function is protected by the onlySigners modifier.
     * @param target The address of the contract to call
     * @param callData The data encoding the function and arguments to call
     * @param nativeValue The amount of native currency (e.g., ETH) to send along with the call
     */
    function execute(
        address target,
        bytes calldata callData,
        uint256 nativeValue
    ) external payable onlySigners {
        _call(target, callData, nativeValue);
    }

    /**
     * @notice Withdraws native token from the contract
     * @param recipient The address to send the native token to
     * @param amount The amount of native token to send
     * @dev This function is only callable by the contract itself after passing according proposal
     */
    function withdraw(address recipient, uint256 amount) external onlySigners {
        recipient.safeNativeTransfer(amount);
    }

    /**
     * @notice Making contact able to receive native value
     */
    receive() external payable {}
}
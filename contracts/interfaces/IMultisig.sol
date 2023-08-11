// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IMultisigBase } from './IMultisigBase.sol';
import { ICaller } from './ICaller.sol';

/**
 * @title IMultisig Interface
 * @notice This interface extends IMultisigBase by adding an execute function for multisignature transactions.
 */
interface IMultisig is ICaller, IMultisigBase {
    /**
     * @notice Executes a function on an external target.
     * @param target The address of the target to call
     * @param callData The call data to be sent
     * @param nativeValue The native token value to be sent (e.g., ETH)
     */
    function execute(
        address target,
        bytes calldata callData,
        uint256 nativeValue
    ) external payable;

    /**
     * @notice Withdraws native token from the contract
     * @param recipient The address to send the native token to
     * @param amount The amount of native token to send
     * @dev This function is only callable by the contract itself after passing according proposal
     */
    function withdraw(address recipient, uint256 amount) external;
}

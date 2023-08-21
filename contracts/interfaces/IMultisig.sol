// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IBaseMultisig } from './IBaseMultisig.sol';
import { ICaller } from './ICaller.sol';
import { IContractExecutor } from './IContractExecutor.sol';

/**
 * @title IMultisig Interface
 * @notice This interface extends IMultisigBase by adding an execute function for multisignature transactions.
 */
interface IMultisig is ICaller, IContractExecutor, IBaseMultisig {
    /**
     * @notice Withdraws native token from the contract
     * @param recipient The address to send the native token to
     * @param amount The amount of native token to send
     * @dev This function is only callable by the contract itself after passing according proposal
     */
    function withdraw(address recipient, uint256 amount) external;
}

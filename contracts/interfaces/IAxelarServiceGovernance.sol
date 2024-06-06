// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IInterchainGovernance } from './IInterchainGovernance.sol';

/**
 * @title IAxelarServiceGovernance Interface
 * @dev This interface extends IInterchainGovernance and IMultisigBase for multisig proposal actions
 */
interface IAxelarServiceGovernance is IInterchainGovernance {
    error InvalidMultisigAddress();
    error NotApproved();
    error NotAuthorized();

    event MultisigApproved(
        bytes32 indexed proposalHash,
        address indexed targetContract,
        bytes callData,
        uint256 nativeValue
    );

    event MultisigCancelled(
        bytes32 indexed proposalHash,
        address indexed targetContract,
        bytes callData,
        uint256 nativeValue
    );

    event MultisigExecuted(
        bytes32 indexed proposalHash,
        address indexed targetContract,
        bytes callData,
        uint256 nativeValue
    );

    event MultisigTransferred(address indexed oldMultisig, address indexed newMultisig);

    /**
     * @notice Returns whether a multisig proposal has been approved
     * @param proposalHash The hash of the proposal
     * @return bool True if the proposal has been approved, False otherwise
     */
    function multisigApprovals(bytes32 proposalHash) external view returns (bool);

    /**
     * @notice Returns whether a multisig proposal has been approved
     * @param target The address of the contract targeted by the proposal
     * @param callData The call data to be sent to the target contract
     * @param nativeValue The amount of native tokens to be sent to the target contract
     * @return bool True if the proposal has been approved, False otherwise
     */
    function isMultisigProposalApproved(
        address target,
        bytes calldata callData,
        uint256 nativeValue
    ) external view returns (bool);

    /**
     * @notice Executes a multisig proposal
     * @param targetContract The target address the proposal will call
     * @param callData The data that encodes the function and arguments to call on the target contract
     */
    function executeMultisigProposal(
        address targetContract,
        bytes calldata callData,
        uint256 value
    ) external payable;

    /**
     * @notice Transfers the multisig address to a new address
     * @dev Only the current multisig or the governance can call this function
     * @param newMultisig The new multisig address
     */
    function transferMultisig(address newMultisig) external;
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IInterchainGovernance } from './IInterchainGovernance.sol';

/**
 * @title IAxelarServiceGovernance Interface
 * @dev This interface extends IInterchainGovernance for operator proposal actions
 */
interface IAxelarServiceGovernance is IInterchainGovernance {
    error InvalidOperator();
    error NotApproved();
    error NotAuthorized();

    event OperatorProposalApproved(
        bytes32 indexed proposalHash,
        address indexed targetContract,
        bytes callData,
        uint256 nativeValue
    );

    event OperatorProposalCancelled(
        bytes32 indexed proposalHash,
        address indexed targetContract,
        bytes callData,
        uint256 nativeValue
    );

    event OperatorProposalExecuted(
        bytes32 indexed proposalHash,
        address indexed targetContract,
        bytes callData,
        uint256 nativeValue
    );

    event OperatorshipTransferred(address indexed oldOperator, address indexed newOperator);

    /**
     * @notice Returns whether an operator proposal has been approved
     * @param proposalHash The hash of the proposal
     * @return bool True if the proposal has been approved, False otherwise
     */
    function operatorApprovals(bytes32 proposalHash) external view returns (bool);

    /**
     * @notice Returns whether an operator proposal has been approved
     * @param target The address of the contract targeted by the proposal
     * @param callData The call data to be sent to the target contract
     * @param nativeValue The amount of native tokens to be sent to the target contract
     * @return bool True if the proposal has been approved, False otherwise
     */
    function isOperatorProposalApproved(
        address target,
        bytes calldata callData,
        uint256 nativeValue
    ) external view returns (bool);

    /**
     * @notice Executes an operator proposal
     * @param targetContract The target address the proposal will call
     * @param callData The data that encodes the function and arguments to call on the target contract
     */
    function executeOperatorProposal(
        address targetContract,
        bytes calldata callData,
        uint256 value
    ) external payable;

    /**
     * @notice Transfers the operator address to a new address
     * @dev Only the current operator or the governance can call this function
     * @param newOperator The new operator address
     */
    function transferOperatorship(address newOperator) external;
}

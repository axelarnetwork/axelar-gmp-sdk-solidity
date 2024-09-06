// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarServiceGovernance } from '../interfaces/IAxelarServiceGovernance.sol';
import { InterchainGovernance } from './InterchainGovernance.sol';

/**
 * @title AxelarServiceGovernance Contract
 * @dev This contract is part of the Axelar Governance system, it inherits the Interchain Governance contract
 * with added functionality to approve and execute multisig proposals.
 */
contract AxelarServiceGovernance is InterchainGovernance, IAxelarServiceGovernance {
    enum ServiceGovernanceCommand {
        ScheduleTimeLockProposal,
        CancelTimeLockProposal,
        ApproveMultisigProposal,
        CancelMultisigApproval
    }

    address public operator;

    mapping(bytes32 => bool) public multisigApprovals;

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotAuthorized();
        _;
    }

    modifier onlyOperatorOrSelf() {
        if (msg.sender != operator && msg.sender != address(this)) revert NotAuthorized();
        _;
    }

    /**
     * @notice Initializes the contract.
     * @param gateway_ The address of the Axelar gateway contract
     * @param governanceChain_ The name of the governance chain
     * @param governanceAddress_ The address of the governance contract
     * @param minimumTimeDelay The minimum time delay for timelock operations
     * @param operator_ The operator address
     */
    constructor(
        address gateway_,
        string memory governanceChain_,
        string memory governanceAddress_,
        uint256 minimumTimeDelay,
        address operator_
    ) InterchainGovernance(gateway_, governanceChain_, governanceAddress_, minimumTimeDelay) {
        if (operator_ == address(0)) revert InvalidOperatorAddress();
        operator = operator_;
    }

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
    ) external view returns (bool) {
        return multisigApprovals[_getProposalHash(target, callData, nativeValue)];
    }

    /**
     * @notice Executes a multisig proposal.
     * @param target The target address the proposal will call
     * @param callData The data that encodes the function and arguments to call on the target contract
     * @param nativeValue The value of native token to be sent to the target contract
     */
    function executeMultisigProposal(
        address target,
        bytes calldata callData,
        uint256 nativeValue
    ) external payable onlyOperator {
        bytes32 proposalHash = _getProposalHash(target, callData, nativeValue);

        if (!multisigApprovals[proposalHash]) revert NotApproved();

        multisigApprovals[proposalHash] = false;

        emit MultisigExecuted(proposalHash, target, callData, nativeValue);

        _call(target, callData, nativeValue);
    }

    /**
     * @notice Transfers the operator address to a new address
     * @dev Only the current operator or the governance can call this function
     * @param newOperator The new operator address
     */
    function transferOperator(address newOperator) external onlyOperatorOrSelf {
        if (newOperator == address(0)) revert InvalidOperatorAddress();

        emit OperatorTransferred(operator, newOperator);

        operator = newOperator;
    }

    /**
     * @notice Internal function to process a governance command
     * @param commandType The type of the command
     * @param target The target address the proposal will call
     * @param callData The data the encodes the function and arguments to call on the target contract
     * @param nativeValue The value of native token to be sent to the target contract
     * @param eta The time after which the proposal can be executed
     */
    function _processCommand(
        uint256 commandType,
        address target,
        bytes memory callData,
        uint256 nativeValue,
        uint256 eta
    ) internal override {
        bytes32 proposalHash = _getProposalHash(target, callData, nativeValue);

        if (commandType == uint256(ServiceGovernanceCommand.ScheduleTimeLockProposal)) {
            eta = _scheduleTimeLock(proposalHash, eta);

            emit ProposalScheduled(proposalHash, target, callData, nativeValue, eta);
            return;
        } else if (commandType == uint256(ServiceGovernanceCommand.CancelTimeLockProposal)) {
            _cancelTimeLock(proposalHash);

            emit ProposalCancelled(proposalHash, target, callData, nativeValue, eta);
            return;
        } else if (commandType == uint256(ServiceGovernanceCommand.ApproveMultisigProposal)) {
            multisigApprovals[proposalHash] = true;

            emit MultisigApproved(proposalHash, target, callData, nativeValue);
            return;
        } else if (commandType == uint256(ServiceGovernanceCommand.CancelMultisigApproval)) {
            multisigApprovals[proposalHash] = false;

            emit MultisigCancelled(proposalHash, target, callData, nativeValue);
            return;
        } else {
            revert InvalidCommand();
        }
    }
}

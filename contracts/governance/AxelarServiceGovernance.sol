// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarServiceGovernance } from '../interfaces/IAxelarServiceGovernance.sol';
import { InterchainGovernance } from './InterchainGovernance.sol';
import { BaseMultisig } from './BaseMultisig.sol';

/**
 * @title AxelarServiceGovernance Contract
 * @dev This contract is part of the Axelar Governance system, it inherits the Interchain Governance contract
 * with added functionality to approve and execute multisig proposals.
 */
contract AxelarServiceGovernance is InterchainGovernance, BaseMultisig, IAxelarServiceGovernance {
    enum ServiceGovernanceCommand {
        ScheduleTimeLockProposal,
        CancelTimeLockProposal,
        ApproveMultisigProposal,
        CancelMultisigApproval
    }

    mapping(bytes32 => bool) public multisigApprovals;

    /**
     * @notice Initializes the contract.
     * @param gateway_ The address of the Axelar gateway contract
     * @param governanceChain_ The name of the governance chain
     * @param governanceAddress_ The address of the governance contract
     * @param minimumTimeDelay The minimum time delay for timelock operations
     * @param cosigners The list of initial signers
     * @param threshold The number of required signers to validate a transaction
     */
    constructor(
        address gateway_,
        string memory governanceChain_,
        string memory governanceAddress_,
        uint256 minimumTimeDelay,
        address[] memory cosigners,
        uint256 threshold
    )
        InterchainGovernance(gateway_, governanceChain_, governanceAddress_, minimumTimeDelay)
        BaseMultisig(cosigners, threshold) // can add batch events for cosigners
    {}

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
    ) external payable onlySigners {
        // have to execute multiple txs from each signer, can be cahnged to a sigle tx with multiple txs, look at Gnosis Safe contracts
        bytes32 proposalHash = _getProposalHash(target, callData, nativeValue);

        if (!multisigApprovals[proposalHash]) revert NotApproved();

        // We need to do this update because proposalhash need not be unique
        // In such cases previous transactions executed on the same chain or some other chain for the same set of signers in this epoch can be used to get false votes
        multisigApprovals[proposalHash] = false;

        emit MultisigExecuted(proposalHash, target, callData, nativeValue);

        _call(target, callData, nativeValue);
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

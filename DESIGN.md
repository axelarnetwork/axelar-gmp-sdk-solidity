# Design

This document covers design aspects of Axelar's Interchain Governance contracts.

## Axelar Governance

## Interchain Governance

The Interchain Governance Contract facilitates cross-chain governance actions within the Axelar network. It enables the creation, cancellation, and execution of governance proposals while incorporating a TimeLock mechanism. The TimeLock mechanism institutes a mandatory time delay before any proposal execution, thereby offering robust protection against sudden, potentially disruptive changes. This mechanism is used to govern upgrades of the Axelar Gateway contract.

### Timelock Mechanism

The TimeLock contract institutes a mechanism that guarantees the secure execution of functions after a designated time delay. This mechanism not only enables the scheduling, cancellation, and finalization of function calls, but it also enforces a minimum time delay before any function can be either scheduled or finalized, thereby enhancing the contract's security.

### Governance Operations

The TimeLock contract manages two types of governance operations: Proposal Scheduling and Proposal Cancellation.

- **Proposal Scheduling**: Facilitates the creation of new proposals. For each scheduled proposal, it sets a corresponding TimeLock that must expire before the proposal's execution.

- **Proposal Cancellation**: Facilitates the cancellation of an existing proposal by setting its corresponding TimeLock timestamp to zero and thereby blocking its execution.

Both operations require a match between the source chain and source address, and the governance chain and governance address in the contract. This check guarantees that only authorized entities can schedule or cancel actions.

### Secure Execution of Proposals

Once their corresponding TimeLock expires, proposals become executable. For ensured safety during execution, the contract revalidates the TimeLock right before initiating the proposal execution.

### Generating Proposal Hashes

The system ensures the uniqueness of each proposal by generating hashes with the Keccak256 algorithm. The hashes are derived from the target contract's address, encoded function call data, and the native token transfer value.

## Multisig

The Multisig contract maintains a list of signer accounts and enforces a threshold or minimum number of signers required to execute certain functions. It plays a pivotal role in defining token mint limits for the gateway.

### Voting Procedure

For each transaction, a voting process is initiated among the signers. Every time a signer casts a vote, the counter increases, and the action is recorded under the signer's address. Once the threshold is met, the transaction is carried out, and the voting counter is reset.

### Rotation of Signers

The Multisig contract facilitates a rotation mechanism for signers. Existing signers can refresh the list of signatory addresses and the threshold value using the `rotateSigners` function. Each rotation is tracked by incrementing an epoch.

### Execution of External Contracts

The Multisig contract's `execute` function allows signers to call any function on any external contract if the threshold number of signers trigger the method with the same args.

### Safeguards

The Multisig contract incorporates safeguards to deter misuse. These safeguards enforce preventive measures such as prohibiting multiple votes from the same account within an epoch, preventing signer duplication, and requiring transactions to meet the voting threshold before execution.

### Multisig Operations

Multisig operations demand multi-signatory authorization for proposal execution. A mapping mechanism tracks approvals for different proposals, requiring a proposal to garner sufficient approval to meet the predefined threshold before its execution.

## Axelar Service Governance

Building upon the Interchain Governance Contract, the Service Governance Contract is specifically designed to manage operations that require coordination. By incorporating `MultisigBase`, it introduces the functionality to approve, execute, and cancel multisig proposals, in addition to schedule and cancel TimeLock proposals. This is intended to be used as the owner for services such as the Interchain token service contract, allowing Axelar governance to manage it.

### Service Governance Operations

The contract orchestrates four governance operations:

- **Schedule TimeLock Proposal**: Similar to Interchain Governance, it schedules a new governance proposal with a TimeLock.

- **Cancel TimeLock Proposal**: Again, similar to Interchain Governance, it cancels an existing governance proposal.

- **Approve Multisig Proposal**: This function enables multisig proposal approval by setting the proposal's approval status to true. It resets any previous voting and signals successful approval via a MultisigApproved event.

- **Cancel Multisig Approval**: Cancels an approved multisig proposal, setting the approval status of the proposal to false and indicating successful cancellation through a `MultisigCancelled` event.

### Secure Execution of Multisig Proposals

Each time a new multisig proposal receives approval from governance, the multisig voting count is reset to 0. This ensures that any previous votes on similar proposals will not affect the new proposal. When a multisig proposal gathers the required number of signatory approvals, it becomes ready for execution. Before execution, the contract verifies the proposal's approval status. If the status is set to false, the transaction is reverted. Once executed successfully, the approval status of the proposal is reset, and a MultisigExecuted event gets emitted.

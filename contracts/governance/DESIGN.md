# Axelar Governance Protocol

The Axelar Governance Protocol is a cross-chain governance protocol that allows for the creation, cancellation, and execution of governance proposals. The protocol is implemented in the `InterchainGovernance` contract.

## Design Principles

The protocol is designed with security and decentralization in mind. Proposals are initiated and voted on the Axelar Network. If proposals are successfully voted on, the governance address can send execution commands to governance modules on different chains via General Message Passing (GMP). These commands are scheduled via a timelock mechanism to ensure that actions cannot be executed immediately after being proposed, giving participants time to react.

## Security Properties

The `InterchainGovernance` contract uses several security measures:

- **Timelock Mechanism**: This mechanism ensures that there's a delay between when a proposal is made and when it can be executed. This gives participants time to react.
- **Only Governance Modifier**: Only the governance contract can initiate proposals.
- **Only Self Modifier**: Some functions can only be called by the contract itself.
- **Safe Native Transfer**: The contract uses SafeNativeTransfer for transferring native tokens to prevent reentrancy attacks.

## Commands

There are two types of commands that can be sent to a governance module:

1. `ScheduleTimeLockProposal`: This command schedules a new proposal for future execution.
2. `CancelTimeLockProposal`: This command cancels an existing proposal.

These commands are processed by `_processCommand` function which takes as parameters: command type, target address, call data (function signature and parameters), native token value (if any), and ETA (the timestamp after which this proposal could be executed).

## Upgrading Gateway Contract

To upgrade gateway contracts on different chains, an upgrade calldata needs to be sent as part of a ScheduleTimeLockProposal command. The calldata should trigger an upgrade function in the target gateway contract.

## Withdrawing Funds

Funds can be withdrawn from this contract when it's targeted by its own withdraw function through ScheduleTimeLockProposal command with onlySelf modifier ensuring only this contract itself could call it.

## Implementation Details

When implementing this protocol in another smart-contract language or non-EVM platform:

1. Implement similar functionality as provided by Solidity such as hashing (`keccak256`), ABI encoding (`abi.encode`, `abi.encodePacked`) etc.
2. Implement equivalent modifiers like `onlyGovernance`, `onlySelf`.
3. Implement safe transfer methods for native tokens or assets.
4. Ensure proper handling of timestamps for scheduling timelocks.
5. Ensure proper access control mechanisms so only authorized entities could propose or cancel proposals.


In conclusion, while implementing Axelar Governance Protocol on non-EVM platforms might require some adjustments due to differences in languages or environments; core principles such as decentralized voting process, timelock mechanism for executing proposals should remain intact ensuring secure cross-chain governance operations across multiple blockchains within Axelar Network ecosystem.

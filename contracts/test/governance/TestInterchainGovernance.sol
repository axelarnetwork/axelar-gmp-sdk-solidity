// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { InterchainGovernance } from '../../governance/InterchainGovernance.sol';

/**
 * @dev This exists so Slither knows InterchainGovernance methods are being used.
 */
contract TestInterchainGovernance is InterchainGovernance {
    constructor(
        address gatewayAddress,
        string memory governanceChain_,
        string memory governanceAddress_,
        uint256 minimumTimeDelay
    ) InterchainGovernance(gatewayAddress, governanceChain_, governanceAddress_, minimumTimeDelay) {}

    function executeProposalAction(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external {
        _execute(commandId, sourceChain, sourceAddress, payload);
    }
}

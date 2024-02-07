// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IWeightedAuthModule } from '../interfaces/IWeightedAuthModule.sol';

import { BaseWeightedMultisig } from '../governance/BaseWeightedMultisig.sol';
import { Ownable } from '../utils/Ownable.sol';

/**
 * @title WeightedAuthModule Contract
 * @dev This contract is part of the Axelar Governance system, it inherits the BaseWeightedMultisig contract
 * with added functionality to approve and execute multisig proposals.
 */
contract WeightedAuthModule is Ownable, BaseWeightedMultisig, IWeightedAuthModule {
    // @notice The number of previous signers to authorize batches of commands
    uint256 public constant PREVIOUS_SIGNERS_RETENTION = 15;

    /**
     * @notice Initializes the contract.
     * @dev Ownership of this contract should be transferred to the Gateway contract after deployment.
     * @param recentOperatorSets The recent operator sets to be added to the multisig as initial signers
     */
    constructor(WeightedSigners[] memory recentOperatorSets) Ownable(msg.sender) BaseWeightedMultisig(PREVIOUS_SIGNERS_RETENTION) {
        uint256 length = recentOperatorSets.length;

        for (uint256 i; i < length; ++i) {
            _rotateSigners(recentOperatorSets[i]);
        }
    }

    /**
     * @notice Transfers operatorship to a new set of signers
     * @param params The new set of signers encoded as (address[], uint256[], uint256)
     */
    function transferOperatorship(bytes calldata params) external onlyOwner {
        WeightedSigners memory newSigners;

        (newSigners.signers, newSigners.weights, newSigners.threshold) = abi.decode(
            params,
            (address[], uint256[], uint256)
        );

        _rotateSigners(newSigners);
    }
}

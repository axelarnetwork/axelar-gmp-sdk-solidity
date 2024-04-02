// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGatewayWeightedAuth } from '../interfaces/IAxelarGatewayWeightedAuth.sol';

import { BaseWeightedMultisig } from '../governance/BaseWeightedMultisig.sol';
import { Ownable } from '../utils/Ownable.sol';

/**
 * @title AxelarGatewayWeightedAuth Contract
 * @dev This contract is used by the Axelar Gateway to verify signed commands. It inherits the BaseWeightedMultisig contract
 * with added functionality to approve and execute multisig proposals.
 */
contract AxelarGatewayWeightedAuth is Ownable, BaseWeightedMultisig, IAxelarGatewayWeightedAuth {
    // @notice The number of previous signers whose messages will be considered valid. This gives some time for signed messages to be relayed.
    uint256 public constant PREVIOUS_SIGNERS_RETENTION = 15;

    /**
     * @notice Initializes the contract.
     * @dev Ownership of this contract should be transferred to the Gateway contract after deployment.
     * @param initialSigners The recent operator sets to be added to the multisig as initial signers
     */
    constructor(address owner_, bytes[] memory initialSigners)
        Ownable(owner_)
        BaseWeightedMultisig(PREVIOUS_SIGNERS_RETENTION)
    {
        uint256 length = initialSigners.length;

        for (uint256 i; i < length; ++i) {
            // slither-disable-next-line uninitialized-local
            WeightedSigners memory signerSet;

            (signerSet.signers, signerSet.weights, signerSet.threshold) = abi.decode(
                initialSigners[i],
                (address[], uint256[], uint256)
            );

            _rotateSigners(signerSet);
        }
    }

    /**
     * @notice Rotate to a new set of signers
     * @param params The new set of signers encoded as (address[], uint256[], uint256)
     */
    function rotateSigners(bytes calldata params) external onlyOwner {
        // slither-disable-next-line uninitialized-local
        WeightedSigners memory newSigners;

        (newSigners.signers, newSigners.weights, newSigners.threshold) = abi.decode(
            params,
            (address[], uint256[], uint256)
        );

        _rotateSigners(newSigners);
    }
}

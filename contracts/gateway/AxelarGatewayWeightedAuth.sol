// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGatewayWeightedAuth } from '../interfaces/IAxelarGatewayWeightedAuth.sol';

import { BaseWeightedMultisig } from '../governance/BaseWeightedMultisig.sol';
import { Ownable } from '../utils/Ownable.sol';
import { WeightedSigners } from '../types/WeightedSigners.sol';

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
     * @param owner_ The owner of the contract
     * @param domainSeparator_ The domain separator for the signer proof
     * @param initialSigners The initial weighted signers to be added to the auth contract
     */
    constructor(
        address owner_,
        bytes32 domainSeparator_,
        bytes[] memory initialSigners
    ) Ownable(owner_) BaseWeightedMultisig(PREVIOUS_SIGNERS_RETENTION, domainSeparator_) {
        uint256 length = initialSigners.length;

        for (uint256 i; i < length; ++i) {
            WeightedSigners memory signers = abi.decode(initialSigners[i], (WeightedSigners));

            _rotateSigners(signers);
        }
    }

    /**
     * @notice Rotate to a new set of weighted signers
     * @param newSigners The ABI encoded WeightedSigners
     */
    function rotateSigners(bytes calldata newSigners) external onlyOwner {
        WeightedSigners memory signers = abi.decode(newSigners, (WeightedSigners));

        _rotateSigners(signers);
    }
}

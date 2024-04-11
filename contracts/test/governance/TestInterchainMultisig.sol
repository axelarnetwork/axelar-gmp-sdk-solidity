// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { InterchainMultisig } from '../../governance/InterchainMultisig.sol';
import { WeightedSigners } from '../../types/WeightedMultisigTypes.sol';

contract TestInterchainMultisig is InterchainMultisig {
    constructor(
        string memory chainName,
        bytes32 domainSeparator_,
        WeightedSigners memory weightedSigners
    ) InterchainMultisig(chainName, domainSeparator_, weightedSigners) {
        if (INTERCHAIN_MULTISIG_SLOT != bytes32(uint256(keccak256('InterchainMultisig.Slot')) - 1)) {
            revert('InterchainMultisig.Slot');
        }
    }
}

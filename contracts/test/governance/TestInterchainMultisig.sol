// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { InterchainMultisig } from '../../governance/InterchainMultisig.sol';

contract TestInterchainMultisig is InterchainMultisig {
    constructor(string memory chainName, WeightedSigners memory weightedSigners)
        InterchainMultisig(chainName, weightedSigners)
    {
        if (INTERCHAIN_MULTISIG_SLOT != keccak256('InterchainMultisig.Slot')) {
            revert('InterchainMultisig.Slot');
        }
    }
}

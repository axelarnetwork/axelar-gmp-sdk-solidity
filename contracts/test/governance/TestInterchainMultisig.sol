// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { InterchainMultisig } from '../../governance/InterchainMultisig.sol';

contract TestInterchainMultisig is InterchainMultisig {
    constructor(string memory chainName, WeightedSigners memory weightedSigners)
        InterchainMultisig(chainName, weightedSigners)
    {
        if (INTERCHAIN_MULTISIG_SLOT != bytes32(uint256(keccak256('InterchainMultisig.Slot')) - 1)) {
            revert('InterchainMultisig.Slot');
        }
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { BaseMultisig } from '../../governance/BaseMultisig.sol';

contract TestBaseMultisig is BaseMultisig {
    constructor(address[] memory accounts, uint256 threshold) BaseMultisig(accounts, threshold) {}

    function resetVotes(bytes32 topic) external {
        _resetSignerVotes(topic);
    }
}

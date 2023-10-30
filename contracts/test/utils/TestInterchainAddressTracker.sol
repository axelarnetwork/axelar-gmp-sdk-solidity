// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { InterchainAddressTracker } from '../../utils/InterchainAddressTracker.sol';

contract TestInterchainAddressTracker is InterchainAddressTracker {
    string public name = 'Test'; // Dummy var for a different bytecode

    error Invalid();

    constructor(string memory chainName_) InterchainAddressTracker(chainName_) {
        if (_CHAIN_NAME_SLOT != bytes32(uint256(keccak256('interchain-address-tracker-chain-name')) - 1))
            revert Invalid();
    }
}

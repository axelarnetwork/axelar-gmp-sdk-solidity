// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Ownable } from '../../utils/Ownable.sol';
import { InterchainAddressTracker } from '../../utils/InterchainAddressTracker.sol';

contract TestInterchainAddressTracker is InterchainAddressTracker, Ownable {
    string public name = 'Test'; // Dummy var for a different bytecode

    error Invalid();

    constructor(
        string memory chainName_,
        string[] memory trustedChainNames,
        string[] memory trustedAddresses
    ) Ownable(msg.sender) {
        _setChainName(chainName_);

        if (_CHAIN_NAME_SLOT != bytes32(uint256(keccak256('interchain-address-tracker-chain-name')) - 1))
            revert Invalid();

        uint256 length = trustedChainNames.length;

        if (length != trustedAddresses.length) revert LengthMismatch();

        for (uint256 i; i < length; ++i) {
            _setTrustedAddress(trustedChainNames[i], trustedAddresses[i]);
        }
    }

    function setTrustedAddress(string memory chain, string memory address_) external onlyOwner {
        _setTrustedAddress(chain, address_);
    }

    function removeTrustedAddress(string memory chain) external onlyOwner {
        _removeTrustedAddress(chain);
    }
}

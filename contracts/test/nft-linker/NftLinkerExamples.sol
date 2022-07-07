// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { NftLinker } from '../../nft-linking/NftLinker.sol';
import { AddressToString } from '../../StringAddressUtils.sol';
import { NftLinkerLockUnlock } from '../../nft-linking/NftLinkerLockUnlock.sol';
import { NftLinkerMintBurn } from '../../nft-linking/NftLinkerMintBurn.sol';

abstract contract NftLinkerSender is NftLinker {
    using AddressToString for address;
    
    function sendNft(string memory destinationChain, address to, uint256 tokenId) external payable {
        _takeNft(msg.sender, tokenId);
        bytes memory payload = abi.encode(to, tokenId);
        gateway().callContract(
            destinationChain, 
            address(this).toString(), 
            payload
        );
    }
}

contract NftLinkerLockUnlockExample is NftLinkerLockUnlock, NftLinkerSender {
    constructor(address gatewayAddress_, address operatorAddress_) NftLinkerLockUnlock(gatewayAddress_, operatorAddress_) {}
}

contract NftLinkerMintBurnExample is NftLinkerMintBurn, NftLinkerSender {
    constructor(address gatewayAddress_, address operatorAddress_) NftLinkerMintBurn(gatewayAddress_, operatorAddress_) {}
}

// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { TokenLinker } from '../../token-linking/TokenLinker.sol';
import { AddressToString } from '../../StringAddressUtils.sol';
import { TokenLinkerLockUnlock } from '../../token-linking/TokenLinkerLockUnlock.sol';
import { TokenLinkerMintBurn } from '../../token-linking/TokenLinkerMintBurn.sol';
import { TokenLinkerNative } from '../../token-linking/TokenLinkerNative.sol';

abstract contract TokenLinkerSender is TokenLinker {
    using AddressToString for address;

    function sendToken(
        string memory destinationChain,
        address to,
        uint256 amount
    ) external payable {
        _takeToken(msg.sender, amount);
        bytes memory payload = abi.encode(to, amount);
        gateway.callContract(destinationChain, address(this).toString(), payload);
    }
}

contract TokenLinkerLockUnlockExample is TokenLinkerLockUnlock, TokenLinkerSender {
    constructor(address gatewayAddress_, address tokenAddress_) TokenLinkerLockUnlock(gatewayAddress_, tokenAddress_) {}
}

contract TokenLinkerMintBurnExample is TokenLinkerMintBurn, TokenLinkerSender {
    constructor(address gatewayAddress_, address tokenAddress_) TokenLinkerMintBurn(gatewayAddress_, tokenAddress_) {}
}

contract TokenLinkerNativeExample is TokenLinkerNative, TokenLinkerSender {
    constructor(address gatewayAddress_) TokenLinkerNative(gatewayAddress_) {}
}

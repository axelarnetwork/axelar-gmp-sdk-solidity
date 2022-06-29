// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { TokenLinker } from './TokenLinker.sol';
import { AddressToString } from '../StringAddressUtils.sol';

contract TokenLinkerImplementation is TokenLinker {
    using AddressToString for address;

    error AlreadyInitialized();

    function init(
        address gateway_,
        TokenType tokenType_,
        address tokenAddress_
    ) external {
        (TokenType tokenType, address tokenAddress) = getTokenData();
        if (address(gateway()) != address(0) || tokenType != TokenType(0) || tokenAddress != address(0))
            revert AlreadyInitialized();
        _setGateway(gateway_);
        _setTokenData(tokenType_, tokenAddress_);
    }

    function sendToken(
        string calldata destinationChain,
        address recipient,
        uint256 amount
    ) external payable {
        // Pay for gas first if you want to in your implementation
        _takeToken(msg.sender, amount);
        bytes memory payload = abi.encode(recipient, amount);
        gateway().callContract(destinationChain, address(this).toString(), payload);
    }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { AxelarExecutable } from '../executables/AxelarExecutable.sol';
import { StringToAddress } from '../StringAddressUtils.sol';
import { TokenLockUnlock } from './TokenLockUnlock.sol';
import { TokenMintBurn } from './TokenMintBurn.sol';
import { TokenNativeHandler } from './TokenNativeHandler.sol';

abstract contract TokenLinker is AxelarExecutable, TokenLockUnlock, TokenMintBurn, TokenNativeHandler {
    using StringToAddress for string;

    error UnknownTokenType();

    //keccak256('token_data')
    uint256 public constant TOKEN_DATA_SLOT = 0x9687d0aabb5040966c37a37f42f70d8fe4113ce3b0fe2ef8d62958457c742733;

    enum TokenType {
        LOCK,
        MINT,
        NATIVE
    }

    function _execute(
        string calldata, /*sourceChain*/
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        if (sourceAddress.toAddress() != address(this)) return;
        (address recipient, uint256 amount) = abi.decode(payload, (address, uint256));
        _giveToken(recipient, amount);
    }

    function getTokenData() public view returns (TokenType tokenType, address tokenAddress) {
        uint256 tokenData;
        assembly {
            tokenData := sload(TOKEN_DATA_SLOT)
        }
        tokenType = TokenType(uint8(tokenData));
        tokenAddress = address(uint160(tokenData >> 8));
    }

    function _setTokenData(TokenType tokenType, address tokenAddress) internal {
        uint256 tokenData = (uint256(tokenType) + uint256(uint160(tokenAddress))) << 8;
        assembly {
            sstore(TOKEN_DATA_SLOT, tokenData)
        }
    }

    function _giveToken(address to, uint256 amount) internal {
        (TokenType tokenType, address tokenAddress) = getTokenData();
        if (tokenType == TokenType.LOCK) {
            _safeTransfer(tokenAddress, to, amount);
        } else if (tokenType == TokenType.MINT) {
            _safeMint(tokenAddress, to, amount);
        } else if (tokenType == TokenType.NATIVE) {
            _safeNativeTransfer(to, amount);
        } else {
            revert UnknownTokenType();
        }
    }

    function _takeToken(address from, uint256 amount) internal {
        (TokenType tokenType, address tokenAddress) = getTokenData();
        if (tokenType == TokenType.LOCK) {
            _safeTransferFrom(tokenAddress, from, amount);
        } else if (tokenType == TokenType.MINT) {
            _safeBurn(tokenAddress, from, amount);
        } else if (tokenType == TokenType.NATIVE) {
            _safeNativeTransferFrom(amount);
        } else {
            revert UnknownTokenType();
        }
    }
}

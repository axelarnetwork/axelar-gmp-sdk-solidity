// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { AxelarExecutable } from '../executables/AxelarExecutable.sol';
import { StringToAddress } from '../StringAddressUtils.sol';
import { Upgradable } from '../upgradables/Upgradable.sol';
import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';

abstract contract NftLinker is AxelarExecutable, Upgradable {
    using StringToAddress for string;

    constructor(address gatewayAddress) AxelarExecutable(gatewayAddress) {}

    function contractId() external pure override returns (bytes32) {
        return keccak256('nft-linker');
    }

    function _execute(
        string calldata, /*sourceChain*/
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        if (sourceAddress.toAddress() != address(this)) return;
        (address recipient, uint256 tokenId) = abi.decode(payload, (address, uint256));
        _giveNft(recipient, tokenId);
    }

    function _giveNft(address to, uint256 tokenId) internal virtual;

    function _takeNft(address from, uint256 tokenId) internal virtual;
}

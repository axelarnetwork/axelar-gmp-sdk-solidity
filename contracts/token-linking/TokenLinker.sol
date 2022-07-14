// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { AxelarExecutable } from '../executables/AxelarExecutable.sol';
import { StringToAddress } from '../StringAddressUtils.sol';
import { Upgradable } from '../upgradables/Upgradable.sol';
import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';

abstract contract TokenLinker is AxelarExecutable, Upgradable {
    using StringToAddress for string;

    address public immutable gatewayAddress;

    constructor(address gatewayAddress_) {
        gatewayAddress = gatewayAddress_;
    }

    function contractId() external pure override returns (bytes32) {
        return keccak256('token-linker');
    }

    function gateway() public view override returns (IAxelarGateway) {
        return IAxelarGateway(gatewayAddress);
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

    function _giveToken(address to, uint256 amount) internal virtual;

    function _takeToken(address from, uint256 amount) internal virtual;
}

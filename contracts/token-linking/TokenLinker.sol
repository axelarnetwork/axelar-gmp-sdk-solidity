// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IAxelarGasService } from '../interfaces/IAxelarGasService.sol';
import { AxelarExecutable } from '../executables/AxelarExecutable.sol';
import { StringToAddress, AddressToString } from '../StringAddressUtils.sol';
import { Upgradable } from '../upgradables/Upgradable.sol';

abstract contract TokenLinker is AxelarExecutable, Upgradable {
    using StringToAddress for string;
    using AddressToString for address;

    IAxelarGasService public immutable gasService;

    constructor(address gatewayAddress_, address gasServiceAddress_) AxelarExecutable(gatewayAddress_) {
        if (gasServiceAddress_ == address(0)) revert InvalidAddress();

        gasService = IAxelarGasService(gasServiceAddress_);
    }

    function contractId() external pure override returns (bytes32) {
        return keccak256('token-linker');
    }

    function sendToken(
        string calldata destinationChain,
        address to,
        uint256 amount
    ) external payable virtual {
        _takeToken(msg.sender, amount);
        string memory thisAddress = address(this).toString();
        bytes memory payload = abi.encode(to, amount);
        uint256 gasValue = _lockNative() ? msg.value - amount : msg.value;
        if (gasValue > 0) {
            gasService.payNativeGasForContractCall{ value: gasValue }(
                address(this),
                destinationChain,
                thisAddress,
                payload,
                msg.sender
            );
        }
        gateway.callContract(destinationChain, thisAddress, payload);
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

    function _lockNative() internal pure virtual returns (bool) {
        return false;
    }

    function _giveToken(address to, uint256 amount) internal virtual;

    function _takeToken(address from, uint256 amount) internal virtual;
}

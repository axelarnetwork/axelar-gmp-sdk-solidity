// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarGMPExecutableWithToken } from '../../executable/AxelarGMPExecutableWithToken.sol';
import { IInterchainTransferReceived } from '../../interfaces/IInterchainTransfer.sol';

contract GMPExecutableWithTokenTest is AxelarGMPExecutableWithToken, IInterchainTransferReceived {
    event Received(uint256 num);
    event ReceivedWithToken(uint256 num, address tokenAddress, uint256 amount);

    constructor(address gatewayAddress) AxelarGMPExecutableWithToken(gatewayAddress) {}

    function _execute(
        bytes32 /*commandId*/,
        string calldata /*sourceChain*/,
        string calldata /*sourceAddress*/,
        bytes calldata payload
    ) internal override {
        uint256 num = abi.decode(payload, (uint256));
        emit Received(num);
    }

    function _executeWithToken(
        bytes32 /*commandId*/,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata /*payload*/,
        string calldata tokenSymbol,
        uint256 amount
    ) internal override {
        // Emit InterchainTransferReceived event
        emit InterchainTransferReceived(
            sourceChain,
            sourceAddress,
            bytes(sourceAddress),
            address(this),
            gatewayWithToken().tokenAddresses(tokenSymbol),
            amount
        );
    }
}

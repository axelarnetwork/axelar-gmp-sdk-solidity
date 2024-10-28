// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarExecutableWithToken } from '../../executable/AxelarExecutableWithToken.sol';
import { IInterchainTransferReceived } from '../../interfaces/IInterchainTransfer.sol';

contract AxelarExecutableWithTokenTest is AxelarExecutableWithToken, IInterchainTransferReceived {
    event Received(uint256 num);
    event ReceivedWithToken(uint256 num, address tokenAddress, uint256 amount);

    constructor(address gatewayAddress) AxelarExecutableWithToken(gatewayAddress) {}

    function _execute(
        bytes32, /*commandId*/
        string calldata, /*sourceChain*/
        string calldata, /*sourceAddress*/
        bytes calldata payload
    ) internal override {
        uint256 num = abi.decode(payload, (uint256));
        emit Received(num);
    }

    function _executeWithToken(
        bytes32, /*commandId*/
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata, /*payload*/
        string calldata tokenSymbol,
        uint256 amount
    ) internal override {
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

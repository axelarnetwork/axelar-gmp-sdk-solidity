// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarGMPExecutableWithToken } from '../../executable/AxelarGMPExecutableWithToken.sol';

contract GMPExecutableWithTokenTest is AxelarGMPExecutableWithToken {
    event Received(uint256 num);
    event ReceivedWithToken(uint256 num, address tokenAddress, uint256 amount);
    event ContractCallWithToken(
        address sender,
        string destinationChain,
        string contractAddress,
        bytes32 payloadHash,
        bytes payload,
        string symbol,
        uint256 amount
    );

    constructor(address gatewayAddress) AxelarGMPExecutableWithToken(gatewayAddress) {}

    function callContractWithToken(
        string calldata destinationChain,
        string calldata contractAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external override {
        emit ContractCallWithToken(
            msg.sender,
            destinationChain,
            contractAddress,
            keccak256(payload),
            payload,
            symbol,
            amount
        );
    }

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
        string calldata, /*sourceChain*/
        string calldata, /*sourceAddress*/
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) internal override {
        uint256 num = abi.decode(payload, (uint256));
        emit ReceivedWithToken(num, gatewayWithToken().tokenAddresses(tokenSymbol), amount);
    }
}

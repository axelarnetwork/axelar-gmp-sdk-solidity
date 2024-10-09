// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarGMPExecutableWithToken } from '../../executable/AxelarGMPExecutableWithToken.sol';
import { IAxelarGMPGatewayWithToken } from '../../interfaces/IAxelarGMPGatewayWithToken.sol';
import { IERC20 } from '../../interfaces/IERC20.sol';
import { DestinationChainTokenSwapper } from './DestinationChainTokenSwapper.sol';

contract DestinationChainSwapExpressDisabled is AxelarGMPExecutableWithToken {
    DestinationChainTokenSwapper public immutable swapper;

    event Executed(bytes32 commandId, string sourceChain, string sourceAddress, bytes payload);

    constructor(address gatewayAddress, address swapperAddress) AxelarGMPExecutableWithToken(gatewayAddress) {
        swapper = DestinationChainTokenSwapper(swapperAddress);
    }

    function _execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        emit Executed(commandId, sourceChain, sourceAddress, payload);
    }

    function _executeWithToken(
        bytes32, /*commandId*/
        string calldata sourceChain,
        string calldata, /*sourceAddress*/
        bytes calldata payload,
        string calldata tokenSymbolA,
        uint256 amount
    ) internal override {
        (string memory tokenSymbolB, string memory recipient) = abi.decode(payload, (string, string));

        address tokenA = IAxelarGMPGatewayWithToken(gatewayAddress).tokenAddresses(tokenSymbolA);
        address tokenB = IAxelarGMPGatewayWithToken(gatewayAddress).tokenAddresses(tokenSymbolB);

        IERC20(tokenA).approve(address(swapper), amount);
        uint256 convertedAmount = swapper.swap(tokenA, tokenB, amount, address(this));

        IERC20(tokenB).approve(address(gatewayAddress), convertedAmount);
        IAxelarGMPGatewayWithToken(gatewayAddress).sendToken(sourceChain, recipient, tokenSymbolB, convertedAmount);
    }

    function contractId() external pure returns (bytes32) {
        return keccak256('destination-chain-swap-express');
    }
}

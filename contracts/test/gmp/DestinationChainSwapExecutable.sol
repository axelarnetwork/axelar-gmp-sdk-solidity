// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarGMPExecutableWithToken } from '../../executable/AxelarGMPExecutableWithToken.sol';
import { IAxelarGMPGatewayWithToken } from '../../interfaces/IAxelarGMPGatewayWithToken.sol';
import { IERC20 } from '../../interfaces/IERC20.sol';
import { DestinationChainTokenSwapper } from './DestinationChainTokenSwapper.sol';

contract DestinationChainSwapExecutable is AxelarGMPExecutableWithToken {
    DestinationChainTokenSwapper public immutable swapper;

    constructor(address gatewayAddress, address swapperAddress) AxelarGMPExecutableWithToken(gatewayAddress) {
        swapper = DestinationChainTokenSwapper(swapperAddress);
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

        address tokenA = IAxelarGMPGatewayWithToken(address(gatewayAddress)).tokenAddresses(tokenSymbolA);
        address tokenB = IAxelarGMPGatewayWithToken(address(gatewayAddress)).tokenAddresses(tokenSymbolB);

        IERC20(tokenA).approve(address(swapper), amount);
        uint256 convertedAmount = swapper.swap(tokenA, tokenB, amount, address(this));

        IERC20(tokenB).approve(address(gatewayAddress), convertedAmount);
        IAxelarGMPGatewayWithToken(gatewayAddress).sendToken(sourceChain, recipient, tokenSymbolB, convertedAmount);
    }

    function _execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {}
}

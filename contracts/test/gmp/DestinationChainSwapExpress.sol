// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { AxelarExpressExecutableWithToken } from '../../express/AxelarExpressExecutableWithToken.sol';
import { IERC20 } from '../../interfaces/IERC20.sol';
import { DestinationChainTokenSwapper } from './DestinationChainTokenSwapper.sol';

contract DestinationChainSwapExpress is AxelarExpressExecutableWithToken {
    DestinationChainTokenSwapper public immutable swapper;

    event Executed(bytes32 commandId, string sourceChain, string sourceAddress, bytes payload);
    event ExecutedWithToken(
        bytes32 commandId,
        string sourceChain,
        string sourceAddress,
        bytes payload,
        string symbol,
        uint256 amount
    );

    constructor(address gatewayAddress, address swapperAddress) AxelarExpressExecutableWithToken(gatewayAddress) {
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
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbolA,
        uint256 amount
    ) internal override {
        (string memory tokenSymbolB, string memory recipient) = abi.decode(payload, (string, string));

        address tokenA = gatewayWithToken().tokenAddresses(tokenSymbolA);
        address tokenB = gatewayWithToken().tokenAddresses(tokenSymbolB);

        IERC20(tokenA).approve(address(swapper), amount);
        uint256 convertedAmount = swapper.swap(tokenA, tokenB, amount, address(this));

        IERC20(tokenB).approve(address(gatewayWithToken()), convertedAmount);
        gatewayWithToken().sendToken(sourceChain, recipient, tokenSymbolB, convertedAmount);
        emit ExecutedWithToken(commandId, sourceChain, sourceAddress, payload, tokenSymbolA, amount);
    }

    function contractId() external pure returns (bytes32) {
        return keccak256('destination-chain-swap-express');
    }
}

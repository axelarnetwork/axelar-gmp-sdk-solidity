// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import { Upgradable } from '../upgradable/Upgradable.sol';
import { SafeTokenTransfer, SafeNativeTransfer } from '../utils/SafeTransfer.sol';
import { IExpressProxy } from '../interfaces/IExpressProxy.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { IExpressService } from '../interfaces/IExpressService.sol';
import { ExpressProxyFactory } from './ExpressProxyFactory.sol';

contract ExpressService is Upgradable, ExpressProxyFactory, IExpressService {
    using SafeTokenTransfer for IERC20;
    using SafeNativeTransfer for address payable;

    address public immutable expressOperator;

    constructor(
        address gateway_,
        address proxyDeployer_,
        address expressOperator_
    ) ExpressProxyFactory(gateway_, proxyDeployer_) {
        if (expressOperator_ == address(0)) revert InvalidOperator();

        expressOperator = expressOperator_;
    }

    modifier onlyOperator() {
        if (msg.sender != expressOperator) revert NotOperator();

        _;
    }

    function callWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external onlyOperator {
        if (contractAddress == address(0)) revert InvalidContractAddress();

        if (commandId != bytes32(0) && gateway.isCommandExecuted(commandId)) {
            IExpressProxy(contractAddress).executeWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount
            );
        } else {
            if (!isExpressProxy(contractAddress)) revert NotExpressProxy();

            address tokenAddress = gateway.tokenAddresses(tokenSymbol);

            if (tokenAddress == address(0)) revert InvalidTokenSymbol();

            IERC20(tokenAddress).approve(contractAddress, amount);
            IExpressProxy(contractAddress).expressExecuteWithToken(
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount
            );
        }
    }

    function withdraw(
        address payable receiver,
        address token,
        uint256 amount
    ) external onlyOperator {
        if (receiver == address(0)) revert InvalidAddress();

        if (token == address(0)) {
            receiver.safeNativeTransfer(amount);
        } else {
            IERC20(token).safeTransfer(receiver, amount);
        }
    }

    function contractId() external pure returns (bytes32) {
        return keccak256('axelar-gmp-express-service');
    }
}

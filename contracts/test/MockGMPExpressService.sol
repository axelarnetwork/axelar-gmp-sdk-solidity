// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IExpressExecutable } from '../interfaces/IExpressExecutable.sol';
import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IGMPExpressService } from '../interfaces/IGMPExpressService.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { AxelarExecutable } from '../executable/AxelarExecutable.sol';
import { ExpressProxy } from '../express/ExpressProxy.sol';
import { SafeTokenTransfer, SafeNativeTransfer } from '../utils/SafeTransfer.sol';

contract MockGMPExpressService is AxelarExecutable, IGMPExpressService {
    using SafeTokenTransfer for IERC20;
    using SafeNativeTransfer for address payable;

    address public immutable expressOperator;
    bytes32 public immutable expressProxyCodeHash;

    constructor(address gateway_, address expressOperator_) AxelarExecutable(gateway_) {
        if (expressOperator_ == address(0)) revert InvalidOperator();

        expressOperator = expressOperator_;
        expressProxyCodeHash = address(new ExpressProxy(gateway_, address(this))).codehash;
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
            IExpressExecutable(contractAddress).executeWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount
            );
        } else {
            if (contractAddress.codehash != expressProxyCodeHash) revert NotExpressProxy();

            IERC20(gateway.tokenAddresses(tokenSymbol)).approve(contractAddress, amount);
            IExpressExecutable(contractAddress).expressExecuteWithToken(
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount
            );
        }
    }

    function deployExpressProxy(
        bytes32,
        address,
        address,
        bytes calldata
    ) external pure returns (address) {
        return address(0);
    }

    function deployExpressExecutable(
        bytes32,
        bytes memory,
        address,
        bytes calldata
    ) external pure returns (address) {
        return address(0);
    }

    function deployExpressExecutableOnChains(
        bytes32,
        bytes memory,
        address,
        bytes calldata,
        string[] calldata,
        uint256[] calldata,
        address
    ) external {}

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
        return keccak256('gmp-express-service');
    }
}

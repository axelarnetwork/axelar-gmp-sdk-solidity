// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarExecutable } from '../interfaces/IAxelarExecutable.sol';
import { IGMPExpressService } from '../interfaces/IGMPExpressService.sol';

interface IExpressExecutable is IAxelarExecutable {
    error NotGMPExpressService();
    error TransferFailed();

    function gmpExpressService() external view returns (IGMPExpressService);

    function expressExecute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external;

    function expressExecuteWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external;
}

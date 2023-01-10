// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarExecutable } from '../interfaces/IAxelarExecutable.sol';
import { IExpressRegistry } from '../interfaces/IExpressRegistry.sol';

interface IExpressExecutable is IAxelarExecutable {
    error NotExpressRegistry();
    error TransferFailed();

    function registry() external view returns (IExpressRegistry);

    function registryCodeHash() external view returns (bytes32);

    function expressExecuteWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external;

    function completeExecuteWithToken(
        address expressCaller,
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external;
}

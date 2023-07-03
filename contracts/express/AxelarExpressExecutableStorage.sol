// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IExpressExecutable } from '../interfaces/IExpressExecutable.sol';

abstract contract AxelarExpressExecutableStorage is IExpressExecutable {
    uint256 private constant PREFIX_EXPRESS_EXECUTION = uint256(keccak256('prefix-express-execution'));
    uint256 private constant PREFIX_EXPRESS_EXECUTION_WTIH_TOKEN = uint256(keccak256('prefix-express-execution-with-token'));
    
    function _expressExecutionSlot(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal pure returns (uint256 slot) {
        // TODO: maybe add some salt although i doubt it will be an issue.
        slot = uint256(keccak256(abi.encode(PREFIX_EXPRESS_EXECUTION, commandId, sourceChain, sourceAddress, payload))) - 1;
    }

    function _expressExecutedWithTokenSlot(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) internal pure returns (uint256 slot) {
        // TODO: maybe add some salt although i doubt it will be an issue.
        slot = uint256(keccak256(abi.encode(PREFIX_EXPRESS_EXECUTION_WTIH_TOKEN, commandId, sourceChain, sourceAddress, payload, symbol, amount))) - 1;
    }

    function getExpressCaller(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external view returns (address expressExecutor) {
        uint256 slot = _expressExecutionSlot(commandId, sourceChain, sourceAddress, payload);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            expressExecutor := sload(slot)
        }
    }

    function getExpressCallerWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external view returns (address expressExecutor) {
        uint256 slot = _expressExecutedWithTokenSlot(commandId, sourceChain, sourceAddress, payload, symbol, amount);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            expressExecutor := sload(slot)
        }
    }

    function _setExpressCaller(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        address expressExecutor
    ) internal {
        uint256 slot = _expressExecutionSlot(commandId, sourceChain, sourceAddress, payload);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, expressExecutor)
        }
    }

    function _setExpressCallerWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount,
        address expressExecutor
    ) internal {
        uint256 slot = _expressExecutedWithTokenSlot(commandId, sourceChain, sourceAddress, payload, symbol, amount);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, expressExecutor)
        }
    }

    function _popExpressCaller(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal returns (address expressExecutor) {
        uint256 slot = _expressExecutionSlot(commandId, sourceChain, sourceAddress, payload);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            expressExecutor := sload(slot)
            if expressExecutor {
                sstore(slot, 0)
            }
        }
    }

    function _popExpressCallerWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) internal returns (address expressExecutor) {
        uint256 slot = _expressExecutedWithTokenSlot(commandId, sourceChain, sourceAddress, payload, symbol, amount);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            expressExecutor := sload(slot)
            if expressExecutor {
                sstore(slot, 0)
            }
        }
    }
}

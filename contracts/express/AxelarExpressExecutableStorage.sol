// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IAxelarExpressExecutable } from '../interfaces/IAxelarExpressExecutable.sol';

abstract contract AxelarExpressExecutableStorage is IAxelarExpressExecutable {
    uint256 private constant PREFIX_EXPRESS_EXECUTE = uint256(keccak256('express-execute'));
    uint256 private constant PREFIX_EXPRESS_EXECUTE_WTIH_TOKEN = uint256(keccak256('express-execute-with-token'));

    function _expressExecuteSlot(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal pure returns (uint256 slot) {
        slot =
            uint256(keccak256(abi.encode(PREFIX_EXPRESS_EXECUTE, commandId, sourceChain, sourceAddress, payload))) -
            1;
    }

    function _expressExecuteWithTokenSlot(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) internal pure returns (uint256 slot) {
        slot =
            uint256(
                keccak256(
                    abi.encode(
                        PREFIX_EXPRESS_EXECUTE_WTIH_TOKEN,
                        commandId,
                        sourceChain,
                        sourceAddress,
                        payload,
                        symbol,
                        amount
                    )
                )
            ) -
            1;
    }

    function getExpressExecutor(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external view returns (address expressExecutor) {
        uint256 slot = _expressExecuteSlot(commandId, sourceChain, sourceAddress, payload);

        assembly {
            expressExecutor := sload(slot)
        }
    }

    function getExpressExecutorWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external view returns (address expressExecutor) {
        uint256 slot = _expressExecuteWithTokenSlot(commandId, sourceChain, sourceAddress, payload, symbol, amount);

        assembly {
            expressExecutor := sload(slot)
        }
    }

    function _setExpressExecutor(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        address expressExecutor
    ) internal {
        uint256 slot = _expressExecuteSlot(commandId, sourceChain, sourceAddress, payload);
        address currentExecutor;

        assembly {
            currentExecutor := sload(slot)
        }

        if (currentExecutor != address(0)) revert ExpressExecutorAlreadySet();

        assembly {
            sstore(slot, expressExecutor)
        }
    }

    function _setExpressExecutorWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount,
        address expressExecutor
    ) internal {
        uint256 slot = _expressExecuteWithTokenSlot(commandId, sourceChain, sourceAddress, payload, symbol, amount);
        address currentExecutor;

        assembly {
            currentExecutor := sload(slot)
        }

        if (currentExecutor != address(0)) revert ExpressExecutorAlreadySet();

        assembly {
            sstore(slot, expressExecutor)
        }
    }

    function _popExpressExecutor(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal returns (address expressExecutor) {
        uint256 slot = _expressExecuteSlot(commandId, sourceChain, sourceAddress, payload);

        assembly {
            expressExecutor := sload(slot)
            if expressExecutor {
                sstore(slot, 0)
            }
        }
    }

    function _popExpressExecutorWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) internal returns (address expressExecutor) {
        uint256 slot = _expressExecuteWithTokenSlot(commandId, sourceChain, sourceAddress, payload, symbol, amount);

        assembly {
            expressExecutor := sload(slot)
            if expressExecutor {
                sstore(slot, 0)
            }
        }
    }
}

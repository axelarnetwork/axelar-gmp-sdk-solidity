// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

abstract contract ExpressExecutorTracker {
    error ExpressExecutorAlreadySet();

    bytes32 internal constant PREFIX_EXPRESS_EXECUTE = keccak256('express-execute');
    bytes32 internal constant PREFIX_EXPRESS_EXECUTE_WITH_TOKEN = keccak256('express-execute-with-token');

    function _expressExecuteSlot(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) internal pure returns (bytes32 slot) {
        slot = keccak256(abi.encode(PREFIX_EXPRESS_EXECUTE, commandId, sourceChain, sourceAddress, payloadHash));
    }

    function _expressExecuteWithTokenSlot(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash,
        string calldata symbol,
        uint256 amount
    ) internal pure returns (bytes32 slot) {
        slot = keccak256(
            abi.encode(
                PREFIX_EXPRESS_EXECUTE_WITH_TOKEN,
                commandId,
                sourceChain,
                sourceAddress,
                payloadHash,
                symbol,
                amount
            )
        );
    }

    function _getExpressExecutor(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) internal view returns (address expressExecutor) {
        bytes32 slot = _expressExecuteSlot(commandId, sourceChain, sourceAddress, payloadHash);

        assembly {
            expressExecutor := sload(slot)
        }
    }

    function _getExpressExecutorWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash,
        string calldata symbol,
        uint256 amount
    ) internal view returns (address expressExecutor) {
        bytes32 slot = _expressExecuteWithTokenSlot(commandId, sourceChain, sourceAddress, payloadHash, symbol, amount);

        assembly {
            expressExecutor := sload(slot)
        }
    }

    function _setExpressExecutor(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash,
        address expressExecutor
    ) internal {
        bytes32 slot = _expressExecuteSlot(commandId, sourceChain, sourceAddress, payloadHash);
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
        bytes32 payloadHash,
        string calldata symbol,
        uint256 amount,
        address expressExecutor
    ) internal {
        bytes32 slot = _expressExecuteWithTokenSlot(commandId, sourceChain, sourceAddress, payloadHash, symbol, amount);
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
        bytes32 payloadHash
    ) internal returns (address expressExecutor) {
        bytes32 slot = _expressExecuteSlot(commandId, sourceChain, sourceAddress, payloadHash);

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
        bytes32 payloadHash,
        string calldata symbol,
        uint256 amount
    ) internal returns (address expressExecutor) {
        bytes32 slot = _expressExecuteWithTokenSlot(commandId, sourceChain, sourceAddress, payloadHash, symbol, amount);

        assembly {
            expressExecutor := sload(slot)
            if expressExecutor {
                sstore(slot, 0)
            }
        }
    }
}

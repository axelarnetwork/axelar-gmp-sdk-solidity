// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IERC20 } from '../interfaces/IERC20.sol';

error TokenTransferFailed();
error NativeTransferFailed();

library SafeTokenCall {
    function safeCall(IERC20 token, bytes memory callData) internal {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returnData) = address(token).call(callData);
        bool transferred = success && (returnData.length == uint256(0) || abi.decode(returnData, (bool)));

        if (!transferred || address(token).code.length == 0) revert TokenTransferFailed();
    }
}

library SafeTokenTransfer {
    function safeTransfer(
        IERC20 token,
        address receiver,
        uint256 amount
    ) internal {
        SafeTokenCall.safeCall(token, abi.encodeWithSelector(IERC20.transfer.selector, receiver, amount));
    }
}

library SafeTokenTransferFrom {
    function safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 amount
    ) internal {
        SafeTokenCall.safeCall(token, abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
    }
}

library SafeNativeTransfer {
    uint256 internal constant NATIVE_TRANSFER_GAS_LIMIT = 2300;

    function safeNativeTransfer(address receiver, uint256 amount) internal {
        bool success;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            success := call(NATIVE_TRANSFER_GAS_LIMIT, receiver, amount, 0, 0, 0, 0)
        }

        if (!success) revert NativeTransferFailed();
    }
}

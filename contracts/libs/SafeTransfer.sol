// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IERC20 } from '../interfaces/IERC20.sol';

error TokenTransferFailed(); // Should include token Address, makes it easier to debug when multiple tokens are involved in the same call
error NativeTransferFailed();

// Note: This won't work with NON standard ERC20s like USDT
library SafeTokenCall {
    function safeCall(IERC20 token, bytes memory callData) internal {
        (bool success, bytes memory returnData) = address(token).call(callData);
        // This can be re-written as:
        // bool transferFailed = !success || (returnData.length != uint256(0) && !abi.decode(returnData, (bool)));
        // Checking success first with an "OR" of rest of the statement should provide an early exit to the check
        bool transferred = success && (returnData.length == uint256(0) || abi.decode(returnData, (bool)));
        // if (transferFailed || address(token).code.length == 0) revert TokenTransferFailed(token);
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
    function safeNativeTransfer(address receiver, uint256 amount) internal {
        bool success;

        // We should check if the current contract has enouigh balance before this call

        assembly {
            success := call(gas(), receiver, amount, 0, 0, 0, 0)
        }

        if (!success) revert NativeTransferFailed();
    }
}

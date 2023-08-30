// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

error NativeTransferFailed();

library SafeNativeTransfer {
    function safeNativeTransfer(address receiver, uint256 amount) internal {
        bool success;

        assembly {
            success := call(gas(), receiver, amount, 0, 0, 0, 0)
        }

        if (!success) revert NativeTransferFailed();
    }
}

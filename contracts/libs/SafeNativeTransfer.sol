// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

error NativeTransferFailed();

/*
 * @title SafeNativeTransfer
 * @dev This library is used for performing safe native value transfers in Solidity by utilizing inline assembly.
 */
library SafeNativeTransfer {
    /*
     * @notice Perform a native transfer to a given address.
     * @param receiver The recipient address to which the amount will be sent.
     * @param amount The amount of native value to send.
     * @throws NativeTransferFailed error if transfer is not successful.
     */
    function safeNativeTransfer(address receiver, uint256 amount) internal {
        bool success;

        assembly {
            success := call(gas(), receiver, amount, 0, 0, 0, 0)
        }

        if (!success) revert NativeTransferFailed();
    }
}

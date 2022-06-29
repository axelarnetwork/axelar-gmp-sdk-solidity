// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IERC20 } from '../interfaces/IERC20.sol';

contract TokenNativeHandler {
    //keccak256('native_balance')
    uint256 public constant NATIVE_BALANCE_SLOT = 0x2b1b2f0e2e6377507cc7f28638bed85633f644ec5614112adcc88f3c5e87903a;

    error InsufficientBalance();
    error TranferFromNativeFailed();

    function getNativeBalance() public view returns (uint256 nativeBalance) {
        assembly {
            nativeBalance := sload(NATIVE_BALANCE_SLOT)
        }
    }

    function _setNativeBalance(uint256 nativeBalance) internal {
        assembly {
            sstore(NATIVE_BALANCE_SLOT, nativeBalance)
        }
    }

    function _safeNativeTransfer(address to, uint256 amount) internal {
        uint256 balance = getNativeBalance();
        if (balance < amount) revert InsufficientBalance();
        payable(to).transfer(amount);
        _setNativeBalance(balance - amount);
    }

    function _safeNativeTransferFrom(uint256 amount) internal {
        uint256 balance = getNativeBalance();
        if (balance + amount < address(this).balance) revert TranferFromNativeFailed();
        _setNativeBalance(balance + amount);
    }
}

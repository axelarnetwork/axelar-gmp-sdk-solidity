// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { SafeNativeTransfer } from '../../libs/SafeNativeTransfer.sol';

contract TestSafeNativeTransfer {
    using SafeNativeTransfer for address payable;

    function forward(address payable recipient) external payable {
        recipient.safeNativeTransfer(msg.value);
    }
}

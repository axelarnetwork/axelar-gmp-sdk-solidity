// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ContractAddress } from '../libs/ContractAddress.sol';
import { ICaller } from '../interfaces/ICaller.sol';

contract Caller is ICaller {
    using ContractAddress for address;

    /**
     * @dev Calls a target address with specified calldata and optionally sends value.
     */
    function _call(
        address target,
        bytes calldata callData,
        uint256 nativeValue
    ) internal returns (bytes memory) {
        if (!target.isContract()) revert InvalidContract(target);

        if (nativeValue > address(this).balance) revert InsufficientBalance();

        (bool success, bytes memory data) = target.call{ value: nativeValue }(callData);
        if (!success) {
            revert ExecutionFailed();
        }

        return data;
    }
}

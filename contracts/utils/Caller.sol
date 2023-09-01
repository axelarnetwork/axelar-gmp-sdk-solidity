// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ContractAddress } from '../libs/ContractAddress.sol';
import { ICaller } from '../interfaces/ICaller.sol';

contract Caller is ICaller {
    using ContractAddress for address;

    /**
     * @dev Calls a target address with specified calldata and optionally sends value.
     */
    // We should follow the OZ pattern: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/8186c07a83c09046c6fbaa90a035ee47e4d7d785/contracts/utils/Address.sol#L83
    // The address is a contract check can be moved after checking success of execution because it is a scenario which will happen less when we use this lib
    // the revert should also be able to log error returned from the external call which is done using: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/8186c07a83c09046c6fbaa90a035ee47e4d7d785/contracts/utils/Address.sol#L146C35-L146C45
    // rename to callWithValue
    function _call(
        address target,
        bytes calldata callData,
        uint256 nativeValue
    ) internal returns (bytes memory) {
        if (!target.isContract()) revert InvalidContract(target); // always calls a contract

        if (nativeValue > address(this).balance) revert InsufficientBalance(); // can log current balance of the contract

        (bool success, bytes memory data) = target.call{ value: nativeValue }(callData);
        if (!success) {
            revert ExecutionFailed();
        }

        return data;
    }
}

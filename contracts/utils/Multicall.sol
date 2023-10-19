// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IMulticall } from '../interfaces/IMulticall.sol';

/**
 * @title Multicall
 * @notice This contract is a multi-functional smart contract which allows for multiple
 * contract calls in a single transaction.
 */
contract Multicall is IMulticall {
    /**
     * @notice Performs multiple delegate calls and returns the results of all calls as an array
     * @dev This function requires that the contract has sufficient balance for the delegate calls.
     * If any of the calls fail, the function will revert with the failure message.
     * @param data An array of encoded function calls
     * @return results An bytes array with the return data of each function call
     */
    function multicall(bytes[] calldata data) public payable returns (bytes[] memory results) {
        results = new bytes[](data.length);
        bool success;
        bytes memory result;
        for (uint256 i = 0; i < data.length; ++i) {
            // slither-disable-next-line calls-loop,delegatecall-loop
            (success, result) = address(this).delegatecall(data[i]);

            if (!success) {
                if (result.length == 0) revert MulticallFailed();
                assembly {
                    revert(add(32, result), mload(result))
                }
            }

            results[i] = result;
        }
    }
}

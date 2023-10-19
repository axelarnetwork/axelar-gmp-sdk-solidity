// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IMulticall
 * @notice This contract is a multi-functional smart contract which allows for multiple
 * contract calls in a single transaction.
 */
interface IMulticall {
    error MulticallFailed();

    /**
     * @notice Performs multiple delegate calls and returns the results of all calls as an array
     * @dev This function requires that the contract has sufficient balance for the delegate calls.
     * If any of the calls fail, the function will revert with the failure message.
     * @param data An array of encoded function calls
     * @return results An bytes array with the return data of each function call
     */
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results);
}

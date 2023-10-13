// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title NoReEntrancy
 * @notice This contract provides a mechanism to halt the execution of specific functions
 * if a pause condition is activated.
 */
interface INoReEntrancy {
    error ReEntrancy();
}

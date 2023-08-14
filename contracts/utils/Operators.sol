// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IOperators } from '../interfaces/IOperators.sol';
import { Ownable } from './Ownable.sol';

/**
 * @title Operators
 * @notice This contract provides an access control mechanism, where an owner can register
 * operator accounts that can call arbitrary contracts on behalf of this contract.
 * @dev The owner account is initially set as the deployer address.
 */
contract Operators is Ownable, IOperators {
    mapping(address => bool) public operators;

    /**
     * @notice Sets the initial owner of the contract.
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Modifier that requires the `msg.sender` to be an operator.
     * @dev Reverts with a NotOperator error if the condition is not met.
     */
    modifier onlyOperator() {
        if (!operators[msg.sender]) revert NotOperator();
        _;
    }

    /**
     * @notice Returns whether an address is an operator.
     * @param account Address to check
     * @return boolean whether the address is an operator
     */
    function isOperator(address account) external view returns (bool) {
        return operators[account];
    }

    /**
     * @notice Adds an address as an operator.
     * @dev Can only be called by the current owner.
     * @param operator address to be added as operator
     */
    function addOperator(address operator) external onlyOwner {
        if (operator == address(0)) revert InvalidOperator();
        if (operators[operator]) revert OperatorAlreadyAdded();

        operators[operator] = true;

        emit OperatorAdded(operator);
    }

    /**
     * @notice Removes an address as an operator.
     * @dev Can only be called by the current owner.
     * @param operator address to be removed as operator
     */
    function removeOperator(address operator) external onlyOwner {
        if (operator == address(0)) revert InvalidOperator();
        if (!operators[operator]) revert NotAnOperator();

        operators[operator] = false;

        emit OperatorRemoved(operator);
    }

    /**
     * @notice Allows an operator to execute arbitrary functions on any smart contract.
     * @dev Can only be called by an operator.
     * @param target address of the contract to execute the function on. Existence is not checked.
     * @param callData ABI encoded function call to execute on target
     * @param nativeValue The amount of native asset to send with the call. If `nativeValue` is set to `0`, then `msg.value` is forwarded instead.
     * @return data return data from executed function call
     */
    function executeContract(
        address target,
        bytes calldata callData,
        uint256 nativeValue
    ) external payable onlyOperator returns (bytes memory) {
        if (nativeValue == 0) {
            nativeValue = msg.value;
        }

        (bool success, bytes memory data) = target.call{ value: nativeValue }(callData);
        if (!success) {
            revert ExecutionFailed();
        }

        return data;
    }

    /**
     * @notice This function enables the contract to accept native value transfers.
     */
    receive() external payable {}
}

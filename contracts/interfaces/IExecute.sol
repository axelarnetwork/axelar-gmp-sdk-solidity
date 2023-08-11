// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IExecute Interface
 * @notice This interface defines the execute function used to interact with external contracts.
 */
interface IExecute {
    /**
     * @notice Executes a call to an external contract.
     * @dev Execution logic is left up to the implementation.
     * @param target The address of the contract to be called
     * @param callData The calldata to be sent
     * @param nativeValue The amount of native token (e.g., Ether) to be sent along with the call
     * @return bytes The data returned from the executed call
     */
    function execute(
        address target,
        bytes calldata callData,
        uint256 nativeValue
    ) external payable returns (bytes memory);
}

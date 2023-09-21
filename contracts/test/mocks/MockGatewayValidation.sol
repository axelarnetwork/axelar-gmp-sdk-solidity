// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract MockGatewayValidation {
    function validateContractCall(
        bytes32,
        string calldata,
        string calldata,
        bytes32
    ) external pure returns (bool) {
        return true;
    }

    function validateContractCallAndMint(
        bytes32,
        string calldata,
        string calldata,
        bytes32,
        string calldata,
        uint256
    ) external pure returns (bool) {
        return true;
    }
}

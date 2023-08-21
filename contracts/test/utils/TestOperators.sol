// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract TestOperators {
    event NumAdded(uint256 num);

    function setNum(uint256 num) external payable returns (bool) {
        emit NumAdded(num);

        return true;
    }
}

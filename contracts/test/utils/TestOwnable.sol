// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { Ownable } from '../../utils/Ownable.sol';

contract TestOwnable is Ownable {
    uint256 public num;

    event NumAdded(uint256 num);

    constructor(address _owner) Ownable(_owner) {
        if (_OWNER_SLOT != keccak256('owner')) revert('invalid owner slot');
        if (_OWNERSHIP_TRANSFER_SLOT != keccak256('ownership-transfer')) revert('invalid ownership transfer slot');
    }

    function setNum(uint256 _num) external payable onlyOwner returns (bool) {
        num = _num;

        emit NumAdded(_num);

        return true;
    }
}

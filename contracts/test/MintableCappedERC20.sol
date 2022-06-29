// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IMintableCappedERC20 } from './interfaces/IMintableCappedERC20.sol';

import { ERC20 } from './ERC20.sol';
import { ERC20Permit } from './ERC20Permit.sol';

contract MintableCappedERC20 is IMintableCappedERC20, ERC20, ERC20Permit {
    uint256 public immutable cap;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 capacity
    ) ERC20(name, symbol, decimals) ERC20Permit(name) {
        cap = capacity;
    }

    function mint(address account, uint256 amount) external {
        uint256 capacity = cap;

        _mint(account, amount);

        if (capacity == 0) return;

        if (totalSupply > capacity) revert CapExceeded();
    }
}

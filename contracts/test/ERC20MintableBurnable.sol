// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;


import { IERC20MintableBurnable } from '../interfaces/IERC20MintableBurnable.sol';
import { ERC20 } from './ERC20.sol';

contract ERC20MintableBurnable is ERC20, IERC20MintableBurnable {
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) ERC20(name, symbol, decimals) {}

    function burn(address account, uint256 amount) external {
        _approve(account, msg.sender, allowance[account][msg.sender] - amount);
        _burn(account, amount);
    }
    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}

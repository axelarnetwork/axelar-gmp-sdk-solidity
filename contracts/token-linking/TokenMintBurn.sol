// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IERC20MintableBurnable } from '../interfaces/IERC20MintableBurnable.sol';

contract TokenMintBurn {
    error MintFailed();
    error BurnFailed();

    function _safeMint(
        address tokenAddress,
        address to,
        uint256 amount
    ) internal {
        (bool success, bytes memory returnData) = tokenAddress.call(
            abi.encodeWithSelector(IERC20MintableBurnable.mint.selector, to, amount)
        );
        bool transferred = success && (returnData.length == uint256(0) || abi.decode(returnData, (bool)));

        if (!transferred || tokenAddress.code.length == 0) revert MintFailed();
    }

    function _safeBurn(
        address tokenAddress,
        address from,
        uint256 amount
    ) internal {
        (bool success, bytes memory returnData) = tokenAddress.call(
            abi.encodeWithSelector(IERC20MintableBurnable.burn.selector, from, address(this), amount)
        );
        bool transferred = success && (returnData.length == uint256(0) || abi.decode(returnData, (bool)));

        if (!transferred || tokenAddress.code.length == 0) revert BurnFailed();
    }
}

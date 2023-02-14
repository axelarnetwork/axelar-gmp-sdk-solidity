// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IProxy } from '../interfaces/IProxy.sol';
import { IUpgradable } from '../interfaces/IUpgradable.sol';

contract BaseProxy is IProxy {
    // bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)
    bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    // keccak256('owner')
    bytes32 internal constant _OWNER_SLOT = 0x02016836a56b71f0d02689e69e326f4f4c1b9057164ef592671cf0d37c8040c0;

    function implementation() public view virtual returns (address implementation_) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            implementation_ := sload(_IMPLEMENTATION_SLOT)
        }
    }

    // solhint-disable-next-line no-empty-blocks
    function setup(bytes calldata setupParams) external {}

    function contractId() internal pure virtual returns (bytes32) {
        return bytes32(0);
    }

    // solhint-disable-next-line no-complex-fallback
    fallback() external payable virtual {
        address implementaion_ = implementation();
        // solhint-disable-next-line no-inline-assembly
        assembly {
            calldatacopy(0, 0, calldatasize())

            let result := delegatecall(gas(), implementaion_, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())

            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable virtual {}
}

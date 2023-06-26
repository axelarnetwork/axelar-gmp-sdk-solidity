// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IProxy } from '../interfaces/IProxy.sol';
import { IUpgradable } from '../interfaces/IUpgradable.sol';

/**
 * @title BaseProxy Contract
 * @author Kiryl Yermakou
 * @notice This abstract contract implements basic proxy functionalities. It provides an implementation
 * address storage slot and a fallback function to delegate calls to the implementation address.
 * This contract is meant to be inherited by other proxy contracts.
 */
abstract contract BaseProxy is IProxy {
    // bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)
    bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    // keccak256('owner')
    bytes32 internal constant _OWNER_SLOT = 0x02016836a56b71f0d02689e69e326f4f4c1b9057164ef592671cf0d37c8040c0;

    /**
     * @dev Returns the current implementation address.
     * @return implementation_ The address of the current implementation contract
     */
    function implementation() public view virtual returns (address implementation_) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            implementation_ := sload(_IMPLEMENTATION_SLOT)
        }
    }

    /**
     * @dev Shadows the setup function on the implementation contract. This way calling the setup function on the proxy
     * will call the empty code block below instead of hitting the setup function of the implementation.
     * @param setupParams The setup parameters for the implementation contract.
     */
    // solhint-disable-next-line no-empty-blocks
    function setup(bytes calldata setupParams) external {}

    /**
     * @dev Returns the contract ID. Meant to be overridden in derived contracts.
     * @return bytes32 The contract ID
     */
    function contractId() internal pure virtual returns (bytes32) {
        return bytes32(0);
    }

    /**
     * @dev Fallback function. Delegates the call to the current implementation contract.
     */
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

    /**
     * @dev Payable fallback function. Can be overridden in derived contracts.
     */
    // solhint-disable-next-line no-empty-blocks
    receive() external payable virtual {}
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IProxy } from '../interfaces/IProxy.sol';
import { IFinalProxy } from '../interfaces/IFinalProxy.sol';
import { IContractIdentifier } from '../interfaces/IContractIdentifier.sol';
import { Create3 } from '../deploy/Create3.sol';
import { BaseProxy } from './BaseProxy.sol';
import { Proxy } from './Proxy.sol';

/**
 * @title FinalProxy Contract
 * @notice The FinalProxy contract is a proxy that can be upgraded to a final implementation
 * that uses less gas than regular proxy calls. It inherits from the Proxy contract and implements
 * the IFinalProxy interface.
 */
contract FinalProxy is Create3, Proxy, IFinalProxy {
    // bytes32(uint256(keccak256('final-implementation')) - 1);
    bytes32 internal constant FINAL_IMPLEMENTATION_SALT =
        0x80df4dfef2d6527a47431f6f203697684e26d83f81418443821420778d4c4e8c;

    /**
     * @dev Constructs a FinalProxy contract with a given implementation address, owner, and setup parameters.
     * @param implementationAddress The address of the implementation contract
     * @param owner The owner of the proxy contract
     * @param setupParams Parameters to setup the implementation contract
     */
    constructor(
        address implementationAddress,
        address owner,
        bytes memory setupParams
    ) Proxy(implementationAddress, owner, setupParams) {}

    /**
     * @dev The final implementation address takes less gas to compute than reading an address from storage. That makes FinalProxy
     * more efficient when making delegatecalls to the implementation (assuming it is the final implementation).
     * @return implementation_ The address of the final implementation if it exists, otherwise the current implementation
     */
    function implementation() public view override(BaseProxy, IProxy) returns (address implementation_) {
        implementation_ = _finalImplementation();
        if (implementation_ == address(0)) {
            implementation_ = super.implementation();
        }
    }

    /**
     * @dev Checks if the final implementation has been deployed.
     * @return bool True if the final implementation exists, false otherwise
     */
    function isFinal() external view returns (bool) {
        return _finalImplementation() != address(0);
    }

    /**
     * @dev Computes the final implementation address.
     * @return implementation_ The address of the final implementation, or the zero address if the final implementation
     * has not yet been deployed
     */
    function _finalImplementation() internal view virtual returns (address implementation_) {
        // Computing the address is cheaper than using storage
        implementation_ = _create3Address(FINAL_IMPLEMENTATION_SALT);

        if (implementation_.code.length == 0) implementation_ = address(0);
    }

    /**
     * @dev Upgrades the proxy to a final implementation.
     * @param bytecode The bytecode of the final implementation contract
     * @param setupParams The parameters to setup the final implementation contract
     * @return finalImplementation_ The address of the final implementation contract
     */
    function finalUpgrade(bytes memory bytecode, bytes calldata setupParams)
        external
        returns (address finalImplementation_)
    {
        address owner;
        assembly {
            owner := sload(_OWNER_SLOT)
        }
        if (msg.sender != owner) revert NotOwner();

        bytes32 id = contractId();
        finalImplementation_ = _create3(bytecode, FINAL_IMPLEMENTATION_SALT);

        // Skipping the check if contractId() is not set by an inheriting proxy contract
        if (id != bytes32(0) && IContractIdentifier(finalImplementation_).contractId() != id)
            revert InvalidImplementation();

        if (setupParams.length != 0) {
            (bool success, ) = finalImplementation_.delegatecall(
                abi.encodeWithSelector(BaseProxy.setup.selector, setupParams)
            );
            if (!success) revert SetupFailed();
        }
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IProxy } from '../interfaces/IProxy.sol';
import { IFinalProxy } from '../interfaces/IFinalProxy.sol';
import { Create3 } from '../deploy/Create3.sol';
import { Proxy } from './Proxy.sol';

contract FinalProxy is Proxy, IFinalProxy {
    bytes32 internal constant FINAL_IMPLEMENTATION_SALT = keccak256('final-implementation');

    constructor(
        address implementationAddress,
        address owner,
        bytes memory setupParams
    ) Proxy(implementationAddress, owner, setupParams) {}

    function implementation() public view override(Proxy, IProxy) returns (address implementation_) {
        implementation_ = _finalImplementation();
        if (implementation_ == address(0)) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                implementation_ := sload(_IMPLEMENTATION_SLOT)
            }
        }
    }

    function isFinal() public view returns (bool) {
        return _finalImplementation() != address(0);
    }

    function _finalImplementation() internal view virtual returns (address implementation_) {
        // Computing address is cheaper than using storage
        implementation_ = Create3.deployedAddress(FINAL_IMPLEMENTATION_SALT, address(this));

        if (implementation_.code.length == 0) implementation_ = address(0);
    }

    function finalUpgrade(bytes memory bytecode, bytes calldata setupParams)
        public
        returns (address finalImplementation_)
    {
        address owner;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            owner := sload(_OWNER_SLOT)
        }
        if (msg.sender != owner) revert NotOwner();
        if (implementation() != address(0)) revert AlreadyInitialized();

        finalImplementation_ = Create3.deploy(FINAL_IMPLEMENTATION_SALT, bytecode);
        _setup(finalImplementation_, setupParams);
    }
}

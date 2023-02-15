// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IExpressProxyDeployer } from '../interfaces/IExpressProxyDeployer.sol';
import { IExpressProxy } from '../interfaces/IExpressProxy.sol';
import { Create3 } from '../deploy/Create3.sol';
import { ExpressProxy } from './ExpressProxy.sol';
import { ExpressRegistry } from './ExpressRegistry.sol';

contract ExpressProxyDeployer is IExpressProxyDeployer {
    address public immutable gateway;
    bytes32 public immutable proxyCodeHash;
    bytes32 public immutable registryCodeHash;

    constructor(address gateway_) {
        if (gateway_ == address(0)) revert InvalidAddress();

        gateway = gateway_;

        ExpressProxy proxy = new ExpressProxy(address(1), address(1), '', gateway_);
        proxy.deployRegistry(type(ExpressRegistry).creationCode);

        proxyCodeHash = address(proxy).codehash;
        registryCodeHash = address(proxy.registry()).codehash;
    }

    function isExpressProxy(address proxyAddress) external view returns (bool) {
        address expressRegistry = address(IExpressProxy(proxyAddress).registry());

        return proxyAddress.codehash == proxyCodeHash && expressRegistry.codehash == registryCodeHash;
    }

    /// @param host is delegating call to this contract
    function deployedProxyAddress(
        bytes32 salt,
        address sender,
        address host
    ) external pure returns (address) {
        bytes32 deploySalt = keccak256(abi.encode(sender, salt));
        return Create3.deployedAddress(deploySalt, host);
    }

    /// @dev delegatecall to this function to deploy a proxy from a host contract
    function deployExpressProxy(
        bytes32 deploySalt,
        address implementationAddress,
        address owner,
        bytes memory setupParams
    ) external returns (address proxyAddress) {
        proxyAddress = Create3.deploy(
            deploySalt,
            abi.encodePacked(
                type(ExpressProxy).creationCode,
                abi.encode(implementationAddress, owner, setupParams, gateway)
            )
        );

        ExpressProxy proxy = ExpressProxy(payable(proxyAddress));
        proxy.deployRegistry(type(ExpressRegistry).creationCode);
    }
}

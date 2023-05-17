// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import { IExpressProxyDeployer } from '../interfaces/IExpressProxyDeployer.sol';
import { AxelarExecutable } from '../executable/AxelarExecutable.sol';
import { IExpressProxyFactory } from '../interfaces/IExpressProxyFactory.sol';

contract ExpressProxyFactory is AxelarExecutable, IExpressProxyFactory {
    IExpressProxyDeployer public immutable proxyDeployer;

    constructor(address gateway_, address proxyDeployer_) AxelarExecutable(gateway_) {
        if (proxyDeployer_ == address(0)) revert InvalidAddress();

        proxyDeployer = IExpressProxyDeployer(proxyDeployer_);
    }

    function isExpressProxy(address proxyAddress) public view returns (bool) {
        return proxyDeployer.isExpressProxy(proxyAddress);
    }

    function deployedProxyAddress(bytes32 salt, address sender) external view returns (address) {
        return proxyDeployer.deployedProxyAddress(salt, sender, address(this));
    }

    function deployExpressProxy(
        bytes32 salt,
        address implementationAddress,
        address owner,
        bytes calldata setupParams
    ) external returns (address) {
        bytes32 deploySalt = keccak256(abi.encode(msg.sender, salt));
        return _deployExpressProxy(deploySalt, implementationAddress, owner, setupParams);
    }

    function _deployExpressProxy(
        bytes32 deploySalt,
        address implementationAddress,
        address owner,
        bytes memory setupParams
    ) internal returns (address deployedAddress) {
        (, bytes memory data) = address(proxyDeployer).delegatecall(
            abi.encodeWithSelector(
                IExpressProxyDeployer.deployExpressProxy.selector,
                deploySalt,
                implementationAddress,
                owner,
                setupParams
            )
        );
        (deployedAddress) = abi.decode(data, (address));
    }
}

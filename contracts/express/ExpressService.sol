// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import { Upgradable } from '../upgradable/Upgradable.sol';
import { SafeTokenTransfer, SafeNativeTransfer } from '../utils/SafeTransfer.sol';
import { IExpressProxy } from '../interfaces/IExpressProxy.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { IExpressProxyDeployer } from '../interfaces/IExpressProxyDeployer.sol';
import { IExpressService } from '../interfaces/IExpressService.sol';
import { AxelarExecutable } from '../executable/AxelarExecutable.sol';

contract ExpressService is Upgradable, AxelarExecutable, IExpressService {
    using SafeTokenTransfer for IERC20;
    using SafeNativeTransfer for address payable;

    IExpressProxyDeployer public immutable proxyDeployer;

    address public immutable expressOperator;

    constructor(
        address gateway_,
        address proxyDeployer_,
        address expressOperator_
    ) AxelarExecutable(gateway_) {
        if (expressOperator_ == address(0)) revert InvalidOperator();
        if (proxyDeployer_ == address(0)) revert InvalidAddress();

        proxyDeployer = IExpressProxyDeployer(proxyDeployer_);
        expressOperator = expressOperator_;
    }

    modifier onlyOperator() {
        if (msg.sender != expressOperator) revert NotOperator();

        _;
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

    function callWithToken(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        address contractAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) external onlyOperator {
        if (contractAddress == address(0)) revert InvalidContractAddress();

        if (commandId != bytes32(0) && gateway.isCommandExecuted(commandId)) {
            IExpressProxy(contractAddress).executeWithToken(
                commandId,
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount
            );
        } else {
            if (!isExpressProxy(contractAddress)) revert NotExpressProxy();

            address tokenAddress = gateway.tokenAddresses(tokenSymbol);

            if (tokenAddress == address(0)) revert InvalidTokenSymbol();

            IERC20(tokenAddress).approve(contractAddress, amount);
            IExpressProxy(contractAddress).expressExecuteWithToken(
                sourceChain,
                sourceAddress,
                payload,
                tokenSymbol,
                amount
            );
        }
    }

    function withdraw(
        address payable receiver,
        address token,
        uint256 amount
    ) external onlyOperator {
        if (receiver == address(0)) revert InvalidAddress();

        if (token == address(0)) {
            receiver.safeNativeTransfer(amount);
        } else {
            IERC20(token).safeTransfer(receiver, amount);
        }
    }

    function contractId() external pure returns (bytes32) {
        return keccak256('axelar-gmp-express-service');
    }
}

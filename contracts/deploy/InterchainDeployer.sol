// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { AxelarExecutable } from '../executable/AxelarExecutable.sol';
import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IAxelarGasService } from '../interfaces/IAxelarGasService.sol';

import { IInterchainDeployer } from '../interfaces/IInterchainDeployer.sol';
import { IUpgradable } from '../interfaces/IUpgradable.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { Proxy } from '../upgradable/Proxy.sol';
import { Ownable } from '../utils/Ownable.sol';
import { Create3 } from './Create3.sol';

contract InterchainDeployer is IInterchainDeployer, AxelarExecutable, Ownable, Create3 {
    IAxelarGasService public immutable gasService;

    mapping(string => mapping(string => bool)) public whitelistedSourceAddresses;

    constructor(
        address gateway_,
        address gasService_,
        address owner_
    ) AxelarExecutable(gateway_) Ownable(owner_) {
        gasService = IAxelarGasService(gasService_);
    }

    function deployStaticContract(bytes32 userSalt, bytes memory implementationBytecode) external {
        _deployStatic(msg.sender, userSalt, implementationBytecode, '');
    }

    function getProxyAddress(bytes32 userSalt) external view returns (address) {
        return _create3Address(keccak256(abi.encode(msg.sender, userSalt)));
    }

    function deployUpgradeableContract(
        bytes32 userSalt,
        bytes memory newImplementationBytecode,
        bytes memory setupParams
    ) external {
        _deployUpgradeable(msg.sender, userSalt, newImplementationBytecode, setupParams, '');
    }

    function upgradeUpgradeableContract(
        bytes32 userSalt,
        bytes memory newImplementationBytecode,
        bytes memory setupParams
    ) external {
        _upgradeUpgradeable(msg.sender, userSalt, newImplementationBytecode, setupParams, '');
    }

    function deployRemoteStaticContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt) external payable {
        require(msg.value > 0, 'Gas payment is required');
        _sendRemote(Command.DeployStatic, remoteChainData, userSalt);
    }

    function deployRemoteUpgradeableContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt)
        external
        payable
    {
        require(msg.value > 0, 'Gas payment is required');
        _sendRemote(Command.DeployUpgradeable, remoteChainData, userSalt);
    }

    function upgradeRemoteContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt) external payable {
        require(msg.value > 0, 'Gas payment is required');
        _sendRemote(Command.UpgradeUpgradeable, remoteChainData, userSalt);
    }

    function _sendRemote(
        Command command,
        RemoteChains[] calldata remoteChains,
        bytes32 userSalt
    ) internal {
        for (uint256 i = 0; i < remoteChains.length; i++) {
            bytes memory payload = abi.encode(
                command,
                msg.sender,
                userSalt,
                remoteChains[i].implBytecode,
                remoteChains[i].implSetupParams
            );
            if (remoteChains[i].gas > 0) {
                gasService.payNativeGasForContractCall{ value: remoteChains[i].gas }(
                    address(this),
                    remoteChains[i].destinationChain,
                    remoteChains[i].destinationAddress,
                    payload,
                    msg.sender
                );
            }
            gateway.callContract(remoteChains[i].destinationChain, remoteChains[i].destinationAddress, payload);
        }
    }

    function _upgradeUpgradeable(
        address sender,
        bytes32 userSalt,
        bytes memory newImplementationBytecode,
        bytes memory setupParams,
        string memory sourceChain
    ) internal {
        bytes32 deploySalt = keccak256(abi.encode(sender, userSalt));
        address proxy = _create3Address(deploySalt);
        address newImplementation = _deployImplementation(deploySalt, newImplementationBytecode);
        bytes32 newImplementationCodeHash = newImplementation.codehash;
        IUpgradable(proxy).upgrade(newImplementation, newImplementationCodeHash, setupParams);
        emit UpgradedContract(sender, userSalt, proxy, newImplementation, sourceChain);
    }

    function _deployStatic(
        address sender,
        bytes32 userSalt,
        bytes memory implementationBytecode,
        string memory sourceChain
    ) internal {
        bytes32 deploySalt = keccak256(abi.encode(sender, userSalt));
        address deployedImplementationAddress = _deployImplementation(deploySalt, implementationBytecode);
        emit DeployedStaticContract(sender, userSalt, deployedImplementationAddress, sourceChain);
    }

    function _deployUpgradeable(
        address sender,
        bytes32 userSalt,
        bytes memory implementationBytecode,
        bytes memory setupParams,
        string memory sourceChain
    ) internal {
        bytes32 deploySalt = keccak256(abi.encode(sender, userSalt));
        address implementation = _deployImplementation(deploySalt, implementationBytecode);
        address proxy = _deployProxy(deploySalt, implementation, setupParams);

        emit DeployedUpgradeableContract(sender, userSalt, proxy, implementation, sourceChain);
    }

    function _deployImplementation(bytes32 deploySalt, bytes memory implementationBytecode) internal returns (address) {
        if (implementationBytecode.length == 0) revert('empty bytecode');

        address implementation;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            implementation := create2(0, add(implementationBytecode, 32), mload(implementationBytecode), deploySalt)
        }

        if (implementation == address(0)) revert('failed to deploy');

        return implementation;
    }

    function _deployProxy(
        bytes32 deploySalt,
        address implementationAddress,
        bytes memory setupParams
    ) internal returns (address proxy) {
        return
            _create3(
                abi.encodePacked(
                    type(Proxy).creationCode,
                    abi.encode(implementationAddress, address(this), setupParams)
                ),
                deploySalt
            );
    }

    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        if (!whitelistedSourceAddresses[sourceChain][sourceAddress]) {
            revert NotWhitelistedSourceAddress();
        }
        Command command = abi.decode(payload, (Command));

        if (command == Command.DeployStatic) {
            (, address sender, bytes32 userSalt, bytes memory bytecode) = abi.decode(
                payload,
                (Command, address, bytes32, bytes)
            );
            _deployStatic(sender, userSalt, bytecode, sourceChain);
        } else if (command == Command.DeployUpgradeable) {
            (, address sender, bytes32 userSalt, bytes memory bytecode, bytes memory setupParams) = abi.decode(
                payload,
                (Command, address, bytes32, bytes, bytes)
            );
            _deployUpgradeable(sender, userSalt, bytecode, setupParams, sourceChain);
        } else if (command == Command.UpgradeUpgradeable) {
            (, address sender, bytes32 userSalt, bytes memory bytecode, bytes memory setupParams) = abi.decode(
                payload,
                (Command, address, bytes32, bytes, bytes)
            );
            _upgradeUpgradeable(sender, userSalt, bytecode, setupParams, sourceChain);
        } else {
            revert('invalid command');
        }
    }

    function setWhitelistedSourceAddress(
        string calldata sourceChain,
        string calldata sourceSender,
        bool whitelisted
    ) external onlyOwner {
        whitelistedSourceAddresses[sourceChain][sourceSender] = whitelisted;
        emit WhitelistedSourceAddressSet(sourceChain, sourceSender, whitelisted);
    }
}

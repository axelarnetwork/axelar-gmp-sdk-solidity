// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { AxelarExecutable } from '../executable/AxelarExecutable.sol';
import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IAxelarGasService } from '../interfaces/IAxelarGasService.sol';

import { IInterchainDeployer } from '../interfaces/IInterchainDeployer.sol';
import { IUpgradable } from '../interfaces/IUpgradable.sol';
import { IDeployer } from '../interfaces/IDeployer.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { Proxy } from '../upgradable/Proxy.sol';
import { Ownable } from '../utils/Ownable.sol';

struct RemoteChains {
    string destinationChain;
    string destinationAddress;
    uint256 gas;
}

contract InterchainDeployer is IInterchainDeployer, AxelarExecutable, Ownable {
    IAxelarGasService public immutable gasService;
    IDeployer public immutable create3Deployer;
    enum Command {
        Deploy,
        Upgrade
    }
    mapping(address => address) public owners;
    mapping(string => mapping(string => bool)) public whitelistedSourceAddresses;

    constructor(
        address gateway_,
        address gasReceiver_,
        address create3Deployer_,
        address owner_
    ) AxelarExecutable(gateway_) Ownable(owner_) {
        gasService = IAxelarGasService(gasReceiver_);
        create3Deployer = IDeployer(create3Deployer_);
    }

    /**
     * @notice Modifier that throws an error if called by any account other than the owner.
     */
    modifier onlyProxyOwner(address _proxyAddress) {
        if (owners[_proxyAddress] != msg.sender) revert('not proxy owner');

        _;
    }

    modifier onlyRemoteProxyOwner(address _proxyAddress, address _owner) {
        if (owners[_proxyAddress] != _owner) revert('not remote proxy owner');

        _;
    }

    function deployRemoteContracts(
        RemoteChains[] calldata remoteChains,
        bytes calldata implementationBytecode,
        bytes32 salt,
        bytes calldata setupParams
    ) external payable {
        require(msg.value > 0, 'Gas payment is required');

        bytes memory payload = abi.encode(Command.Deploy, implementationBytecode, salt, msg.sender, setupParams);

        _fanOut(remoteChains, payload);
    }

    function upgradeRemoteContracts(
        RemoteChains[] calldata remoteChains,
        address proxyAddress,
        address newImplementation,
        bytes32 newImplementationCodeHash,
        bytes calldata setupParams
    ) external payable {
        require(msg.value > 0, 'Gas payment is required');

        bytes memory payload = abi.encode(
            Command.Upgrade,
            msg.sender,
            proxyAddress,
            newImplementation,
            newImplementationCodeHash,
            setupParams
        );

        _fanOut(remoteChains, payload);
    }

    function _fanOut(RemoteChains[] calldata remoteChains, bytes memory payload) internal {
        for (uint256 i = 0; i < remoteChains.length; i++) {
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

    function upgrade(
        address proxyAddress,
        address newImplementation,
        bytes32 newImplementationCodeHash,
        bytes memory params
    ) external onlyProxyOwner(proxyAddress) {
        _upgrade(proxyAddress, msg.sender, newImplementation, newImplementationCodeHash, params);
    }

    function _upgrade(
        address proxyAddress,
        address owner,
        address newImplementation,
        bytes32 newImplementationCodeHash,
        bytes memory params
    ) internal onlyRemoteProxyOwner(proxyAddress, owner) {
        IUpgradable(proxyAddress).upgrade(newImplementation, newImplementationCodeHash, params);
        emit Upgraded(IUpgradable(proxyAddress).implementation());
    }

    function _deployUpgradeable(
        bytes memory implementationBytecode,
        bytes32 salt,
        bytes memory setupParams,
        address owner
    ) internal {
        address deployedImplementationAddress = _deployImplementation(salt, implementationBytecode);
        address deployedProxyAddress = _deployProxy(deployedImplementationAddress, address(this), setupParams);

        _setOwnerOnProxy(deployedProxyAddress, owner);

        emit Deployed(owner, deployedImplementationAddress, deployedProxyAddress);
    }

    function _setOwnerOnProxy(address proxyAddress, address owner) internal {
        owners[proxyAddress] = owner;
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
        address implementationAddress,
        address owner,
        bytes memory setupParams
    ) internal returns (address deployedProxyAddress) {
        return address(new Proxy(implementationAddress, owner, setupParams));
    }

    function _execute(
        string calldata sourceChain_,
        string calldata sourceAddress_,
        bytes calldata payload_
    ) internal override {
        if (!whitelistedSourceAddresses[sourceChain_][sourceAddress_]) {
            revert NotWhitelistedSourceAddress();
        }
        Command command = abi.decode(payload_, (Command));

        if (command == Command.Deploy) {
            (, bytes memory implementationBytecode, bytes32 salt, address owner, bytes memory setupParams) = abi.decode(
                payload_,
                (Command, bytes, bytes32, address, bytes)
            );
            _deployUpgradeable(implementationBytecode, salt, setupParams, owner);
        } else if (command == Command.Upgrade) {
            (
                ,
                address proxyAddress,
                address owner,
                address newImplementation,
                bytes32 newImplementationCodeHash,
                bytes memory setupParams
            ) = abi.decode(payload_, (Command, address, address, address, bytes32, bytes));
            _upgrade(proxyAddress, owner, newImplementation, newImplementationCodeHash, setupParams);
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

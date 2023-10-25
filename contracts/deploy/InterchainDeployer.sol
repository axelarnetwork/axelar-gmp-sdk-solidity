// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { AxelarExecutable } from '../executable/AxelarExecutable.sol';
import { IAxelarGateway } from '../interfaces/IAxelarGateway.sol';
import { IAxelarGasService } from '../interfaces/IAxelarGasService.sol';
import { StringToAddress } from '../libs/AddressString.sol';

import { IInterchainDeployer } from '../interfaces/IInterchainDeployer.sol';
import { IUpgradable } from '../interfaces/IUpgradable.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { Proxy } from '../upgradable/Proxy.sol';
import { Ownable } from '../utils/Ownable.sol';
import { Create3 } from './Create3.sol';

contract InterchainDeployer is IInterchainDeployer, AxelarExecutable, Ownable, Create3 {
    using StringToAddress for string;
    IAxelarGasService public immutable gasService;
    address governanceExecutor;

    mapping(address => bool) public whitelistedSourceAddresses;
    mapping(address => address) public igeRestrictedProxies;

    constructor(
        address gateway_,
        address gasService_,
        address owner_,
        address governanceExecutor_
    ) AxelarExecutable(gateway_) Ownable(owner_) {
        gasService = IAxelarGasService(gasService_);
        governanceExecutor = governanceExecutor_;
        whitelistedSourceAddresses[address(this)] = true;
    }

    function setWhitelistedSourceAddress(address sourceSender, bool whitelisted) public onlyOwner {
        whitelistedSourceAddresses[sourceSender] = whitelisted;
        emit WhitelistedSourceAddressSet(sourceSender, whitelisted);
    }

    function deployStaticContract(bytes32 userSalt, bytes memory implementationBytecode) external {
        _deployStatic(msg.sender, userSalt, implementationBytecode, '');
    }

    function setGovernanceExecutor(address governanceExecutor_) external onlyOwner {
        governanceExecutor = governanceExecutor_;
    }

    function getProxyAddress(bytes32 userSalt) public view returns (address) {
        return _create3Address(keccak256(abi.encode(msg.sender, userSalt)));
    }

    function deployUpgradeableContract(bytes32 userSalt, ImplContractDetails memory contractDetails) external {
        _deployUpgradeable(msg.sender, userSalt, contractDetails, '');
    }

    function upgradeUpgradeableContract(
        address proxyOwner,
        bytes32 userSalt,
        ImplContractDetails memory contractDetails
    ) external {
        address proxy;

        if (msg.sender == governanceExecutor) {
            proxy = _create3Address(keccak256(abi.encode(proxyOwner, userSalt)));
        } else if (msg.sender == proxyOwner) {
            proxy = _create3Address(keccak256(abi.encode(msg.sender, userSalt)));
        } else {
            revert CannotUpgradeForSomeoneElse('cannot upgrade for someone else');
        }

        address ownerInMapping = igeRestrictedProxies[proxy];

        if (ownerInMapping != address(0x0) && msg.sender != governanceExecutor)
            revert CannotUpgradeFromNonIGEAccount('Only upgradeable via IGE');

        _upgradeUpgradeable(
            ownerInMapping != address(0x0) ? ownerInMapping : msg.sender,
            userSalt,
            contractDetails,
            ''
        );
    }

    function deployRemoteStaticContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt) external payable {
        _sendRemote(Command.DeployStatic, remoteChainData, userSalt);
    }

    function deployRemoteUpgradeableContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt)
        external
        payable
    {
        _sendRemote(Command.DeployUpgradeable, remoteChainData, userSalt);
    }

    function upgradeRemoteContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt) external payable {
        _sendRemote(Command.UpgradeUpgradeable, remoteChainData, userSalt);
    }

    function _sendRemote(
        Command command,
        RemoteChains[] calldata remoteChains,
        bytes32 userSalt
    ) internal {
        require(msg.value > 0, 'Gas payment is required');

        for (uint256 i = 0; i < remoteChains.length; i++) {
            bytes memory payload = abi.encode(command, msg.sender, userSalt, remoteChains[i].contractDetails);

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
        ImplContractDetails memory contractDetails,
        string memory sourceChain
    ) internal {
        bytes32 deploySalt = keccak256(abi.encode(sender, userSalt));
        address proxy = _create3Address(deploySalt);
        address newImplementation = _deployImplementation(deploySalt, contractDetails.implBytecode);
        bytes32 newImplementationCodeHash = newImplementation.codehash;
        IUpgradable(proxy).upgrade(newImplementation, newImplementationCodeHash, contractDetails.implSetupParams);
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
        ImplContractDetails memory contractDetails,
        string memory sourceChain
    ) internal {
        bytes32 deploySalt = keccak256(abi.encode(sender, userSalt));
        address implementation = _deployImplementation(deploySalt, contractDetails.implBytecode);
        address proxy = _deployProxy(deploySalt, implementation, contractDetails.implSetupParams);

        if (governanceExecutor != address(0x0) && contractDetails.onlyIGEUpgrades) igeRestrictedProxies[proxy] = sender;

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
        if (!whitelistedSourceAddresses[StringToAddress.toAddress(sourceAddress)]) {
            revert NotWhitelistedSourceAddress();
        }
        Command command = abi.decode(payload, (Command));

        if (command == Command.DeployStatic) {
            (, address sender, bytes32 userSalt, ImplContractDetails memory contractDetails) = abi.decode(
                payload,
                (Command, address, bytes32, ImplContractDetails)
            );
            _deployStatic(sender, userSalt, contractDetails.implBytecode, sourceChain);
        } else if (command == Command.DeployUpgradeable) {
            (, address sender, bytes32 userSalt, ImplContractDetails memory contractDetails) = abi.decode(
                payload,
                (Command, address, bytes32, ImplContractDetails)
            );

            _deployUpgradeable(sender, userSalt, contractDetails, sourceChain);
        } else if (command == Command.UpgradeUpgradeable) {
            (, address sender, bytes32 userSalt, ImplContractDetails memory contractDetails) = abi.decode(
                payload,
                (Command, address, bytes32, ImplContractDetails)
            );
            address proxy = _create3Address(keccak256(abi.encode(sender, userSalt)));
            if (igeRestrictedProxies[proxy] != address(0x0))
                revert CannotUpgradeFromNonIGEAccount('Only upgradeable via IGE');
            _upgradeUpgradeable(sender, userSalt, contractDetails, sourceChain);
        } else {
            revert('invalid command');
        }
    }
}

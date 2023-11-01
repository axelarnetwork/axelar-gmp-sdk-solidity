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

/**
 * @title InterchainDeployer
 * @dev This contract enables the deployment of smart contracts across multiple
 * chains from a single source chain. Both fixed implementation and upgradeable contract
 * deployments are supported.
 *
 * For upgradeable contracts, upgradeability is also supported, either directly
 * by the owner of the contract (if allowed by the owner during contract creation)
 * or by an approved Governance Executor contract.
 *
 */
contract InterchainDeployer is IInterchainDeployer, AxelarExecutable, Ownable, Create3 {
    using StringToAddress for string;
    IAxelarGasService public immutable gasService;

    // The `InterchainDeployer` contract address at the source chain is set as a whitelisted source address by default
    mapping(address => bool) public whitelistedSourceAddresses;

    // A mapping of upgradeable proxy contract addresses and their owners,
    // as specified by the user initially deploying the contract.
    mapping(address => address) public proxyOwner;

    constructor(
        address gateway_,
        address gasService_,
        address owner_
    ) AxelarExecutable(gateway_) Ownable(owner_) {
        gasService = IAxelarGasService(gasService_);
        whitelistedSourceAddresses[address(this)] = true;
    }

    /**
     * @dev Change the whitelisted caller address from the source chain
     * @param sourceSender The source sender
     * @param whitelisted The whitelist status
     */
    function setWhitelistedSourceAddress(address sourceSender, bool whitelisted) public onlyOwner {
        whitelistedSourceAddresses[sourceSender] = whitelisted;
        emit WhitelistedSourceAddressSet(sourceSender, whitelisted);
    }

    /**
     * @dev Deploy a fixed implementation contract on a chain. Not an interchain call.
     * @param userSalt Unique salt used to deploy the contract
     * @param implementationBytecode The bytecode of the contract to deploy. This should be compiled into bytecode with packed constructor args
     */
    function deployStaticContract(bytes32 userSalt, bytes memory implementationBytecode) external {
        _deployStatic(msg.sender, userSalt, implementationBytecode, '');
    }

    /**
     * @dev Utility method that returns an address derived from the msg.sender and its unique salt
     * @param userSalt Unique salt used to deploy the contract
     */
    function getProxyAddress(bytes32 userSalt) public view returns (address) {
        return _create3Address(keccak256(abi.encode(msg.sender, userSalt)));
    }

    /**
     * @dev Deploy an upgradeable implementation contract on a chain. Not an interchain call.
     * @param userSalt Unique salt used to deploy the contract
     * @param contractDetails The details of the implementation, including the implementation bytecode, setup parameters,
     * and instructions on whether or not this contract can only be upgraded through governance proposal via IGE
     */
    function deployUpgradeableContract(bytes32 userSalt, ImplContractDetails memory contractDetails) external {
        _deployUpgradeable(msg.sender, userSalt, contractDetails, '');
    }

    /**
     * @dev Upgrades the implementation of an upgradeable contract. Not an interchain call. This method can only be called
     * by either the owner of the proxy contract in question or via the approved interchain governance executor contract
     * @param userSalt Unique salt used to deploy the contract
     * @param contractDetails The details of the implementation, including the implementation bytecode and setup parameters
     */
    function upgradeUpgradeableContract(bytes32 userSalt, ImplContractDetails memory contractDetails) external {
        _upgradeUpgradeable(msg.sender, userSalt, contractDetails, '');
    }

    /**
     * @dev Deploy a fixed implementation contract to an array of specified destination chains. This is an interchain call.
     * @param userSalt Unique salt used to deploy the contract
     * @param remoteChainData Details of the remote chains that should deploy the contracts
     */
    function deployRemoteStaticContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt) external payable {
        _sendRemote(Command.DeployStatic, remoteChainData, userSalt);
    }

    /**
     * @dev Deploy an upgradeable contract to an array of specified destination chains. This is an interchain call.
     * @param userSalt Unique salt used to deploy the contract
     * @param remoteChainData Details of the remote chains that should deploy the contracts
     */
    function deployRemoteUpgradeableContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt)
        external
        payable
    {
        _sendRemote(Command.DeployUpgradeable, remoteChainData, userSalt);
    }

    /**
     * @dev Upgrade an upgradeable contract to an array of specified destination chains. This is an interchain call.
     * Note this will only work if the sender is the owner of the originally-deployed proxy contract.
     * @param userSalt Unique salt used to deploy the contract
     * @param remoteChainData Details of the remote chains that should deploy the contracts
     */
    function upgradeRemoteContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt) external payable {
        _sendRemote(Command.UpgradeUpgradeable, remoteChainData, userSalt);
    }

    /**
     * @dev Internal method. Written to abstract the cross-chain GMP call that includes gas payments.
     */
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

    /**
     * @dev Internal method that:
     * 1. Derives the deploySalt from the sender + userSalt params
     * 2. Finds the create3 proxy address
     * 3. Deploys the new implementation bytecode
     * 4. Upgrades the proxy contract
     */
    function _upgradeUpgradeable(
        address sender,
        bytes32 userSalt,
        ImplContractDetails memory contractDetails,
        string memory sourceChain
    ) internal {
        bytes32 deploySalt = keccak256(abi.encode(sender, userSalt));
        address proxy = _create3Address(deploySalt);
        address approvedOwner = proxyOwner[proxy];

        if (approvedOwner == address(0x0)) revert NoProxyFound('No proxy found');
        if (sender != approvedOwner) revert CannotUpgradeForSomeoneElse('Cannot upgrade for someone else');

        address newImplementation = _deployImplementation(deploySalt, contractDetails.implBytecode);
        bytes32 newImplementationCodeHash = newImplementation.codehash;
        IUpgradable(proxy).upgrade(newImplementation, newImplementationCodeHash, contractDetails.implSetupParams);

        emit UpgradedContract(sender, userSalt, proxy, newImplementation, sourceChain);
    }

    /**
     * @dev Internal method that deployed a fixed implementation contract
     */
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

    /**
     * @dev Internal method that deploys an upgradeable contract
     * If the user specifies 'governanceExecutorAddress',
     * then that address is the owner of the contract
     */
    function _deployUpgradeable(
        address sender,
        bytes32 userSalt,
        ImplContractDetails memory contractDetails,
        string memory sourceChain
    ) internal {
        address owner = contractDetails.governanceExecutorAddress != address(0x0)
            ? contractDetails.governanceExecutorAddress
            : sender;
        bytes32 deploySalt = keccak256(abi.encode(owner, userSalt));

        address implementation = _deployImplementation(deploySalt, contractDetails.implBytecode);
        address proxy = _deployProxy(deploySalt, implementation, contractDetails.implSetupParams);

        proxyOwner[proxy] = owner;

        emit DeployedUpgradeableContract(owner, userSalt, proxy, implementation, sourceChain);
    }

    /**
     * @dev Internal method that deploys an implementation using create2
     */
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

    /**
     * @dev Internal method that deploys a standard proxy contract using create3
     */
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

    /**
     * @dev Internal callback executable that can only be invoked from the whitelisted source address.
     * Handles three cross-chain use cases to either:
     * 1. deploy a fixed implementation contract
     * 2. deploy an upgradeable contract
     * 3. upgrade an upgradeable contract
     */
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
            _upgradeUpgradeable(sender, userSalt, contractDetails, sourceChain);
        } else {
            revert('invalid command');
        }
    }
}

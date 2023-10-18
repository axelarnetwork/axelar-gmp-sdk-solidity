// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IOwnable } from './IOwnable.sol';
import { IAxelarExecutable } from './IAxelarExecutable.sol';
import { IDeploy } from './IDeploy.sol';

interface IInterchainDeployer is IOwnable, IAxelarExecutable, IDeploy {
    struct RemoteChains {
        string destinationChain;
        string destinationAddress;
        uint256 gas;
        //TODO add constructor args bytes, i.e. bytes calldata implConstructorArgs
        //TODO add setupParam args bytes, i.e. bytes calldata implSetupParams
    }

    enum Command {
        DeployStatic,
        DeployUpgradeable,
        UpgradeUpgradeable
    }

    event Deployed(
        address indexed sender,
        bytes32 indexed userSalt,
        address indexed proxy,
        address implementation,
        string sourceChain
    );
    event Upgraded(
        address indexed sender,
        bytes32 indexed userSalt,
        address indexed proxy,
        address implementation,
        string sourceChain
    );
    event WhitelistedSourceAddressSet(string indexed sourceChain, string sourceSender, bool whitelisted);
    error NotWhitelistedSourceAddress();

    function deployStatic(bytes32 userSalt, bytes memory implementationBytecode) external;

    function deployUpgradeable(
        bytes32 userSalt,
        bytes memory newImplementationBytecode,
        bytes memory setupParams
    ) external;

    function deployRemoteContracts(
        RemoteChains[] calldata remoteChains,
        bytes calldata implementationBytecode,
        bytes32 userSalt,
        bytes calldata setupParams
    ) external payable;

    function upgradeUpgradeable(
        bytes32 userSalt,
        bytes memory newImplementationBytecode,
        bytes memory params
    ) external;

    function upgradeRemoteContracts(
        RemoteChains[] calldata remoteChains,
        bytes32 userSalt,
        bytes calldata newImplementationBytecode,
        bytes calldata setupParams
    ) external payable;

    function setWhitelistedSourceAddress(
        string calldata sourceChain,
        string calldata sourceSender,
        bool whitelisted
    ) external;
}

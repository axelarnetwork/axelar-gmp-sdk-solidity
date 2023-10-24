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
        bytes implBytecode;
        bytes implSetupParams;
    }

    enum Command {
        DeployStatic,
        DeployUpgradeable,
        UpgradeUpgradeable
    }

    event DeployedStaticContract(
        address indexed sender,
        bytes32 indexed userSalt,
        address implementation,
        string sourceChain
    );

    event DeployedUpgradeableContract(
        address indexed sender,
        bytes32 indexed userSalt,
        address indexed proxy,
        address implementation,
        string sourceChain
    );
    event UpgradedContract(
        address indexed sender,
        bytes32 indexed userSalt,
        address indexed proxy,
        address implementation,
        string sourceChain
    );
    event WhitelistedSourceAddressSet(string indexed sourceChain, string sourceSender, bool whitelisted);
    error NotWhitelistedSourceAddress();

    function deployStaticContract(bytes32 userSalt, bytes memory implementationBytecode) external;

    function deployUpgradeableContract(
        bytes32 userSalt,
        bytes memory newImplementationBytecode,
        bytes memory setupParams
    ) external;

    function deployRemoteStaticContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt) external payable;

    function deployRemoteUpgradeableContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt)
        external
        payable;

    function upgradeUpgradeableContract(
        bytes32 userSalt,
        bytes memory newImplementationBytecode,
        bytes memory setupParams
    ) external;

    function upgradeRemoteContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt) external payable;

    function getProxyAddress(bytes32 userSalt) external view returns (address);

    function setWhitelistedSourceAddress(
        string calldata sourceChain,
        string calldata sourceSender,
        bool whitelisted
    ) external;
}

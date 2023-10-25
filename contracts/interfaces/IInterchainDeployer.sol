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
        ImplContractDetails contractDetails;
    }

    struct ImplContractDetails {
        bytes implBytecode;
        bytes implSetupParams;
        bool onlyIGEUpgrades;
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
    event WhitelistedSourceAddressSet(address sourceSender, bool whitelisted);
    error NotWhitelistedSourceAddress();
    error CannotUpgradeFromNonIGEAccount(string reason);
    error CannotUpgradeForSomeoneElse(string reason);

    function deployStaticContract(bytes32 userSalt, bytes memory implementationBytecode) external;

    function deployUpgradeableContract(bytes32 userSalt, ImplContractDetails memory contractDetails) external;

    function deployRemoteStaticContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt) external payable;

    function deployRemoteUpgradeableContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt)
        external
        payable;

    function upgradeUpgradeableContract(
        address proxyOwner,
        bytes32 userSalt,
        ImplContractDetails memory contractDetails
    ) external;

    function upgradeRemoteContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt) external payable;

    function getProxyAddress(bytes32 userSalt) external view returns (address);

    function setWhitelistedSourceAddress(address sourceSender, bool whitelisted) external;

    function setGovernanceExecutor(address governanceExecutor_) external;
}

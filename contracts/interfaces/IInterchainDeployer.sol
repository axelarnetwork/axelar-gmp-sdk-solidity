// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IOwnable } from './IOwnable.sol';
import { IAxelarExecutable } from './IAxelarExecutable.sol';
import { IDeploy } from './IDeploy.sol';

interface IInterchainDeployer is IOwnable, IAxelarExecutable, IDeploy {
    /**
     * The struct that is used in cross-chain GMP calls where
     * the user can specify details of the contract to be deployed to
     * destination chains
     */
    struct RemoteChains {
        string destinationChain;
        string destinationAddress;
        uint256 gas;
        ImplContractDetails contractDetails;
    }

    /**
     * The struct that is used for the details of an implementation
     * contract
     */
    struct ImplContractDetails {
        bytes implBytecode;
        bytes implSetupParams;
        bool onlyIGEUpgrades;
    }

    // an enum used to declare the type of cross-chain function to execute
    enum Command {
        DeployStatic,
        DeployUpgradeable,
        UpgradeUpgradeable
    }

    // an event emitted when a static contract is deployed
    event DeployedStaticContract(
        address indexed sender,
        bytes32 indexed userSalt,
        address implementation,
        string sourceChain
    );

    // an event emitted when an upgradeable contract is deployed
    event DeployedUpgradeableContract(
        address indexed sender,
        bytes32 indexed userSalt,
        address indexed proxy,
        address implementation,
        string sourceChain
    );

    // an event emitted when an upgradeable contract is upgraded
    event UpgradedContract(
        address indexed sender,
        bytes32 indexed userSalt,
        address indexed proxy,
        address implementation,
        string sourceChain
    );

    // an event emitted when the whitelisted source address is changed
    event WhitelistedSourceAddressSet(address sourceSender, bool whitelisted);

    // an error emitted when a GMP call is invoked from a non-authorized contract address on the source chain
    error NotWhitelistedSourceAddress();

    // an error emitted when an upgrade to a contract configured only to upgrade via IGE is attempted by a user
    error CannotUpgradeFromNonIGEAccount(string reason);

    // an error emitted when an upgrade to a contract is attempted by a non-owner
    error CannotUpgradeForSomeoneElse(string reason);

    /**
     * @dev Deploy a fixed implementation contract on a chain. Not an interchain call.
     * @param userSalt Unique salt used to deploy the contract
     * @param implementationBytecode The bytecode of the contract to deploy. This should be compiled into bytecode with packed constructor args
     */
    function deployStaticContract(bytes32 userSalt, bytes memory implementationBytecode) external;

    /**
     * @dev Deploy an upgradeable implementation contract on a chain. Not an interchain call.
     * @param userSalt Unique salt used to deploy the contract
     * @param contractDetails The details of the implementation, including the implementation bytecode, setup parameters,
     * and instructions on whether or not this contract can only be upgraded through governance proposal via IGE
     */
    function deployUpgradeableContract(bytes32 userSalt, ImplContractDetails memory contractDetails) external;

    /**
     * @dev Deploy a fixed implementation contract to an array of specified destination chains. This is an interchain call.
     * @param userSalt Unique salt used to deploy the contract
     * @param remoteChainData Details of the remote chains that should deploy the contracts
     */
    function deployRemoteStaticContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt) external payable;

    /**
     * @dev Deploy an upgradeable contract to an array of specified destination chains. This is an interchain call.
     * @param userSalt Unique salt used to deploy the contract
     * @param remoteChainData Details of the remote chains that should deploy the contracts
     */
    function deployRemoteUpgradeableContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt)
        external
        payable;

    /**
     * @dev Upgrades the implementation of an upgradeable contract. Not an interchain call. This method can only be called
     * by either the owner of the proxy contract in question or via the approved interchain governance executor contract
     * @param proxyOwner The owner of the proxy address whose implementation needs to be updated
     * @param userSalt Unique salt used to deploy the contract
     * @param contractDetails The details of the implementation, including the implementation bytecode and setup parameters
     * (The 'onlyIGEUpgrades' boolean is ignored here)
     */
    function upgradeUpgradeableContract(
        address proxyOwner,
        bytes32 userSalt,
        ImplContractDetails memory contractDetails
    ) external;

    /**
     * @dev Upgrade an upgradeable contract to an array of specified destination chains. This is an interchain call.
     * Note this will only work if in the initial deployment of the contract, 'onlyIGEUpgrades' was not configured to 'true'.
     * @param userSalt Unique salt used to deploy the contract
     * @param remoteChainData Details of the remote chains that should deploy the contracts
     */
    function upgradeRemoteContracts(RemoteChains[] calldata remoteChainData, bytes32 userSalt) external payable;

    /**
     * @dev Utility method that returns an address derived from the msg.sender and its unique salt
     * @param userSalt Unique salt used to deploy the contract
     */
    function getProxyAddress(bytes32 userSalt) external view returns (address);

    /**
     * @dev Change the whitelisted caller address from the source chain
     * @param sourceSender The source sender
     * @param whitelisted The whitelist status
     */
    function setWhitelistedSourceAddress(address sourceSender, bool whitelisted) external;

    /**
     * @dev Set the whitelisted governance executor contract.
     * @param governanceExecutor_ Address of the deployed Interchain Governance Executor
     */
    function setGovernanceExecutor(address governanceExecutor_) external;
}

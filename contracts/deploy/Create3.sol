// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

error AlreadyDeployed();
error EmptyBytecode();
error DeployFailed();

contract CreateDeployer {
    function deploy(bytes memory bytecode) external {
        address deployed;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            deployed := create(0, add(bytecode, 32), mload(bytecode))
            if iszero(deployed) {
                revert(0, 0)
            }
        }

        selfdestruct(payable(msg.sender));
    }
}

library Create3 {
    bytes32 internal constant DEPLOYER_BYTECODE_HASH = keccak256(type(CreateDeployer).creationCode);

    function deploy(bytes32 salt, bytes memory bytecode) internal returns (address deployed) {
        deployed = deployedAddress(salt, address(this));

        if (deployed.codehash != bytes32(0)) revert AlreadyDeployed();
        if (bytecode.length == 0) revert EmptyBytecode();

        // CREATE2
        CreateDeployer deployer = new CreateDeployer{ salt: salt }();

        if (address(deployer) == address(0)) revert DeployFailed();

        deployer.deploy(bytecode);

        // checking for codehash instead of code length to support contracts that selfdestruct in constructor
        if (deployed.codehash == bytes32(0)) revert DeployFailed();
    }

    function deployedAddress(bytes32 salt, address host) internal pure returns (address deployed) {
        address deployer = address(
            uint160(uint256(keccak256(abi.encodePacked(hex'ff', host, salt, DEPLOYER_BYTECODE_HASH))))
        );

        deployed = address(uint160(uint256(keccak256(abi.encodePacked(hex'd6_94', deployer, hex'01')))));
    }
}

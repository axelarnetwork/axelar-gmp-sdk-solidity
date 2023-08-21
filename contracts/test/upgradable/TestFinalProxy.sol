import '../../upgradable/FinalProxy.sol';

contract TestFinalProxy is FinalProxy {
    constructor(
        address implementationAddress,
        address owner,
        bytes memory setupParams
    ) FinalProxy(implementationAddress, owner, setupParams) {
        if (FINAL_IMPLEMENTATION_SALT != bytes32(uint256(keccak256('final-implementation')) - 1))
            revert('invalid final implementation salt');
    }
}

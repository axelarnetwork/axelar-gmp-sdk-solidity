// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IOperatable } from '../interfaces/IOperatable.sol';

/**
 * @title Operatable Contract
 * @dev A contract module which provides a basic access control mechanism, where
 * there is an account (an operator) that can be granted exclusive access to
 * specific functions. This module is used through inheritance.
 */
contract Operatable is IOperatable {
    // uint256(keccak256('operator')) - 1
    uint256 internal constant OPERATOR_SLOT = 0x46a52cf33029de9f84853745a87af28464c80bf0346df1b32e205fc73319f621;
    // uint256(keccak256('proposed-operator')) - 1
    uint256 internal constant PROPOSED_OPERATOR_SLOT = 0x18dd7104fe20f6107b1523000995e8f87ac02b734a65cf0a45fafa7635a2c526;

    /**
     * @dev Throws a NotOperator custom error if called by any account other than the operator.
     */
    modifier onlyOperator() {
        if (operator() != msg.sender) revert NotOperator();
        _;
    }

    /**
     * @notice Get the address of the operator
     * @return operator_ of the operator
     */
    function operator() public view returns (address operator_) {
        assembly {
            operator_ := sload(OPERATOR_SLOT)
        }
    }

    /**
     * @dev Internal function that stores the new operator address in the operator storage slot
     * @param operator_ The address of the new operator
     */
    function _setOperator(address operator_) internal {
        assembly {
            sstore(OPERATOR_SLOT, operator_)
        }
        emit OperatorshipTransferred(operator_);
    }

    /**
     * @notice Change the operator of the contract
     * @dev Can only be called by the current operator
     * @param operator_ The address of the new operator
     */
    function transferOperatorship(address operator_) external onlyOperator {
        _setOperator(operator_);
    }

    /**
     * @notice Proposed a change of the operator of the contract
     * @dev Can only be called by the current operator
     * @param operator_ The address of the new operator
     */
    function proposeOperatorship(address operator_) external onlyOperator {
        assembly {
            sstore(PROPOSED_OPERATOR_SLOT, operator_)
        }
        emit OperatorChangeProposed(operator_);
    }

    /**
     * @notice Accept a proposed change of operatorship
     * @dev Can only be called by the proposed operator
     */
    function acceptOperatorship() external {
        address proposedOperator;
        assembly {
            proposedOperator := sload(PROPOSED_OPERATOR_SLOT)
            sstore(PROPOSED_OPERATOR_SLOT, 0)
        }
        if (msg.sender != proposedOperator) revert NotProposedOperator();
        _setOperator(proposedOperator);
    }
}

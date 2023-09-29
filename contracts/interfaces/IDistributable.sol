// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IDistributable {
    error NotDistributor();
    error NotProposedDistributor();

    event DistributorshipTransferred(address indexed distributor);
    event DistributorshipTransferStarted(address indexed distributor);

    /**
     * @notice Get the address of the distributor
     * @return distributor of the distributor
     */
    function distributor() external view returns (address distributor);

    /**
     * @notice Change the distributor of the contract
     * @dev Can only be called by the current distributor
     * @param distributor The address of the new distributor
     */
    function transferDistributorship(address distributor) external;

    /**
     * @notice Proposed a change of the distributor of the contract
     * @dev Can only be called by the current distributor
     * @param distributor_ The address of the new distributor
     */
    function proposeDistributorship(address distributor_) external;

    /**
     * @notice Accept a change of the distributor of the contract
     * @dev Can only be called by the proposed distributor
     */
    function acceptDistributorship() external;
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title GasEstimationType
 * @notice This enum represents the gas estimation types for different chains.
 */
enum GasEstimationType {
    Default,
    OptimismBedrock,
    OptimismEcotone,
    Arbitrum,
    Scroll,
    Mantle
}

/**
 * @title GasInfo
 * @notice This struct represents the gas pricing information for a specific chain.
 */
struct GasInfo {
    uint8 gasEstimationType; // Custom gas pricing rule, such as L1 data fee on L2s
    uint120 l1FeeScalar; // scalar value for a gas estimation formula, expected < 1e10
    uint128 axelarBaseFee; // Axelar base fee for cross-chain message approval (in terms of src native gas token)
    uint128 relativeGasPrice; // dest_gas_price * dest_token_market_price / src_token_market_price
    uint128 relativeBlobBaseFee; // dest_blob_base_fee * dest_token_market_price / src_token_market_price
    uint128 expressFee; // Axelar express fee for cross-chain message approval and express execution
}

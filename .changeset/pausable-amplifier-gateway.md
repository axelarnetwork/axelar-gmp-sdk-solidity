---
'@axelar-network/axelar-gmp-sdk-solidity': minor
---

Add pause/unpause to `AxelarAmplifierGateway` via `setPauseStatus(bool)` (operator-or-owner gated). While paused, `callContract` reverts and `validateMessage` / `validateContractCall` are gated, with an owner bypass so the owner can still consume inbound messages.

/**
 * onchain.executor.ts  [PHASE 3 — stub]
 *
 * Executes trades on-chain via viem + account abstraction smart wallet.
 *
 * Defense-in-depth layers (Phase 3):
 *   1. Risk engine validates intent (this file never sees an unvalidated intent)
 *   2. Smart wallet contract enforces: only allowed routers, max $ per tx
 *   3. Gas + slippage checks before signing
 *   4. MEV protection via flashbots/private mempool
 *
 * Current state: STUB — Phase 3 not yet active.
 */

import type { Intent, ExecutionResult } from '../../agents/loop/loop.types'

export async function executeOnchain(intent: Intent): Promise<ExecutionResult> {
  // Phase 3 not active — this function should never be called yet.
  throw new Error(
    'On-chain execution is not yet active (Phase 3). ' +
    'Dependencies needed: viem, account-abstraction smart wallet, flashbots RPC. ' +
    'Set agent.config.mode = "paper" or "cex" for now.'
  )

  // ── FUTURE IMPLEMENTATION (Phase 3) ──────────────────────────────────────
  //
  // Dependencies: viem, @permissionless/accounts (ERC-4337 smart wallet)
  //
  // 1. Load private key from keystore.ts (never logged)
  // 2. Create viem publicClient + walletClient
  // 3. Get the Uniswap V3 quote (exactInputSingle quote)
  // 4. Check: expected output > amountIn * (1 - slippage)
  // 5. Check: gas cost (estimate) < expected profit (minProfitOverGasUsd guard)
  // 6. Build calldata with deadline = now + 5min
  // 7. Send via flashbots relay (MEV protection)
  // 8. Wait for confirmation (1 block)
  // 9. Return txHash, blockNumber, filledAmountUsd, feesUsd
  //
  // ── END FUTURE IMPLEMENTATION ─────────────────────────────────────────────
}

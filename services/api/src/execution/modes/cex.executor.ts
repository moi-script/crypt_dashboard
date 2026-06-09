/**
 * cex.executor.ts  [PHASE 2 — stub]
 *
 * Executes trades via Binance REST API.
 *
 * SECURITY RULES (never relaxed):
 *   - API key is trade-enabled ONLY — withdrawal permission is NEVER granted.
 *   - The API key is loaded from environment at runtime, never logged, never in LLM context.
 *   - This file is the ONLY place the Binance key is ever read.
 *   - All intents have already passed risk.engine.validate() before reaching here.
 *
 * Current state: STUB — Phase 2 not yet active.
 * Enable in agent.config when ready.
 */

import type { Intent, ExecutionResult } from '../../agents/loop/loop.types'

// ── Key loading (only place Binance keys exist in the codebase) ───────────────

function loadBinanceKeys(): { apiKey: string; secret: string } {
  const apiKey = process.env.BINANCE_API_KEY
  const secret = process.env.BINANCE_SECRET

  if (!apiKey || !secret) {
    throw new Error(
      'BINANCE_API_KEY and BINANCE_SECRET must be set in environment for CEX mode. ' +
      'Key must have TRADE permission only — NEVER withdrawal permission.'
    )
  }

  // Sanity check: keys should never end up in logs
  return { apiKey, secret }
}

export async function executeCex(intent: Intent): Promise<ExecutionResult> {
  // Phase 2 not active — this function should never be called yet.
  throw new Error(
    'CEX execution is not yet active (Phase 2). ' +
    'Set agent.config.mode = "paper" for now. ' +
    'To activate: implement Binance order placement here and set mode to "cex" in agent.config.'
  )

  // ── FUTURE IMPLEMENTATION (Phase 2) ──────────────────────────────────────
  //
  // const { apiKey, secret } = loadBinanceKeys()
  //
  // if (intent.type === 'propose_trade') {
  //   const trade = intent as TradeIntent
  //   const symbol = `${trade.tokenIn}${trade.tokenOut}`
  //   // POST /api/v3/order — MARKET order, qty in base asset
  //   // Sign with HMAC-SHA256(secret, queryString)
  //   // Return: { status, orderId, filledAmountUsd, feesUsd, executedAt }
  // }
  //
  // if (intent.type === 'set_alert') {
  //   // Use existing alert.service.ts — no Binance key needed
  // }
  //
  // ── END FUTURE IMPLEMENTATION ─────────────────────────────────────────────
}

/**
 * risk.rules.ts
 *
 * Hardcoded risk rules. These are the "hard" guardrails — the LLM cannot
 * bypass them regardless of what intent it produces.
 *
 * Rules are evaluated in order. The first BLOCK result short-circuits.
 * All rules must pass (ALLOW) for an intent to reach the execution layer.
 */

import type { Intent, TradeIntent } from '../agents/loop/loop.types'
import type { WalletState }         from '../agents/loop/loop.types'

export type RuleResult =
  | { verdict: 'allow' }
  | { verdict: 'block'; reason: string }

export type RuleContext = {
  intent:      Intent
  walletState: WalletState
  mode:        'paper' | 'cex' | 'onchain'
}

// ── Rule: allowed tokens allowlist ───────────────────────────────────────────

const ALLOWED_TOKENS = new Set([
  'USDC', 'USDT', 'DAI', 'USDC.e',   // stablecoins
  'ETH', 'WETH', 'WBTC',              // major collateral
  'BTC',
])

export function ruleAllowedTokens(ctx: RuleContext): RuleResult {
  if (ctx.intent.type !== 'propose_trade') return { verdict: 'allow' }
  const trade = ctx.intent as TradeIntent
  if (!ALLOWED_TOKENS.has(trade.tokenIn.toUpperCase())) {
    return { verdict: 'block', reason: `Token "${trade.tokenIn}" is not in the allowed token list.` }
  }
  if (!ALLOWED_TOKENS.has(trade.tokenOut.toUpperCase())) {
    return { verdict: 'block', reason: `Token "${trade.tokenOut}" is not in the allowed token list.` }
  }
  return { verdict: 'allow' }
}

// ── Rule: max trade size ──────────────────────────────────────────────────────

export function ruleMaxTradeSize(
  ctx:       RuleContext,
  maxUsd:    number,
): RuleResult {
  if (ctx.intent.type !== 'propose_trade') return { verdict: 'allow' }
  const trade = ctx.intent as TradeIntent
  if (trade.amountUsd > maxUsd) {
    return {
      verdict: 'block',
      reason:  `Trade size $${trade.amountUsd} exceeds max allowed $${maxUsd}.`,
    }
  }
  return { verdict: 'allow' }
}

// ── Rule: daily loss cap ──────────────────────────────────────────────────────

export function ruleDailyLossCap(
  ctx:           RuleContext,
  dailyLossCap:  number,
): RuleResult {
  if (ctx.intent.type !== 'propose_trade') return { verdict: 'allow' }
  if (ctx.walletState.dailyPnlUsd <= -Math.abs(dailyLossCap)) {
    return {
      verdict: 'block',
      reason:  `Daily loss cap of $${Math.abs(dailyLossCap)} reached (current PnL: $${ctx.walletState.dailyPnlUsd.toFixed(2)}). No more trades today.`,
    }
  }
  return { verdict: 'allow' }
}

// ── Rule: slippage cap ────────────────────────────────────────────────────────

const MAX_SLIPPAGE_BPS = 200  // 2%

export function ruleMaxSlippage(ctx: RuleContext): RuleResult {
  if (ctx.intent.type !== 'propose_trade') return { verdict: 'allow' }
  const trade = ctx.intent as TradeIntent
  const slippage = trade.maxSlippageBps ?? 50
  if (slippage > MAX_SLIPPAGE_BPS) {
    return {
      verdict: 'block',
      reason:  `Slippage ${slippage}bps exceeds max allowed ${MAX_SLIPPAGE_BPS}bps. Reduce slippage tolerance.`,
    }
  }
  return { verdict: 'allow' }
}

// ── Rule: minimum trade size (don't pay fees for dust trades) ──────────────────

const MIN_TRADE_USD = 10

export function ruleMinTradeSize(ctx: RuleContext): RuleResult {
  if (ctx.intent.type !== 'propose_trade') return { verdict: 'allow' }
  const trade = ctx.intent as TradeIntent
  if (trade.amountUsd < MIN_TRADE_USD) {
    return {
      verdict: 'block',
      reason:  `Trade size $${trade.amountUsd} is below minimum $${MIN_TRADE_USD}. Not worth the fees.`,
    }
  }
  return { verdict: 'allow' }
}

// ── Rule: no live execution in paper mode without explicit override ─────────────

export function rulePaperModeOnly(
  ctx:       RuleContext,
  mode:      'paper' | 'cex' | 'onchain',
): RuleResult {
  // In CEX or onchain mode, rebalance requires manual approval
  if (ctx.intent.type === 'rebalance' && mode !== 'paper') {
    return {
      verdict: 'block',
      reason:  'Rebalance intent requires manual approval in live mode. Use the admin API to approve.',
    }
  }
  return { verdict: 'allow' }
}

// ── Rule: self-same trade (tokenIn === tokenOut) ──────────────────────────────

export function ruleSelfTrade(ctx: RuleContext): RuleResult {
  if (ctx.intent.type !== 'propose_trade') return { verdict: 'allow' }
  const trade = ctx.intent as TradeIntent
  if (trade.tokenIn.toLowerCase() === trade.tokenOut.toLowerCase()) {
    return { verdict: 'block', reason: `tokenIn and tokenOut are the same: "${trade.tokenIn}". This is a no-op trade.` }
  }
  return { verdict: 'allow' }
}

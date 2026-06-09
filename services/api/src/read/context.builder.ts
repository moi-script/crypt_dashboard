/**
 * context.builder.ts
 *
 * Synthesizes market data, wallet state, and strategy output into a
 * compact text summary for the LLM context window.
 *
 * Goal: give the model the minimum information it needs to make a good
 * decision, without wasting tokens on raw data it can't parse.
 *
 * Example output:
 *   BTC: $67,200 (+2.1% 24h) | ETH: $3,540 (+1.8% 24h)
 *   USDC yields (TVL ≥ $5M): Aave-Base 4.1% | Compound-Arb 4.6% | Morpho-Base 15.2% (↑11pt vs 7d avg)
 *   Wallet (paper): $5,000 USDC. PnL today: $0. Open positions: 0.
 *   Last agent action: none in 6h.
 */

import type { LoopContext, WalletState } from '../agents/loop/loop.types'

export interface ContextSummary {
  text:      string
  tokenEstimate: number
}

/** Rough token estimator (4 chars ≈ 1 token) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function buildContextSummary(
  ctx:              LoopContext,
  strategyContext:  string,
): ContextSummary {
  const { walletState } = ctx
  const walletLine = formatWalletLine(walletState)

  const text = [
    `=== AGENT CONTEXT | ${new Date().toISOString()} ===`,
    `Strategy: ${ctx.strategy}`,
    '',
    walletLine,
    '',
    strategyContext,
  ].join('\n')

  return {
    text,
    tokenEstimate: estimateTokens(text),
  }
}

function formatWalletLine(wallet: WalletState): string {
  const balanceStr = Object.entries(wallet.balances)
    .filter(([, v]) => v > 0)
    .map(([t, v]) => `${t}: $${v.toFixed(2)}`)
    .join(', ')

  const pnlSign = wallet.dailyPnlUsd >= 0 ? '+' : ''

  return [
    `WALLET (${wallet.mode}): ${balanceStr || 'empty'}`,
    `Total: $${wallet.totalValueUsd.toFixed(2)}`,
    `Today PnL: ${pnlSign}$${wallet.dailyPnlUsd.toFixed(2)}`,
    `Open positions: ${wallet.openPositions}`,
  ].join(' | ')
}

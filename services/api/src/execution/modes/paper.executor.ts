/**
 * paper.executor.ts  (updated)
 *
 * Simulates trade execution against live market prices.
 * Now records every fill to the PaperWallet and TradeTransaction collections,
 * giving the agent a real persistent balance and trade history.
 *
 * Simulates:
 *   - Slippage (proportional to trade size / estimated liquidity)
 *   - Exchange fee (0.1% default)
 *   - Fill price (live price ± simulated slippage)
 *   - PnL tracking via paperWallet.service
 */

import type { Intent, TradeIntent, AlertIntent, ExecutionResult } from '../../agents/loop/loop.types'
import { recordTrade, getOrCreateWallet }                        from '../../services/paperWallet.service'

const BASE_URL      = process.env.API_BASE_URL ?? 'http://localhost:4000'
const PAPER_FEE_PCT = 0.001  // 0.1% simulated fee

// Symbol → CoinGecko ID mapping for price lookups
const SYMBOL_TO_ID: Record<string, string> = {
  BTC:      'bitcoin',
  ETH:      'ethereum',
  WETH:     'ethereum',
  USDC:     'usd-coin',
  USDT:     'tether',
  DAI:      'dai',
  WBTC:     'wrapped-bitcoin',
  'USDC.e': 'usd-coin',
}

async function getLivePrice(symbol: string): Promise<number> {
  const coinId = SYMBOL_TO_ID[symbol.toUpperCase()] ?? symbol.toLowerCase()
  try {
    const res  = await fetch(`${BASE_URL}/api/simple/price?ids=${coinId}&vs=usd`)
    const data = await res.json() as Record<string, { usd?: number }>
    return data[coinId]?.usd ?? 1
  } catch {
    return 1
  }
}

function simulateSlippage(amountUsd: number, maxSlippageBps: number): number {
  const baseSlippagePct = Math.min(maxSlippageBps / 10_000, (amountUsd / 1_000_000) * 0.01)
  return baseSlippagePct
}

// Carries the agent context so the trade recorder can attach metadata
export interface PaperExecutorContext {
  userId:     string
  runId:      string
  strategy:   string
  rationale:  string
  confidence: number
}

export async function executePaper(
  intent: Intent,
  agentCtx: PaperExecutorContext,
): Promise<ExecutionResult> {
  const now = new Date()

  if (intent.type === 'no_action') {
    return { status: 'filled', executedAt: now, simulatedPnlUsd: 0 }
  }

  if (intent.type === 'set_alert') {
    const alert = intent as AlertIntent
    try {
      await fetch(`${BASE_URL}/api/alerts`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coinId:    alert.coinId,
          condition: alert.condition,
          threshold: alert.threshold,
        }),
      })
    } catch { /* ignore — alert failure doesn't block the run */ }

    return { status: 'filled', executedAt: now, simulatedPnlUsd: 0 }
  }

  if (intent.type === 'propose_trade') {
    const trade = intent as TradeIntent

    try {
      // ── 1. Check wallet has enough balance ─────────────────────────────────
      const wallet = await getOrCreateWallet(agentCtx.userId)
      const tokenInBal = wallet.balances.find(
        b => b.symbol.toUpperCase() === trade.tokenIn.toUpperCase()
      )

      if (!tokenInBal || tokenInBal.valueUsd < trade.amountUsd) {
        const available = tokenInBal?.valueUsd ?? 0
        console.warn(
          `[PaperExecutor] Insufficient ${trade.tokenIn} balance: need $${trade.amountUsd.toFixed(2)}, have $${available.toFixed(2)}`
        )
        return {
          status:       'rejected',
          errorMessage: `Insufficient ${trade.tokenIn} balance ($${available.toFixed(2)} available, $${trade.amountUsd.toFixed(2)} required)`,
          executedAt:   now,
        }
      }

      // ── 2. Get live prices ─────────────────────────────────────────────────
      const [inPrice, outPrice] = await Promise.all([
        getLivePrice(trade.tokenIn),
        getLivePrice(trade.tokenOut),
      ])

      // ── 3. Simulate execution ──────────────────────────────────────────────
      const slippage     = simulateSlippage(trade.amountUsd, trade.maxSlippageBps ?? 50)
      const fee          = trade.amountUsd * PAPER_FEE_PCT
      const netAmountUsd = trade.amountUsd * (1 - slippage) - fee
      const outAmount    = netAmountUsd / outPrice
      const orderId      = `paper-${Date.now()}`

      console.log(
        `[PaperExecutor] FILL: ${trade.tokenIn}→${trade.tokenOut} ` +
        `$${trade.amountUsd.toFixed(2)} @ slippage=${(slippage * 100).toFixed(3)}% ` +
        `fee=$${fee.toFixed(4)} out=${outAmount.toFixed(6)} ${trade.tokenOut}`
      )

      // ── 4. Record to wallet + trade history ────────────────────────────────
      try {
        await recordTrade(agentCtx.userId, {
          runId:           agentCtx.runId,
          orderId,
          tokenIn:         trade.tokenIn,
          tokenOut:        trade.tokenOut,
          amountUsd:       trade.amountUsd,
          filledAmountUsd: netAmountUsd,
          entryPrice:      outPrice,
          feesUsd:         fee,
          slippagePct:     slippage * 100,
          strategy:        agentCtx.strategy,
          rationale:       agentCtx.rationale,
          confidence:      agentCtx.confidence,
        })
      } catch (recordErr: any) {
        // Recording failure must NOT block the execution result
        console.warn('[PaperExecutor] Failed to record trade to wallet:', recordErr.message)
      }

      return {
        status:          'filled',
        orderId,
        filledAmountUsd: netAmountUsd,
        entryPrice:      outPrice,
        feesUsd:         fee,
        simulatedPnlUsd: 0,  // closed PnL computed by wallet service on sell
        executedAt:      now,
      }
    } catch (err: any) {
      return {
        status:       'error',
        errorMessage: err.message,
        executedAt:   now,
      }
    }
  }

  if (intent.type === 'rebalance') {
    return {
      status:          'filled',
      orderId:         `paper-rebal-${Date.now()}`,
      filledAmountUsd: 0,
      simulatedPnlUsd: 0,
      executedAt:      now,
    }
  }

  return { status: 'error', errorMessage: 'Unknown intent type', executedAt: now }
}

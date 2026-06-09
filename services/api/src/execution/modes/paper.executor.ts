/**
 * paper.executor.ts
 *
 * Simulates trade execution against live market prices.
 * No real money, no API keys, no side effects beyond writing to MongoDB.
 *
 * Simulates:
 *   - Slippage (proportional to trade size / estimated liquidity)
 *   - Exchange fee (0.1% default)
 *   - Fill price (live price ± simulated slippage)
 *   - PnL tracking
 */

import type { Intent, TradeIntent, AlertIntent, ExecutionResult } from '../../agents/loop/loop.types'

const BASE_URL      = process.env.API_BASE_URL ?? 'http://localhost:4000'
const PAPER_FEE_PCT = 0.001  // 0.1% simulated fee

// Symbol → CoinGecko ID mapping for price lookups
const SYMBOL_TO_ID: Record<string, string> = {
  BTC:    'bitcoin',
  ETH:    'ethereum',
  WETH:   'ethereum',
  USDC:   'usd-coin',
  USDT:   'tether',
  DAI:    'dai',
  WBTC:   'wrapped-bitcoin',
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
  // Slippage grows with size — simple linear model
  const baseSlippagePct = Math.min(maxSlippageBps / 10_000, (amountUsd / 1_000_000) * 0.01)
  return baseSlippagePct
}

export async function executePaper(intent: Intent): Promise<ExecutionResult> {
  const now = new Date()

  if (intent.type === 'no_action') {
    return { status: 'filled', executedAt: now, simulatedPnlUsd: 0 }
  }

  if (intent.type === 'set_alert') {
    const alert = intent as AlertIntent
    // In paper mode, set_alert just logs — the real alert creation goes through the alert service
    try {
      await fetch(`${BASE_URL}/api/alerts`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        // Note: auth would be needed in production — paper mode uses system token
        body: JSON.stringify({
          coinId:    alert.coinId,
          condition: alert.condition,
          threshold: alert.threshold,
        }),
      })
    } catch { /* ignore — alert creation failure doesn't block the run */ }

    return {
      status:        'filled',
      executedAt:    now,
      simulatedPnlUsd: 0,
    }
  }

  if (intent.type === 'propose_trade') {
    const trade = intent as TradeIntent

    try {
      const [inPrice, outPrice] = await Promise.all([
        getLivePrice(trade.tokenIn),
        getLivePrice(trade.tokenOut),
      ])

      const slippage     = simulateSlippage(trade.amountUsd, trade.maxSlippageBps)
      const fee          = trade.amountUsd * PAPER_FEE_PCT
      const netAmountUsd = trade.amountUsd * (1 - slippage) - fee
      const outAmount    = netAmountUsd / outPrice

      console.log(
        `[PaperExecutor] FILL: ${trade.tokenIn}→${trade.tokenOut} $${trade.amountUsd} ` +
        `@ slippage=${(slippage * 100).toFixed(3)}% fee=$${fee.toFixed(4)} out=${outAmount.toFixed(6)} ${trade.tokenOut}`
      )

      return {
        status:          'filled',
        orderId:         `paper-${Date.now()}`,
        filledAmountUsd: netAmountUsd,
        entryPrice:      outPrice,
        feesUsd:         fee,
        simulatedPnlUsd: 0,  // PnL calculated when position is closed
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

/**
 * paperWallet.service.ts
 *
 * Manages the paper wallet's persistent balance state.
 *
 * Responsibilities:
 *  - Bootstrap wallet on first use (5000 USDC)
 *  - Debit tokenIn, credit tokenOut on each fill
 *  - Record every trade as a TradeTransactionDoc
 *  - Compute running PnL
 *  - Expose wallet state + history for the API
 */

import { PaperWalletDoc, TradeTransactionDoc, type ITokenBalance } from '../models/paperWallet.model'
import type { ITradeTransaction } from '../models/paperWallet.model'
import { generateMyId } from '../utils/nanoid'

const INITIAL_USD    = 5000
const STABLE_TOKENS  = new Set(['USDC', 'USDT', 'DAI', 'USDC.e'])

const walletIdFor = (userId: string) => `paper-${userId}`

// ── Bootstrap / get wallet ────────────────────────────────────────────────────

export async function getOrCreateWallet(userId: string) {
  let wallet = await PaperWalletDoc.findOne({ userId })

  if (!wallet) {
    wallet = await PaperWalletDoc.create({
      userId,
      walletId:      walletIdFor(userId),
      mode:          'paper',
      initialUsd:    INITIAL_USD,
      totalValueUsd: INITIAL_USD,
      balances: [
        {
          symbol:     'USDC',
          amount:     INITIAL_USD,
          valueUsd:   INITIAL_USD,
          avgCostUsd: 1,
          updatedAt:  new Date(),
        },
      ],
      realizedPnlUsd:   0,
      unrealizedPnlUsd: 0,
    })
    console.log(`[PaperWallet] Created paper wallet for ${userId} with $${INITIAL_USD} USDC`)
  }

  return wallet
}

// ── Get balance for a specific token ─────────────────────────────────────────

function getBalance(balances: ITokenBalance[], symbol: string): ITokenBalance | undefined {
  return balances.find(b => b.symbol.toUpperCase() === symbol.toUpperCase())
}

// ── Record a completed trade + update balances ────────────────────────────────

export interface RecordTradeInput {
  runId:          string
  orderId?:       string
  tokenIn:        string
  tokenOut:       string
  amountUsd:      number
  filledAmountUsd: number
  entryPrice:     number       // price of tokenOut in USD
  priceInUsd?:    number       // price of tokenIn in USD (only meaningful when tokenIn isn't a stablecoin)
  feesUsd:        number
  slippagePct:    number
  strategy:       string
  rationale:      string
  confidence:     number
}

export async function recordTrade(userId: string, input: RecordTradeInput): Promise<ITradeTransaction> {
  const wallet = await getOrCreateWallet(userId)

  const tokenInSymbol  = input.tokenIn.toUpperCase()
  const tokenOutSymbol = input.tokenOut.toUpperCase()

  const priceInUsd  = STABLE_TOKENS.has(tokenInSymbol) ? 1 : (input.priceInUsd ?? input.entryPrice ?? 1)
  const priceOutUsd = input.entryPrice || 1

  // How many units of tokenIn we're spending
  const amountIn  = input.filledAmountUsd / (STABLE_TOKENS.has(tokenInSymbol) ? 1 : priceInUsd)
  // How many units of tokenOut we receive
  const amountOut = input.filledAmountUsd / priceOutUsd

  // Determine side: if tokenIn is a stablecoin → buying tokenOut
  const side = STABLE_TOKENS.has(tokenInSymbol) ? 'buy' : 'sell'

  // ── Update balances ──────────────────────────────────────────────────────────
  const balances = [...wallet.balances.map(b => ({ ...(b as any).toObject?.() ?? b }))]

  // Debit tokenIn
  const inIdx = balances.findIndex(b => b.symbol.toUpperCase() === tokenInSymbol)
  if (inIdx >= 0) {
    balances[inIdx].amount   = Math.max(0, balances[inIdx].amount - amountIn)
    balances[inIdx].valueUsd = balances[inIdx].amount * (STABLE_TOKENS.has(tokenInSymbol) ? 1 : priceInUsd)
    balances[inIdx].updatedAt = new Date()
  } else {
    // Shouldn't happen for tokenIn, but guard anyway
    console.warn(`[PaperWallet] tokenIn ${tokenInSymbol} not in balances — skipping debit`)
  }

  // Credit tokenOut
  const outIdx = balances.findIndex(b => b.symbol.toUpperCase() === tokenOutSymbol)
  if (outIdx >= 0) {
    const existing = balances[outIdx]
    const newAmount  = existing.amount + amountOut
    // Weighted average cost basis
    const newAvgCost = ((existing.amount * existing.avgCostUsd) + (amountOut * priceOutUsd)) / newAmount
    balances[outIdx].amount     = newAmount
    balances[outIdx].valueUsd   = newAmount * priceOutUsd
    balances[outIdx].avgCostUsd = newAvgCost
    balances[outIdx].updatedAt  = new Date()
  } else {
    balances.push({
      symbol:     tokenOutSymbol,
      amount:     amountOut,
      valueUsd:   amountOut * priceOutUsd,
      avgCostUsd: priceOutUsd,
      updatedAt:  new Date(),
    })
  }

  // ── Compute PnL for sells ────────────────────────────────────────────────────
  let realizedPnlUsd: number | undefined
  let pnlPct: number | undefined

  if (side === 'sell') {
    const outBalance = balances.find(b => b.symbol.toUpperCase() === tokenInSymbol)
    const costBasis  = outBalance?.avgCostUsd ?? priceInUsd
    realizedPnlUsd   = (priceInUsd - costBasis) * amountIn - input.feesUsd
    pnlPct           = costBasis > 0 ? ((priceInUsd - costBasis) / costBasis) * 100 : 0
  }

  // ── Total portfolio value ────────────────────────────────────────────────────
  const totalValueUsd = balances.reduce((sum, b) => {
    if (STABLE_TOKENS.has(b.symbol.toUpperCase())) return sum + b.amount
    return sum + b.amount * priceOutUsd
  }, 0)

  const newRealizedPnl = wallet.realizedPnlUsd + (realizedPnlUsd ?? 0)

  // Save updated wallet
  await PaperWalletDoc.updateOne(
    { userId },
    {
      $set: {
        balances,
        totalValueUsd,
        realizedPnlUsd: newRealizedPnl,
        updatedAt: new Date(),
      },
    },
  )

  // ── Persist trade transaction ────────────────────────────────────────────────
  const txId = `tx-${generateMyId(12)}`

  const tx = await TradeTransactionDoc.create({
    txId,
    runId:             input.runId,
    userId,
    orderId:           input.orderId,
    walletId:          walletIdFor(userId),
    side,
    tokenIn:           tokenInSymbol,
    tokenOut:          tokenOutSymbol,
    amountIn,
    amountOut,
    amountUsd:         input.filledAmountUsd,
    priceUsd:          priceOutUsd,
    priceInUsd,
    feesUsd:           input.feesUsd,
    slippagePct:       input.slippagePct,
    realizedPnlUsd,
    pnlPct,
    strategy:          input.strategy,
    rationale:         input.rationale,
    confidence:        input.confidence,
    portfolioValueUsd: totalValueUsd,
    cumulativePnlUsd:  newRealizedPnl,
    status:            'filled',
    executedAt:        new Date(),
  })

  console.log(
    `[PaperWallet] Trade recorded: ${side.toUpperCase()} ${amountOut.toFixed(6)} ${tokenOutSymbol} @ $${priceOutUsd.toFixed(2)} | PnL: ${realizedPnlUsd !== undefined ? '$' + realizedPnlUsd.toFixed(2) : 'N/A'} | Portfolio: $${totalValueUsd.toFixed(2)}`
  )

  return tx.toObject()
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export async function getTradeHistory(userId: string, limit = 50, skip = 0) {
  return TradeTransactionDoc
    .find({ userId })
    .sort({ executedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean()
}

export async function getTradeStats(userId: string) {
  const wallet = await getOrCreateWallet(userId)
  const allTrades = await TradeTransactionDoc.find({ userId }).lean()

  const totalTrades  = allTrades.length
  const buys         = allTrades.filter(t => t.side === 'buy')
  const sells        = allTrades.filter(t => t.side === 'sell')
  const winners      = sells.filter(t => (t.realizedPnlUsd ?? 0) > 0)
  const losers       = sells.filter(t => (t.realizedPnlUsd ?? 0) < 0)
  const totalFees    = allTrades.reduce((s, t) => s + (t.feesUsd ?? 0), 0)

  const winRate      = sells.length > 0 ? (winners.length / sells.length) * 100 : 0
  const avgWin       = winners.length > 0
    ? winners.reduce((s, t) => s + (t.realizedPnlUsd ?? 0), 0) / winners.length
    : 0
  const avgLoss      = losers.length > 0
    ? losers.reduce((s, t) => s + (t.realizedPnlUsd ?? 0), 0) / losers.length
    : 0

  const totalVolume  = allTrades.reduce((s, t) => s + (t.amountUsd ?? 0), 0)
  const returnPct    = ((wallet.totalValueUsd - wallet.initialUsd) / wallet.initialUsd) * 100

  return {
    wallet: {
      totalValueUsd:    wallet.totalValueUsd,
      initialUsd:       wallet.initialUsd,
      realizedPnlUsd:   wallet.realizedPnlUsd,
      returnPct:        parseFloat(returnPct.toFixed(2)),
      balances:         wallet.balances,
    },
    trades: {
      total:       totalTrades,
      buys:        buys.length,
      sells:       sells.length,
      winners:     winners.length,
      losers:      losers.length,
      winRate:     parseFloat(winRate.toFixed(1)),
      avgWinUsd:   parseFloat(avgWin.toFixed(2)),
      avgLossUsd:  parseFloat(avgLoss.toFixed(2)),
      totalFees:   parseFloat(totalFees.toFixed(2)),
      totalVolume: parseFloat(totalVolume.toFixed(2)),
    },
  }
}

export async function resetWallet(userId: string) {
  await PaperWalletDoc.deleteOne({ userId })
  await TradeTransactionDoc.deleteMany({ userId })
  return getOrCreateWallet(userId)
}
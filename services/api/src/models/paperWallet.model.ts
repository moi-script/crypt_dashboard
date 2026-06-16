/**
 * paperWallet.model.ts
 *
 * Persists the paper wallet's balance state and full trade transaction history.
 *
 * Design:
 *  - One PaperWalletDoc per agent mode (currently just "paper")
 *  - One TradeTransactionDoc per executed trade (filled orders only)
 *  - Balances are updated atomically on each trade fill
 */

import { Schema, model } from 'mongoose'

// ── Token balance ─────────────────────────────────────────────────────────────

export interface ITokenBalance {
  symbol:        string
  amount:        number          // actual token units
  valueUsd:      number          // USD value at last update
  avgCostUsd:    number          // average cost basis per unit
  updatedAt:     Date
}

// ── Paper wallet document ─────────────────────────────────────────────────────

export interface IPaperWallet {
  userId:        string          // owning user's ID
  walletId:      string          // e.g. "paper-default"
  mode:          'paper'
  balances:      ITokenBalance[]
  totalValueUsd: number
  initialUsd:    number          // starting capital
  realizedPnlUsd: number         // cumulative closed PnL
  unrealizedPnlUsd: number       // open positions mark-to-market
  createdAt:     Date
  updatedAt:     Date
}

const TokenBalanceSchema = new Schema<ITokenBalance>({
  symbol:     { type: String, required: true },
  amount:     { type: Number, required: true, default: 0 },
  valueUsd:   { type: Number, required: true, default: 0 },
  avgCostUsd: { type: Number, required: true, default: 0 },
  updatedAt:  { type: Date,   default: Date.now },
}, { _id: false })

const PaperWalletSchema = new Schema<IPaperWallet>({
  userId:           { type: String, required: true, unique: true, index: true },
  walletId:         { type: String, required: true },
  mode:             { type: String, enum: ['paper'], default: 'paper' },
  balances:         { type: [TokenBalanceSchema], default: [] },
  totalValueUsd:    { type: Number, default: 5000 },
  initialUsd:       { type: Number, default: 5000 },
  realizedPnlUsd:   { type: Number, default: 0 },
  unrealizedPnlUsd: { type: Number, default: 0 },
}, { timestamps: true })

export const PaperWalletDoc = model<IPaperWallet>('PaperWallet', PaperWalletSchema)

// ── Trade transaction ─────────────────────────────────────────────────────────

export type TradeSide = 'buy' | 'sell'
export type TradeStatus = 'filled' | 'partial' | 'rejected' | 'cancelled'

export interface ITradeTransaction {
  txId:            string          // unique transaction ID
  runId:           string          // which AgentRun triggered this
  userId:          string          // owning user's ID
  orderId?:        string
  walletId:        string

  // Trade details
  side:            TradeSide       // 'buy' = tokenIn→tokenOut, 'sell' = tokenOut→tokenIn
  tokenIn:         string          // asset sold / spent
  tokenOut:        string          // asset bought / received
  amountIn:        number          // units of tokenIn spent
  amountOut:       number          // units of tokenOut received
  amountUsd:       number          // USD value of the trade

  // Pricing
  priceUsd:        number          // execution price of tokenOut in USD
  priceInUsd:      number          // execution price of tokenIn in USD (usually 1 for stable)

  // Costs
  feesUsd:         number
  slippagePct:     number          // actual slippage applied

  // PnL (for sells / round-trips)
  realizedPnlUsd?: number          // profit/loss realised on this trade
  pnlPct?:         number          // % gain/loss vs cost basis

  // Context
  strategy:        string
  rationale:       string          // LLM's stated reason
  confidence:      number          // 0-100

  // Wallet snapshot after trade
  portfolioValueUsd: number
  cumulativePnlUsd:  number

  status:          TradeStatus
  executedAt:      Date
}

const TradeTransactionSchema = new Schema<ITradeTransaction>({
  txId:              { type: String, required: true, unique: true },
  runId:             { type: String, required: true },
  userId:            { type: String, required: true, index: true },
  orderId:           String,
  walletId:          { type: String, required: true },

  side:              { type: String, enum: ['buy', 'sell'], required: true },
  tokenIn:           { type: String, required: true },
  tokenOut:          { type: String, required: true },
  amountIn:          { type: Number, required: true },
  amountOut:         { type: Number, required: true },
  amountUsd:         { type: Number, required: true },

  priceUsd:          { type: Number, required: true },
  priceInUsd:        { type: Number, default: 1 },

  feesUsd:           { type: Number, default: 0 },
  slippagePct:       { type: Number, default: 0 },

  realizedPnlUsd:    Number,
  pnlPct:            Number,

  strategy:          { type: String, required: true },
  rationale:         { type: String, default: '' },
  confidence:        { type: Number, default: 0 },

  portfolioValueUsd: { type: Number, default: 0 },
  cumulativePnlUsd:  { type: Number, default: 0 },

  status:            {
    type: String,
    enum: ['filled', 'partial', 'rejected', 'cancelled'],
    default: 'filled',
  },
  executedAt:        { type: Date, required: true },
}, { timestamps: true })

TradeTransactionSchema.index({ userId: 1, executedAt: -1 })
TradeTransactionSchema.index({ runId: 1 })
TradeTransactionSchema.index({ tokenOut: 1, executedAt: -1 })

// TTL — keep 1 year of history
TradeTransactionSchema.index({ executedAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 })

export const TradeTransactionDoc = model<ITradeTransaction>('TradeTransaction', TradeTransactionSchema)

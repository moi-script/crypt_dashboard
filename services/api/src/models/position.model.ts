/**
 * position.model.ts
 *
 * Tracks open and closed positions (paper or real).
 * One position covers the lifecycle: entry → open → closed.
 */

import { Schema, model } from 'mongoose'

export type PositionStatus = 'pending' | 'open' | 'closed' | 'cancelled'

export interface IPosition {
  positionId:   string
  userId?:      string
  mode:         'paper' | 'cex' | 'onchain'
  /** pending = limit order awaiting fill, open = filled & live, closed = exited, cancelled = limit expired unfilled */
  status:       PositionStatus
  tokenIn:      string
  tokenOut:     string
  entryAmountUsd: number
  entryPrice?:  number       // set on fill; undefined while pending
  entryFeesUsd: number
  entryAt:      Date
  exitPrice?:   number
  exitAmountUsd?: number
  exitFeesUsd?: number
  exitAt?:      Date
  isOpen:       boolean       // kept in sync with status === 'open'
  realizedPnlUsd?: number
  strategy:     string
  runId:        string      // which AgentRun opened this
  orderId?:     string
  txHash?:      string      // on-chain only
  stopLossPrice?:   number
  takeProfitPrice?: number
  entryZoneLow?:    number   // limit-order entry zone (pending positions)
  entryZoneHigh?:   number
  entryExpiresAt?:  Date     // cancel the pending limit order after this time
  framework?:          string   // 'SmartMoney' | 'Wyckoff' | 'ElliottWave' | 'Harmonic'
  confidence?:         number   // 0-100, from the originating signal
  trailingStopPct?:    number   // % below high-water-mark; server-side monitor updates SL
  highWaterMarkPrice?: number   // highest price reached since open (trailing stop reference)
  takeProfitPrice2?:   number   // TP2 — final exit after TP1 50% scale-out
  tp1ScaledOut?:       boolean  // true once TP1 partial exit has fired
  maxHoldHours?:       number   // auto-exit if position exceeds this age without reaching TP1
  runnerActive?:       boolean  // true when a 10% runner remains after TP2 hit
  runnerTrailPct?:     number   // trailing stop % for the runner slice
  bias?:               'long' | 'short'  // trade direction (required for correct SL/TP logic on shorts)
}

const PositionSchema = new Schema<IPosition>({
  positionId:     { type: String, required: true, unique: true },
  userId:         { type: String, index: true },
  mode:           { type: String, enum: ['paper', 'cex', 'onchain'], required: true },
  status:         { type: String, enum: ['pending', 'open', 'closed', 'cancelled'], default: 'open' },
  tokenIn:        { type: String, required: true },
  tokenOut:       { type: String, required: true },
  entryAmountUsd: { type: Number, required: true },
  entryPrice:     { type: Number },
  entryFeesUsd:   { type: Number, default: 0 },
  entryAt:        { type: Date,   required: true },
  exitPrice:      Number,
  exitAmountUsd:  Number,
  exitFeesUsd:    Number,
  exitAt:         Date,
  isOpen:         { type: Boolean, default: true },
  realizedPnlUsd: Number,
  strategy:       { type: String, required: true },
  runId:          { type: String, required: true },
  orderId:        String,
  txHash:         String,
  stopLossPrice:   Number,
  takeProfitPrice: Number,
  entryZoneLow:    Number,
  entryZoneHigh:   Number,
  entryExpiresAt:  Date,
  framework:           String,
  confidence:          Number,
  trailingStopPct:     Number,
  highWaterMarkPrice:  Number,
  takeProfitPrice2:    Number,
  tp1ScaledOut:        { type: Boolean, default: false },
  maxHoldHours:        Number,
  runnerActive:        { type: Boolean, default: false },
  runnerTrailPct:      Number,
  bias:                { type: String, enum: ['long', 'short'] },
}, { timestamps: true })

PositionSchema.index({ isOpen: 1, mode: 1 })
PositionSchema.index({ status: 1, mode: 1 })
PositionSchema.index({ strategy: 1, entryAt: -1 })

export const PositionDoc = model<IPosition>('Position', PositionSchema)

// ────────────────────────────────────────────────────────────────────────────────

/**
 * order.model.ts (inlined)
 *
 * Every execution attempt — including failures, partial fills, and rejections.
 */

export interface IOrder {
  orderId:        string
  userId?:        string
  positionId?:    string
  runId:          string
  mode:           'paper' | 'cex' | 'onchain'
  intentType:     string
  tokenIn:        string
  tokenOut:       string
  amountUsd:      number
  status:         'filled' | 'rejected' | 'pending' | 'blocked_by_risk' | 'manual_approval_required' | 'error'
  filledAmountUsd?: number
  entryPrice?:    number
  feesUsd?:       number
  txHash?:        string
  blockNumber?:   number
  riskBlockedBy?: string
  riskReason?:    string
  errorMessage?:  string
  executedAt:     Date
}

const OrderSchema = new Schema<IOrder>({
  orderId:         { type: String, required: true, unique: true },
  userId:          { type: String, index: true },
  positionId:      String,
  runId:           { type: String, required: true },
  mode:            { type: String, enum: ['paper', 'cex', 'onchain'], required: true },
  intentType:      { type: String, required: true },
  tokenIn:         { type: String, required: true },
  tokenOut:        { type: String, required: true },
  amountUsd:       { type: Number, required: true },
  status:          {
    type: String,
    enum: ['filled', 'rejected', 'pending', 'blocked_by_risk', 'manual_approval_required', 'error'],
    required: true,
  },
  filledAmountUsd: Number,
  entryPrice:      Number,
  feesUsd:         Number,
  txHash:          String,
  blockNumber:     Number,
  riskBlockedBy:   String,
  riskReason:      String,
  errorMessage:    String,
  executedAt:      { type: Date, required: true },
}, { timestamps: true })

OrderSchema.index({ runId: 1 })
OrderSchema.index({ status: 1, executedAt: -1 })
// TTL — keep orders for 1 year
OrderSchema.index({ executedAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 })

export const OrderDoc = model<IOrder>('Order', OrderSchema)

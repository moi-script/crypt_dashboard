/**
 * position.model.ts
 *
 * Tracks open and closed positions (paper or real).
 * One position covers the lifecycle: entry → open → closed.
 */

import { Schema, model } from 'mongoose'

export interface IPosition {
  positionId:   string
  mode:         'paper' | 'cex' | 'onchain'
  tokenIn:      string
  tokenOut:     string
  entryAmountUsd: number
  entryPrice:   number
  entryFeesUsd: number
  entryAt:      Date
  exitPrice?:   number
  exitAmountUsd?: number
  exitFeesUsd?: number
  exitAt?:      Date
  isOpen:       boolean
  realizedPnlUsd?: number
  strategy:     string
  runId:        string      // which AgentRun opened this
  orderId?:     string
  txHash?:      string      // on-chain only
}

const PositionSchema = new Schema<IPosition>({
  positionId:     { type: String, required: true, unique: true },
  mode:           { type: String, enum: ['paper', 'cex', 'onchain'], required: true },
  tokenIn:        { type: String, required: true },
  tokenOut:       { type: String, required: true },
  entryAmountUsd: { type: Number, required: true },
  entryPrice:     { type: Number, required: true },
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
}, { timestamps: true })

PositionSchema.index({ isOpen: 1, mode: 1 })
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

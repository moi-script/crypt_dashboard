/**
 * agentRun.model.ts
 *
 * Persists one document per agent loop iteration.
 * Gives a full audit trail: strategy → context → reasoning → decision → outcome.
 * Reuses ReasoningStep from analysis.model for consistency.
 */

import { Schema, model } from 'mongoose'
import type { AgentRunRecord, Decision, ExecutionResult } from '../agents/loop/loop.types'

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const IntentSchema = new Schema({
  type:           { type: String, required: true },
  tokenIn:        String,
  tokenOut:       String,
  amountUsd:      Number,
  maxSlippageBps: Number,
  rationale:      String,
  venue:          String,
  coinId:         String,
  condition:      String,
  threshold:      Number,
  targetWeights:  Schema.Types.Mixed,
}, { _id: false })

const DecisionSchema = new Schema({
  intent:        { type: IntentSchema, required: true },
  confidence:    Number,
  reasoning:     String,
  toolCallTrace: [String],
}, { _id: false })

const ExecutionResultSchema = new Schema({
  status:              { type: String, required: true },
  orderId:             String,
  filledAmountUsd:     Number,
  entryPrice:          Number,
  feesUsd:             Number,
  txHash:              String,
  blockNumber:         Number,
  riskRejectionReason: String,
  errorMessage:        String,
  simulatedPnlUsd:     Number,
  executedAt:          { type: Date, required: true },
}, { _id: false })

// ── Main schema ───────────────────────────────────────────────────────────────

const AgentRunSchema = new Schema<AgentRunRecord>({
  runId:           { type: String, required: true, unique: true },
  strategy:        { type: String, required: true },
  mode:            { type: String, enum: ['paper', 'cex', 'onchain'], required: true },
  startedAt:       { type: Date, required: true },
  completedAt:     Date,
  status:          {
    type:    String,
    enum:    ['running', 'completed', 'failed', 'blocked', 'pending_approval'],
    default: 'running',
  },
  contextSnapshot: { type: String, default: '' },
  decision:        DecisionSchema,
  executionResult: ExecutionResultSchema,
  errorMessage:    String,
}, { timestamps: true })

AgentRunSchema.index({ strategy: 1, startedAt: -1 })
AgentRunSchema.index({ status: 1, startedAt: -1 })

// TTL — keep runs for 90 days
AgentRunSchema.index({ startedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

export const AgentRunDoc = model<AgentRunRecord>('AgentRun', AgentRunSchema)

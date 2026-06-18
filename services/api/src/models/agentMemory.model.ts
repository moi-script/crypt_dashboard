// services/api/src/models/agentMemory.model.ts

import { Schema, model } from 'mongoose'
import type { AgentMemoryEntry } from '../agents/memory/memory.types'

const OutcomeSchema = new Schema({
  pnl:            { type: Number, required: true },
  pnlPercent:     { type: Number, required: true },
  durationHeldMs: { type: Number, required: true },
  closedAt:       { type: Date,   required: true },
  success:        { type: Boolean, required: true },
}, { _id: false })

const AgentMemorySchema = new Schema<AgentMemoryEntry>({
  agentId:     { type: String, required: true, index: true },
  runId:       { type: String, required: true, index: true },
  timestamp:   { type: Date,   required: true, index: true },
  coin:        { type: String, required: true, index: true },
  type:        { type: String, enum: ['decision', 'observation', 'outcome'], required: true },
  summary:     { type: String, required: true },
  fullContext: { type: Schema.Types.Mixed, default: {} },
  embedding:   { type: [Number], required: true },
  linkedDecisionId: String,
  outcome:     OutcomeSchema,
  marketRegime: { type: String, default: 'unknown' },
  signals:     [String],
  tools:       [String],
}, { timestamps: true })

AgentMemorySchema.index({ agentId: 1, coin: 1, timestamp: -1 })

export const AgentMemoryDoc = model<AgentMemoryEntry>('AgentMemory', AgentMemorySchema)

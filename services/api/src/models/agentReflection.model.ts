// services/api/src/models/agentReflection.model.ts

import { Schema, model } from 'mongoose'
import type { AgentReflection } from '../agents/memory/memory.types'

const AgentReflectionSchema = new Schema<AgentReflection>({
  agentId:  { type: String, required: true, index: true },
  period:   {
    start: { type: Date, required: true },
    end:   { type: Date, required: true },
    _id:   false,
  },
  coin:     String,
  summary:  { type: String, required: true },
  embedding: { type: [Number], required: true },
  stats: {
    totalDecisions: Number,
    winRate:        Number,
    avgPnlPercent:  Number,
    bestPattern:    String,
    worstPattern:   String,
    _id: false,
  },
  lessonsLearned: [String],
}, { timestamps: true })

AgentReflectionSchema.index({ agentId: 1, coin: 1, 'period.end': -1 })

export const AgentReflectionDoc = model<AgentReflection>('AgentReflection', AgentReflectionSchema)

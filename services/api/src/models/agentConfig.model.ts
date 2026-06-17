import { Schema, model } from 'mongoose'
import type { AgentConfig } from '../config/agent.config'

export interface IAgentConfig extends AgentConfig {
  userId: string
}

const AgentConfigSchema = new Schema<IAgentConfig>({
  userId:                { type: String, required: true, unique: true, index: true },
  enabled:               { type: Boolean, default: false },
  mode:                  { type: String, enum: ['paper', 'cex', 'onchain'], default: 'paper' },
  loopIntervalMs:        { type: Number, default: 60_000 },
  strategies: {
    yieldHunter:  { type: Boolean, default: true },
    rebalance:    { type: Boolean, default: false },
    airdropWatch: { type: Boolean, default: false },
    chartSignal:  { type: Boolean, default: false },
  },
  watchlist:             { type: [String], default: ['bitcoin', 'ethereum', 'usd-coin', 'tether'] },
  maxTradeUsd:           { type: Number, default: 100 },
  requireManualApproval: { type: Boolean, default: true },
  minSignalConfidence:   { type: Number, default: 55 },
}, { timestamps: true })

export const AgentConfigDoc = model<IAgentConfig>('AgentConfig', AgentConfigSchema)

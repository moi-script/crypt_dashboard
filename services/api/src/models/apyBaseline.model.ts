/**
 * apyBaseline.model.ts
 *
 * Persists the rolling APY sample window for each DeFi pool so the
 * yieldHunter strategy can compute a meaningful 7-day average across
 * server restarts.
 *
 * One document per pool (upserted on each tick). The `samples` array
 * is capped at MAX_SAMPLES entries, oldest first.
 */

import { Schema, model } from 'mongoose'

export const MAX_SAMPLES = 7

export interface IApyBaseline {
  poolId:    string      // DefiLlama pool UUID
  protocol:  string
  chain:     string
  symbol:    string
  samples:   number[]   // APY readings, oldest → newest, max MAX_SAMPLES entries
  updatedAt: Date
}

const ApyBaselineSchema = new Schema<IApyBaseline>(
  {
    poolId:   { type: String, required: true, unique: true, index: true },
    protocol: { type: String, required: true },
    chain:    { type: String, required: true },
    symbol:   { type: String, required: true },
    samples:  { type: [Number], default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'apy_baselines' },
)

export const ApyBaselineDoc = model<IApyBaseline>('ApyBaseline', ApyBaselineSchema)

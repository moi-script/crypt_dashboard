/**
 * opportunity.model.ts
 *
 * Stores detected yield anomalies, price spikes, and other signals
 * the agent identifies during perception. TTL'd like ArticleDoc.
 *
 * Used by the dashboard to show "what the agent sees" even when
 * it decides no_action.
 */

import { Schema, model } from 'mongoose'

export type OpportunityType =
  | 'yield_anomaly'
  | 'price_spike'
  | 'volume_spike'
  | 'airdrop_signal'
  | 'sentiment_shift'

export interface IOpportunity {
  opportunityId: string
  type:          OpportunityType
  strategy:      string
  runId:         string
  title:         string           // short human-readable label
  detail:        string           // fuller explanation
  asset:         string           // coin/token involved
  protocol?:     string           // DeFi protocol if applicable
  chain?:        string
  score:         number           // 0–100 signal strength
  acted:         boolean          // did the agent act on this?
  actionTaken?:  string           // what intent was produced
  detectedAt:    Date
  expiresAt:     Date             // TTL field
  metadata:      Record<string, unknown>
}

const OpportunitySchema = new Schema<IOpportunity>({
  opportunityId: { type: String, required: true, unique: true },
  type:          { type: String, enum: ['yield_anomaly','price_spike','volume_spike','airdrop_signal','sentiment_shift'], required: true },
  strategy:      { type: String, required: true },
  runId:         { type: String, required: true },
  title:         { type: String, required: true },
  detail:        { type: String, required: true },
  asset:         { type: String, required: true },
  protocol:      String,
  chain:         String,
  score:         { type: Number, min: 0, max: 100, default: 50 },
  acted:         { type: Boolean, default: false },
  actionTaken:   String,
  detectedAt:    { type: Date, default: Date.now },
  expiresAt:     { type: Date, required: true },
  metadata:      { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true })

OpportunitySchema.index({ strategy: 1, detectedAt: -1 })
OpportunitySchema.index({ type: 1, acted: 1 })
// TTL — auto-delete after expiresAt
OpportunitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const OpportunityDoc = model<IOpportunity>('Opportunity', OpportunitySchema)

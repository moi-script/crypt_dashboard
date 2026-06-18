import { Schema, model } from 'mongoose'
import type { CoinAnalysisRun } from '@/agents/coinAnalysis/coinAnalysis.types'

const NewsImpactSchema = new Schema(
  {
    verdict:         { type: String, enum: ['supports', 'contradicts', 'neutral'], required: true },
    confidenceDelta: { type: Number, required: true },
    headlines:       [{ title: String, sentiment: Number, _id: false }],
  },
  { _id: false },
)

const StrategyCardSchema = new Schema(
  {
    framework:      { type: String, enum: ['SmartMoney', 'Wyckoff', 'ElliottWave', 'Harmonic'], required: true },
    signal:         { type: Schema.Types.Mixed, default: null },
    chartSnapshot:  { type: Schema.Types.Mixed, default: null },
    llmNarrative:   { type: String, default: '' },
    newsImpact:     { type: NewsImpactSchema, required: true },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'auto_executed', 'skipped'], required: true },
    skippedReason:  String,
  },
  { _id: false },
)

const CoinAnalysisRunSchema = new Schema<CoinAnalysisRun>(
  {
    coinAnalysisRunId: { type: String, required: true, unique: true, index: true },
    userId:            { type: String, required: true, index: true },
    symbol:            { type: String, required: true },
    triggeredBy:       { type: String, enum: ['scheduler', 'on_demand'], required: true },
    status:            { type: String, enum: ['running', 'completed', 'failed', 'pending_approval', 'auto_executed'], required: true },
    startedAt:         { type: Date, required: true },
    completedAt:       Date,
    strategyCards:     [StrategyCardSchema],
    autoMode:          { type: Boolean, required: true },
    newsArticlesUsed:  [String],
    errorMessage:      String,
  },
  { timestamps: true },
)

CoinAnalysisRunSchema.index({ userId: 1, startedAt: -1 })

export const CoinAnalysisRunDoc = model<CoinAnalysisRun>('CoinAnalysisRun', CoinAnalysisRunSchema)

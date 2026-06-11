// ============================================================
// chartAnalysis.schema.ts
// Mongoose schema for persisted ChartAnalysisResult per symbol
// ✅ COMPLETE — do NOT regenerate
// Imported by: chartAnalysis.model.ts
// ============================================================

import { Schema } from 'mongoose';

export const ChartAnalysisSchema = new Schema(
  {
    symbol:            { type: String, required: true, index: true },
    regime: {
      type: String,
      enum: ['trending_up', 'trending_down', 'ranging', 'accumulation', 'distribution', 'price_discovery'],
      required: true,
    },
    bias:              { type: String, enum: ['long', 'short', 'neutral'], required: true },
    primary_framework: {
      type: String,
      enum: ['SmartMoney', 'Wyckoff', 'ElliottWave', 'Harmonic', 'Hybrid'],
      required: true,
    },
    setup_name:        { type: String, required: true },
    entry_zone: {
      high: { type: Number, required: true },
      low:  { type: Number, required: true },
    },
    stop_loss:            { type: Number, required: true },
    take_profit_levels:   [{ type: Number }],
    risk_reward:          { type: Number, required: true },
    confidence:           { type: Number, min: 0, max: 100, required: true },
    invalidation:         { type: String },
    reasoning:            { type: String },
    framework_scores:     { type: Map, of: Number, default: {} },
    confluence_score:     { type: Number, min: 0, max: 9, default: 0 },
    confluence_factors:   [{ type: String }],
    // Risk gate output — populated after validateChartAnalysisTrade()
    risk_approved:        { type: Boolean, default: null },
    adjusted_confidence:  { type: Number, default: null },
    adjusted_size_mult:   { type: Number, default: null },
    risk_warnings:        [{ type: String }],
    risk_rejection:       { type: String, default: null },
    // Metadata
    analyzed_at:          { type: Date, default: Date.now, index: true },
    timeframes_used:      [{ type: String }],
    btc_bias_at_time:     { type: String, enum: ['long', 'short', 'neutral'], default: null },
  },
  {
    timestamps: true,
    collection: 'chartanalyses',
  }
);

// Most common queries: latest analysis per symbol, all analyses by bias
ChartAnalysisSchema.index({ symbol: 1, analyzed_at: -1 });
ChartAnalysisSchema.index({ symbol: 1, bias: 1, confidence: -1 });
// TTL: auto-expire after 72h (analyses are point-in-time)
ChartAnalysisSchema.index({ analyzed_at: 1 }, { expireAfterSeconds: 259200 });
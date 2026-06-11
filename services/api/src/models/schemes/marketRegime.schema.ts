// ============================================================
// marketRegime.schema.ts
// Mongoose schema for Market Regime snapshots
// ✅ COMPLETE — do NOT regenerate
// Imported by: marketRegime.model.ts
// ============================================================

import { Schema } from 'mongoose';

export const MarketRegimeSchema = new Schema(
  {
    symbol: {
      type:     String,
      required: true,
      index:    true,
    },
    regime: {
      type:     String,
      enum:     ['trending_up', 'trending_down', 'ranging', 'accumulation', 'distribution', 'price_discovery'],
      required: true,
    },
    detected_at: {
      type:    Date,
      required: true,
      default:  Date.now,
    },
    confidence: {
      type:    Number,
      min:     0,
      max:     100,
      default: 70,
    },
    adx: {
      type:    Number,
      default: 0,
    },
    wyckoff_phase: {
      type:    String,
      default: 'unknown',
    },
    timeframe: {
      type:    String,
      default: '4h',
    },
  },
  {
    timestamps:  true,
    collection: 'marketregimes',
  }
);

// Get latest regime per symbol quickly
MarketRegimeSchema.index({ symbol: 1, detected_at: -1 });

// TTL index: auto-expire old regime snapshots after 24h
MarketRegimeSchema.index({ detected_at: 1 }, { expireAfterSeconds: 86400 });
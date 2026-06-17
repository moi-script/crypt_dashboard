// ============================================================
// intelligenceScan.schema.ts
// Mongoose schema for a persisted IntelligenceScan snapshot.
// The scan is a denormalized, point-in-time aggregation. Top-level
// metadata is typed/indexed for querying; the heavy nested payloads
// (coins, btc_context, dominance) are stored as Mixed since they are
// read back whole, not queried into.
// Imported by: intelligenceScan.model.ts
// ============================================================

import { Schema } from 'mongoose';

// Retain scan snapshots for 14 days, then auto-expire. Scans are
// point-in-time and large; this keeps meaningful history bounded.
export const INTELLIGENCE_SCAN_TTL_SECONDS = 14 * 24 * 60 * 60;

export const IntelligenceScanSchema = new Schema(
  {
    scan_id:        { type: String, required: true, unique: true, index: true },
    generated_at:   { type: Date, required: true },
    market_phase:   { type: String, default: 'mixed' },
    total_analyzed: { type: Number, default: 0 },
    windows_open:   { type: Number, default: 0 },
    coin_count:     { type: Number, default: 0 },
    // Denormalized BTC headline fields for cheap querying/filtering
    btc_regime:     { type: String, default: null },
    btc_bias:       { type: String, enum: ['long', 'short', 'neutral', null], default: null },
    // Full nested payloads — read back whole, not queried into
    btc_context:       { type: Schema.Types.Mixed, default: null },
    dominance:         { type: Schema.Types.Mixed, default: null },
    coins:             { type: [Schema.Types.Mixed], default: [] },
    top_opportunities: { type: [Schema.Types.Mixed], default: [] },
  },
  {
    timestamps: true,
    collection: 'intelligencescans',
  }
);

// Most common query: latest scan(s) by recency
IntelligenceScanSchema.index({ generated_at: -1 });
// TTL: auto-expire old scan snapshots
IntelligenceScanSchema.index({ generated_at: 1 }, { expireAfterSeconds: INTELLIGENCE_SCAN_TTL_SECONDS });

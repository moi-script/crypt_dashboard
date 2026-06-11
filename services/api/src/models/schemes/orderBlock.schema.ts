// ============================================================
// orderBlock.schema.ts
// Mongoose schema for Order Block zones
// ✅ COMPLETE — do NOT regenerate
// Imported by: orderBlock.model.ts
// ============================================================

import { Schema } from 'mongoose';

const FairValueGapSubSchema = new Schema({
  high:      { type: Number, required: true },
  low:       { type: Number, required: true },
  timestamp: { type: Number, required: true },
  filled:    { type: Boolean, default: false },
  type:      { type: String, enum: ['bullish', 'bearish'], required: true },
}, { _id: false });

export const OrderBlockSchema = new Schema(
  {
    id:               { type: String, required: true, unique: true, index: true },
    symbol:           { type: String, required: true, index: true },
    type:             { type: String, enum: ['bullish', 'bearish'], required: true },
    high:             { type: Number, required: true },
    low:              { type: Number, required: true },
    origin_timestamp: { type: Number, required: true },
    timeframe:        { type: String, required: true, default: '4H' },
    status:           { type: String, enum: ['active', 'mitigated', 'broken'], default: 'active', index: true },
    strength:         { type: Number, min: 0, max: 100, default: 50 },
    associated_fvg:   { type: FairValueGapSubSchema, default: null },
    mitigated_at:     { type: Date, default: null },
  },
  {
    timestamps: true,   // adds createdAt, updatedAt
    collection: 'orderblocks',
  }
);

// Compound index: most common query pattern
OrderBlockSchema.index({ symbol: 1, status: 1, origin_timestamp: -1 });
OrderBlockSchema.index({ symbol: 1, low: 1, high: 1 }); // for price range queries
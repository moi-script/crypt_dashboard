// src/models/schemas/ohlcv.schema.ts
import { Schema, model } from 'mongoose'

const OHLCVSchema = new Schema({
  time:    { type: Date,   required: true, index: true },
  coinId:  { type: String, required: true, index: true },
  open:    Number, high: Number, low: Number, close: Number,
  volume:  Number
}, { timeseries: { timeField: 'time', metaField: 'coinId' } })

// Compound index for chart queries
// OHLCVSchema.index({ coinId: 1, time: -1 })

export const OHLCVDoc = model('OHLCV', OHLCVSchema)
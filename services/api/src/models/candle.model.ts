import { Schema, model, Document } from 'mongoose'

// ─── Candle5m document ────────────────────────────────────────────────────────

export interface ICandle5m extends Document {
  symbol: string
  coingeckoId: string
  timeframeStart: Date
  open: number
  high: number
  low: number
  close: number
  volume: number | null
  tickCount: number
  source: string
  createdAt: Date
}

const Candle5mSchema = new Schema<ICandle5m>(
  {
    symbol: { type: String, required: true },
    coingeckoId: { type: String, required: true },
    timeframeStart: { type: Date, required: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, default: null },
    tickCount: { type: Number, required: true },
    source: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

// Compound unique index for idempotent upserts
Candle5mSchema.index(
  { coingeckoId: 1, timeframeStart: 1 },
  { unique: true }
)

// Range query index
Candle5mSchema.index({ coingeckoId: 1, timeframeStart: -1 })

export const Candle5mDoc = model<ICandle5m>('Candle5m', Candle5mSchema)

// ─── TickRaw document ────────────────────────────────────────────────────────

export interface ITickRaw extends Document {
  coingeckoId: string
  price: number
  volume24h: number | null
  polledAt: Date
  source: string
}

const TickRawSchema = new Schema<ITickRaw>(
  {
    coingeckoId: { type: String, required: true },
    price: { type: Number, required: true },
    volume24h: { type: Number, default: null },
    polledAt: { type: Date, required: true },
    source: { type: String, required: true },
  },
  { timestamps: true }
)

// Index for bucket aggregation queries
TickRawSchema.index({ coingeckoId: 1, polledAt: 1 })

// TTL index — 48 hour auto-purge
TickRawSchema.index({ polledAt: 1 }, { expireAfterSeconds: 48 * 60 * 60 })

export const TickRawDoc = model<ITickRaw>('TickRaw', TickRawSchema)

// ─── DataHealth document ────────────────────────────────────────────────────

export interface IDataHealth extends Document {
  coingeckoId: string
  symbol: string
  lastTickAt: Date | null
  lastCandleClosedAt: Date | null
  consecutiveMissedPolls: number
  staleSince: Date | null
}

const DataHealthSchema = new Schema<IDataHealth>(
  {
    coingeckoId: { type: String, required: true, unique: true },
    symbol: { type: String, required: true },
    lastTickAt: { type: Date, default: null },
    lastCandleClosedAt: { type: Date, default: null },
    consecutiveMissedPolls: { type: Number, required: true, default: 0 },
    staleSince: { type: Date, default: null },
  },
  { timestamps: true }
)

export const DataHealthDoc = model<IDataHealth>('DataHealth', DataHealthSchema)

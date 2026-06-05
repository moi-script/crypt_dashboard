import { Schema, model, Document } from 'mongoose'
import { OHLCVDoc } from './schemes/ohlcv.schema'

// ─── Coin document ────────────────────────────────────────────────────────────

export interface ICoin {
  coinId:    string
  symbol:    string
  name:      string
  image?:    string
  rank?:     number
  price:     number
  change24h: number
  volume24h: number
  marketCap: number
  updatedAt: Date
}

const CoinSchema = new Schema<ICoin>({
  coinId:    { type: String, required: true, unique: true, index: true },
  symbol:    { type: String, required: true },
  name:      { type: String, required: true },
  image:     String,
  rank:      Number,
  price:     { type: Number, default: 0 },
  change24h: { type: Number, default: 0 },
  volume24h: { type: Number, default: 0 },
  marketCap: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true })

export const CoinDoc = model<ICoin>('Coin', CoinSchema)

// ─── Indicator document ───────────────────────────────────────────────────────

export interface IIndicator {
  coinId: string
  time:   Date
  rsi14:  number | null
  macd:   number | null
  signal: number | null
  sma20:  number | null
  ema50:  number | null
  bb_upper: number | null
  bb_lower: number | null
}

const IndicatorSchema = new Schema<IIndicator>({
  coinId:   { type: String, required: true, index: true },
  time:     { type: Date,   required: true, index: true },
  rsi14:    Number,
  macd:     Number,
  signal:   Number,
  sma20:    Number,
  ema50:    Number,
  bb_upper: Number,
  bb_lower: Number,
})

IndicatorSchema.index({ coinId: 1, time: -1 })
export const IndicatorDoc = model<IIndicator>('Indicator', IndicatorSchema)

// ─── CoinModel class (used by CoinService) ────────────────────────────────────

export class CoinModel {
  findAll() {
    return CoinDoc.find().sort({ rank: 1 }).lean()
  }

  findById(coinId: string) {
    return CoinDoc.findOne({ coinId }).lean()
  }

 findOHLCV(coinId: string, range: string) {
  const rangeMap: Record<string, { unit: string; binSize: number; daysBack: number }> = {
    '1D': { unit: 'minute', binSize: 5,  daysBack: 1   },
    '1W': { unit: 'hour',   binSize: 1,  daysBack: 7   },
    '1M': { unit: 'hour',   binSize: 4,  daysBack: 30  },
    '1Y': { unit: 'day',    binSize: 1,  daysBack: 365 },
  }

  const { unit, binSize, daysBack } = rangeMap[range] ?? rangeMap['1D']
  const since = new Date(Date.now() - daysBack * 86_400_000)

  return OHLCVDoc.aggregate([
    { $match: { coinId, time: { $gte: since } } },
    { $group: {
        _id:    { $dateTrunc: { date: '$time', unit, binSize } },
        open:   { $first: '$open'   },
        high:   { $max:   '$high'   },
        low:    { $min:   '$low'    },
        close:  { $last:  '$close'  },
        volume: { $sum:   '$volume' },
    }},
    { $sort: { _id: 1 } },
  ])
}

  findIndicators(coinId: string, limit = 100) {
    return IndicatorDoc.find({ coinId }).sort({ time: -1 }).limit(limit).lean()
  }
}
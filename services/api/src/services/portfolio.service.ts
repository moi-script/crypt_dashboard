import { Schema, model } from 'mongoose'
import { AppError } from '../middleware/errorHandler'
import { redis } from '../config/redis'

// ─── Inline schema (small enough to live here) ─────────────────────────────

interface IHolding {
  coinId:    string
  quantity:  number
  avgCost:   number  // cost basis per unit in USD
  addedAt:   Date
}

interface IPortfolio {
  userId:   string
  holdings: IHolding[]
}

const PortfolioSchema = new Schema<IPortfolio>({
  userId:   { type: String, required: true, unique: true },
  holdings: [{
    coinId:   { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    avgCost:  { type: Number, required: true, min: 0 },
    addedAt:  { type: Date,   default: Date.now },
  }],
}, { timestamps: true })

const PortfolioDoc = model<IPortfolio>('Portfolio', PortfolioSchema)

// ─── Service ──────────────────────────────────────────────────────────────────

export class PortfolioService {
  async get(userId: string) {
    const cacheKey = `portfolio:${userId}`
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const portfolio = await PortfolioDoc.findOne({ userId }).lean()
    const result = portfolio ?? { userId, holdings: [] }
    await redis.set(cacheKey, JSON.stringify(result), { EX: 60 })
    return result
  }

  async upsertHolding(userId: string, coinId: string, quantity: number, avgCost: number) {
    let portfolio = await PortfolioDoc.findOneAndUpdate(
      { userId, 'holdings.coinId': coinId },
      { $set: { 'holdings.$.quantity': quantity, 'holdings.$.avgCost': avgCost } },
      { new: true },
    )

    if (!portfolio) {
      portfolio = await PortfolioDoc.findOneAndUpdate(
        { userId },
        { $push: { holdings: { coinId, quantity, avgCost, addedAt: new Date() } } },
        { new: true, upsert: true },
      )
    }

    // ✅ Always invalidate, regardless of which branch ran
    await redis.del(`portfolio:${userId}`)
    return portfolio!.toObject()
  }

  async removeHolding(userId: string, coinId: string) {
    const result = await PortfolioDoc.findOneAndUpdate(
      { userId },
      { $pull: { holdings: { coinId } } },
      { new: true },
    )
    if (!result) throw new AppError(404, 'Portfolio not found')
    await redis.del(`portfolio:${userId}`)
    return result.toObject()
  }
}
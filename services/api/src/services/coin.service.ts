import { CoinModel } from '../models/coin.model'
import { redis } from '../config/redis'
import { AppError } from '../middleware/errorHandler'

const CACHE_TTL = 30 // seconds

export class CoinService {
  private model = new CoinModel()

  async getAll() {
    const cached = await redis.get('coins:all')
    if (cached) return JSON.parse(cached)

    const coins = await this.model.findAll()
    await redis.set('coins:all', JSON.stringify(coins), { EX: CACHE_TTL })
    return coins
  }

  async getOne(coinId: string) {
    const cacheKey = `coins:${coinId}`
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const coin = await this.model.findById(coinId)
    if (!coin) throw new AppError(404, `Coin '${coinId}' not found`)

    await redis.set(cacheKey, JSON.stringify(coin), { EX: CACHE_TTL })
    return coin
  }

async getOHLCV(coinId: string, range: string) {
  return this.model.findOHLCV(coinId, range)
}

  async getIndicators(coinId: string, limit = 100) {
    const cacheKey = `coins:${coinId}:indicators:${limit}`
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const indicators = await this.model.findIndicators(coinId, limit)
    await redis.set(cacheKey, JSON.stringify(indicators), { EX: 60 })
    return indicators
  }
}
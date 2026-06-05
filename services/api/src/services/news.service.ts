import { ArticleDoc } from '../models/news.model'
import { redis } from '../config/redis'

export class NewsService {
  async getLatest(limit = 20, coinId?: string) {
    const cacheKey = `news:${coinId ?? 'all'}:${limit}`
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const filter = coinId ? { coins: coinId } : {}
    const articles = await ArticleDoc
      .find(filter)
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean()

    await redis.set(cacheKey, JSON.stringify(articles), { EX: 120 })
    return articles
  }

  async getForCoin(coinId: string, limit = 10) {
    return this.getLatest(limit, coinId)
  }
}
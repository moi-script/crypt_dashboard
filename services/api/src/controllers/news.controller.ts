import { z } from 'zod'
import type { Request, Response, NextFunction } from 'express'
import { NewsService } from '../services/news.service'
import { validate, NewsQuery, NewsByCoinParams } from '../middleware/validate'

export class NewsController {
  private svc = new NewsService()

  getLatest = [
    validate(NewsQuery, 'query'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { limit } = req.query as unknown as z.infer<typeof NewsQuery>
        res.json(await this.svc.getLatest(limit))
      } catch (err) { next(err) }
    },
  ]

  getByCoin = [
    validate(NewsByCoinParams, 'params'),
    validate(NewsQuery, 'query'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { coinId } = req.params as unknown as z.infer<typeof NewsByCoinParams>
        const { limit } = req.query as unknown as z.infer<typeof NewsQuery>
        res.json(await this.svc.getForCoin(coinId, limit))
      } catch (err) { next(err) }
    },
  ]
}
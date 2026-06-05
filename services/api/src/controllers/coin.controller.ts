import { z } from 'zod'
import type { Request, Response, NextFunction } from 'express'
import { CoinService } from '../services/coin.service'
import {
  validate,
  CoinParams, OHLCVQuery, IndicatorsQuery,
} from '../middleware/validate'

export class CoinController {
  private svc = new CoinService()

  getAll = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.svc.getAll())
    } catch (err) { next(err) }
  }

  getOne = [
    validate(CoinParams, 'params'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as unknown as z.infer<typeof CoinParams>
        res.json(await this.svc.getOne(id))
      } catch (err) { next(err) }
    },
  ]

  getOHLCV = [
    validate(CoinParams, 'params'),
    validate(OHLCVQuery, 'query'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as unknown as z.infer<typeof CoinParams>
        const { range } = req.query as unknown as z.infer<typeof OHLCVQuery>
        res.json(await this.svc.getOHLCV(id, range))
      } catch (err) { next(err) }
    },
  ]

  getIndicators = [
    validate(CoinParams, 'params'),
    validate(IndicatorsQuery, 'query'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as unknown as z.infer<typeof CoinParams>
        const { limit } = req.query as unknown as z.infer<typeof IndicatorsQuery>
        res.json(await this.svc.getIndicators(id, limit))
      } catch (err) { next(err) }
    },
  ]
}
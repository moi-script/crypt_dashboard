import { z } from 'zod'
import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { PortfolioService } from '../services/portfolio.service'
import {
  validate,
  UpsertHoldingBody, PortfolioCoinParams,
} from '../middleware/validate'

export class PortfolioController {
  private svc = new PortfolioService()

  get = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await this.svc.get(req.userId!))
    } catch (err) { next(err) }
  }

  upsert = [
    validate(UpsertHoldingBody),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const { coinId, quantity, avgCost } = req.body as z.infer<typeof UpsertHoldingBody>
        res.json(await this.svc.upsertHolding(req.userId!, coinId, quantity, avgCost))
      } catch (err) { next(err) }
    },
  ]

  remove = [
    validate(PortfolioCoinParams, 'params'),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const { coinId } = req.params as unknown as z.infer<typeof PortfolioCoinParams>
        res.json(await this.svc.removeHolding(req.userId!, coinId))
      } catch (err) { next(err) }
    },
  ]
}
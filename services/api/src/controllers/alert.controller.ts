import { z } from 'zod'
import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { AlertService } from '../services/alert.service'
import {
  validate,
  CreateAlertBody, AlertParams, ToggleAlertBody,
} from '../middleware/validate'

export class AlertController {
  private svc = new AlertService()

  getAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await this.svc.getForUser(req.userId!))
    } catch (err) { next(err) }
  }

  create = [
    validate(CreateAlertBody),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const body = req.body as z.infer<typeof CreateAlertBody>
        res.status(201).json(await this.svc.create(req.userId!, body))
      } catch (err) { next(err) }
    },
  ]

  delete = [
    validate(AlertParams, 'params'),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as unknown as z.infer<typeof AlertParams>
        res.json(await this.svc.delete(req.userId!, id))
      } catch (err) { next(err) }
    },
  ]

  toggle = [
    validate(AlertParams, 'params'),
    validate(ToggleAlertBody),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params as unknown as z.infer<typeof AlertParams>
        const { active } = req.body as z.infer<typeof ToggleAlertBody>
        res.json(await this.svc.toggle(req.userId!, id, active))
      } catch (err) { next(err) }
    },
  ]
}
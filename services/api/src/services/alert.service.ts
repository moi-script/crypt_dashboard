import { AlertDoc, IAlert, AlertCondition } from '../models/alert.model'

import { AppError } from '../middleware/errorHandler'

export interface CreateAlertDTO {
  coinId:    string
  condition: AlertCondition
  threshold: number
}

export class AlertService {
  async getForUser(userId: string) {
    return AlertDoc.find({ userId, active: true }).sort({ createdAt: -1 }).lean()
  }

  async create(userId: string, dto: CreateAlertDTO) {
    const alert = await AlertDoc.create({ userId, ...dto })
    return alert.toObject()
  }

  async delete(userId: string, alertId: string) {
    const result = await AlertDoc.findOneAndDelete({ _id: alertId, userId })
    if (!result) throw new AppError(404, 'Alert not found')
    return { deleted: true }
  }

  async toggle(userId: string, alertId: string, active: boolean) {
    const alert = await AlertDoc.findOneAndUpdate(
      { _id: alertId, userId },
      { active },
      { new: true },
    )
    if (!alert) throw new AppError(404, 'Alert not found')
    return alert.toObject()
  }

  /** Called by the data worker via Redis pub/sub — marks alert as triggered */
  async markTriggered(alertId: string) {
    return AlertDoc.findByIdAndUpdate(alertId, {
      triggered: true,
      triggeredAt: new Date(),
    })
  }
}
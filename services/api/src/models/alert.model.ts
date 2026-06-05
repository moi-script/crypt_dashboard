import { Schema, model } from 'mongoose'

export type AlertCondition = 'above' | 'below' | 'pct_change'

export interface IAlert {
  userId:    string
  coinId:    string
  condition: AlertCondition
  threshold: number
  triggered: boolean
  active:    boolean
  triggeredAt?: Date
  createdAt: Date
}

const AlertSchema = new Schema<IAlert>({
  userId:      { type: String, required: true, index: true },
  coinId:      { type: String, required: true, index: true },
  condition:   { type: String, enum: ['above', 'below', 'pct_change'], required: true },
  threshold:   { type: Number, required: true },
  triggered:   { type: Boolean, default: false },
  active:      { type: Boolean, default: true },
  triggeredAt: Date,
}, { timestamps: true })

AlertSchema.index({ userId: 1, coinId: 1 })

export const AlertDoc = model<IAlert>('Alert', AlertSchema)
/**
 * agent.model.ts
 *
 * Persists chat sessions and emotion state to MongoDB.
 * This gives the free OpenRouter model "memory" across restarts.
 */

import { Schema, model } from 'mongoose'
import type { EmotionType, EmotionIntensity } from '../agents/emotion.types'

// ── Stored emotion ────────────────────────────────────────────────────────────

export interface IStoredEmotion {
  emotion:   EmotionType
  intensity: EmotionIntensity
  reason:    string
  asset:     string
  message:   string
}

// ── Stored message ────────────────────────────────────────────────────────────

export interface IAgentMessage {
  role:      'user' | 'agent'
  content:   string
  emotion?:  IStoredEmotion
  ts:        number
}

// ── Full session document ─────────────────────────────────────────────────────

export interface IAgentSession {
  sessionId:      string
  userId?:        string        // optional — link to auth user if logged in
  coinId:         string
  messages:       IAgentMessage[]
  currentEmotion: IStoredEmotion
  createdAt:      Date
  updatedAt:      Date
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const EmotionSchema = new Schema<IStoredEmotion>({
  emotion:   { type: String, required: true },
  intensity: { type: String, required: true },
  reason:    { type: String, default: '' },
  asset:     { type: String, default: '' },
  message:   { type: String, default: '' },
}, { _id: false })

const MessageSchema = new Schema<IAgentMessage>({
  role:    { type: String, enum: ['user', 'agent'], required: true },
  content: { type: String, required: true },
  emotion: { type: EmotionSchema, default: undefined },
  ts:      { type: Number, required: true },
}, { _id: false })

const AgentSessionSchema = new Schema<IAgentSession>({
  sessionId:      { type: String, required: true, unique: true, index: true },
  userId:         { type: String, index: true },
  coinId:         { type: String, required: true, default: 'bitcoin' },
  messages:       { type: [MessageSchema], default: [] },
  currentEmotion: { type: EmotionSchema, required: true },
  createdAt:      { type: Date, default: Date.now },
  updatedAt:      { type: Date, default: Date.now },
}, { timestamps: true })

// Compound index for user session lookups
AgentSessionSchema.index({ userId: 1, updatedAt: -1 })

// TTL — auto-delete sessions inactive for 30 days
AgentSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })

export const AgentSessionDoc = model<IAgentSession>('AgentSession', AgentSessionSchema)
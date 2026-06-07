/**
 * agent.controller.ts
 */

import type { Request, Response, NextFunction } from 'express'
import { AgentService } from '../services/agent.service'

const svc = new AgentService()

// POST /api/agent/chat
export async function chat(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId, message, coinId, isAnalysing } = req.body

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' })
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' })
    }

    const result = await svc.chat({ sessionId, message, coinId, isAnalysing })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// GET /api/agent/session/:sessionId
export async function getSession(req: Request, res: Response, next: NextFunction) {
  try {
    const session = svc.getSession(req.params.sessionId as string)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    res.json(session)
  } catch (err) {
    next(err)
  }
}

// DELETE /api/agent/session/:sessionId
export async function clearSession(req: Request, res: Response, next: NextFunction) {
  try {
    svc.clearSession(req.params.sessionId as string)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}
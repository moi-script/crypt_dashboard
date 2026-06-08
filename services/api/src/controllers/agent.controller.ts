/**
 * agent.controller.ts
 */

import type { Request, Response, NextFunction } from 'express'
import { AgentService } from '../services/agent.service'

const svc = new AgentService()

// POST /api/agent/chat
// Body: { sessionId, message, coinId?, userId?, isAnalysing? }
export async function chat(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId, message, coinId, userId, isAnalysing } = req.body

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' })
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' })
    }

    const result = await svc.chat({ sessionId, message, coinId, userId, isAnalysing })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// GET /api/agent/session/:sessionId
// NOTE: never returns 404 — auto-creates the session document if it doesn't
// exist yet. This is intentional: the frontend generates the sessionId client-
// side and calls GET to verify/restore it; we don't want a race between the
// seed POST and this GET.
export async function getSession(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params
    const { coinId, userId } = req.query

    const session = await svc.getOrCreateSession(
      sessionId as string,
      (coinId as string | undefined) ?? 'bitcoin',
      userId as string | undefined,
    )

    res.json(session)
  } catch (err) {
    next(err)
  }
}

// GET /api/agent/sessions/user/:userId
export async function getUserSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const sessions = await svc.getUserSessions(req.params.userId as string)
    res.json(sessions)
  } catch (err) {
    next(err)
  }
}

// DELETE /api/agent/session/:sessionId
export async function clearSession(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.clearSession(req.params.sessionId as string)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}
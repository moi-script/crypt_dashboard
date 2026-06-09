/**
 * agentRun.controller.ts
 *
 * REST endpoints for the autonomous agent.
 *
 * GET  /api/agent-runs             — list recent runs with status
 * GET  /api/agent-runs/:runId      — full run detail (context + decision + execution)
 * POST /api/agent-runs/trigger     — manually trigger one loop tick (admin)
 * GET  /api/agent-runs/config      — current agent config
 * PUT  /api/agent-runs/config      — patch agent config (admin)
 */

import type { Request, Response, NextFunction } from 'express'
import { AgentRunDoc }                           from '../models/agentRun.model'
import { agentConfig, patchConfig }              from '../config/agent.config'
import { triggerOneTick, isSchedulerRunning }    from '../agents/loop/scheduler'
import { checkKeyPresence }                      from '../execution/wallet/keystore'

// ── List recent runs ──────────────────────────────────────────────────────────

export async function listRuns(req: Request, res: Response, next: NextFunction) {
  try {
    const limit    = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const strategy = req.query.strategy as string | undefined
    const status   = req.query.status   as string | undefined

    const filter: Record<string, unknown> = {}
    if (strategy) filter.strategy = strategy
    if (status)   filter.status   = status

    const runs = await AgentRunDoc
      .find(filter)
      .sort({ startedAt: -1 })
      .limit(limit)
      .select('-contextSnapshot')  // omit large field from list view
      .lean()

    res.json({ runs, total: runs.length })
  } catch (err) { next(err) }
}

// ── Get one run (full detail) ─────────────────────────────────────────────────

export async function getRun(req: Request, res: Response, next: NextFunction) {
  try {
    const { runId } = req.params
    const run = await AgentRunDoc.findOne({ runId }).lean()
    if (!run) return res.status(404).json({ error: `Run "${runId}" not found` })
    res.json(run)
  } catch (err) { next(err) }
}

// ── Manually trigger one tick ─────────────────────────────────────────────────

export async function triggerRun(req: Request, res: Response, next: NextFunction) {
  try {
    // Non-blocking — trigger and return immediately
    const { wait } = req.query
    if (wait === 'true') {
      await triggerOneTick()
      res.json({ triggered: true, waited: true })
    } else {
      triggerOneTick().catch(err =>
        console.error('[agentRun.controller] Manual trigger failed:', err.message)
      )
      res.json({ triggered: true, waited: false })
    }
  } catch (err: any) {
    next(err)
  }
}

// ── Get current config ────────────────────────────────────────────────────────

export async function getConfig(_req: Request, res: Response) {
  res.json({
    config:          agentConfig,
    schedulerActive: isSchedulerRunning(),
    keyPresence:     checkKeyPresence(),
  })
}

// ── Patch config ──────────────────────────────────────────────────────────────

export async function updateConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const patch = req.body
    patchConfig(patch)
    res.json({ ok: true, config: agentConfig })
  } catch (err: any) {
    next(err)
  }
}

// ── Get run stats ─────────────────────────────────────────────────────────────

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const [total, completed, failed, blocked, pending] = await Promise.all([
      AgentRunDoc.countDocuments({}),
      AgentRunDoc.countDocuments({ status: 'completed' }),
      AgentRunDoc.countDocuments({ status: 'failed' }),
      AgentRunDoc.countDocuments({ status: 'blocked' }),
      AgentRunDoc.countDocuments({ status: 'pending_approval' }),
    ])

    // Last 24h
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const last24h  = await AgentRunDoc.countDocuments({ startedAt: { $gte: since24h } })

    // Most common intent types (last 100 runs)
    const recentDecisions = await AgentRunDoc
      .find({ decision: { $ne: null } })
      .sort({ startedAt: -1 })
      .limit(100)
      .select('decision.intent.type')
      .lean()

    const intentCounts = recentDecisions.reduce<Record<string, number>>((acc, r) => {
      const t = (r.decision as any)?.intent?.type ?? 'unknown'
      acc[t] = (acc[t] ?? 0) + 1
      return acc
    }, {})

    res.json({
      total, completed, failed, blocked, pending, last24h,
      intentBreakdown: intentCounts,
    })
  } catch (err) { next(err) }
}

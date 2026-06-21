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

import type { Response, NextFunction }           from 'express'
import type { AuthRequest }                      from '../middleware/auth'
import { AgentRunDoc }                            from '../models/agentRun.model'
import { getOrCreateConfig, patchConfig }         from '../services/agentConfig.service'
import { triggerOneTick, isSchedulerRunning, startScheduler, stopScheduler } from '../agents/loop/scheduler'
import { checkKeyPresence }                       from '../execution/wallet/keystore'
import { approveRun as doApproveRun, rejectRun as doRejectRun } from '../agents/loop/agent.loop'

// ── List recent runs ──────────────────────────────────────────────────────────

export async function listRuns(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const limit    = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const strategy = req.query.strategy as string | undefined
    const status   = req.query.status   as string | undefined

    const filter: Record<string, unknown> = { userId: req.userId }
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

export async function getRun(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { runId } = req.params
    const run = await AgentRunDoc.findOne({ runId, userId: req.userId }).lean()
    if (!run) return res.status(404).json({ error: `Run "${runId}" not found` })
    res.json(run)
  } catch (err) { next(err) }
}

// ── Manually trigger one tick ─────────────────────────────────────────────────

export async function triggerRun(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Non-blocking — trigger and return immediately
    const { wait } = req.query
    if (wait === 'true') {
      await triggerOneTick(req.userId!)
      res.json({ triggered: true, waited: true })
    } else {
      triggerOneTick(req.userId!).catch(err =>
        console.error('[agentRun.controller] Manual trigger failed:', err.message)
      )
      res.json({ triggered: true, waited: false })
    }
  } catch (err: any) {
    next(err)
  }
}

// ── Get current config ────────────────────────────────────────────────────────

export async function getConfig(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const config = await getOrCreateConfig(req.userId!)
    res.json({
      config,
      schedulerActive: isSchedulerRunning(),
      keyPresence:     checkKeyPresence(),
    })
  } catch (err) { next(err) }
}

// ── Patch config ──────────────────────────────────────────────────────────────

export async function updateConfig(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const config = await patchConfig(req.userId!, req.body)
    if ('enabled' in req.body) {
      if (config.enabled && !isSchedulerRunning()) startScheduler()
      else if (!config.enabled && isSchedulerRunning()) stopScheduler()
    }
    res.json({ ok: true, config })
  } catch (err: any) {
    next(err)
  }
}

// ── Approval queue ────────────────────────────────────────────────────────────

export async function listApprovals(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const approvals = await AgentRunDoc
      .find({ userId: req.userId, status: 'pending_approval' })
      .sort({ startedAt: -1 })
      .select('runId strategy decision chartSnapshot startedAt')
      .lean()
    res.json({ approvals, total: approvals.length })
  } catch (err) { next(err) }
}

export async function approveRunCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await doApproveRun(req.userId!, req.params.runId as string)
    res.json(result)
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message })
    next(err)
  }
}

export async function rejectRunCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await doRejectRun(req.userId!, req.params.runId as string)
    res.sendStatus(204)
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message })
    next(err)
  }
}

// ── Get run stats ─────────────────────────────────────────────────────────────

export async function getStats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [total, completed, failed, blocked, pending] = await Promise.all([
      AgentRunDoc.countDocuments({ userId: req.userId }),
      AgentRunDoc.countDocuments({ userId: req.userId, status: 'completed' }),
      AgentRunDoc.countDocuments({ userId: req.userId, status: 'failed' }),
      AgentRunDoc.countDocuments({ userId: req.userId, status: 'blocked' }),
      AgentRunDoc.countDocuments({ userId: req.userId, status: 'pending_approval' }),
    ])

    // Last 24h
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const last24h  = await AgentRunDoc.countDocuments({ userId: req.userId, startedAt: { $gte: since24h } })

    // Most common intent types (last 100 runs)
    const recentDecisions = await AgentRunDoc
      .find({ userId: req.userId, decision: { $ne: null } })
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

/**
 * opportunity.controller.ts
 *
 * GET /api/opportunities          — list active (non-expired) opportunities
 * GET /api/opportunities/:id      — get one opportunity
 */

import type { Response, NextFunction } from 'express'
import type { AuthRequest }            from '../middleware/auth'
import { OpportunityDoc }              from '../models/opportunity.model'

export async function listOpportunities(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const type     = req.query.type     as string | undefined
    const strategy = req.query.strategy as string | undefined
    const acted    = req.query.acted    as string | undefined
    const limit    = Math.min(parseInt(req.query.limit as string) || 50, 200)

    const filter: Record<string, unknown> = {
      userId:    req.userId!,
      expiresAt: { $gt: new Date() },  // only non-expired
    }
    if (type)     filter.type     = type
    if (strategy) filter.strategy = strategy
    if (acted !== undefined) filter.acted = acted === 'true'

    const opportunities = await OpportunityDoc
      .find(filter)
      .sort({ detectedAt: -1, score: -1 })
      .limit(limit)
      .lean()

    res.json({ opportunities, count: opportunities.length })
  } catch (err) { next(err) }
}

export async function getOpportunity(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const opp = await OpportunityDoc.findOne({ opportunityId: id, userId: req.userId! }).lean()
    if (!opp) return res.status(404).json({ error: `Opportunity "${id}" not found` })
    res.json(opp)
  } catch (err) { next(err) }
}

export async function getOpportunitySummary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const now     = new Date()
    const userId  = req.userId!
    const total   = await OpportunityDoc.countDocuments({ userId, expiresAt: { $gt: now } })
    const acted   = await OpportunityDoc.countDocuments({ userId, expiresAt: { $gt: now }, acted: true })
    const byType  = await OpportunityDoc.aggregate([
      { $match: { userId, expiresAt: { $gt: now } } },
      { $group: { _id: '$type', count: { $sum: 1 }, avgScore: { $avg: '$score' } } },
    ])

    res.json({
      total,
      acted,
      unacted: total - acted,
      byType,
    })
  } catch (err) { next(err) }
}

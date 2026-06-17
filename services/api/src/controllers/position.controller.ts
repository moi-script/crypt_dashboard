/**
 * position.controller.ts
 *
 * GET /api/positions          — list open/closed positions
 * GET /api/positions/pnl/daily — today's PnL
 * GET /api/positions/pnl/summary — all-time PnL breakdown
 */

import type { Response, NextFunction } from 'express'
import type { AuthRequest }            from '../middleware/auth'
import { PositionDoc, OrderDoc }       from '../models/position.model'

export async function listPositions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const mode    = (req.query.mode as string) ?? 'paper'
    const isOpen  = req.query.open === 'true' ? true : req.query.open === 'false' ? false : undefined
    const limit   = Math.min(parseInt(req.query.limit as string) || 50, 200)

    const filter: Record<string, unknown> = { mode, userId: req.userId! }
    if (isOpen !== undefined) filter.isOpen = isOpen

    const positions = await PositionDoc
      .find(filter)
      .sort({ entryAt: -1 })
      .limit(limit)
      .lean()

    res.json({ positions, count: positions.length })
  } catch (err) { next(err) }
}

export async function getDailyPnl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const closedToday = await PositionDoc
      .find({ userId: req.userId!, status: 'closed', exitAt: { $gte: today } })
      .lean()

    const totalPnlUsd  = closedToday.reduce((s, p) => s + (p.realizedPnlUsd ?? 0), 0)
    const tradeCount   = closedToday.length
    const winCount     = closedToday.filter(p => (p.realizedPnlUsd ?? 0) > 0).length

    res.json({
      date:         today.toISOString().slice(0, 10),
      totalPnlUsd:  parseFloat(totalPnlUsd.toFixed(4)),
      tradeCount,
      winCount,
      lossCount:    tradeCount - winCount,
      winRate:      tradeCount > 0 ? parseFloat(((winCount / tradeCount) * 100).toFixed(1)) : null,
    })
  } catch (err) { next(err) }
}

export async function getPnlSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const allClosed = await PositionDoc.find({ userId: req.userId!, status: 'closed' }).lean()

    const totalPnl   = allClosed.reduce((s, p) => s + (p.realizedPnlUsd ?? 0), 0)
    const totalTrades = allClosed.length
    const wins        = allClosed.filter(p => (p.realizedPnlUsd ?? 0) > 0)
    const losses      = allClosed.filter(p => (p.realizedPnlUsd ?? 0) < 0)

    const avgWin  = wins.length  > 0 ? wins.reduce((s, p)   => s + (p.realizedPnlUsd ?? 0), 0) / wins.length  : 0
    const avgLoss = losses.length > 0 ? losses.reduce((s, p) => s + (p.realizedPnlUsd ?? 0), 0) / losses.length : 0

    const openCount  = await PositionDoc.countDocuments({ userId: req.userId!, isOpen: true })
    const orderCount = await OrderDoc.countDocuments({ userId: req.userId! })

    res.json({
      totalPnlUsd:   parseFloat(totalPnl.toFixed(4)),
      totalTrades,
      openPositions: openCount,
      totalOrders:   orderCount,
      wins:          wins.length,
      losses:        losses.length,
      winRate:       totalTrades > 0 ? parseFloat(((wins.length / totalTrades) * 100).toFixed(1)) : null,
      avgWinUsd:     parseFloat(avgWin.toFixed(4)),
      avgLossUsd:    parseFloat(avgLoss.toFixed(4)),
      profitFactor:  avgLoss !== 0 ? parseFloat(Math.abs(avgWin / avgLoss).toFixed(2)) : null,
    })
  } catch (err) { next(err) }
}

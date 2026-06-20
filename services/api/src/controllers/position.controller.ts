/**
 * position.controller.ts
 *
 * GET   /api/positions              — list open/closed positions
 * PATCH /api/positions/:positionId  — update SL / TP on an open position
 * GET   /api/positions/pnl/daily    — today's PnL
 * GET   /api/positions/pnl/summary  — all-time PnL breakdown
 */

import type { Response, NextFunction } from 'express'
import type { AuthRequest }            from '../middleware/auth'
import { PositionDoc, OrderDoc }       from '../models/position.model'

export async function updatePosition(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { positionId } = req.params
    const numericFields = ['stopLossPrice', 'takeProfitPrice', 'highWaterMarkPrice']
    const pctFields     = ['trailingStopPct']
    const update: Record<string, number> = {}
    for (const field of numericFields) {
      const v = req.body[field]
      if (v !== undefined && isFinite(Number(v)) && Number(v) > 0) update[field] = Number(v)
    }
    for (const field of pctFields) {
      const v = req.body[field]
      if (v !== undefined && isFinite(Number(v)) && Number(v) >= 0) update[field] = Number(v)
    }
    if (!Object.keys(update).length) return res.status(400).json({ error: 'No valid fields to update' })

    const pos = await PositionDoc.findOneAndUpdate(
      { positionId, userId: req.userId!, isOpen: true },
      { $set: update },
      { new: true },
    ).lean()
    if (!pos) return res.status(404).json({ error: 'Position not found or not open' })
    res.json({ ok: true, position: pos })
  } catch (err) { next(err) }
}

export async function partialExitPosition(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { positionId } = req.params
    const exitPercent = Math.max(10, Math.min(90, Number(req.body.exitPercent) || 50))

    const pos = await PositionDoc.findOne({ positionId, userId: req.userId!, isOpen: true }).lean()
    if (!pos)            return res.status(404).json({ error: 'Position not found or not open' })
    if (!pos.entryPrice) return res.status(400).json({ error: 'Position has no entry price' })

    const priceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pos.tokenOut}USDT`)
    if (!priceRes.ok) return res.status(502).json({ error: 'Could not fetch live price from Binance' })
    const { price } = await priceRes.json() as { price: string }
    const currentPrice = parseFloat(price)
    if (!isFinite(currentPrice) || currentPrice <= 0) return res.status(502).json({ error: 'Invalid price from Binance' })

    const exitFraction      = exitPercent / 100
    const exitAmountUsd     = pos.entryAmountUsd * exitFraction
    const pnlUsd            = ((currentPrice - pos.entryPrice) / pos.entryPrice) * exitAmountUsd
    const remainingAmountUsd = pos.entryAmountUsd * (1 - exitFraction)

    await PositionDoc.updateOne({ positionId }, { $set: { entryAmountUsd: remainingAmountUsd } })

    res.json({
      ok:                  true,
      exitedAmountUsd:     parseFloat(exitAmountUsd.toFixed(4)),
      pnlUsd:              parseFloat(pnlUsd.toFixed(4)),
      currentPrice,
      remainingPercent:    100 - exitPercent,
      remainingAmountUsd:  parseFloat(remainingAmountUsd.toFixed(4)),
    })
  } catch (err) { next(err) }
}

export async function closePositionAtMarket(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { positionId } = req.params
    const pos = await PositionDoc.findOne({ positionId, userId: req.userId!, isOpen: true }).lean()
    if (!pos)            return res.status(404).json({ error: 'Position not found or not open' })
    if (!pos.entryPrice) return res.status(400).json({ error: 'Position has no entry price' })

    const priceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pos.tokenOut}USDT`)
    if (!priceRes.ok) return res.status(502).json({ error: 'Could not fetch live price' })
    const { price } = await priceRes.json() as { price: string }
    const exitPrice = parseFloat(price)
    if (!isFinite(exitPrice) || exitPrice <= 0) return res.status(502).json({ error: 'Invalid price' })

    const SLIPPAGE_PCT = 0.001  // 0.1% market order slippage + 0.1% fee
    const FEE_PCT      = 0.001
    const netExit      = exitPrice * (1 - SLIPPAGE_PCT - FEE_PCT)
    const pnlUsd       = ((netExit - pos.entryPrice) / pos.entryPrice) * pos.entryAmountUsd

    await PositionDoc.updateOne({ positionId }, {
      $set: {
        status:         'closed',
        isOpen:         false,
        exitPrice:      parseFloat(netExit.toFixed(4)),
        exitAmountUsd:  pos.entryAmountUsd * (netExit / pos.entryPrice),
        exitAt:         new Date(),
        realizedPnlUsd: parseFloat(pnlUsd.toFixed(4)),
      },
    })

    res.json({ ok: true, exitPrice: netExit, pnlUsd, positionId })
  } catch (err) { next(err) }
}

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

/**
 * paperWallet.controller.ts
 *
 * GET  /api/paper-wallet              — wallet state + balances
 * GET  /api/paper-wallet/trades       — paginated trade history
 * GET  /api/paper-wallet/stats        — aggregate stats + PnL
 * POST /api/paper-wallet/reset        — reset wallet to $5000 USDC (dev only)
 */

import type { Request, Response, NextFunction } from 'express'
import {
  getOrCreateWallet,
  getTradeHistory,
  getTradeStats,
  resetWallet,
} from '../services/paperWallet.service'

export async function getWallet(_req: Request, res: Response, next: NextFunction) {
  try {
    const wallet = await getOrCreateWallet()
    res.json(wallet)
  } catch (err) { next(err) }
}

export async function getTrades(req: Request, res: Response, next: NextFunction) {
  try {
    const limit  = Math.min(parseInt(req.query.limit as string)  || 50,  200)
    const skip   = Math.max(parseInt(req.query.skip  as string)  || 0,   0)
    const trades = await getTradeHistory(limit, skip)
    res.json({ trades, count: trades.length, skip, limit })
  } catch (err) { next(err) }
}

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await getTradeStats()
    res.json(stats)
  } catch (err) { next(err) }
}

export async function postReset(_req: Request, res: Response, next: NextFunction) {
  try {
    const wallet = await resetWallet()
    res.json({ ok: true, wallet })
  } catch (err) { next(err) }
}

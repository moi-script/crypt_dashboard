/**
 * paperWallet.controller.ts
 *
 * GET  /api/paper-wallet              — wallet state + balances
 * GET  /api/paper-wallet/trades       — paginated trade history
 * GET  /api/paper-wallet/stats        — aggregate stats + PnL
 * POST /api/paper-wallet/reset        — reset wallet to $5000 USDC (dev only)
 */

import type { Response, NextFunction } from 'express'
import type { AuthRequest }            from '../middleware/auth'
import {
  getOrCreateWallet,
  getTradeHistory,
  getTradeStats,
  resetWallet,
} from '../services/paperWallet.service'

export async function getWallet(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await getOrCreateWallet(req.userId!)) } catch (err) { next(err) }
}

export async function getTrades(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const limit  = Math.min(parseInt(req.query.limit as string) || 50, 200)
    const skip   = Math.max(parseInt(req.query.skip  as string) || 0, 0)
    const trades = await getTradeHistory(req.userId!, limit, skip)
    res.json({ trades, count: trades.length, skip, limit })
  } catch (err) { next(err) }
}

export async function getStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await getTradeStats(req.userId!)) } catch (err) { next(err) }
}

export async function postReset(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json({ ok: true, wallet: await resetWallet(req.userId!) }) } catch (err) { next(err) }
}

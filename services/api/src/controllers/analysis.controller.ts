/**
 * analysis.controller.ts
 */

import { Request, Response, NextFunction } from 'express'
import { AnalysisService } from '../services/analysis.service'

const svc = new AnalysisService()

// POST /api/analysis/:coinId/run
export async function runAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const { coinId } = req.params
    if (!coinId || coinId === 'undefined') {
      return res.status(400).json({ error: 'coinId is required' })
    }
    const analysis = await svc.runAnalysis(coinId as string)
    res.json(analysis)
  } catch (err) {
    next(err)
  }
}

// GET /api/analysis/:coinId/latest
export async function getLatest(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.getLatest(req.params.coinId as string)
    if (!result) return res.status(404).json({ error: 'No analysis found for this coin' })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// GET /api/analysis/:coinId/history?limit=10
export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50)
    const result = await svc.getHistory(req.params.coinId as string, limit)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// GET /api/analysis
export async function getAllLatest(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.getAllLatest()
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// GET /api/analysis/:coinId/behaviour
export async function getBehaviour(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.getBehaviour(req.params.coinId as string)
    if (!result) return res.status(404).json({ error: 'No behaviour data found' })
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// GET /api/analysis/behaviours
export async function getAllBehaviours(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.getAllBehaviours()
    res.json(result)
  } catch (err) {
    next(err)
  }
}
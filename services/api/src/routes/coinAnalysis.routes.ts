import { Router }       from 'express'
import { auth } from '@/middleware/auth'
import { runCoinAnalysis, approveCard, rejectCard } from '@/agents/coinAnalysis/coinAnalysis.runner'
import { CoinAnalysisRunDoc }   from '@/models/coinAnalysisRun.model'
import type { StrategyFramework } from '@/agents/coinAnalysis/coinAnalysis.types'

const VALID_FRAMEWORKS = new Set<StrategyFramework>(['SmartMoney', 'Wyckoff', 'ElliottWave', 'Harmonic'])

const router = Router()
router.use(auth)

// POST /api/coin-analysis/trigger  { symbol?: string }
router.post('/trigger', async (req, res) => {
  try {
    const userId = (req as any).userId
    const symbol = ((req.body as any).symbol as string | undefined)?.toUpperCase() ?? 'BTC'
    const coinAnalysisRunId = await runCoinAnalysis(userId, symbol, 'on_demand')
    res.json({ coinAnalysisRunId })
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ error: err.message })
  }
})

// GET /api/coin-analysis/:runId
router.get('/:runId', async (req, res) => {
  try {
    const userId = (req as any).userId
    const run = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId: req.params.runId, userId }).lean()
    if (!run) return res.status(404).json({ error: 'Run not found' })
    res.json(run)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/coin-analysis/:runId/cards/:framework/approve
router.post('/:runId/cards/:framework/approve', async (req, res) => {
  try {
    const userId    = (req as any).userId
    const framework = req.params.framework as StrategyFramework
    if (!VALID_FRAMEWORKS.has(framework)) return res.status(400).json({ error: 'Invalid framework' })

    const result = await approveCard(userId, req.params.runId, framework)
    res.json({ execution: result })
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ error: err.message })
  }
})

// POST /api/coin-analysis/:runId/cards/:framework/reject
router.post('/:runId/cards/:framework/reject', async (req, res) => {
  try {
    const userId    = (req as any).userId
    const framework = req.params.framework as StrategyFramework
    if (!VALID_FRAMEWORKS.has(framework)) return res.status(400).json({ error: 'Invalid framework' })

    await rejectCard(userId, req.params.runId, framework)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ error: err.message })
  }
})

export default router

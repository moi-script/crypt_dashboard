import { Router } from 'express'
import {
  runAnalysis,
  getLatest,
  getHistory,
  getAllLatest,
  getBehaviour,
  getAllBehaviours,
} from '../controllers/analysis.controller'

const router = Router()

// All latest (one per coin)
router.get('/',                        getAllLatest)

// Behaviour memory
router.get('/behaviours',              getAllBehaviours)
router.get('/:coinId/behaviour',       getBehaviour)

// Per-coin
router.post('/:coinId/run',            runAnalysis)
router.get('/:coinId/latest',          getLatest)
router.get('/:coinId/history',         getHistory)

export default router
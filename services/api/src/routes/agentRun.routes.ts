/**
 * agentRun.routes.ts
 */

import { Router } from 'express'
import {
  listRuns,
  getRun,
  triggerRun,
  getConfig,
  updateConfig,
  getStats,
} from '../controllers/agentRun.controller'

const router = Router()

router.get('/stats',          getStats)
router.get('/config',         getConfig)
router.put('/config',         updateConfig)
router.post('/trigger',       triggerRun)
router.get('/',               listRuns)
router.get('/:runId',         getRun)

export default router

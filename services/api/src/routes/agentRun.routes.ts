/**
 * agentRun.routes.ts
 */

import { Router } from 'express'
import { auth }   from '../middleware/auth'
import {
  listRuns,
  getRun,
  triggerRun,
  getConfig,
  updateConfig,
  getStats,
  listApprovals,
  approveRunCtrl,
  rejectRunCtrl,
} from '../controllers/agentRun.controller'

const router = Router()
router.use(auth)

router.get('/stats',             getStats)
router.get('/config',            getConfig)
router.put('/config',            updateConfig)
router.post('/trigger',          triggerRun)
router.get('/approvals',         listApprovals)       // ← before /:runId
router.post('/:runId/approve',   approveRunCtrl)      // ← before /:runId
router.post('/:runId/reject',    rejectRunCtrl)       // ← before /:runId
router.get('/',                  listRuns)
router.get('/:runId',            getRun)

export default router

/**
 * position.routes.ts
 */

import { Router } from 'express'
import { auth }   from '../middleware/auth'
import { listPositions, getDailyPnl, getPnlSummary, updatePosition } from '../controllers/position.controller'

const router = Router()
router.use(auth)

router.get('/pnl/daily',          getDailyPnl)
router.get('/pnl/summary',        getPnlSummary)
router.get('/',                   listPositions)
router.patch('/:positionId',      updatePosition)

export default router

/**
 * opportunity.routes.ts — inlined here for brevity
 * Mount at /api/opportunities in app.ts
 */

import { Router as OpRouter } from 'express'
import { listOpportunities, getOpportunity, getOpportunitySummary, actOnOpportunity } from '../controllers/opportunity.controller'

export const opportunityRouter = OpRouter()
opportunityRouter.use(auth)

opportunityRouter.get('/summary',  getOpportunitySummary)
opportunityRouter.post('/:id/act', actOnOpportunity)
opportunityRouter.get('/:id',      getOpportunity)
opportunityRouter.get('/',         listOpportunities)

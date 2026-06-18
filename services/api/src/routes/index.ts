import { Router } from 'express'
import coinRoutes          from './coin.routes'
import alertRoutes         from './alert.routes'
import newsRoutes          from './news.routes'
import portfolioRoutes     from './portfolio.routes'
import authRoutes          from './auth.routes'
import analysisRoutes      from './analysis.routes'
import agentRoutes         from './agent.routes'
import agentRunRoutes      from './agentRun.routes'
import positionRoutes      from './position.routes'
import chartAnalysisRoutes from './chartAnalysis.routes'

const router = Router()

router.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }))

router.use('/auth',        authRoutes)
router.use('/coins',       coinRoutes)
router.use('/alerts',      alertRoutes)
router.use('/news',        newsRoutes)
router.use('/portfolio',   portfolioRoutes)
router.use('/analysis',    analysisRoutes)
router.use('/agent',       agentRoutes)
router.use('/agent-runs',  agentRunRoutes)
router.use('/positions',   positionRoutes)
router.use('/chart',       chartAnalysisRoutes)

export default router
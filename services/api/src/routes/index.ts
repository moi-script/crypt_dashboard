import { Router } from 'express'
import coinRoutes      from './coin.routes'
import alertRoutes     from './alert.routes'
import newsRoutes      from './news.routes'
import portfolioRoutes from './portfolio.routes'
import authRoutes from './auth.routes'
const router = Router()

router.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }))

router.use('/auth',      authRoutes)
router.use('/coins',     coinRoutes)
router.use('/alerts',    alertRoutes)
router.use('/news',      newsRoutes)
router.use('/portfolio', portfolioRoutes)

export default router
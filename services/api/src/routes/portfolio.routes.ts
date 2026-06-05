import { Router } from 'express'
import { PortfolioController } from '../controllers/portfolio.controller'
import { auth } from '../middleware/auth'

const router = Router()
const ctrl   = new PortfolioController()

router.use(auth)

router.get('/',                    ctrl.get)
router.put('/holdings',            ...ctrl.upsert)
router.delete('/holdings/:coinId', ...ctrl.remove)

export default router
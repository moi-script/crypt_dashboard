import { Router } from 'express'
import { NewsController } from '../controllers/news.controller'

const router = Router()
const ctrl   = new NewsController()

router.get('/',              ...ctrl.getLatest)
router.get('/coin/:coinId',  ...ctrl.getByCoin)

export default router
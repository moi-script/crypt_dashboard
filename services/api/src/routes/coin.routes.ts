import { Router } from 'express'
import { CoinController } from '../controllers/coin.controller'

const router = Router()
const ctrl   = new CoinController()

router.get('/',                 ctrl.getAll)
router.get('/:id',              ...ctrl.getOne)
router.get('/:id/ohlcv',        ...ctrl.getOHLCV)
router.get('/:id/indicators',   ...ctrl.getIndicators)

export default router
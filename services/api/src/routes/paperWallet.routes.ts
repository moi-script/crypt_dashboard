/**
 * paperWallet.routes.ts
 * Mount at /api/paper-wallet in app.ts
 */

import { Router } from 'express'
import {
  getWallet,
  getTrades,
  getStats,
  postReset,
} from '../controllers/paperWallet.controller'

const router = Router()

router.get('/',        getWallet)
router.get('/trades',  getTrades)
router.get('/stats',   getStats)
router.post('/reset',  postReset)

export default router

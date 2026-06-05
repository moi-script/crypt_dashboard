import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller'
import { auth } from '../middleware/auth'
import { authLimiter } from '../middleware/rateLimit'

const router = Router()
const ctrl   = new AuthController()

router.use(authLimiter)

// Public
router.post('/register', ...ctrl.register)
router.post('/login',    ...ctrl.login)
router.post('/refresh',  ...ctrl.refresh)

// Protected
router.post('/logout',   auth, ctrl.logout)  // ✅ no more ctrl.svc access
router.get('/me',        auth, ctrl.me)

export default router
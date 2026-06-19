import { Router }    from 'express'
import { auth }      from '../middleware/auth'
import { seedDemo }  from '../controllers/demo.controller'

const router = Router()
router.use(auth)
router.post('/seed', seedDemo)

export default router

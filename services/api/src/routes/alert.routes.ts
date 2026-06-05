import { Router } from 'express'
import { AlertController } from '../controllers/alert.controller'
import { auth } from '../middleware/auth'

const router = Router()
const ctrl   = new AlertController()

router.use(auth)

router.get('/',        ctrl.getAll)
router.post('/',       ...ctrl.create)
router.delete('/:id',  ...ctrl.delete)
router.patch('/:id',   ...ctrl.toggle)

export default router
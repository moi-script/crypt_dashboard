/**
 * agent.routes.ts  (updated)
 */

import { Router } from 'express'
import { chat, getSession, getUserSessions, clearSession } from '../controllers/agent.controller'

const router = Router()

router.post('/chat',                        chat)
router.get('/session/:sessionId',           getSession)
router.get('/sessions/user/:userId',        getUserSessions)
router.delete('/session/:sessionId',        clearSession)

export default router
/**
 * agent.routes.ts
 */

import { Router } from 'express'
import { chat, getSession, clearSession } from '../controllers/agent.controller'

const router = Router()

// Chat with the agent
router.post('/chat', chat)

// Get full session (messages + current emotion)
router.get('/session/:sessionId', getSession)

// Reset a session
router.delete('/session/:sessionId', clearSession)

export default router
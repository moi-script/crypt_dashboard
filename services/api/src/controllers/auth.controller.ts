import { z } from 'zod'
import type { Request, Response, NextFunction } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { AuthService } from '../services/auth.service'
import { validate, RegisterBody, LoginBody, RefreshBody } from '../middleware/validate'
import { startScheduler, stopScheduler, isSchedulerRunning } from '../agents/loop/scheduler'
import { getOrCreateConfig } from '../services/agentConfig.service'

export class AuthController {
  private svc = new AuthService()

  register = [
    validate(RegisterBody),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, password } = req.body as z.infer<typeof RegisterBody>
        res.status(201).json(await this.svc.register(email, password))
      } catch (err) { next(err) }
    },
  ]

  login = [
    validate(LoginBody),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, password } = req.body as z.infer<typeof LoginBody>
        const result = await this.svc.login(email, password)
        const cfg = await getOrCreateConfig(result.user.id)
        if (cfg.enabled && !isSchedulerRunning()) startScheduler()
        res.json(result)
      } catch (err) { next(err) }
    },
  ]

  refresh = [
    validate(RefreshBody),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { refreshToken } = req.body as z.infer<typeof RefreshBody>
        res.json(await this.svc.refresh(refreshToken))
      } catch (err) { next(err) }
    },
  ]

  me = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await this.svc.me(req.userId!))
    } catch (err) { next(err) }
  }

  // ✅ Logout lives here — has access to private svc
  logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body
      const accessToken = req.headers.authorization?.slice(7) ?? ''
      await this.svc.logout(refreshToken ?? accessToken)
      stopScheduler()
      res.json({ ok: true })
    } catch (err) { next(err) }
  }
}
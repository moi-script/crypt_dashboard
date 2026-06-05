import { z } from 'zod'
import type { Request, Response, NextFunction } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { AuthService } from '../services/auth.service'
import { validate, RegisterBody, LoginBody, RefreshBody } from '../middleware/validate'

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
        res.json(await this.svc.login(email, password))
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
      res.json({ ok: true })
    } catch (err) { next(err) }
  }
}
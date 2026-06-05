import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { AppError } from './errorHandler'

export interface AuthRequest extends Request {
  userId?: string
}

export const auth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Missing token'))  // ← next(err), not throw
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { sub: string }
    req.userId = payload.sub
    next()
  } catch {
    next(new AppError(401, 'Invalid or expired token'))  // ← next(err), not throw
  }
}
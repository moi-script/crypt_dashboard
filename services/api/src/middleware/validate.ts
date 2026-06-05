import { z, type ZodType } from 'zod'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from './errorHandler'

// ── Generic validate helper ───────────────────────────────────────────────────

type Source = 'body' | 'query' | 'params'

export function validate<T>(schema: ZodType<T>, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      const message = result.error.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ')
      return next(new AppError(400, message))
    }
    // Replace source with the parsed + coerced value
    ;(req as any)[source] = result.data
    next()
  }
}

// ── Auth schemas ──────────────────────────────────────────────────────────────

export const RegisterBody = z.object({
  email:    z.string().email({ message: 'Invalid email address' }),
  password: z.string()
    .min(8,  { message: 'Password must be at least 8 characters' })
    .max(72, { message: 'Password must be 72 characters or fewer' }),
})

export const LoginBody = z.object({
  email:    z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
})

export const RefreshBody = z.object({
  refreshToken: z.string().min(1, { message: 'Refresh token is required' }),
})

// ── Coin schemas ──────────────────────────────────────────────────────────────

export const CoinParams = z.object({
  id: z.string().min(1, { message: 'Coin ID is required' }),
})

export const OHLCVQuery = z.object({
  range: z.enum(['1D', '1W', '1M', '1Y']).default('1D'),
})

export const IndicatorsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

// ── News schemas ──────────────────────────────────────────────────────────────

export const NewsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const NewsByCoinParams = z.object({
  coinId: z.string().min(1, { message: 'Coin ID is required' }),
})

// ── Alert schemas ─────────────────────────────────────────────────────────────

export const CreateAlertBody = z.object({
  coinId:    z.string().min(1, { message: 'Coin ID is required' }),
  condition: z.enum(['above', 'below', 'pct_change']),
  threshold: z.number({ error: 'Threshold must be a number' })
    .finite({ message: 'Threshold must be a finite number' }),
})

export const AlertParams = z.object({
  id: z.string().min(1, { message: 'Alert ID is required' }),
})

export const ToggleAlertBody = z.object({
  active: z.boolean({ error: 'active must be a boolean' }),
})

// ── Portfolio schemas ─────────────────────────────────────────────────────────

export const UpsertHoldingBody = z.object({
  coinId:   z.string().min(1, { message: 'Coin ID is required' }),
  quantity: z.number({ error: 'Quantity must be a number' })
    .positive({ message: 'Quantity must be positive' }),
  avgCost:  z.number({ error: 'Average cost must be a number' })
    .nonnegative({ message: 'Average cost cannot be negative' }),
})

export const PortfolioCoinParams = z.object({
  coinId: z.string().min(1, { message: 'Coin ID is required' }),
})
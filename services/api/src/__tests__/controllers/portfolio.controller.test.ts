import { PortfolioController } from '../../controllers/portfolio.controller'
import { AppError } from '../../middleware/errorHandler'
import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth'

// ── Mock service ──────────────────────────────────────────────────────────────

jest.mock('../../services/portfolio.service', () => ({
  PortfolioService: jest.fn().mockImplementation(() => ({
    get:            jest.fn(),
    upsertHolding:  jest.fn(),
    removeHolding:  jest.fn(),
  })),
}))

// ── Mock validate (pass-through) ──────────────────────────────────────────────

jest.mock('../../middleware/validate', () => ({
  validate:               () => (_req: AuthRequest, _res: Response, next: NextFunction) => next(),
  UpsertHoldingBody:      {},
  PortfolioCoinParams:    {},
}))

import { PortfolioService } from '../../services/portfolio.service'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json:   jest.fn().mockReturnThis(),
  } as unknown as Response
}

const next = jest.fn() as jest.MockedFunction<NextFunction>

let ctrl: PortfolioController
let svc:  jest.Mocked<InstanceType<typeof PortfolioService>>

beforeEach(() => {
  jest.clearAllMocks()
  ctrl = new PortfolioController()
  svc  = (PortfolioService as jest.Mock).mock.results[0]!.value
})

// ── get ───────────────────────────────────────────────────────────────────────

describe('PortfolioController.get', () => {
  it('responds with the user portfolio', async () => {
    const portfolio = { userId: 'user-1', holdings: [{ coinId: 'bitcoin', quantity: 0.5, avgCost: 40000 }] }
    svc.get.mockResolvedValue(portfolio as any)

    const req = { userId: 'user-1' } as AuthRequest
    const res = makeRes()

    await ctrl.get(req, res, next)

    expect(svc.get).toHaveBeenCalledWith('user-1')
    expect(res.json).toHaveBeenCalledWith(portfolio)
  })

  it('responds with empty holdings when portfolio does not exist', async () => {
    svc.get.mockResolvedValue({ userId: 'user-1', holdings: [] })

    const req = { userId: 'user-1' } as AuthRequest
    const res = makeRes()

    await ctrl.get(req, res, next)

    expect(res.json).toHaveBeenCalledWith({ userId: 'user-1', holdings: [] })
  })

  it('calls next(err) on failure', async () => {
    svc.get.mockRejectedValue(new Error('DB error'))

    await ctrl.get({ userId: 'user-1' } as AuthRequest, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})

// ── upsert ────────────────────────────────────────────────────────────────────

describe('PortfolioController.upsert', () => {
  const handler = () => (ctrl.upsert as any[]).at(-1)

  it('responds with updated portfolio on success', async () => {
    const updated = { userId: 'user-1', holdings: [{ coinId: 'bitcoin', quantity: 1, avgCost: 50000 }] }
    svc.upsertHolding.mockResolvedValue(updated as any)

    const req = {
      userId: 'user-1',
      body:   { coinId: 'bitcoin', quantity: 1, avgCost: 50000 },
    } as unknown as AuthRequest
    const res = makeRes()

    await handler()(req, res, next)

    expect(svc.upsertHolding).toHaveBeenCalledWith('user-1', 'bitcoin', 1, 50000)
    expect(res.json).toHaveBeenCalledWith(updated)
  })

  it('calls next(err) on failure', async () => {
    svc.upsertHolding.mockRejectedValue(new Error('DB error'))

    await handler()(
      { userId: 'user-1', body: { coinId: 'bitcoin', quantity: 1, avgCost: 50000 } } as unknown as AuthRequest,
      makeRes(),
      next,
    )

    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})

// ── remove ────────────────────────────────────────────────────────────────────

describe('PortfolioController.remove', () => {
  const handler = () => (ctrl.remove as any[]).at(-1)

  it('responds with updated portfolio after removal', async () => {
    const updated = { userId: 'user-1', holdings: [] }
    svc.removeHolding.mockResolvedValue(updated as any)

    const req = { userId: 'user-1', params: { coinId: 'bitcoin' } } as unknown as AuthRequest
    const res = makeRes()

    await handler()(req, res, next)

    expect(svc.removeHolding).toHaveBeenCalledWith('user-1', 'bitcoin')
    expect(res.json).toHaveBeenCalledWith(updated)
  })

  it('calls next(err) with 404 when portfolio not found', async () => {
    svc.removeHolding.mockRejectedValue(new AppError(404, 'Portfolio not found'))

    await handler()(
      { userId: 'user-1', params: { coinId: 'bitcoin' } } as unknown as AuthRequest,
      makeRes(),
      next,
    )

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }))
  })
})
import { CoinController } from '../../controllers/coin.controller'
import { AppError } from '../../middleware/errorHandler'
import type { Request, Response, NextFunction } from 'express'

// ── Mock service ──────────────────────────────────────────────────────────────

jest.mock('../../services/coin.service', () => ({
  CoinService: jest.fn().mockImplementation(() => ({
    getAll:        jest.fn(),
    getOne:        jest.fn(),
    getOHLCV:      jest.fn(),
    getIndicators: jest.fn(),
  })),
}))

// ── Mock validate (pass-through) ──────────────────────────────────────────────

jest.mock('../../middleware/validate', () => ({
  validate:        () => (_req: Request, _res: Response, next: NextFunction) => next(),
  CoinParams:      {},
  OHLCVQuery:      {},
  IndicatorsQuery: {},
}))

import { CoinService } from '../../services/coin.service'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json:   jest.fn().mockReturnThis(),
  } as unknown as Response
}

const next = jest.fn() as jest.MockedFunction<NextFunction>

let ctrl: CoinController
let svc:  jest.Mocked<InstanceType<typeof CoinService>>

beforeEach(() => {
  jest.clearAllMocks()
  ctrl = new CoinController()
  svc  = (CoinService as jest.Mock).mock.results[0]!.value
})

// ── getAll ────────────────────────────────────────────────────────────────────

describe('CoinController.getAll', () => {
  it('responds with all coins', async () => {
    const coins = [{ coinId: 'bitcoin' }, { coinId: 'ethereum' }]
    svc.getAll.mockResolvedValue(coins as any)

    const res = makeRes()
    await ctrl.getAll({} as Request, res, next)

    expect(svc.getAll).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(coins)
  })

  it('calls next(err) on failure', async () => {
    svc.getAll.mockRejectedValue(new Error('DB error'))

    await ctrl.getAll({} as Request, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})

// ── getOne ────────────────────────────────────────────────────────────────────

describe('CoinController.getOne', () => {
  const handler = () => (ctrl.getOne as any[]).at(-1)

  it('responds with a single coin', async () => {
    const coin = { coinId: 'bitcoin', price: 50000 }
    svc.getOne.mockResolvedValue(coin as any)

    const req = { params: { id: 'bitcoin' } } as unknown as Request
    const res = makeRes()

    await handler()(req, res, next)

    expect(svc.getOne).toHaveBeenCalledWith('bitcoin')
    expect(res.json).toHaveBeenCalledWith(coin)
  })

  it('calls next(err) with 404 when coin not found', async () => {
    svc.getOne.mockRejectedValue(new AppError(404, "Coin 'unknown' not found"))

    await handler()({ params: { id: 'unknown' } } as unknown as Request, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }))
  })
})

// ── getOHLCV ──────────────────────────────────────────────────────────────────

describe('CoinController.getOHLCV', () => {
  const handler = () => (ctrl.getOHLCV as any[]).at(-1)

  it('passes coinId and range to service', async () => {
    const ohlcv = [{ time: new Date(), open: 100, high: 110, low: 90, close: 105, volume: 500 }]
    svc.getOHLCV.mockResolvedValue(ohlcv as any)

    const req = { params: { id: 'bitcoin' }, query: { range: '1W' } } as unknown as Request
    const res = makeRes()

    await handler()(req, res, next)

    expect(svc.getOHLCV).toHaveBeenCalledWith('bitcoin', '1W')
    expect(res.json).toHaveBeenCalledWith(ohlcv)
  })

  it('calls next(err) on failure', async () => {
    svc.getOHLCV.mockRejectedValue(new Error('Aggregation error'))

    await handler()(
      { params: { id: 'bitcoin' }, query: { range: '1D' } } as unknown as Request,
      makeRes(),
      next,
    )

    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})

// ── getIndicators ─────────────────────────────────────────────────────────────

describe('CoinController.getIndicators', () => {
  const handler = () => (ctrl.getIndicators as any[]).at(-1)

  it('passes coinId and limit to service', async () => {
    const indicators = [{ coinId: 'bitcoin', rsi14: 55.2 }]
    svc.getIndicators.mockResolvedValue(indicators as any)

    const req = { params: { id: 'bitcoin' }, query: { limit: 50 } } as unknown as Request
    const res = makeRes()

    await handler()(req, res, next)

    expect(svc.getIndicators).toHaveBeenCalledWith('bitcoin', 50)
    expect(res.json).toHaveBeenCalledWith(indicators)
  })

  it('calls next(err) on failure', async () => {
    svc.getIndicators.mockRejectedValue(new Error('DB error'))

    await handler()(
      { params: { id: 'bitcoin' }, query: { limit: 100 } } as unknown as Request,
      makeRes(),
      next,
    )

    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})
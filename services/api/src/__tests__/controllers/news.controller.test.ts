import { NewsController } from '../../controllers/news.controller'
import type { Request, Response, NextFunction } from 'express'

// ── Mock service ──────────────────────────────────────────────────────────────

jest.mock('../../services/news.service', () => ({
  NewsService: jest.fn().mockImplementation(() => ({
    getLatest:  jest.fn(),
    getForCoin: jest.fn(),
  })),
}))

// ── Mock validate (pass-through) ──────────────────────────────────────────────

jest.mock('../../middleware/validate', () => ({
  validate:          () => (_req: Request, _res: Response, next: NextFunction) => next(),
  NewsQuery:         {},
  NewsByCoinParams:  {},
}))

import { NewsService } from '../../services/news.service'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json:   jest.fn().mockReturnThis(),
  } as unknown as Response
}

const next = jest.fn() as jest.MockedFunction<NextFunction>

let ctrl: NewsController
let svc:  jest.Mocked<InstanceType<typeof NewsService>>

beforeEach(() => {
  jest.clearAllMocks()
  ctrl = new NewsController()
  svc  = (NewsService as jest.Mock).mock.results[0]!.value
})

// ── getLatest ─────────────────────────────────────────────────────────────────

describe('NewsController.getLatest', () => {
  const handler = () => (ctrl.getLatest as any[]).at(-1)

  it('responds with latest articles', async () => {
    const articles = [{ title: 'Bitcoin hits ATH', url: 'https://example.com/1' }]
    svc.getLatest.mockResolvedValue(articles as any)

    const req = { query: { limit: 20 } } as unknown as Request
    const res = makeRes()

    await handler()(req, res, next)

    expect(svc.getLatest).toHaveBeenCalledWith(20)
    expect(res.json).toHaveBeenCalledWith(articles)
  })

  it('calls next(err) on failure', async () => {
    svc.getLatest.mockRejectedValue(new Error('DB error'))

    await handler()({ query: { limit: 20 } } as unknown as Request, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})

// ── getByCoin ─────────────────────────────────────────────────────────────────

describe('NewsController.getByCoin', () => {
  const handler = () => (ctrl.getByCoin as any[]).at(-1)

  it('responds with articles for the given coin', async () => {
    const articles = [{ title: 'ETH upgrade', url: 'https://example.com/2', coins: ['ethereum'] }]
    svc.getForCoin.mockResolvedValue(articles as any)

    const req = { params: { coinId: 'ethereum' }, query: { limit: 10 } } as unknown as Request
    const res = makeRes()

    await handler()(req, res, next)

    expect(svc.getForCoin).toHaveBeenCalledWith('ethereum', 10)
    expect(res.json).toHaveBeenCalledWith(articles)
  })

  it('calls next(err) on failure', async () => {
    svc.getForCoin.mockRejectedValue(new Error('DB error'))

    await handler()(
      { params: { coinId: 'bitcoin' }, query: { limit: 10 } } as unknown as Request,
      makeRes(),
      next,
    )

    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})
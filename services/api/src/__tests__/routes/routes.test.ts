/**
 * Route tests — verify HTTP method + path wiring and auth guard placement.
 *
 * Strategy:
 *   - Mock all controllers to return 200 immediately (no DB/Redis/JWT needed)
 *   - Mock auth middleware to call next() (so protected routes pass through)
 *   - Assert status 200 on valid paths → handler was reached
 *   - Assert 401 on protected routes when auth is NOT mocked → guard is active
 *
 * We test routing, not business logic — that lives in controller/service tests.
 */

import express, { Router } from 'express'
import request from 'supertest'

// ── Shared auth mock helpers ──────────────────────────────────────────────────

// Returns 401 — simulates auth rejecting (default state before we mock it)
const authReject = (_req: any, _res: any, next: any) =>
  next({ statusCode: 401, message: 'Unauthorized' })

// Passes through — simulates auth accepting a valid token
const authAccept = (_req: any, _res: any, next: any) => next()

// Simple error handler for supertest app
const errorHandler = (err: any, _req: any, res: any, _next: any) =>
  res.status(err.statusCode ?? 500).json({ error: err.message })

// ── Mock all controllers up-front ─────────────────────────────────────────────

jest.mock('../../controllers/auth.controller', () => ({
  AuthController: jest.fn().mockImplementation(() => ({
    register: [(_req: any, res: any) => res.status(201).json({})],
    login:    [(_req: any, res: any) => res.json({})],
    refresh:  [(_req: any, res: any) => res.json({})],
    logout:   (_req: any, res: any) => res.json({ ok: true }),
    me:       (_req: any, res: any) => res.json({}),
  })),
}))

jest.mock('../../controllers/coin.controller', () => ({
  CoinController: jest.fn().mockImplementation(() => ({
    getAll:        (_req: any, res: any) => res.json([]),
    getOne:        [(_req: any, res: any) => res.json({})],
    getOHLCV:      [(_req: any, res: any) => res.json([])],
    getIndicators: [(_req: any, res: any) => res.json([])],
  })),
}))

jest.mock('../../controllers/alert.controller', () => ({
  AlertController: jest.fn().mockImplementation(() => ({
    getAll: (_req: any, res: any) => res.json([]),
    create: [(_req: any, res: any) => res.status(201).json({})],
    delete: [(_req: any, res: any) => res.json({ deleted: true })],
    toggle: [(_req: any, res: any) => res.json({})],
  })),
}))

jest.mock('../../controllers/news.controller', () => ({
  NewsController: jest.fn().mockImplementation(() => ({
    getLatest: [(_req: any, res: any) => res.json([])],
    getByCoin: [(_req: any, res: any) => res.json([])],
  })),
}))

jest.mock('../../controllers/portfolio.controller', () => ({
  PortfolioController: jest.fn().mockImplementation(() => ({
    get:    (_req: any, res: any) => res.json({}),
    upsert: [(_req: any, res: any) => res.json({})],
    remove: [(_req: any, res: any) => res.json({})],
  })),
}))

jest.mock('../../middleware/rateLimit', () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter:  (_req: any, _res: any, next: any) => next(),
}))

// ── Auth routes ───────────────────────────────────────────────────────────────

describe('auth.routes', () => {
  // Auth routes use authLimiter but no global auth guard —
  // only /logout and /me are protected individually.

  function makeApp(authMiddleware = authAccept) {
    jest.resetModules()
    jest.mock('../../middleware/auth', () => ({ auth: authMiddleware }))
    const authRoutes = require('../../routes/auth.routes').default
    const app = express()
    app.use(express.json())
    app.use('/api/auth', authRoutes)
    app.use(errorHandler)
    return app
  }

  it('POST /api/auth/register → 201', async () => {
    const res = await request(makeApp()).post('/api/auth/register').send({})
    expect(res.status).toBe(201)
  })

  it('POST /api/auth/login → 200', async () => {
    const res = await request(makeApp()).post('/api/auth/login').send({})
    expect(res.status).toBe(200)
  })

  it('POST /api/auth/refresh → 200', async () => {
    const res = await request(makeApp()).post('/api/auth/refresh').send({})
    expect(res.status).toBe(200)
  })

  it('POST /api/auth/logout is protected — returns 401 when auth rejects', async () => {
    const res = await request(makeApp(authReject)).post('/api/auth/logout')
    expect(res.status).toBe(401)
  })

  it('POST /api/auth/logout → 200 when auth passes', async () => {
    const res = await request(makeApp()).post('/api/auth/logout')
    expect(res.status).toBe(200)
  })

  it('GET /api/auth/me is protected — returns 401 when auth rejects', async () => {
    const res = await request(makeApp(authReject)).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('GET /api/auth/me → 200 when auth passes', async () => {
    const res = await request(makeApp()).get('/api/auth/me')
    expect(res.status).toBe(200)
  })
})

// ── Coin routes ───────────────────────────────────────────────────────────────

describe('coin.routes', () => {
  // No auth guard — all endpoints are public

  let app: express.Express

  beforeAll(() => {
    jest.mock('../../middleware/auth', () => ({ auth: authAccept }))
    const coinRoutes = require('../../routes/coin.routes').default
    app = express()
    app.use(express.json())
    app.use('/api/coins', coinRoutes)
    app.use(errorHandler)
  })

  it('GET /api/coins → 200', async () => {
    const res = await request(app).get('/api/coins')
    expect(res.status).toBe(200)
  })

  it('GET /api/coins/:id → 200', async () => {
    const res = await request(app).get('/api/coins/bitcoin')
    expect(res.status).toBe(200)
  })

  it('GET /api/coins/:id/ohlcv → 200', async () => {
    const res = await request(app).get('/api/coins/bitcoin/ohlcv')
    expect(res.status).toBe(200)
  })

  it('GET /api/coins/:id/indicators → 200', async () => {
    const res = await request(app).get('/api/coins/bitcoin/indicators')
    expect(res.status).toBe(200)
  })
})

// ── Alert routes ──────────────────────────────────────────────────────────────

describe('alert.routes', () => {
  // All routes protected by router.use(auth)

  function makeApp(authMiddleware = authAccept) {
    jest.resetModules()
    jest.mock('../../middleware/auth', () => ({ auth: authMiddleware }))
    const alertRoutes = require('../../routes/alert.routes').default
    const app = express()
    app.use(express.json())
    app.use('/api/alerts', alertRoutes)
    app.use(errorHandler)
    return app
  }

  it('GET /api/alerts returns 401 when unauthenticated', async () => {
    const res = await request(makeApp(authReject)).get('/api/alerts')
    expect(res.status).toBe(401)
  })

  it('GET /api/alerts → 200 when authenticated', async () => {
    const res = await request(makeApp()).get('/api/alerts')
    expect(res.status).toBe(200)
  })

  it('POST /api/alerts → 201', async () => {
    const res = await request(makeApp()).post('/api/alerts').send({})
    expect(res.status).toBe(201)
  })

  it('DELETE /api/alerts/:id → 200', async () => {
    const res = await request(makeApp()).delete('/api/alerts/alert-1')
    expect(res.status).toBe(200)
  })

  it('PATCH /api/alerts/:id → 200', async () => {
    const res = await request(makeApp()).patch('/api/alerts/alert-1').send({})
    expect(res.status).toBe(200)
  })
})

// ── News routes ───────────────────────────────────────────────────────────────

describe('news.routes', () => {
  // No auth guard — all public

  let app: express.Express

  beforeAll(() => {
    jest.mock('../../middleware/auth', () => ({ auth: authAccept }))
    const newsRoutes = require('../../routes/news.routes').default
    app = express()
    app.use(express.json())
    app.use('/api/news', newsRoutes)
    app.use(errorHandler)
  })

  it('GET /api/news → 200', async () => {
    const res = await request(app).get('/api/news')
    expect(res.status).toBe(200)
  })

  it('GET /api/news/coin/:coinId → 200', async () => {
    const res = await request(app).get('/api/news/coin/bitcoin')
    expect(res.status).toBe(200)
  })
})

// ── Portfolio routes ──────────────────────────────────────────────────────────

describe('portfolio.routes', () => {
  // All routes protected by router.use(auth)

  function makeApp(authMiddleware = authAccept) {
    jest.resetModules()
    jest.mock('../../middleware/auth', () => ({ auth: authMiddleware }))
    const portfolioRoutes = require('../../routes/portfolio.routes').default
    const app = express()
    app.use(express.json())
    app.use('/api/portfolio', portfolioRoutes)
    app.use(errorHandler)
    return app
  }

  it('GET /api/portfolio returns 401 when unauthenticated', async () => {
    const res = await request(makeApp(authReject)).get('/api/portfolio')
    expect(res.status).toBe(401)
  })

  it('GET /api/portfolio → 200 when authenticated', async () => {
    const res = await request(makeApp()).get('/api/portfolio')
    expect(res.status).toBe(200)
  })

  it('PUT /api/portfolio/holdings → 200', async () => {
    const res = await request(makeApp()).put('/api/portfolio/holdings').send({})
    expect(res.status).toBe(200)
  })

  it('DELETE /api/portfolio/holdings/:coinId → 200', async () => {
    const res = await request(makeApp()).delete('/api/portfolio/holdings/bitcoin')
    expect(res.status).toBe(200)
  })
})

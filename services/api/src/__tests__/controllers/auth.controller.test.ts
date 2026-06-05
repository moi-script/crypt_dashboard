import { AuthController } from '../../controllers/auth.controller'
import { AppError } from '../../middleware/errorHandler'
import type { Request, Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth'

// ── Mock service ──────────────────────────────────────────────────────────────

jest.mock('../../services/auth.service', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    login:    jest.fn(),
    refresh:  jest.fn(),
    me:       jest.fn(),
    logout:   jest.fn(),
  })),
}))

// ── Mock validate (pass-through) ──────────────────────────────────────────────

jest.mock('../../middleware/validate', () => ({
  validate:     () => (_req: Request, _res: Response, next: NextFunction) => next(),
  RegisterBody: {},
  LoginBody:    {},
  RefreshBody:  {},
}))

import { AuthService } from '../../services/auth.service'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json:   jest.fn().mockReturnThis(),
  } as unknown as Response
}

const next = jest.fn() as jest.MockedFunction<NextFunction>

let ctrl: AuthController
let svc:  jest.Mocked<InstanceType<typeof AuthService>>

beforeEach(() => {
  jest.clearAllMocks()
  ctrl = new AuthController()
  svc  = (AuthService as jest.Mock).mock.results[0]!.value
})

// ── register ──────────────────────────────────────────────────────────────────

describe('AuthController.register', () => {
  const handler = () => (ctrl.register as any[]).at(-1) // last item is the async handler

  it('responds 201 with user + tokens on success', async () => {
    const payload = { user: { id: '1', email: 'user@example.com' }, accessToken: 'at', refreshToken: 'rt' }
    svc.register.mockResolvedValue(payload)

    const req = { body: { email: 'user@example.com', password: 'password123' } } as Request
    const res = makeRes()

    await handler()(req, res, next)

    expect(svc.register).toHaveBeenCalledWith('user@example.com', 'password123')
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(payload)
  })

  it('calls next(err) when service throws', async () => {
    const err = new AppError(409, 'Email taken')
    svc.register.mockRejectedValue(err)

    const req = { body: { email: 'x@x.com', password: 'password123' } } as Request
    await handler()(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(err)
  })
})

// ── login ─────────────────────────────────────────────────────────────────────

describe('AuthController.login', () => {
  const handler = () => (ctrl.login as any[]).at(-1)

  it('responds with tokens on success', async () => {
    const payload = { user: { id: '1', email: 'user@example.com' }, accessToken: 'at', refreshToken: 'rt' }
    svc.login.mockResolvedValue(payload)

    const req = { body: { email: 'user@example.com', password: 'password123' } } as Request
    const res = makeRes()

    await handler()(req, res, next)

    expect(svc.login).toHaveBeenCalledWith('user@example.com', 'password123')
    expect(res.json).toHaveBeenCalledWith(payload)
  })

  it('calls next(err) on invalid credentials', async () => {
    svc.login.mockRejectedValue(new AppError(401, 'Invalid email or password'))

    await handler()({ body: { email: 'x@x.com', password: 'wrong' } } as Request, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }))
  })
})

// ── refresh ───────────────────────────────────────────────────────────────────

describe('AuthController.refresh', () => {
  const handler = () => (ctrl.refresh as any[]).at(-1)

  it('returns new tokens on valid refresh token', async () => {
    const payload = { accessToken: 'new-at', refreshToken: 'new-rt' }
    svc.refresh.mockResolvedValue(payload)

    const req = { body: { refreshToken: 'valid-rt' } } as Request
    const res = makeRes()

    await handler()(req, res, next)

    expect(svc.refresh).toHaveBeenCalledWith('valid-rt')
    expect(res.json).toHaveBeenCalledWith(payload)
  })

  it('calls next(err) when token is revoked', async () => {
    svc.refresh.mockRejectedValue(new AppError(401, 'Refresh token has been revoked'))

    await handler()({ body: { refreshToken: 'revoked' } } as Request, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }))
  })
})

// ── me ────────────────────────────────────────────────────────────────────────

describe('AuthController.me', () => {
  it('returns the current user', async () => {
    const user = { id: 'user-1', email: 'user@example.com', createdAt: new Date() }
    svc.me.mockResolvedValue(user)

    const req  = { userId: 'user-1' } as AuthRequest
    const res  = makeRes()

    await ctrl.me(req, res, next)

    expect(svc.me).toHaveBeenCalledWith('user-1')
    expect(res.json).toHaveBeenCalledWith(user)
  })

  it('calls next(err) when user not found', async () => {
    svc.me.mockRejectedValue(new AppError(404, 'User not found'))

    await ctrl.me({ userId: 'ghost' } as AuthRequest, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }))
  })
})

// ── logout ────────────────────────────────────────────────────────────────────

describe('AuthController.logout', () => {
  it('logs out using refreshToken from body when present', async () => {
    svc.logout.mockResolvedValue(undefined)

    const req = {
      body:    { refreshToken: 'rt-token' },
      headers: { authorization: 'Bearer at-token' },
      userId:  'user-1',
    } as unknown as AuthRequest
    const res = makeRes()

    await ctrl.logout(req, res, next)

    expect(svc.logout).toHaveBeenCalledWith('rt-token')
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('falls back to accessToken when refreshToken absent', async () => {
    svc.logout.mockResolvedValue(undefined)

    const req = {
      body:    {},
      headers: { authorization: 'Bearer at-token' },
      userId:  'user-1',
    } as unknown as AuthRequest

    await ctrl.logout(req, makeRes(), next)

    expect(svc.logout).toHaveBeenCalledWith('at-token')
  })

  it('calls next(err) on failure', async () => {
    svc.logout.mockRejectedValue(new Error('Redis down'))

    const req = { body: {}, headers: {}, userId: 'u1' } as unknown as AuthRequest
    await ctrl.logout(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})
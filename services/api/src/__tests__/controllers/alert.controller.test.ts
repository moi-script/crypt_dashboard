import { AlertController } from '../../controllers/alert.controller'
import { AppError } from '../../middleware/errorHandler'
import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth'

// ── Mock service ──────────────────────────────────────────────────────────────

jest.mock('../../services/alert.service', () => ({
  AlertService: jest.fn().mockImplementation(() => ({
    getForUser: jest.fn(),
    create:     jest.fn(),
    delete:     jest.fn(),
    toggle:     jest.fn(),
  })),
}))

// ── Mock validate (pass-through) ──────────────────────────────────────────────

jest.mock('../../middleware/validate', () => ({
  validate:         () => (_req: AuthRequest, _res: Response, next: NextFunction) => next(),
  CreateAlertBody:  {},
  AlertParams:      {},
  ToggleAlertBody:  {},
}))

import { AlertService } from '../../services/alert.service'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json:   jest.fn().mockReturnThis(),
  } as unknown as Response
}

const next = jest.fn() as jest.MockedFunction<NextFunction>

let ctrl: AlertController
let svc:  jest.Mocked<InstanceType<typeof AlertService>>

beforeEach(() => {
  jest.clearAllMocks()
  ctrl = new AlertController()
  svc  = (AlertService as jest.Mock).mock.results[0]!.value
})

// ── getAll ────────────────────────────────────────────────────────────────────

describe('AlertController.getAll', () => {
  it('returns alerts for the authenticated user', async () => {
    const alerts = [{ _id: 'a1', coinId: 'bitcoin', condition: 'above', threshold: 60000 }]
    svc.getForUser.mockResolvedValue(alerts as any)

    const req = { userId: 'user-1' } as AuthRequest
    const res = makeRes()

    await ctrl.getAll(req, res, next)

    expect(svc.getForUser).toHaveBeenCalledWith('user-1')
    expect(res.json).toHaveBeenCalledWith(alerts)
  })

  it('calls next(err) on failure', async () => {
    svc.getForUser.mockRejectedValue(new Error('DB error'))

    await ctrl.getAll({ userId: 'user-1' } as AuthRequest, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})

// ── create ────────────────────────────────────────────────────────────────────

describe('AlertController.create', () => {
  const handler = () => (ctrl.create as any[]).at(-1)

  it('responds 201 with created alert', async () => {
    const alert = { _id: 'a1', userId: 'user-1', coinId: 'bitcoin', condition: 'above', threshold: 60000 }
    svc.create.mockResolvedValue(alert as any)

    const req = {
      userId: 'user-1',
      body:   { coinId: 'bitcoin', condition: 'above', threshold: 60000 },
    } as unknown as AuthRequest
    const res = makeRes()

    await handler()(req, res, next)

    expect(svc.create).toHaveBeenCalledWith('user-1', {
      coinId: 'bitcoin', condition: 'above', threshold: 60000,
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(alert)
  })

  it('calls next(err) on failure', async () => {
    svc.create.mockRejectedValue(new Error('Validation error'))

    const req = {
      userId: 'user-1',
      body:   { coinId: 'bitcoin', condition: 'above', threshold: 60000 },
    } as unknown as AuthRequest

    await handler()(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})

// ── delete ────────────────────────────────────────────────────────────────────

describe('AlertController.delete', () => {
  const handler = () => (ctrl.delete as any[]).at(-1)

  it('responds with { deleted: true } on success', async () => {
    svc.delete.mockResolvedValue({ deleted: true })

    const req = { userId: 'user-1', params: { id: 'a1' } } as unknown as AuthRequest
    const res = makeRes()

    await handler()(req, res, next)

    expect(svc.delete).toHaveBeenCalledWith('user-1', 'a1')
    expect(res.json).toHaveBeenCalledWith({ deleted: true })
  })

  it('calls next(err) with 404 when alert not found', async () => {
    svc.delete.mockRejectedValue(new AppError(404, 'Alert not found'))

    await handler()(
      { userId: 'user-1', params: { id: 'missing' } } as unknown as AuthRequest,
      makeRes(),
      next,
    )

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }))
  })
})

// ── toggle ────────────────────────────────────────────────────────────────────

describe('AlertController.toggle', () => {
  const handler = () => (ctrl.toggle as any[]).at(-1)

  it('responds with updated alert on success', async () => {
    const updated = { _id: 'a1', active: false }
    svc.toggle.mockResolvedValue(updated as any)

    const req = {
      userId: 'user-1',
      params: { id: 'a1' },
      body:   { active: false },
    } as unknown as AuthRequest
    const res = makeRes()

    await handler()(req, res, next)

    expect(svc.toggle).toHaveBeenCalledWith('user-1', 'a1', false)
    expect(res.json).toHaveBeenCalledWith(updated)
  })

  it('calls next(err) with 404 when alert not found', async () => {
    svc.toggle.mockRejectedValue(new AppError(404, 'Alert not found'))

    await handler()(
      { userId: 'user-1', params: { id: 'missing' }, body: { active: true } } as unknown as AuthRequest,
      makeRes(),
      next,
    )

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }))
  })
})
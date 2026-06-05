import { validate, RegisterBody, LoginBody, OHLCVQuery, IndicatorsQuery } from '../../middleware/validate'
import { AppError } from '../../middleware/errorHandler'
import type { Request, Response, NextFunction } from 'express'

const res = {} as Response
const next = jest.fn() as jest.MockedFunction<NextFunction>

function makeReq(body = {}, query = {}, params = {}): Request {
  return { body, query, params } as unknown as Request
}

beforeEach(() => jest.clearAllMocks())

describe('validate middleware', () => {
  describe('RegisterBody', () => {
    const mw = validate(RegisterBody)

    it('passes with valid email and password', () => {
      const req = makeReq({ email: 'user@example.com', password: 'password123' })
      mw(req, res, next)
      expect(next).toHaveBeenCalledWith()
    })

    it('rejects invalid email', () => {
      const req = makeReq({ email: 'not-an-email', password: 'password123' })
      mw(req, res, next)
      // 👇 Fixed cast here
      const err = next.mock.calls[0][0] as unknown as AppError
      expect(err.statusCode).toBe(400)
      expect(err.message).toContain('Invalid email')
    })

    it('rejects password shorter than 8 chars', () => {
      const req = makeReq({ email: 'user@example.com', password: 'short' })
      mw(req, res, next)
      // 👇 Fixed cast here
      const err = next.mock.calls[0][0] as unknown as AppError
      expect(err.statusCode).toBe(400)
      expect(err.message).toContain('8 characters')
    })

    it('rejects password over 72 chars', () => {
      const req = makeReq({ email: 'user@example.com', password: 'a'.repeat(73) })
      mw(req, res, next)
      // 👇 Fixed cast here
      const err = next.mock.calls[0][0] as unknown as AppError
      expect(err.statusCode).toBe(400)
      expect(err.message).toContain('72 characters')
    })
  })

  describe('OHLCVQuery', () => {
    const mw = validate(OHLCVQuery, 'query')

    it('defaults range to 1D when omitted', () => {
      const req = makeReq({}, {})
      mw(req, res, next)
      expect(next).toHaveBeenCalledWith()
      expect((req as any).query.range).toBe('1D')
    })

    it('accepts valid range values', () => {
      for (const range of ['1D', '1W', '1M', '1Y']) {
        jest.clearAllMocks()
        const req = makeReq({}, { range })
        mw(req, res, next)
        expect(next).toHaveBeenCalledWith()
      }
    })

    it('rejects invalid range', () => {
      const req = makeReq({}, { range: '5Y' })
      mw(req, res, next)
      // 👇 Fixed cast here
      const err = next.mock.calls[0][0] as unknown as AppError
      expect(err.statusCode).toBe(400)
    })
  })

  describe('IndicatorsQuery', () => {
    const mw = validate(IndicatorsQuery, 'query')

    it('coerces string limit to number', () => {
      const req = makeReq({}, { limit: '50' })
      mw(req, res, next)
      expect((req as any).query.limit).toBe(50)
    })

    it('rejects limit above 500', () => {
      const req = makeReq({}, { limit: '501' })
      mw(req, res, next)
      // 👇 Fixed cast here
      const err = next.mock.calls[0][0] as unknown as AppError
      expect(err.statusCode).toBe(400)
    })

    it('defaults limit to 100', () => {
      const req = makeReq({}, {})
      mw(req, res, next)
      expect((req as any).query.limit).toBe(100)
    })
  })
})
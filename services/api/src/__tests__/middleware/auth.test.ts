import { auth } from '../../middleware/auth'
import { AppError } from '../../middleware/errorHandler'
import jwt from 'jsonwebtoken'
import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../middleware/auth'

jest.mock('jsonwebtoken')

const mockNext = jest.fn() as jest.MockedFunction<NextFunction>

function makeReq(authHeader?: string): AuthRequest {
  return { headers: { authorization: authHeader } } as AuthRequest
}

const res = {} as Response

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret'
  jest.clearAllMocks()
})

describe('auth middleware', () => {
  it('throws 401 when Authorization header is missing', () => {
    auth(makeReq(), res, mockNext)
    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError))
    
    // 👇 Fixed cast here
    const err = mockNext.mock.calls[0][0] as unknown as AppError
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Missing token')
  })

  it('throws 401 when header does not start with Bearer', () => {
    auth(makeReq('Basic abc123'), res, mockNext)
    
    // 👇 Fixed cast here
    const err = mockNext.mock.calls[0][0] as unknown as AppError
    expect(err.statusCode).toBe(401)
  })

  it('sets userId and calls next() on valid token', () => {
    ;(jwt.verify as jest.Mock).mockReturnValue({ sub: 'user-123' })
    const req = makeReq('Bearer valid.token.here')
    auth(req, res, mockNext)
    expect(req.userId).toBe('user-123')
    expect(mockNext).toHaveBeenCalledWith()
  })

  it('throws 401 on invalid token', () => {
    ;(jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('bad') })
    auth(makeReq('Bearer bad.token'), res, mockNext)
    
    // 👇 Fixed cast here
    const err = mockNext.mock.calls[0][0] as unknown as AppError
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Invalid or expired token')
  })
})
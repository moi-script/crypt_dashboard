import { errorHandler, AppError } from '../../middleware/errorHandler'
import type { Request, Response, NextFunction } from 'express'

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json:   jest.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

const req  = {} as Request
const next = jest.fn() as NextFunction

describe('errorHandler', () => {
  it('returns statusCode and message for AppError', () => {
    const res = makeRes()
    errorHandler(new AppError(422, 'Unprocessable'), req, res, next)
    expect(res.status).toHaveBeenCalledWith(422)
    expect(res.json).toHaveBeenCalledWith({ error: 'Unprocessable' })
  })

  it('returns 500 for unknown errors', () => {
    const res = makeRes()
    errorHandler(new Error('Something blew up'), req, res, next)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })
})
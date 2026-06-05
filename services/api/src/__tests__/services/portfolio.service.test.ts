import { PortfolioService } from '../../services/portfolio.service'
import { AppError } from '../../middleware/errorHandler'

// Mock mongoose model before the service is imported
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose')
  return {
    ...actual,
    model: jest.fn().mockReturnValue({
      findOne:          jest.fn(),
      findOneAndUpdate: jest.fn(),
    }),
    Schema: actual.Schema,
  }
})

jest.mock('../../config/redis', () => ({
  redis: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
}))

import { redis } from '../../config/redis'
import mongoose from 'mongoose'

const PortfolioDoc = (mongoose.model as jest.Mock).mock.results[0]?.value ?? {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}

let svc: PortfolioService

beforeEach(() => {
  jest.clearAllMocks()
  svc = new PortfolioService()
})

describe('PortfolioService.get', () => {
  it('returns cached portfolio when available', async () => {
    const portfolio = { userId: 'u1', holdings: [] }
    ;(redis.get as jest.Mock).mockResolvedValue(JSON.stringify(portfolio))
    const result = await svc.get('u1')
    expect(result).toEqual(portfolio)
  })

  it('returns empty holdings when portfolio does not exist', async () => {
    ;(redis.get as jest.Mock).mockResolvedValue(null)
    PortfolioDoc.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) })
    const result = await svc.get('u1')
    expect(result).toEqual({ userId: 'u1', holdings: [] })
  })

  it('caches the result on DB hit', async () => {
    const portfolio = { userId: 'u1', holdings: [{ coinId: 'bitcoin' }] }
    ;(redis.get as jest.Mock).mockResolvedValue(null)
    PortfolioDoc.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(portfolio) })
    await svc.get('u1')
    expect(redis.set).toHaveBeenCalledWith(
      'portfolio:u1', JSON.stringify(portfolio), { EX: 60 }
    )
  })
})

describe('PortfolioService.removeHolding', () => {
  it('throws 404 when portfolio not found', async () => {
    PortfolioDoc.findOneAndUpdate.mockResolvedValue(null)
    await expect(svc.removeHolding('u1', 'bitcoin'))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('invalidates cache on success', async () => {
    const updated = { holdings: [] }
    PortfolioDoc.findOneAndUpdate.mockResolvedValue({ toObject: () => updated })
    await svc.removeHolding('u1', 'bitcoin')
    expect(redis.del).toHaveBeenCalledWith('portfolio:u1')
  })
})
import { CoinService } from '../../services/coin.service'
import { AppError } from '../../middleware/errorHandler'

jest.mock('../../models/coin.model', () => ({
  CoinModel: jest.fn().mockImplementation(() => ({
    findAll:       jest.fn(),
    findById:      jest.fn(),
    findOHLCV:     jest.fn(),
    findIndicators: jest.fn(),
  })),
}))

jest.mock('../../config/redis', () => ({
  redis: { get: jest.fn(), set: jest.fn() },
}))

import { CoinModel } from '../../models/coin.model'
import { redis } from '../../config/redis'

let svc: CoinService
let model: jest.Mocked<InstanceType<typeof CoinModel>>

beforeEach(() => {
  jest.clearAllMocks()
  svc = new CoinService()
  model = (CoinModel as jest.Mock).mock.results[0].value
})

describe('CoinService.getAll', () => {
  it('returns cached value when available', async () => {
    const coins = [{ coinId: 'bitcoin' }]
    ;(redis.get as jest.Mock).mockResolvedValue(JSON.stringify(coins))
    const result = await svc.getAll()
    expect(result).toEqual(coins)
    expect(model.findAll).not.toHaveBeenCalled()
  })

  it('fetches from DB and caches on miss', async () => {
    ;(redis.get as jest.Mock).mockResolvedValue(null)
    const coins = [{ coinId: 'bitcoin' }]
    model.findAll.mockResolvedValue(coins as any)
    const result = await svc.getAll()
    expect(result).toEqual(coins)
    expect(redis.set).toHaveBeenCalledWith('coins:all', JSON.stringify(coins), { EX: 30 })
  })
})

describe('CoinService.getOne', () => {
  it('throws 404 when coin not found', async () => {
    ;(redis.get as jest.Mock).mockResolvedValue(null)
    model.findById.mockResolvedValue(null)
    await expect(svc.getOne('unknown-coin'))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns coin from DB and caches it', async () => {
    ;(redis.get as jest.Mock).mockResolvedValue(null)
    const coin = { coinId: 'bitcoin', price: 50000 }
    model.findById.mockResolvedValue(coin as any)
    const result = await svc.getOne('bitcoin')
    expect(result).toEqual(coin)
    expect(redis.set).toHaveBeenCalledWith(
      'coins:bitcoin', JSON.stringify(coin), { EX: 30 }
    )
  })
})

describe('CoinService.getOHLCV', () => {
  it('passes correct range string to model', async () => {
    model.findOHLCV.mockResolvedValue([])
    await svc.getOHLCV('bitcoin', '1W')
    expect(model.findOHLCV).toHaveBeenCalledWith('bitcoin', '1W')
  })
})
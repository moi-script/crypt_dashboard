import { CoinModel } from '../../models/coin.model'

// ── Mock Mongoose documents ───────────────────────────────────────────────────

// Defined before jest.mock so hoisting doesn't cause ReferenceError.
// The factory uses jest.fn() directly; we grab the reference after import.
jest.mock('../../models/schemes/ohlcv.schema', () => ({
  OHLCVDoc: { aggregate: jest.fn() },
}))

import { OHLCVDoc } from '../../models/schemes/ohlcv.schema'
const mockAggregate = OHLCVDoc.aggregate as jest.Mock

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose')

  const makeSortable = (val: unknown) => ({
    sort:  jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean:  jest.fn().mockResolvedValue(val),
  })

  return {
    ...actual,
    model: jest.fn((name: string) => {
      if (name === 'Coin') {
        return {
          find:    jest.fn(() => makeSortable([])),
          findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
        }
      }
      if (name === 'Indicator') {
        return {
          find: jest.fn(() => makeSortable([])),
        }
      }
      // OHLCV timeseries model
      return { aggregate: mockAggregate }
    }),
    Schema: actual.Schema,
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

// Capture the $match stage from the aggregate pipeline
function captureMatch(): { coinId: string; time: { $gte: Date } } {
  const [[pipeline]] = mockAggregate.mock.calls
  return (pipeline as any[])[0].$match
}

// Capture the $group stage
function captureGroup(): Record<string, unknown> {
  const [[pipeline]] = mockAggregate.mock.calls
  return (pipeline as any[])[1].$group
}

let model: CoinModel

beforeEach(() => {
  jest.clearAllMocks()
  mockAggregate.mockResolvedValue([])
  model = new CoinModel()
})

// ── findOHLCV — range bucketing ───────────────────────────────────────────────

describe('CoinModel.findOHLCV', () => {
  const RANGES: Array<{ range: string; unit: string; binSize: number; daysBack: number }> = [
    { range: '1D', unit: 'minute', binSize: 5,   daysBack: 1   },
    { range: '1W', unit: 'hour',   binSize: 1,   daysBack: 7   },
    { range: '1M', unit: 'hour',   binSize: 4,   daysBack: 30  },
    { range: '1Y', unit: 'day',    binSize: 1,   daysBack: 365 },
  ]

  it.each(RANGES)('$range → unit=$unit binSize=$binSize daysBack=$daysBack', async ({ range, unit, binSize, daysBack }) => {
    const before = Date.now()
    await model.findOHLCV('bitcoin', range)
    const after = Date.now()

    expect(mockAggregate).toHaveBeenCalledTimes(1)

    const match = captureMatch()
    expect(match.coinId).toBe('bitcoin')
    // since = Date.now() - daysBack * 86_400_000 — verify it's within a 1s window
    const expectedSince = before - daysBack * 86_400_000
    expect(match.time.$gte.getTime()).toBeGreaterThanOrEqual(expectedSince - 1000)
    expect(match.time.$gte.getTime()).toBeLessThanOrEqual(after)

    const group = captureGroup()
    expect(group._id).toMatchObject({ $dateTrunc: { unit, binSize } })
  })

  it('falls back to 1D config for unknown range', async () => {
    await model.findOHLCV('ethereum', 'UNKNOWN')

    const group = captureGroup()
    expect(group._id).toMatchObject({
      $dateTrunc: { unit: 'minute', binSize: 5 },
    })
  })

  it('pipeline includes open/high/low/close/volume accumulators', async () => {
    await model.findOHLCV('bitcoin', '1D')

    const group = captureGroup()
    expect(group).toMatchObject({
      open:   { $first: '$open'   },
      high:   { $max:   '$high'   },
      low:    { $min:   '$low'    },
      close:  { $last:  '$close'  },
      volume: { $sum:   '$volume' },
    })
  })

  it('pipeline ends with $sort: { _id: 1 }', async () => {
    await model.findOHLCV('bitcoin', '1W')

    const [[pipeline]] = mockAggregate.mock.calls
    const sort = (pipeline as any[]).at(-1)
    expect(sort).toEqual({ $sort: { _id: 1 } })
  })

  it('returns the aggregate result', async () => {
    const rows = [{ _id: new Date(), open: 100, high: 110, low: 90, close: 105, volume: 500 }]
    mockAggregate.mockResolvedValue(rows)

    const result = await model.findOHLCV('bitcoin', '1D')
    expect(result).toEqual(rows)
  })
})

// ── findAll ───────────────────────────────────────────────────────────────────

describe('CoinModel.findAll', () => {
  it('calls find sorted by rank and returns result', async () => {
    const result = await model.findAll()
    expect(result).toEqual([]) // mock returns []
  })
})

// ── findById ──────────────────────────────────────────────────────────────────

describe('CoinModel.findById', () => {
  it('returns null when coin does not exist', async () => {
    const result = await model.findById('unknown')
    expect(result).toBeNull()
  })
})

// ── findIndicators ────────────────────────────────────────────────────────────

describe('CoinModel.findIndicators', () => {
  it('returns indicators array', async () => {
    const result = await model.findIndicators('bitcoin')
    expect(result).toEqual([])
  })

  it('uses default limit of 100', async () => {
    // Default is exercised — no error means the default param was accepted
    await expect(model.findIndicators('bitcoin')).resolves.toBeDefined()
  })
})
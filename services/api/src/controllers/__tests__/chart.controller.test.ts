import '../../config/env'
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'

jest.mock('../../read/ingestion/ohlcv.ingest', () => ({
  ohlcvIngest: {
    fetchMultiTimeframe: jest.fn(async (symbol: string, tfs: string[]) => ({
      [tfs[0]]: [
        { timestamp: 1700000000000, open: 40000, high: 41000, low: 39000, close: 40500, volume: 123 },
      ],
    })),
  },
}))

import { getOhlcv } from '../chartAnalysis.controller'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

function mockRes() {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json   = jest.fn(() => res)
  return res
}

test('getOhlcv returns candles for valid symbol and timeframe', async () => {
  const req: any = { params: { symbol: 'BTCUSDT' }, query: { timeframe: '4h', limit: '10' } }
  const res      = mockRes()
  await getOhlcv(req, res)

  const payload = res.json.mock.calls[0][0]
  expect(payload.symbol).toBe('BTCUSDT')
  expect(payload.timeframe).toBe('4h')
  expect(Array.isArray(payload.candles)).toBe(true)
  expect(payload.candles).toHaveLength(1)
})

test('getOhlcv rejects unknown symbol', async () => {
  const req: any = { params: { symbol: 'SCAMCOIN' }, query: { timeframe: '4h' } }
  const res      = mockRes()
  await getOhlcv(req, res)

  expect(res.status.mock.calls[0][0]).toBe(400)
})

test('getOhlcv rejects unknown timeframe', async () => {
  const req: any = { params: { symbol: 'BTCUSDT' }, query: { timeframe: '3h' } }
  const res      = mockRes()
  await getOhlcv(req, res)

  expect(res.status.mock.calls[0][0]).toBe(400)
})

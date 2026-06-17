import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { listPositions, getDailyPnl, getPnlSummary } from '../position.controller'
import { PositionDoc } from '../../models/position.model'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

function mockRes() {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

const base = {
  mode: 'paper' as const,
  tokenIn: 'USDC',
  tokenOut: 'ETH',
  entryAmountUsd: 100,
  entryPrice: 2000,
  entryAt: new Date(),
  strategy: 'chartSignal',
  runId: 'r',
}

async function seedClosed(userId: string, pnl: number) {
  await PositionDoc.create({
    ...base,
    positionId: `pos-${userId}-${pnl}`,
    userId,
    isOpen: false,
    exitPrice: 1900,
    exitAt: new Date(),
    realizedPnlUsd: pnl,
  })
}

test('listPositions returns only the caller\'s positions', async () => {
  await PositionDoc.create({ ...base, positionId: 'pos-a', userId: 'user-a', isOpen: true })
  await PositionDoc.create({ ...base, positionId: 'pos-b', userId: 'user-b', isOpen: true })

  const req: any = { userId: 'user-a', query: {} }
  const res = mockRes()
  await listPositions(req, res, jest.fn())

  const payload = res.json.mock.calls[0][0]
  expect(payload.count).toBe(1)
  expect(payload.positions[0].userId).toBe('user-a')
})

test('getPnlSummary aggregates only the caller\'s closed positions', async () => {
  await seedClosed('user-a', 10)
  await seedClosed('user-a', -4)
  await seedClosed('user-b', 999)

  const req: any = { userId: 'user-a' }
  const res = mockRes()
  await getPnlSummary(req, res, jest.fn())

  const payload = res.json.mock.calls[0][0]
  expect(payload.totalTrades).toBe(2)
  expect(payload.totalPnlUsd).toBeCloseTo(6, 4)
  expect(payload.wins).toBe(1)
  expect(payload.losses).toBe(1)
})

test('getDailyPnl counts only the caller\'s closed positions', async () => {
  await seedClosed('user-a', 5)
  await seedClosed('user-b', 5)

  const req: any = { userId: 'user-a' }
  const res = mockRes()
  await getDailyPnl(req, res, jest.fn())

  const payload = res.json.mock.calls[0][0]
  expect(payload.tradeCount).toBe(1)
  expect(payload.totalPnlUsd).toBeCloseTo(5, 4)
})

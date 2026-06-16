import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { getWallet, getTrades } from '../paperWallet.controller'
import { recordTrade } from '../../services/paperWallet.service'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

function mockRes() {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

test('getWallet returns the caller\'s auto-provisioned wallet', async () => {
  const req: any = { userId: 'user-a' }
  const res = mockRes()
  await getWallet(req, res, jest.fn())
  const wallet = res.json.mock.calls[0][0]
  expect(wallet.userId).toBe('user-a')
  expect(wallet.totalValueUsd).toBe(5000)
})

test('getTrades is scoped to the caller', async () => {
  await recordTrade('user-a', { runId: 'r', tokenIn: 'USDC', tokenOut: 'ETH', amountUsd: 100, filledAmountUsd: 100, entryPrice: 2000, feesUsd: 0.1, slippagePct: 0.01, strategy: 's', rationale: 'r', confidence: 50 })
  await recordTrade('user-b', { runId: 'r', tokenIn: 'USDC', tokenOut: 'ETH', amountUsd: 100, filledAmountUsd: 100, entryPrice: 2000, feesUsd: 0.1, slippagePct: 0.01, strategy: 's', rationale: 'r', confidence: 50 })

  const req: any = { userId: 'user-a', query: {} }
  const res = mockRes()
  await getTrades(req, res, jest.fn())
  const payload = res.json.mock.calls[0][0]
  expect(payload.trades).toHaveLength(1)
  expect(payload.trades[0].userId).toBe('user-a')
})

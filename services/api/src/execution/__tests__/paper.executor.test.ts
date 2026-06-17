import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { executePaper, getLivePrice } from '../modes/paper.executor'
import { getOrCreateWallet } from '../../services/paperWallet.service'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

beforeEach(() => {
  global.fetch = jest.fn(async (url: string) => {
    if (url.includes('ethereum')) {
      return { json: async () => ({ ethereum: { usd: 2000 } }) } as any
    }
    if (url.includes('usd-coin')) {
      return { json: async () => ({ 'usd-coin': { usd: 1 } }) } as any
    }
    return { json: async () => ({}) } as any
  }) as any
})

test('getLivePrice resolves a known symbol to its USD price', async () => {
  const price = await getLivePrice('ETH')
  expect(price).toBe(2000)
})

test('a closing sell surfaces realizedPnlUsd into simulatedPnlUsd', async () => {
  await getOrCreateWallet('user-pnl')

  // Buy ETH at $2000
  await executePaper(
    { type: 'propose_trade', tokenIn: 'USDC', tokenOut: 'ETH', amountUsd: 1000, maxSlippageBps: 50, rationale: 'buy' },
    { userId: 'user-pnl', runId: 'run-1', strategy: 'test', rationale: 'buy', confidence: 50 },
  )

  // Price rises to $2200 — sell back to USDC
  global.fetch = jest.fn(async (url: string) => {
    if (url.includes('ethereum')) return { json: async () => ({ ethereum: { usd: 2200 } }) } as any
    return { json: async () => ({ 'usd-coin': { usd: 1 } }) } as any
  }) as any

  const sellResult = await executePaper(
    { type: 'propose_trade', tokenIn: 'ETH', tokenOut: 'USDC', amountUsd: 900, maxSlippageBps: 50, rationale: 'sell' },
    { userId: 'user-pnl', runId: 'run-2', strategy: 'test', rationale: 'sell', confidence: 50 },
  )

  expect(sellResult.status).toBe('filled')
  expect(sellResult.simulatedPnlUsd).toBeGreaterThan(0)
})

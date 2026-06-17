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

test('rejects an opening buy whose fill price is already at/above the take-profit', async () => {
  await getOrCreateWallet('user-tp')
  const res = await executePaper(
    { type: 'propose_trade', tokenIn: 'USDC', tokenOut: 'ETH', amountUsd: 100, maxSlippageBps: 50,
      rationale: 'x', stopLossPrice: 1850, takeProfitPrice: 1950 },  // fill is $2000 → already past TP
    { userId: 'user-tp', runId: 'r', strategy: 'chartSignal', rationale: 'x', confidence: 90 },
  )
  expect(res.status).toBe('rejected')
  expect(res.errorMessage).toMatch(/take-profit/i)

  // wallet must NOT have been debited
  const wallet = await getOrCreateWallet('user-tp')
  expect(wallet.balances.find(b => b.symbol === 'USDC')!.amount).toBe(5000)
})

test('rejects an opening buy whose fill price is already at/below the stop-loss', async () => {
  await getOrCreateWallet('user-slr')
  const res = await executePaper(
    { type: 'propose_trade', tokenIn: 'USDC', tokenOut: 'ETH', amountUsd: 100, maxSlippageBps: 50,
      rationale: 'x', stopLossPrice: 2050, takeProfitPrice: 2200 },  // fill is $2000 → already past SL
    { userId: 'user-slr', runId: 'r', strategy: 'chartSignal', rationale: 'x', confidence: 90 },
  )
  expect(res.status).toBe('rejected')
  expect(res.errorMessage).toMatch(/stop-loss/i)
})

test('fills an opening buy when the fill price sits between stop-loss and take-profit', async () => {
  await getOrCreateWallet('user-ok')
  const res = await executePaper(
    { type: 'propose_trade', tokenIn: 'USDC', tokenOut: 'ETH', amountUsd: 100, maxSlippageBps: 50,
      rationale: 'x', stopLossPrice: 1900, takeProfitPrice: 2100 },  // fill $2000 is in range
    { userId: 'user-ok', runId: 'r', strategy: 'chartSignal', rationale: 'x', confidence: 90 },
  )
  expect(res.status).toBe('filled')
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

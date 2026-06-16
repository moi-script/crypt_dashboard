import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import {
  getOrCreateWallet, recordTrade, getTradeHistory, getTradeStats, resetWallet,
} from '../paperWallet.service'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

const tradeInput = (runId: string) => ({
  runId, tokenIn: 'USDC', tokenOut: 'ETH', amountUsd: 100, filledAmountUsd: 100,
  entryPrice: 2000, feesUsd: 0.1, slippagePct: 0.01,
  strategy: 'yieldHunter', rationale: 'test', confidence: 80,
})

test('auto-provisions a $5000 USDC wallet on first access', async () => {
  const w = await getOrCreateWallet('user-a')
  expect(w.userId).toBe('user-a')
  expect(w.walletId).toBe('paper-user-a')
  expect(w.totalValueUsd).toBe(5000)
  expect(w.balances.find(b => b.symbol === 'USDC')?.amount).toBe(5000)
})

test('trades on one user never touch another user balances', async () => {
  await getOrCreateWallet('user-a')
  await getOrCreateWallet('user-b')
  await recordTrade('user-a', tradeInput('run-a'))

  const a = await getOrCreateWallet('user-a')
  const b = await getOrCreateWallet('user-b')
  expect(a.balances.find(x => x.symbol === 'USDC')!.amount).toBeLessThan(5000)
  expect(b.balances.find(x => x.symbol === 'USDC')!.amount).toBe(5000)
})

test('history and stats are scoped to the user', async () => {
  await recordTrade('user-a', tradeInput('run-a'))
  await recordTrade('user-b', tradeInput('run-b'))

  const histA = await getTradeHistory('user-a')
  expect(histA).toHaveLength(1)
  expect(histA[0].userId).toBe('user-a')

  const statsB = await getTradeStats('user-b')
  expect(statsB.trades.total).toBe(1)
})

test('resetWallet only clears the target user', async () => {
  await recordTrade('user-a', tradeInput('run-a'))
  await recordTrade('user-b', tradeInput('run-b'))
  await resetWallet('user-a')

  expect(await getTradeHistory('user-a')).toHaveLength(0)
  expect(await getTradeHistory('user-b')).toHaveLength(1)
})

import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { PaperWalletDoc, TradeTransactionDoc } from '../paperWallet.model'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('wallet requires userId and enforces uniqueness per user', async () => {
  await PaperWalletDoc.create({ userId: 'user-a', walletId: 'paper-user-a' })
  await expect(
    PaperWalletDoc.create({ userId: 'user-a', walletId: 'paper-user-a-2' }),
  ).rejects.toThrow()
})

test('two different users can each have a wallet', async () => {
  await PaperWalletDoc.create({ userId: 'user-a', walletId: 'paper-user-a' })
  await PaperWalletDoc.create({ userId: 'user-b', walletId: 'paper-user-b' })
  expect(await PaperWalletDoc.countDocuments({})).toBe(2)
})

test('trade transaction stores userId', async () => {
  const tx = await TradeTransactionDoc.create({
    txId: 'tx-1', runId: 'run-1', userId: 'user-a', walletId: 'paper-user-a',
    side: 'buy', tokenIn: 'USDC', tokenOut: 'ETH',
    amountIn: 100, amountOut: 0.05, amountUsd: 100, priceUsd: 2000,
    strategy: 'yieldHunter', executedAt: new Date(),
  })
  expect(tx.userId).toBe('user-a')
})

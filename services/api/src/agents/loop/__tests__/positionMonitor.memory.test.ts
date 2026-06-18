process.env.OPENAI_API_KEY = 'test-key'

import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'
import { AgentMemoryDoc } from '../../../models/agentMemory.model'
import { PositionDoc } from '../../../models/position.model'
import { PaperWalletDoc } from '../../../models/paperWallet.model'
import { getOrCreateWallet } from '../../../services/paperWallet.service'
import { runPositionMonitorSweep } from '../positionMonitor'

jest.mock('../../memory/memory.embedder', () => ({
  embed: jest.fn(async () => new Array(1536).fill(0.1)),
}))

// Seed a decision memory entry so writeOutcome can link to it
async function seedDecisionEntry(runId: string) {
  await AgentMemoryDoc.create({
    agentId: 'user-pm', runId, timestamp: new Date(), coin: 'BTC',
    type: 'decision', summary: 'BTC long', fullContext: {},
    embedding: new Array(1536).fill(0.1), marketRegime: 'trending_up',
    signals: [], tools: [],
  })
}

// Seed a wallet with BTC so the paper executor can close the position
async function seedWalletWithBtc(userId: string) {
  await getOrCreateWallet(userId)
  await PaperWalletDoc.updateOne({ userId }, { $set: {
    balances: [
      { symbol: 'USDC', amount: 4000, valueUsd: 4000, avgCostUsd: 1, updatedAt: new Date() },
      { symbol: 'BTC',  amount: 0.002, valueUsd: 110, avgCostUsd: 50000, updatedAt: new Date() },
    ],
  } })
}

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ bitcoin: { usd: 55000 } }),  // above take-profit
  })) as any
})

test('closePosition writes an outcome memory entry when a position closes', async () => {
  const runId = 'run-pm1'
  await seedDecisionEntry(runId)
  await seedWalletWithBtc('user-pm')

  await PositionDoc.create({
    positionId: 'pos-pm1', userId: 'user-pm', mode: 'paper', status: 'open',
    tokenIn: 'USDC', tokenOut: 'BTC', entryAmountUsd: 100, entryPrice: 50000,
    entryFeesUsd: 0, entryAt: new Date(), isOpen: true,
    strategy: 'chartSignal', runId,
    stopLossPrice: 48000, takeProfitPrice: 53000,
  })

  await runPositionMonitorSweep()

  const outcomeEntries = await AgentMemoryDoc.find({ type: 'outcome' }).lean()
  expect(outcomeEntries.length).toBeGreaterThanOrEqual(1)
  expect(outcomeEntries[0].linkedDecisionId).toBeDefined()
})

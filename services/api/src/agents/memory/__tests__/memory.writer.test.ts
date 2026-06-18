process.env.OPENAI_API_KEY = 'test-key'

import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'
import { writeDecision, writeOutcome } from '../memory.writer'
import { AgentMemoryDoc } from '../../../models/agentMemory.model'
import type { LoopContext } from '../../loop/loop.types'
import type { Decision } from '../../loop/loop.types'

// Mock embedder so tests don't call the real OpenAI API
jest.mock('../memory.embedder', () => ({
  embed: jest.fn(async () => new Array(1536).fill(0.1)),
}))

const ctx: LoopContext = {
  runId: 'run-w1', userId: 'user-w1', strategy: 'chartSignal',
  startedAt: Date.now(), contextSummary: 'BTC at 50k, trending up',
  walletState: { mode: 'paper', balances: {}, openPositions: 0, totalValueUsd: 1000, dailyPnlUsd: 0 },
  marketData: {}, config: {} as any,
}

const decision: Decision = {
  intent: { type: 'propose_trade', tokenIn: 'USDC', tokenOut: 'BTC', amountUsd: 100, maxSlippageBps: 50, rationale: 'SmartMoney long signal' },
  confidence: 80,
  reasoning: 'SmartMoney confluence detected',
  toolCallTrace: ['chartSignal'],
}

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('writeDecision persists a decision-type memory entry', async () => {
  await writeDecision(ctx, decision)
  const entry = await AgentMemoryDoc.findOne({ runId: 'run-w1' }).lean()
  expect(entry).not.toBeNull()
  expect(entry!.type).toBe('decision')
  expect(entry!.coin).toBe('BTC')
  expect(entry!.embedding).toHaveLength(1536)
})

test('writeOutcome links back to the decision entry', async () => {
  await writeDecision(ctx, decision)
  const decisionEntry = await AgentMemoryDoc.findOne({ runId: 'run-w1' }).lean()

  await writeOutcome('run-w1', {
    pnl: 12.5, pnlPercent: 2.5, durationHeldMs: 3_600_000,
    closedAt: new Date(), success: true,
  })

  const outcomeEntry = await AgentMemoryDoc.findOne({ type: 'outcome', linkedDecisionId: decisionEntry!._id!.toString() }).lean()
  expect(outcomeEntry).not.toBeNull()
  expect(outcomeEntry!.outcome!.success).toBe(true)
})

test('writeDecision on no_action still persists (type decision, no coin defaults to unknown)', async () => {
  const noActionCtx = { ...ctx, runId: 'run-w2' }
  const noActionDecision: Decision = {
    intent: { type: 'no_action', rationale: 'no signal' },
    confidence: 90, reasoning: 'quiet market', toolCallTrace: [],
  }
  await writeDecision(noActionCtx, noActionDecision)
  const entry = await AgentMemoryDoc.findOne({ runId: 'run-w2' }).lean()
  expect(entry).not.toBeNull()
  expect(entry!.coin).toBe('unknown')
})

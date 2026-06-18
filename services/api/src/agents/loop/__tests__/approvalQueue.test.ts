import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'
import { AgentRunDoc } from '../../../models/agentRun.model'
import { PositionDoc } from '../../../models/position.model'
import { getOrCreateWallet } from '../../../services/paperWallet.service'

// Must be before agent.loop import to prevent OpenAI credential check at module load
jest.mock('../../policy/policy.engine', () => ({
  runPolicyEngine: jest.fn(async () => { throw new Error('runPolicyEngine should not be called in approvalQueue tests') }),
}))

import { approveRun, rejectRun } from '../agent.loop'

// Prevent the chartSignal tick from needing Binance/Redis during these tests
jest.mock('../../../services/chartAnalysis.service', () => ({
  buildMarketPrimitives: jest.fn(async () => ({ meta: { symbol: 'BTC' } } as any)),
}))

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

function makePendingRun(overrides: Record<string, unknown> = {}) {
  return AgentRunDoc.create({
    runId:     'run-approve-1',
    userId:    'user-test',
    strategy:  'chartSignal',
    mode:      'paper',
    startedAt: new Date(),
    status:    'pending_approval',
    decision: {
      intent: {
        type:           'propose_trade',
        tokenIn:        'USDC',
        tokenOut:       'BTC',
        amountUsd:      100,
        maxSlippageBps: 50,
        rationale:      'test',
        stopLossPrice:  49000,
        takeProfitPrice: 53000,
        entryZoneLow:   50000,
        entryZoneHigh:  51000,
        framework:      'SmartMoney',
      },
      confidence:    85,
      reasoning:     'test signal',
      toolCallTrace: ['chartSignal:SmartMoney'],
    },
    ...overrides,
  })
}

test('approveRun executes the intent and flips run to completed', async () => {
  await getOrCreateWallet('user-test')
  await makePendingRun()

  const result = await approveRun('user-test', 'run-approve-1')

  expect(['filled', 'pending_limit', 'blocked_by_risk']).toContain(result.status)

  const updated = await AgentRunDoc.findOne({ runId: 'run-approve-1' }).lean()
  expect(updated!.status).toMatch(/completed|blocked/)
  expect(updated!.completedAt).toBeDefined()
})

test('approveRun for chart-signal intent creates a pending limit position', async () => {
  await getOrCreateWallet('user-test')
  await makePendingRun()

  await approveRun('user-test', 'run-approve-1')

  const positions = await PositionDoc.find({ userId: 'user-test' }).lean()
  // chart-signal uses a limit order (pending until price re-enters entry zone)
  expect(positions.length).toBeGreaterThanOrEqual(1)
  if (positions.length > 0) {
    expect(positions[0].tokenOut).toBe('BTC')
    expect(positions[0].stopLossPrice).toBe(49000)
  }
})

test('approveRun returns 404 if runId not found for this user', async () => {
  await getOrCreateWallet('user-test')
  await makePendingRun()

  await expect(approveRun('other-user', 'run-approve-1')).rejects.toThrow('not found')
})

test('rejectRun sets status to rejected and creates no position', async () => {
  await makePendingRun()

  await rejectRun('user-test', 'run-approve-1')

  const updated = await AgentRunDoc.findOne({ runId: 'run-approve-1' }).lean()
  expect(updated!.status).toBe('rejected')
  expect(updated!.completedAt).toBeDefined()

  const positions = await PositionDoc.find({ userId: 'user-test' }).lean()
  expect(positions).toHaveLength(0)
})

test('rejectRun returns 404 if runId not found for this user', async () => {
  await makePendingRun()
  await expect(rejectRun('other-user', 'run-approve-1')).rejects.toThrow('not found')
})

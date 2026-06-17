import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'

jest.mock('../../policy/policy.engine', () => ({
  runPolicyEngine: jest.fn(async () => { throw new Error('runPolicyEngine should not be called for chartSignal') }),
}))

import { runLoopTick } from '../agent.loop'
import { AgentConfigDoc } from '../../../models/agentConfig.model'
import { DEFAULT_AGENT_CONFIG } from '../../../config/agent.config'
import { PositionDoc } from '../../../models/position.model'
import { getOrCreateWallet } from '../../../services/paperWallet.service'

jest.mock('../../../services/chartAnalysis.service', () => ({
  buildMarketPrimitives: jest.fn(async (symbol: string) => ({ meta: { symbol } } as any)),
}))
jest.mock('../../policy/strategies/smartMoney.strategy', () => ({
  runSmartMoneyStrategy: jest.fn(() => ({
    skipped: false,
    signal: {
      symbol: 'BTC', framework: 'SmartMoney', bias: 'long', setup_name: 'Test setup',
      entry_zone: { high: 51000, low: 50000 }, stop_loss: 49000,
      take_profit_levels: [53000], risk_reward: 2.5, confidence: 90,
      invalidation: 'x', reasoning: 'Test signal', confluence_factors: [],
      generated_at: new Date().toISOString(),
    },
  })),
}))
jest.mock('../../policy/strategies/wyckoff.strategy',  () => ({ runWyckoffStrategy:  jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'x' })) }))
jest.mock('../../policy/strategies/elliott.strategy',  () => ({ runElliottStrategy:  jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'x' })) }))
jest.mock('../../policy/strategies/harmonic.strategy', () => ({ runHarmonicStrategy: jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'x' })) }))

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

beforeEach(() => {
  global.fetch = jest.fn(async (url: string) => {
    if (url.includes('bitcoin')) return { json: async () => ({ bitcoin: { usd: 50500 } }) } as any
    return { json: async () => ({ 'usd-coin': { usd: 1 } }) } as any
  }) as any
})

test('a chartSignal tick records a pending limit order (not an immediate fill), bypassing the LLM', async () => {
  await getOrCreateWallet('user-cs')
  await AgentConfigDoc.create({
    userId: 'user-cs', ...DEFAULT_AGENT_CONFIG, enabled: true, requireManualApproval: false,
    strategies: { yieldHunter: false, rebalance: false, airdropWatch: false, chartSignal: true },
  })

  await runLoopTick('user-cs')

  const positions = await PositionDoc.find({ userId: 'user-cs' }).lean()
  expect(positions).toHaveLength(1)
  expect(positions[0].tokenOut).toBe('BTC')
  expect(positions[0].stopLossPrice).toBe(49000)
  expect(positions[0].takeProfitPrice).toBe(53000)
  expect(positions[0].framework).toBe('SmartMoney')
  expect(positions[0].confidence).toBe(90)
  // Limit order: pending until price re-enters the entry zone — not filled yet.
  expect(positions[0].status).toBe('pending')
  expect(positions[0].isOpen).toBe(false)
  expect(positions[0].entryZoneLow).toBe(50000)
  expect(positions[0].entryZoneHigh).toBe(51000)
  expect(positions[0].entryPrice).toBeUndefined()
  expect(positions[0].entryExpiresAt).toBeDefined()
})

import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'
import { AgentMemoryDoc } from '../../../models/agentMemory.model'
import { AgentConfigDoc } from '../../../models/agentConfig.model'
import { DEFAULT_AGENT_CONFIG } from '../../../config/agent.config'
import { getOrCreateWallet } from '../../../services/paperWallet.service'
import { runLoopTick } from '../agent.loop'

// Mock everything that touches external services
jest.mock('../../policy/policy.engine', () => ({
  runPolicyEngine: jest.fn(async () => ({
    intent: { type: 'no_action', rationale: 'test quiet market' },
    confidence: 90, reasoning: 'quiet', toolCallTrace: [],
  })),
}))

jest.mock('../../memory/memory.embedder', () => ({
  embed: jest.fn(async () => new Array(1536).fill(0.1)),
}))

jest.mock('../../memory/memory.retriever', () => ({
  retrieve: jest.fn(async () => ({ similarMemories: [], reflection: null })),
}))

jest.mock('../../policy/strategies/yieldHunter.strategy', () => ({
  yieldHunterStrategy: {
    buildContext: jest.fn(async () => ({
      contextSummary: 'yields stable', metadata: {}, deterministicDecision: null,
    })),
  },
}))

jest.mock('../../../services/chartAnalysis.service', () => ({
  buildMarketPrimitives: jest.fn(async () => ({ meta: { symbol: 'BTC' } } as any)),
}))
jest.mock('../../policy/strategies/smartMoney.strategy', () => ({
  runSmartMoneyStrategy: jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'test' })),
}))
jest.mock('../../policy/strategies/wyckoff.strategy', () => ({
  runWyckoffStrategy: jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'test' })),
}))
jest.mock('../../policy/strategies/elliott.strategy', () => ({
  runElliottStrategy: jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'test' })),
}))
jest.mock('../../policy/strategies/harmonic.strategy', () => ({
  runHarmonicStrategy: jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'test' })),
}))

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    json: async () => ({ bitcoin: { usd: 50000 } }),
  })) as any
})

test('runLoopTick writes a decision memory entry after each tick', async () => {
  await getOrCreateWallet('user-mem')
  await AgentConfigDoc.create({
    userId: 'user-mem', ...DEFAULT_AGENT_CONFIG, enabled: true,
    requireManualApproval: false,
    strategies: { yieldHunter: true, rebalance: false, airdropWatch: false, chartSignal: false },
  })

  await runLoopTick('user-mem')

  const entries = await AgentMemoryDoc.find({ agentId: 'user-mem' }).lean()
  expect(entries.length).toBeGreaterThanOrEqual(1)
  expect(entries[0].type).toBe('decision')
})

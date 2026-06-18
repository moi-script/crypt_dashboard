// services/api/src/agents/coinAnalysis/__tests__/coinAnalysis.runner.test.ts
import { connectTestDb, clearTestDb, disconnectTestDb } from '@/__tests__/helpers/db'

jest.mock('@/services/chartAnalysis.service', () => ({
  buildMarketPrimitives: jest.fn(async () => ({ meta: { symbol: 'BTCUSDT' } } as any)),
}))

jest.mock('@/agents/news/news.ingestor', () => ({
  ingestAndFetchNews: jest.fn(async () => ({
    articles:   [{ title: 'BTC rally', summary: '', sentiment: 0 }],
    articleIds: ['art-1'],
  })),
}))

jest.mock('@/agents/memory/memory.retriever', () => ({
  retrieve: jest.fn(async () => ({ similarMemories: [], reflection: null })),
}))

jest.mock('@/agents/policy/prompts/memory.section.prompt', () => ({
  renderMemorySection: jest.fn(() => ''),
}))

const mockSignal = {
  symbol: 'BTC', framework: 'SmartMoney' as const, bias: 'long' as const,
  setup_name: 'OB retest', entry_zone: { high: 51000, low: 50000 },
  stop_loss: 49000, take_profit_levels: [54000], risk_reward: 2,
  confidence: 80, invalidation: 'x', reasoning: 'Strong OB', confluence_factors: [],
  generated_at: new Date().toISOString(),
}

jest.mock('@/agents/policy/strategies/smartMoney.strategy', () => ({
  runSmartMoneyStrategy: jest.fn(() => ({ skipped: false, signal: mockSignal })),
}))
jest.mock('@/agents/policy/strategies/wyckoff.strategy',  () => ({ runWyckoffStrategy:  jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'no range' })) }))
jest.mock('@/agents/policy/strategies/elliott.strategy',  () => ({ runElliottStrategy:  jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'no waves' })) }))
jest.mock('@/agents/policy/strategies/harmonic.strategy', () => ({ runHarmonicStrategy: jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'no pattern' })) }))

jest.mock('@/agents/coinAnalysis/chartSnapshot.util', () => ({
  buildChartSnapshot: jest.fn(async () => ({
    symbol: 'BTC', binanceSymbol: 'BTCUSDT', framework: 'SmartMoney',
    snapshotAt: new Date(), entryZone: { low: 50000, high: 51000 },
    stopLoss: 49000, takeProfitLevels: [54000], confidence: 80,
    overlays: { supportResistance: [], trendlines: [] },
  })),
}))

jest.mock('@/execution/execution.gateway', () => ({
  executeIntent: jest.fn(async () => ({
    execution: { status: 'pending_limit', executedAt: new Date() },
    riskPassed: true,
    pendingApproval: false,
  })),
}))

// Mock DeepSeek LLM call
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(async () => ({
          choices: [{ message: { content: 'SmartMoney sees a clean OB retest with bullish news.' } }],
        })),
      },
    },
  }))
})

import { runCoinAnalysis, approveCard, rejectCard } from '../coinAnalysis.runner'
import { CoinAnalysisRunDoc } from '@/models/coinAnalysisRun.model'
import { AgentConfigDoc }     from '@/models/agentConfig.model'
import { DEFAULT_AGENT_CONFIG } from '@/config/agent.config'
import { getOrCreateWallet }  from '@/services/paperWallet.service'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

async function setupUser(overrides: Record<string, any> = {}) {
  await getOrCreateWallet('user-ca')
  await AgentConfigDoc.create({
    userId: 'user-ca',
    ...DEFAULT_AGENT_CONFIG,
    enabled: true,
    requireManualApproval: true,
    strategies: { yieldHunter: false, rebalance: false, airdropWatch: false, chartSignal: true },
    ...overrides,
  })
}

test('creates a CoinAnalysisRunDoc with 4 strategy cards', async () => {
  await setupUser()
  const runId = await runCoinAnalysis('user-ca', 'BTC', 'on_demand')

  const doc = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId: runId }).lean()
  expect(doc).not.toBeNull()
  expect(doc!.strategyCards).toHaveLength(4)
  expect(doc!.symbol).toBe('BTC')
  expect(doc!.triggeredBy).toBe('on_demand')
})

test('manual mode: cards with signals are pending, cards without are skipped', async () => {
  await setupUser({ requireManualApproval: true })
  const runId = await runCoinAnalysis('user-ca', 'BTC', 'on_demand')

  const doc = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId: runId }).lean()
  const smartMoney = doc!.strategyCards.find(c => c.framework === 'SmartMoney')!
  const wyckoff    = doc!.strategyCards.find(c => c.framework === 'Wyckoff')!

  expect(smartMoney.approvalStatus).toBe('pending')
  expect(wyckoff.approvalStatus).toBe('skipped')
  expect(doc!.status).toBe('pending_approval')
})

test('auto mode: executes the best signal and marks others skipped', async () => {
  await setupUser({ requireManualApproval: false })
  const runId = await runCoinAnalysis('user-ca', 'BTC', 'on_demand')

  const doc = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId: runId }).lean()
  const smartMoney = doc!.strategyCards.find(c => c.framework === 'SmartMoney')!

  expect(smartMoney.approvalStatus).toBe('auto_executed')
  expect(doc!.status).toBe('auto_executed')
})

test('each card has llmNarrative, newsImpact, and chartSnapshot', async () => {
  await setupUser()
  const runId = await runCoinAnalysis('user-ca', 'BTC', 'on_demand')

  const doc = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId: runId }).lean()
  const smartMoney = doc!.strategyCards.find(c => c.framework === 'SmartMoney')!

  expect(typeof smartMoney.llmNarrative).toBe('string')
  expect(smartMoney.llmNarrative.length).toBeGreaterThan(0)
  expect(smartMoney.newsImpact).toBeDefined()
  expect(smartMoney.chartSnapshot).not.toBeNull()
})

test('approveCard executes the trade and sets approvalStatus to approved', async () => {
  await setupUser({ requireManualApproval: true })
  const runId = await runCoinAnalysis('user-ca', 'BTC', 'on_demand')

  const result = await approveCard('user-ca', runId, 'SmartMoney')
  expect(result.status).toBe('pending_limit')

  const doc = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId: runId }).lean()
  const card = doc!.strategyCards.find(c => c.framework === 'SmartMoney')!
  expect(card.approvalStatus).toBe('approved')
})

test('rejectCard sets approvalStatus to rejected', async () => {
  await setupUser({ requireManualApproval: true })
  const runId = await runCoinAnalysis('user-ca', 'BTC', 'on_demand')

  await rejectCard('user-ca', runId, 'SmartMoney')

  const doc = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId: runId }).lean()
  const card = doc!.strategyCards.find(c => c.framework === 'SmartMoney')!
  expect(card.approvalStatus).toBe('rejected')
})

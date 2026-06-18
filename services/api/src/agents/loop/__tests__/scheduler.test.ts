import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'

// Mock the loop so we only test fan-out, not a full LLM tick.
const ticked: string[] = []
jest.mock('../agent.loop', () => ({
  runLoopTick: jest.fn(async (userId: string) => { ticked.push(userId) }),
}))
jest.mock('@/agents/coinAnalysis/coinAnalysis.runner', () => ({
  runCoinAnalysis: jest.fn(async (userId: string) => { ticked.push(`coin:${userId}`) }),
}))

import { runEnabledUserTicks } from '../scheduler'
import { AgentConfigDoc } from '../../../models/agentConfig.model'
import { DEFAULT_AGENT_CONFIG } from '../../../config/agent.config'

beforeAll(connectTestDb)
afterEach(async () => { ticked.length = 0; await clearTestDb() })
afterAll(disconnectTestDb)

test('runs a tick only for users whose config is enabled', async () => {
  await AgentConfigDoc.create({ userId: 'user-on',  ...DEFAULT_AGENT_CONFIG, enabled: true })
  await AgentConfigDoc.create({ userId: 'user-off', ...DEFAULT_AGENT_CONFIG, enabled: false })

  await runEnabledUserTicks()

  expect(ticked).toEqual(['user-on'])
})

test('one user failing does not stop other users ticking', async () => {
  const { runLoopTick } = require('../agent.loop') as { runLoopTick: jest.Mock }
  runLoopTick.mockImplementationOnce(async () => { throw new Error('boom') })

  await AgentConfigDoc.create({ userId: 'user-1', ...DEFAULT_AGENT_CONFIG, enabled: true })
  await AgentConfigDoc.create({ userId: 'user-2', ...DEFAULT_AGENT_CONFIG, enabled: true })

  await expect(runEnabledUserTicks()).resolves.not.toThrow()
})

test('routes chartSignal users to runCoinAnalysis, others to runLoopTick', async () => {
  await AgentConfigDoc.create({
    userId: 'user-chart', ...DEFAULT_AGENT_CONFIG, enabled: true,
    strategies: { yieldHunter: false, rebalance: false, airdropWatch: false, chartSignal: true },
    watchlist: ['BTC'],
  })
  await AgentConfigDoc.create({
    userId: 'user-yield', ...DEFAULT_AGENT_CONFIG, enabled: true,
    strategies: { yieldHunter: true, rebalance: false, airdropWatch: false, chartSignal: false },
  })

  await runEnabledUserTicks()

  expect(ticked).toContain('coin:user-chart')
  expect(ticked).toContain('user-yield')
  expect(ticked).not.toContain('user-chart')       // should NOT go through runLoopTick
  expect(ticked).not.toContain('coin:user-yield')  // should NOT go through runCoinAnalysis
})

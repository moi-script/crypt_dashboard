import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { AgentMemoryDoc } from '../agentMemory.model'
import { AgentReflectionDoc } from '../agentReflection.model'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('saves and retrieves an AgentMemoryEntry', async () => {
  const entry = await AgentMemoryDoc.create({
    agentId:     'user-1',
    runId:       'run-abc',
    timestamp:   new Date('2026-01-01'),
    coin:        'BTC',
    type:        'decision',
    summary:     'BTC trending up, SmartMoney long signal, confidence 80',
    fullContext: { price: 50000 },
    embedding:   new Array(1536).fill(0.1),
    marketRegime: 'trending_up',
    signals:     ['smartmoney_long'],
    tools:       ['chartSignal'],
  })
  expect(entry.runId).toBe('run-abc')
  expect(entry.embedding).toHaveLength(1536)
})

test('saves and retrieves an AgentReflection', async () => {
  const ref = await AgentReflectionDoc.create({
    agentId:  'user-1',
    period:   { start: new Date('2026-01-01'), end: new Date('2026-01-02') },
    coin:     'BTC',
    summary:  'Mostly profitable on trending days.',
    embedding: new Array(1536).fill(0.2),
    stats: { totalDecisions: 5, winRate: 0.8, avgPnlPercent: 2.1, bestPattern: 'wyckoff spring', worstPattern: 'harmonic in volatile' },
    lessonsLearned: ['Avoid harmonic patterns in high-volatility regime.'],
  })
  expect(ref.stats.winRate).toBe(0.8)
  expect(ref.lessonsLearned).toHaveLength(1)
})

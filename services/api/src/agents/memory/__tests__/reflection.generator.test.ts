import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'
import { AgentMemoryDoc }     from '../../../models/agentMemory.model'
import { AgentReflectionDoc } from '../../../models/agentReflection.model'
import { runReflection }      from '../reflection.generator'

jest.mock('../memory.embedder', () => ({
  embed: jest.fn(async () => new Array(1536).fill(0.2)),
}))

// Mock DeepSeek LLM call inside reflection.generator
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: 'BTC trending wins most.',
                lessonsLearned: ['Trade with trend.', 'Avoid ranging in low vol.'],
                bestPattern: 'trending_up long',
                worstPattern: 'ranging short',
              }),
            },
          }],
        })),
      },
    },
  }))
})

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

async function seedDecisions() {
  const base = {
    agentId: 'user-ref', coin: 'BTC', type: 'decision' as const,
    summary: 'BTC long', fullContext: {}, embedding: new Array(1536).fill(0),
    marketRegime: 'trending_up', signals: [], tools: [],
  }
  await AgentMemoryDoc.create({ ...base, runId: 'run-r1', timestamp: new Date(Date.now() - 3600_000) })
  await AgentMemoryDoc.create({ ...base, runId: 'run-r2', timestamp: new Date(Date.now() - 7200_000) })
  await AgentMemoryDoc.create({
    ...base, runId: 'run-r1-outcome', type: 'outcome',
    timestamp: new Date(), linkedDecisionId: 'fake-id',
    outcome: { pnl: 10, pnlPercent: 2, durationHeldMs: 3600000, closedAt: new Date(), success: true },
  })
}

test('runReflection creates an AgentReflection document', async () => {
  await seedDecisions()
  await runReflection('user-ref', 'BTC')
  const reflections = await AgentReflectionDoc.find({ agentId: 'user-ref' }).lean()
  expect(reflections).toHaveLength(1)
  expect(reflections[0].lessonsLearned.length).toBeGreaterThan(0)
  expect(reflections[0].coin).toBe('BTC')
})

test('runReflection is a no-op when there are no memory entries', async () => {
  await runReflection('user-ref', 'BTC')
  const reflections = await AgentReflectionDoc.find({}).lean()
  expect(reflections).toHaveLength(0)
})

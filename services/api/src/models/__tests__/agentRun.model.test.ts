import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { AgentRunDoc } from '../agentRun.model'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('agent run persists and filters by userId', async () => {
  await AgentRunDoc.create({ runId: 'run-a', userId: 'user-a', strategy: 'yieldHunter', mode: 'paper', startedAt: new Date(), status: 'running' })
  await AgentRunDoc.create({ runId: 'run-b', userId: 'user-b', strategy: 'yieldHunter', mode: 'paper', startedAt: new Date(), status: 'running' })

  const forA = await AgentRunDoc.find({ userId: 'user-a' }).lean()
  expect(forA).toHaveLength(1)
  expect(forA[0].runId).toBe('run-a')
})

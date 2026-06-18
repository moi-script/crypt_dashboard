import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'
import { saveMemory, findMemoryByRunId } from '../memory.store'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('saveMemory persists an entry and findMemoryByRunId retrieves it', async () => {
  await saveMemory({
    agentId: 'u1', runId: 'run-1', timestamp: new Date(), coin: 'BTC',
    type: 'decision', summary: 'test', fullContext: {},
    embedding: new Array(1536).fill(0), marketRegime: 'ranging', signals: [], tools: [],
  })
  const found = await findMemoryByRunId('run-1')
  expect(found).not.toBeNull()
  expect(found!.coin).toBe('BTC')
})

test('saveMemory fails gracefully with partial data by throwing a validation error', async () => {
  await expect(
    saveMemory({ agentId: '', runId: '', timestamp: new Date(), coin: '', type: 'decision',
      summary: '', fullContext: {}, embedding: [], marketRegime: '', signals: [], tools: [] })
  ).rejects.toThrow()
})

import '../../config/env'
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { listRuns, getConfig, updateConfig } from '../agentRun.controller'
import { AgentRunDoc } from '../../models/agentRun.model'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

function mockRes() {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

test('listRuns only returns the caller\'s runs', async () => {
  await AgentRunDoc.create({ runId: 'r-a', userId: 'user-a', strategy: 's', mode: 'paper', startedAt: new Date(), status: 'completed' })
  await AgentRunDoc.create({ runId: 'r-b', userId: 'user-b', strategy: 's', mode: 'paper', startedAt: new Date(), status: 'completed' })

  const req: any = { userId: 'user-a', query: {} }
  const res = mockRes()
  await listRuns(req, res, jest.fn())

  const payload = res.json.mock.calls[0][0]
  expect(payload.runs).toHaveLength(1)
  expect(payload.runs[0].runId).toBe('r-a')
})

test('getConfig seeds and returns the caller\'s config', async () => {
  const req: any = { userId: 'user-a' }
  const res = mockRes()
  await getConfig(req, res, jest.fn())
  const payload = res.json.mock.calls[0][0]
  expect(payload.config.enabled).toBe(false)
})

test('updateConfig enables only the caller', async () => {
  const req: any = { userId: 'user-a', body: { enabled: true } }
  const res = mockRes()
  await updateConfig(req, res, jest.fn())
  const payload = res.json.mock.calls[0][0]
  expect(payload.config.enabled).toBe(true)
})

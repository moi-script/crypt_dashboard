import '../../config/env'
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { listRuns, getConfig, updateConfig } from '../agentRun.controller'
import { AgentRunDoc } from '../../models/agentRun.model'

// Mock agent.loop so we don't need DB-backed wallet during controller tests
jest.mock('../../agents/loop/agent.loop', () => ({
  approveRun: jest.fn(async (userId: string, runId: string) => {
    if (userId !== 'user-a') throw Object.assign(new Error('not found'), { statusCode: 404 })
    return { status: 'pending_limit', executedAt: new Date() }
  }),
  rejectRun: jest.fn(async (userId: string, runId: string) => {
    if (userId !== 'user-a') throw Object.assign(new Error('not found'), { statusCode: 404 })
  }),
}))

import { listApprovals, approveRunCtrl, rejectRunCtrl } from '../agentRun.controller'

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

test('listApprovals returns only pending_approval runs for the caller', async () => {
  await AgentRunDoc.create({ runId: 'r-pend', userId: 'user-a', strategy: 'chartSignal', mode: 'paper', startedAt: new Date(), status: 'pending_approval' })
  await AgentRunDoc.create({ runId: 'r-done', userId: 'user-a', strategy: 'chartSignal', mode: 'paper', startedAt: new Date(), status: 'completed' })
  await AgentRunDoc.create({ runId: 'r-other', userId: 'user-b', strategy: 'chartSignal', mode: 'paper', startedAt: new Date(), status: 'pending_approval' })

  const req: any = { userId: 'user-a' }
  const res = mockRes()
  await listApprovals(req, res, jest.fn())

  const payload = res.json.mock.calls[0][0]
  expect(payload.approvals).toHaveLength(1)
  expect(payload.approvals[0].runId).toBe('r-pend')
})

test('approveRunCtrl calls approveRun and returns result', async () => {
  const req: any = { userId: 'user-a', params: { runId: 'run-x' } }
  const res = mockRes()
  await approveRunCtrl(req, res, jest.fn())

  const payload = res.json.mock.calls[0][0]
  expect(payload.status).toBe('pending_limit')
})

test('rejectRunCtrl calls rejectRun and returns 204', async () => {
  const req: any = { userId: 'user-a', params: { runId: 'run-x' } }
  const res = mockRes()
  res.sendStatus = jest.fn()
  await rejectRunCtrl(req, res, jest.fn())

  expect(res.sendStatus.mock.calls[0][0]).toBe(204)
})

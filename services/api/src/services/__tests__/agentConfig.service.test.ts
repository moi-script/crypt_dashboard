import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { getOrCreateConfig, patchConfig } from '../agentConfig.service'
import { AgentConfigDoc } from '../../models/agentConfig.model'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('seeds a disabled paper config on first access', async () => {
  const c = await getOrCreateConfig('user-a')
  expect(c.userId).toBe('user-a')
  expect(c.enabled).toBe(false)
  expect(c.mode).toBe('paper')
  expect(c.maxTradeUsd).toBe(100)
})

test('enable toggle is isolated per user', async () => {
  await getOrCreateConfig('user-a')
  await getOrCreateConfig('user-b')
  await patchConfig('user-a', { enabled: true })

  expect((await getOrCreateConfig('user-a')).enabled).toBe(true)
  expect((await getOrCreateConfig('user-b')).enabled).toBe(false)
})

test('mode is locked to paper even if a patch tries to change it', async () => {
  await getOrCreateConfig('user-a')
  await patchConfig('user-a', { mode: 'onchain' as any })
  expect((await getOrCreateConfig('user-a')).mode).toBe('paper')
})

test('requireManualApproval can be disabled in paper mode', async () => {
  await getOrCreateConfig('user-a')
  await patchConfig('user-a', { requireManualApproval: false })
  expect((await getOrCreateConfig('user-a')).requireManualApproval).toBe(false)
})

test('requireManualApproval cannot be disabled when mode is not paper', async () => {
  await getOrCreateConfig('user-a')
  // Reach into the doc directly to simulate a future phase where mode isn't paper —
  // patchConfig itself always strips mode from patches, so this is the only way
  // to exercise the guard today.
  await AgentConfigDoc.updateOne({ userId: 'user-a' }, { $set: { mode: 'cex' } })

  await expect(patchConfig('user-a', { requireManualApproval: false }))
    .rejects.toThrow('Cannot disable manual approval outside paper mode')
})

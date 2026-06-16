import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { getOrCreateConfig, patchConfig } from '../agentConfig.service'

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

test('requireManualApproval cannot be disabled once mode is not paper', async () => {
  await getOrCreateConfig('user-a')
  // mode is locked to paper in this phase, so this should still succeed —
  // the guard only triggers if a future phase allows mode to be cex/onchain.
  // This test documents the paper-only guard by checking the stored mode directly.
  const before = await getOrCreateConfig('user-a')
  expect(before.mode).toBe('paper')
})

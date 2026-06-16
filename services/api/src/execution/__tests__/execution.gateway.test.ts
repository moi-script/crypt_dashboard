import { executeIntent } from '../execution.gateway'
import { DEFAULT_AGENT_CONFIG } from '../../config/agent.config'
import type { ExecutionContext, WalletState } from '../../agents/loop/loop.types'

const wallet: WalletState = { mode: 'paper', balances: { USDC: 5000 }, openPositions: 0, totalValueUsd: 5000, dailyPnlUsd: 0 }
const ctx = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  userId: 'user-a', runId: 'run-a', strategy: 'yieldHunter', rationale: 'r', confidence: 50,
  config: { ...DEFAULT_AGENT_CONFIG, enabled: true }, ...overrides,
})

test('kill switch blocks when the user config is disabled', async () => {
  const res = await executeIntent(
    { type: 'no_action', rationale: 'x' },
    wallet,
    ctx({ config: { ...DEFAULT_AGENT_CONFIG, enabled: false } }),
  )
  expect(res.riskPassed).toBe(false)
  expect(res.execution.status).toBe('blocked_by_risk')
})

test('no_action passes through when enabled', async () => {
  const res = await executeIntent({ type: 'no_action', rationale: 'x' }, wallet, ctx())
  expect(res.riskPassed).toBe(true)
  expect(res.execution.status).toBe('filled')
})

test('trade is queued for manual approval when required', async () => {
  const res = await executeIntent(
    { type: 'propose_trade', tokenIn: 'USDC', tokenOut: 'ETH', amountUsd: 50, maxSlippageBps: 50, rationale: 'r' },
    wallet,
    ctx({ config: { ...DEFAULT_AGENT_CONFIG, enabled: true, requireManualApproval: true } }),
  )
  expect(res.pendingApproval).toBe(true)
  expect(res.execution.status).toBe('manual_approval_required')
})

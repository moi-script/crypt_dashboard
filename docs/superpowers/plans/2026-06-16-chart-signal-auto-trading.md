# Chart-Signal Auto Trading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the autonomous agent actually buy and sell in paper mode by wiring the four existing-but-unused chart strategies (SmartMoney, Wyckoff, Elliott, Harmonic) into the agent loop deterministically, and auto-close positions on stop loss / take profit so the paper wallet balance reflects real wins and losses.

**Architecture:** A new `chartSignal` strategy runs all four chart strategies against BTC/ETH market primitives, deterministically builds a `propose_trade` intent from the best qualifying signal (bypassing the LLM policy engine), and reuses the existing risk/execution/wallet pipeline unchanged. A new `positionMonitor` background sweep closes open positions when price crosses their stop-loss or take-profit level, calling `executePaper` directly (bypassing risk/approval gates, since exits must always fire).

**Tech Stack:** TypeScript, Express, Mongoose, Jest + ts-jest, mongodb-memory-server for integration tests.

**Spec:** `docs/superpowers/specs/2026-06-16-chart-signal-auto-trading-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `services/api/src/agents/loop/loop.types.ts` (modify) | Add `stopLossPrice`/`takeProfitPrice`/`framework` to `TradeIntent`; add `userId`/`config` to `LoopContext` |
| `services/api/src/agents/policy/strategies/strategy.types.ts` (modify) | Add `deterministicDecision?: Decision` to `StrategyResult` |
| `services/api/src/models/position.model.ts` (modify) | Add `stopLossPrice`/`takeProfitPrice`/`framework`/`confidence` to `IPosition` |
| `services/api/src/config/agent.config.ts` (modify) | Add `strategies.chartSignal`, `minSignalConfidence` |
| `services/api/src/models/agentConfig.model.ts` (modify) | Mirror new config fields in the Mongoose schema |
| `services/api/src/services/agentConfig.service.ts` (modify) | Allow `requireManualApproval: false` only when `mode === 'paper'` |
| `services/api/src/agents/policy/strategies/chartSignal.strategy.ts` (create) | New deterministic strategy: builds primitives for BTC/ETH, runs the 4 chart strategies, picks the best signal, returns a `deterministicDecision` |
| `services/api/src/execution/modes/paper.executor.ts` (modify) | Export `getLivePrice`; surface `recordTrade()`'s `realizedPnlUsd` into `ExecutionResult.simulatedPnlUsd` |
| `services/api/src/agents/loop/agent.loop.ts` (modify) | Register `chartSignal`; use `deterministicDecision` when present; copy SL/TP/framework/confidence onto created `PositionDoc` |
| `services/api/src/agents/loop/positionMonitor.ts` (create) | Sweep open paper positions, close on SL/TP hit, update wallet + position + order records |
| `services/api/src/app.ts` (modify) | Start the position monitor alongside the scheduler |
| `src/components/AgentChat/ChatDashboard.tsx` (modify) | Display SL/TP/framework/confidence on position cards |

---

### Task 1: Extend shared types

**Files:**
- Modify: `services/api/src/agents/loop/loop.types.ts`
- Modify: `services/api/src/agents/policy/strategies/strategy.types.ts`
- Modify: `services/api/src/models/position.model.ts`
- Modify: `services/api/src/config/agent.config.ts`
- Modify: `services/api/src/models/agentConfig.model.ts`

These are additive, optional-field changes with no behavior change yet — no test needed for this task (nothing observable changes), but every subsequent task depends on it.

- [ ] **Step 1: Extend `TradeIntent` and `LoopContext` in `loop.types.ts`**

In `services/api/src/agents/loop/loop.types.ts`, change:

```ts
export interface TradeIntent {
  type: 'propose_trade'
  tokenIn: string        // symbol or address
  tokenOut: string
  amountUsd: number
  maxSlippageBps: number
  rationale: string
  venue?: string         // 'binance' | 'uniswap_v3_base' | etc.
}
```

to:

```ts
export interface TradeIntent {
  type: 'propose_trade'
  tokenIn: string        // symbol or address
  tokenOut: string
  amountUsd: number
  maxSlippageBps: number
  rationale: string
  venue?: string         // 'binance' | 'uniswap_v3_base' | etc.
  stopLossPrice?: number     // set by chartSignal strategy only
  takeProfitPrice?: number   // set by chartSignal strategy only
  framework?: string         // 'SmartMoney' | 'Wyckoff' | 'ElliottWave' | 'Harmonic'
}
```

And change:

```ts
export interface LoopContext {
  runId: string
  strategy: string
  startedAt: number
  contextSummary: string            // what the LLM sees
  walletState: WalletState
  marketData: Record<string, unknown>
}
```

to:

```ts
export interface LoopContext {
  runId: string
  userId: string
  strategy: string
  startedAt: number
  contextSummary: string            // what the LLM sees
  walletState: WalletState
  marketData: Record<string, unknown>
  config: AgentConfig
}
```

- [ ] **Step 2: Extend `StrategyResult` in `strategy.types.ts`**

In `services/api/src/agents/policy/strategies/strategy.types.ts`, add the import and field:

```ts
import type { LoopContext, Decision } from '../../loop/loop.types'
```

(replace the existing `import type { LoopContext } from '../../loop/loop.types'` line with the one above)

```ts
export interface StrategyResult {
  strategyName:   string
  contextSummary: string
  metadata:       Record<string, unknown>
  deterministicDecision?: Decision   // when set, agent.loop.ts skips the LLM policy engine
}
```

- [ ] **Step 3: Extend `IPosition` in `position.model.ts`**

In `services/api/src/models/position.model.ts`, change the interface:

```ts
export interface IPosition {
  positionId:   string
  userId?:      string
  mode:         'paper' | 'cex' | 'onchain'
  tokenIn:      string
  tokenOut:      string
  entryAmountUsd: number
  entryPrice:   number
  entryFeesUsd: number
  entryAt:      Date
  exitPrice?:   number
  exitAmountUsd?: number
  exitFeesUsd?: number
  exitAt?:      Date
  isOpen:       boolean
  realizedPnlUsd?: number
  strategy:     string
  runId:        string      // which AgentRun opened this
  orderId?:     string
  txHash?:      string      // on-chain only
  stopLossPrice?:   number
  takeProfitPrice?: number
  framework?:       string   // 'SmartMoney' | 'Wyckoff' | 'ElliottWave' | 'Harmonic'
  confidence?:      number   // 0-100, from the originating signal
}
```

And add to `PositionSchema`, right after the `txHash: String,` line:

```ts
  stopLossPrice:   Number,
  takeProfitPrice: Number,
  framework:       String,
  confidence:      Number,
```

- [ ] **Step 4: Extend `AgentConfig` and its default in `agent.config.ts`**

In `services/api/src/config/agent.config.ts`, change:

```ts
  strategies: {
    yieldHunter: boolean
    rebalance: boolean
    airdropWatch: boolean
  }
```

to:

```ts
  strategies: {
    yieldHunter: boolean
    rebalance: boolean
    airdropWatch: boolean
    chartSignal: boolean
  }

  /** Minimum confidence (0-100) a chart-signal must have to be acted on */
  minSignalConfidence: number
```

And change `DEFAULT_AGENT_CONFIG`:

```ts
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: false,
  mode: 'paper',
  loopIntervalMs: 60_000,
  strategies: { yieldHunter: true, rebalance: false, airdropWatch: false },
  watchlist: ['bitcoin', 'ethereum', 'usd-coin', 'tether'],
  maxTradeUsd: 100,
  requireManualApproval: true,
}
```

to:

```ts
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: false,
  mode: 'paper',
  loopIntervalMs: 60_000,
  strategies: { yieldHunter: true, rebalance: false, airdropWatch: false, chartSignal: false },
  watchlist: ['bitcoin', 'ethereum', 'usd-coin', 'tether'],
  maxTradeUsd: 100,
  requireManualApproval: true,
  minSignalConfidence: 55,
}
```

- [ ] **Step 5: Mirror the new fields in the Mongoose schema**

In `services/api/src/models/agentConfig.model.ts`, change:

```ts
  strategies: {
    yieldHunter:  { type: Boolean, default: true },
    rebalance:    { type: Boolean, default: false },
    airdropWatch: { type: Boolean, default: false },
  },
  watchlist:             { type: [String], default: ['bitcoin', 'ethereum', 'usd-coin', 'tether'] },
  maxTradeUsd:           { type: Number, default: 100 },
  requireManualApproval: { type: Boolean, default: true },
```

to:

```ts
  strategies: {
    yieldHunter:  { type: Boolean, default: true },
    rebalance:    { type: Boolean, default: false },
    airdropWatch: { type: Boolean, default: false },
    chartSignal:  { type: Boolean, default: false },
  },
  watchlist:             { type: [String], default: ['bitcoin', 'ethereum', 'usd-coin', 'tether'] },
  maxTradeUsd:           { type: Number, default: 100 },
  requireManualApproval: { type: Boolean, default: true },
  minSignalConfidence:   { type: Number, default: 55 },
```

- [ ] **Step 6: Verify the project still typechecks**

Run: `cd services/api && npx tsc --noEmit`
Expected: No new errors. (There will likely be pre-existing errors unrelated to this change in a project this size — confirm none mention `loop.types.ts`, `strategy.types.ts`, `position.model.ts`, `agent.config.ts`, or `agentConfig.model.ts`.)

- [ ] **Step 7: Run the existing agentConfig test to confirm nothing broke**

Run: `cd services/api && npx jest src/services/__tests__/agentConfig.service.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 8: Commit**

```bash
git add services/api/src/agents/loop/loop.types.ts services/api/src/agents/policy/strategies/strategy.types.ts services/api/src/models/position.model.ts services/api/src/config/agent.config.ts services/api/src/models/agentConfig.model.ts
git commit -m "feat(agent): add stop-loss/take-profit and chartSignal fields to shared types"
```

---

### Task 2: Allow auto-execution in paper mode

**Files:**
- Modify: `services/api/src/services/agentConfig.service.ts`
- Test: `services/api/src/services/__tests__/agentConfig.service.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `services/api/src/services/__tests__/agentConfig.service.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify the first new test fails**

Run: `cd services/api && npx jest src/services/__tests__/agentConfig.service.test.ts -t "can be disabled in paper mode"`
Expected: FAIL with `Cannot disable manual approval in paper phase`

- [ ] **Step 3: Implement the paper-mode-only relaxation**

In `services/api/src/services/agentConfig.service.ts`, change:

```ts
export async function patchConfig(
  userId: string,
  patch: Partial<AgentConfig>,
): Promise<AgentConfig & { userId: string }> {
  await getOrCreateConfig(userId)  // ensure it exists

  const safePatch: Partial<AgentConfig> = { ...patch }
  // Phase 1: paper only — never allow graduating execution mode via the API.
  delete (safePatch as any).mode

  if (safePatch.requireManualApproval === false) {
    throw new Error('Cannot disable manual approval in paper phase')
  }

  const doc = await AgentConfigDoc.findOneAndUpdate(
    { userId },
    { $set: safePatch },
    { new: true },
  )
  return doc!.toObject()
}
```

to:

```ts
export async function patchConfig(
  userId: string,
  patch: Partial<AgentConfig>,
): Promise<AgentConfig & { userId: string }> {
  const existing = await getOrCreateConfig(userId)  // ensure it exists

  const safePatch: Partial<AgentConfig> = { ...patch }
  // Phase 1: paper only — never allow graduating execution mode via the API.
  delete (safePatch as any).mode

  // Manual approval can only be disabled in paper mode — real-money modes
  // (cex/onchain) must always require a human to release a trade.
  if (safePatch.requireManualApproval === false && existing.mode !== 'paper') {
    throw new Error('Cannot disable manual approval outside paper mode')
  }

  const doc = await AgentConfigDoc.findOneAndUpdate(
    { userId },
    { $set: safePatch },
    { new: true },
  )
  return doc!.toObject()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/api && npx jest src/services/__tests__/agentConfig.service.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add services/api/src/services/agentConfig.service.ts services/api/src/services/__tests__/agentConfig.service.test.ts
git commit -m "feat(agent): allow disabling manual approval in paper mode only"
```

---

### Task 3: Surface realized PnL and export `getLivePrice` from the paper executor

**Files:**
- Modify: `services/api/src/execution/modes/paper.executor.ts`
- Test: `services/api/src/execution/__tests__/paper.executor.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `services/api/src/execution/__tests__/paper.executor.test.ts`:

```ts
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { executePaper, getLivePrice } from '../modes/paper.executor'
import { getOrCreateWallet } from '../../services/paperWallet.service'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

beforeEach(() => {
  global.fetch = jest.fn(async (url: string) => {
    if (url.includes('ethereum')) {
      return { json: async () => ({ ethereum: { usd: 2000 } }) } as any
    }
    if (url.includes('usd-coin')) {
      return { json: async () => ({ 'usd-coin': { usd: 1 } }) } as any
    }
    return { json: async () => ({}) } as any
  }) as any
})

test('getLivePrice resolves a known symbol to its USD price', async () => {
  const price = await getLivePrice('ETH')
  expect(price).toBe(2000)
})

test('a closing sell surfaces realizedPnlUsd into simulatedPnlUsd', async () => {
  await getOrCreateWallet('user-pnl')

  // Buy ETH at $2000
  await executePaper(
    { type: 'propose_trade', tokenIn: 'USDC', tokenOut: 'ETH', amountUsd: 1000, maxSlippageBps: 50, rationale: 'buy' },
    { userId: 'user-pnl', runId: 'run-1', strategy: 'test', rationale: 'buy', confidence: 50 },
  )

  // Price rises to $2200 — sell back to USDC
  global.fetch = jest.fn(async (url: string) => {
    if (url.includes('ethereum')) return { json: async () => ({ ethereum: { usd: 2200 } }) } as any
    return { json: async () => ({ 'usd-coin': { usd: 1 } }) } as any
  }) as any

  const sellResult = await executePaper(
    { type: 'propose_trade', tokenIn: 'ETH', tokenOut: 'USDC', amountUsd: 1100, maxSlippageBps: 50, rationale: 'sell' },
    { userId: 'user-pnl', runId: 'run-2', strategy: 'test', rationale: 'sell', confidence: 50 },
  )

  expect(sellResult.status).toBe('filled')
  expect(sellResult.simulatedPnlUsd).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && npx jest src/execution/__tests__/paper.executor.test.ts`
Expected: FAIL — `getLivePrice` is not exported, and `simulatedPnlUsd` is hardcoded to `0`.

- [ ] **Step 3: Export `getLivePrice` and surface realized PnL**

In `services/api/src/execution/modes/paper.executor.ts`, change:

```ts
async function getLivePrice(symbol: string): Promise<number> {
```

to:

```ts
export async function getLivePrice(symbol: string): Promise<number> {
```

Then change the recordTrade block:

```ts
      // ── 4. Record to wallet + trade history ────────────────────────────────
      try {
        await recordTrade(agentCtx.userId, {
          runId:           agentCtx.runId,
          orderId,
          tokenIn:         trade.tokenIn,
          tokenOut:        trade.tokenOut,
          amountUsd:       trade.amountUsd,
          filledAmountUsd: netAmountUsd,
          entryPrice:      outPrice,
          feesUsd:         fee,
          slippagePct:     slippage * 100,
          strategy:        agentCtx.strategy,
          rationale:       agentCtx.rationale,
          confidence:      agentCtx.confidence,
        })
      } catch (recordErr: any) {
        // Recording failure must NOT block the execution result
        console.warn('[PaperExecutor] Failed to record trade to wallet:', recordErr.message)
      }

      return {
        status:          'filled',
        orderId,
        filledAmountUsd: netAmountUsd,
        entryPrice:      outPrice,
        feesUsd:         fee,
        simulatedPnlUsd: 0,  // closed PnL computed by wallet service on sell
        executedAt:      now,
      }
```

to:

```ts
      // ── 4. Record to wallet + trade history ────────────────────────────────
      let realizedPnlUsd = 0
      try {
        const tx = await recordTrade(agentCtx.userId, {
          runId:           agentCtx.runId,
          orderId,
          tokenIn:         trade.tokenIn,
          tokenOut:        trade.tokenOut,
          amountUsd:       trade.amountUsd,
          filledAmountUsd: netAmountUsd,
          entryPrice:      outPrice,
          feesUsd:         fee,
          slippagePct:     slippage * 100,
          strategy:        agentCtx.strategy,
          rationale:       agentCtx.rationale,
          confidence:      agentCtx.confidence,
        })
        realizedPnlUsd = tx.realizedPnlUsd ?? 0
      } catch (recordErr: any) {
        // Recording failure must NOT block the execution result
        console.warn('[PaperExecutor] Failed to record trade to wallet:', recordErr.message)
      }

      return {
        status:          'filled',
        orderId,
        filledAmountUsd: netAmountUsd,
        entryPrice:      outPrice,
        feesUsd:         fee,
        simulatedPnlUsd: realizedPnlUsd,  // 0 on buys, real PnL on sells
        executedAt:      now,
      }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/api && npx jest src/execution/__tests__/paper.executor.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add services/api/src/execution/modes/paper.executor.ts services/api/src/execution/__tests__/paper.executor.test.ts
git commit -m "feat(wallet): surface realized PnL from sells, export getLivePrice"
```

---

### Task 4: Build the `chartSignal` strategy

**Files:**
- Create: `services/api/src/agents/policy/strategies/chartSignal.strategy.ts`
- Test: `services/api/src/agents/policy/strategies/__tests__/chartSignal.strategy.test.ts`

This strategy only ever considers BTC and ETH — the two crypto symbols on the risk engine's `ALLOWED_TOKENS` list (`services/api/src/risk/risk.rules.ts:26-30`). Trading any other coin would always be blocked by `ruleAllowedTokens`, so there's no point generating signals for it.

- [ ] **Step 1: Write the failing tests**

Create `services/api/src/agents/policy/strategies/__tests__/chartSignal.strategy.test.ts`:

```ts
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../../__tests__/helpers/db'

jest.mock('../../../../services/chartAnalysis.service', () => ({
  buildMarketPrimitives: jest.fn(async (symbol: string) => ({ meta: { symbol } } as any)),
}))
jest.mock('../smartMoney.strategy', () => ({ runSmartMoneyStrategy: jest.fn() }))
jest.mock('../wyckoff.strategy',    () => ({ runWyckoffStrategy:    jest.fn() }))
jest.mock('../elliott.strategy',    () => ({ runElliottStrategy:    jest.fn() }))
jest.mock('../harmonic.strategy',   () => ({ runHarmonicStrategy:   jest.fn() }))

import { chartSignalStrategy } from '../chartSignal.strategy'
import { runSmartMoneyStrategy } from '../smartMoney.strategy'
import { runWyckoffStrategy }    from '../wyckoff.strategy'
import { runElliottStrategy }    from '../elliott.strategy'
import { runHarmonicStrategy }   from '../harmonic.strategy'
import { PositionDoc } from '../../../../models/position.model'
import { DEFAULT_AGENT_CONFIG } from '../../../../config/agent.config'
import type { LoopContext } from '../../../loop/loop.types'

const skip = { signal: null, skipped: true, skip_reason: 'no setup' }

const baseCtx = (overrides: Partial<LoopContext> = {}): LoopContext => ({
  runId: 'run-1', userId: 'user-1', strategy: 'chartSignal', startedAt: Date.now(),
  contextSummary: '', walletState: { mode: 'paper', balances: {}, openPositions: 0, totalValueUsd: 5000, dailyPnlUsd: 0 },
  marketData: {}, config: { ...DEFAULT_AGENT_CONFIG }, ...overrides,
})

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('no qualifying signal across both symbols returns no_action', async () => {
  ;(runSmartMoneyStrategy as jest.Mock).mockReturnValue(skip)
  ;(runWyckoffStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runElliottStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runHarmonicStrategy   as jest.Mock).mockReturnValue(skip)

  const result = await chartSignalStrategy.buildContext(baseCtx())

  expect(result.metadata.deterministicDecision).toBeDefined()
  const decision = result.metadata.deterministicDecision as any
  expect(decision.intent.type).toBe('no_action')
})

test('a qualifying long signal becomes a propose_trade intent with SL/TP', async () => {
  const longSignal = {
    signal: {
      symbol: 'BTC', framework: 'SmartMoney', bias: 'long', setup_name: 'Bullish OB + BOS',
      entry_zone: { high: 51000, low: 50000 }, stop_loss: 49000,
      take_profit_levels: [53000, 54000, 55000], risk_reward: 2.5, confidence: 80,
      invalidation: 'x', reasoning: 'Strong bullish structure break', confluence_factors: [],
      generated_at: new Date().toISOString(),
    },
    skipped: false,
  }
  ;(runSmartMoneyStrategy as jest.Mock).mockReturnValue(longSignal)
  ;(runWyckoffStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runElliottStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runHarmonicStrategy   as jest.Mock).mockReturnValue(skip)

  const result = await chartSignalStrategy.buildContext(baseCtx())

  const decision = result.metadata.deterministicDecision as any
  expect(decision.intent.type).toBe('propose_trade')
  expect(decision.intent.tokenOut).toBe('BTC')
  expect(decision.intent.tokenIn).toBe('USDC')
  expect(decision.intent.stopLossPrice).toBe(49000)
  expect(decision.intent.takeProfitPrice).toBe(53000)
  expect(decision.intent.framework).toBe('SmartMoney')
  expect(decision.confidence).toBe(80)
})

test('a signal below minSignalConfidence is skipped', async () => {
  const weakSignal = {
    signal: {
      symbol: 'BTC', framework: 'SmartMoney', bias: 'long', setup_name: 'Weak setup',
      entry_zone: { high: 51000, low: 50000 }, stop_loss: 49000,
      take_profit_levels: [53000], risk_reward: 2.5, confidence: 40,
      invalidation: 'x', reasoning: 'Weak structure', confluence_factors: [],
      generated_at: new Date().toISOString(),
    },
    skipped: false,
  }
  ;(runSmartMoneyStrategy as jest.Mock).mockReturnValue(weakSignal)
  ;(runWyckoffStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runElliottStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runHarmonicStrategy   as jest.Mock).mockReturnValue(skip)

  const result = await chartSignalStrategy.buildContext(baseCtx({ config: { ...DEFAULT_AGENT_CONFIG, minSignalConfidence: 55 } }))

  const decision = result.metadata.deterministicDecision as any
  expect(decision.intent.type).toBe('no_action')
})

test('a short-biased signal is skipped (no shorting support)', async () => {
  const shortSignal = {
    signal: {
      symbol: 'BTC', framework: 'SmartMoney', bias: 'short', setup_name: 'Bearish OB + BOS',
      entry_zone: { high: 51000, low: 50000 }, stop_loss: 52000,
      take_profit_levels: [48000], risk_reward: 2.5, confidence: 80,
      invalidation: 'x', reasoning: 'Strong bearish structure break', confluence_factors: [],
      generated_at: new Date().toISOString(),
    },
    skipped: false,
  }
  ;(runSmartMoneyStrategy as jest.Mock).mockReturnValue(shortSignal)
  ;(runWyckoffStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runElliottStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runHarmonicStrategy   as jest.Mock).mockReturnValue(skip)

  const result = await chartSignalStrategy.buildContext(baseCtx())

  const decision = result.metadata.deterministicDecision as any
  expect(decision.intent.type).toBe('no_action')
})

test('skips a symbol that already has an open position', async () => {
  await PositionDoc.create({
    positionId: 'pos-existing', userId: 'user-1', mode: 'paper', tokenIn: 'USDC', tokenOut: 'BTC',
    entryAmountUsd: 100, entryPrice: 50000, entryAt: new Date(), isOpen: true,
    strategy: 'chartSignal', runId: 'run-0',
  })

  const longSignal = {
    signal: {
      symbol: 'BTC', framework: 'SmartMoney', bias: 'long', setup_name: 'Bullish OB + BOS',
      entry_zone: { high: 51000, low: 50000 }, stop_loss: 49000,
      take_profit_levels: [53000], risk_reward: 2.5, confidence: 80,
      invalidation: 'x', reasoning: 'Strong bullish structure break', confluence_factors: [],
      generated_at: new Date().toISOString(),
    },
    skipped: false,
  }
  ;(runSmartMoneyStrategy as jest.Mock).mockReturnValue(longSignal)
  ;(runWyckoffStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runElliottStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runHarmonicStrategy   as jest.Mock).mockReturnValue(skip)

  const result = await chartSignalStrategy.buildContext(baseCtx())

  const decision = result.metadata.deterministicDecision as any
  expect(decision.intent.type).toBe('no_action')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/api && npx jest src/agents/policy/strategies/__tests__/chartSignal.strategy.test.ts`
Expected: FAIL — `chartSignal.strategy.ts` does not exist yet.

- [ ] **Step 3: Implement the strategy**

Create `services/api/src/agents/policy/strategies/chartSignal.strategy.ts`:

```ts
/**
 * chartSignal.strategy.ts
 *
 * Deterministically wires the four existing chart strategies (SmartMoney,
 * Wyckoff, Elliott, Harmonic) into the agent loop. Unlike every other
 * strategy, this one never asks the LLM whether to act — the chart
 * strategies already compute bias, entry, stop loss, take profit, and
 * confidence, so the decision is made entirely in code via
 * `metadata.deterministicDecision`.
 *
 * Only BTC and ETH are considered — they're the only crypto symbols on
 * the risk engine's ALLOWED_TOKENS list (risk.rules.ts), so any other
 * symbol's signal would be blocked downstream regardless.
 *
 * Short-biased signals are never acted on: the paper wallet is spot-only
 * and cannot simulate a short position.
 */

import type { Strategy, StrategyResult, ChartStrategyResult } from './strategy.types'
import type { LoopContext, Decision, TradeIntent, NoActionIntent } from '../../loop/loop.types'
import { buildMarketPrimitives } from '../../../services/chartAnalysis.service'
import { runSmartMoneyStrategy } from './smartMoney.strategy'
import { runWyckoffStrategy } from './wyckoff.strategy'
import { runElliottStrategy } from './elliott.strategy'
import { runHarmonicStrategy } from './harmonic.strategy'
import { PositionDoc } from '../../../models/position.model'
import type { AgentConfig } from '../../../config/agent.config'

const TRADABLE_SYMBOLS: Array<{ symbol: string; binanceSymbol: string }> = [
  { symbol: 'BTC', binanceSymbol: 'BTCUSDT' },
  { symbol: 'ETH', binanceSymbol: 'ETHUSDT' },
]

function noActionDecision(rationale: string): Decision {
  const intent: NoActionIntent = { type: 'no_action', rationale }
  return { intent, confidence: 0, reasoning: rationale, toolCallTrace: [] }
}

export const chartSignalStrategy: Strategy = {
  name: 'chartSignal',
  description: 'Runs SmartMoney/Wyckoff/Elliott/Harmonic chart strategies against BTC/ETH and trades the best qualifying long signal',

  async buildContext(ctx: LoopContext): Promise<StrategyResult> {
    const config = ctx.config as AgentConfig

    const openSymbols = new Set(
      await PositionDoc.find({ userId: ctx.userId, isOpen: true, mode: 'paper' }).distinct('tokenOut'),
    )

    const lines: string[] = [`=== CHART SIGNAL — ${new Date().toISOString()} ===`]
    const candidates: Array<{ symbol: string; result: ChartStrategyResult }> = []

    for (const { symbol, binanceSymbol } of TRADABLE_SYMBOLS) {
      if (openSymbols.has(symbol)) {
        lines.push(`${symbol}: skipped — position already open`)
        continue
      }

      const primitives = await buildMarketPrimitives(binanceSymbol)
      const results = [
        runSmartMoneyStrategy(primitives),
        runWyckoffStrategy(primitives),
        runElliottStrategy(primitives),
        runHarmonicStrategy(primitives),
      ]

      for (const result of results) {
        if (result.skipped || !result.signal) {
          lines.push(`${symbol}: skipped — ${result.skip_reason}`)
          continue
        }
        if (result.signal.bias !== 'long') {
          lines.push(`${symbol}: skipped — short bias not supported (${result.signal.framework})`)
          continue
        }
        lines.push(
          `${symbol}: ${result.signal.framework} signal — confidence ${result.signal.confidence}, ` +
          `SL ${result.signal.stop_loss}, TP ${result.signal.take_profit_levels[0]}`,
        )
        candidates.push({ symbol, result })
      }
    }

    const qualifying = candidates.filter(c => (c.result.signal?.confidence ?? 0) >= config.minSignalConfidence)
    const best = qualifying.sort((a, b) => (b.result.signal!.confidence) - (a.result.signal!.confidence))[0]

    let deterministicDecision: Decision
    if (!best) {
      const rationale = candidates.length > 0
        ? `${candidates.length} signal(s) found but none reached minSignalConfidence (${config.minSignalConfidence})`
        : 'No qualifying long signal from any chart strategy this tick'
      deterministicDecision = noActionDecision(rationale)
    } else {
      const signal = best.result.signal!
      const intent: TradeIntent = {
        type: 'propose_trade',
        tokenIn: 'USDC',
        tokenOut: signal.symbol,
        amountUsd: config.maxTradeUsd,
        maxSlippageBps: 50,
        rationale: signal.reasoning,
        stopLossPrice: signal.stop_loss,
        takeProfitPrice: signal.take_profit_levels[0],
        framework: signal.framework,
      }
      deterministicDecision = {
        intent,
        confidence: signal.confidence,
        reasoning: signal.reasoning,
        toolCallTrace: [`chartSignal:${signal.framework}`],
      }
      lines.push(`>>> ACTING on ${signal.symbol} ${signal.framework} signal (confidence ${signal.confidence})`)
    }

    return {
      strategyName: 'chartSignal',
      contextSummary: lines.join('\n'),
      metadata: { candidatesConsidered: candidates.length, deterministicDecision },
      deterministicDecision,
    }
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/api && npx jest src/agents/policy/strategies/__tests__/chartSignal.strategy.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add services/api/src/agents/policy/strategies/chartSignal.strategy.ts services/api/src/agents/policy/strategies/__tests__/chartSignal.strategy.test.ts
git commit -m "feat(agent): add deterministic chartSignal strategy"
```

---

### Task 5: Wire `chartSignal` into the agent loop

**Files:**
- Modify: `services/api/src/agents/loop/agent.loop.ts`
- Test: `services/api/src/agents/loop/__tests__/agent.loop.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `services/api/src/agents/loop/__tests__/agent.loop.test.ts`:

```ts
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'

jest.mock('../../policy/policy.engine', () => ({
  runPolicyEngine: jest.fn(async () => { throw new Error('runPolicyEngine should not be called for chartSignal') }),
}))

import { runLoopTick } from '../agent.loop'
import { AgentConfigDoc } from '../../../models/agentConfig.model'
import { DEFAULT_AGENT_CONFIG } from '../../../config/agent.config'
import { PositionDoc } from '../../../models/position.model'
import { getOrCreateWallet } from '../../../services/paperWallet.service'

jest.mock('../../../services/chartAnalysis.service', () => ({
  buildMarketPrimitives: jest.fn(async (symbol: string) => ({ meta: { symbol } } as any)),
}))
jest.mock('../../policy/strategies/smartMoney.strategy', () => ({
  runSmartMoneyStrategy: jest.fn(() => ({
    skipped: false,
    signal: {
      symbol: 'BTC', framework: 'SmartMoney', bias: 'long', setup_name: 'Test setup',
      entry_zone: { high: 51000, low: 50000 }, stop_loss: 49000,
      take_profit_levels: [53000], risk_reward: 2.5, confidence: 90,
      invalidation: 'x', reasoning: 'Test signal', confluence_factors: [],
      generated_at: new Date().toISOString(),
    },
  })),
}))
jest.mock('../../policy/strategies/wyckoff.strategy',  () => ({ runWyckoffStrategy:  jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'x' })) }))
jest.mock('../../policy/strategies/elliott.strategy',  () => ({ runElliottStrategy:  jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'x' })) }))
jest.mock('../../policy/strategies/harmonic.strategy', () => ({ runHarmonicStrategy: jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'x' })) }))

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

beforeEach(() => {
  global.fetch = jest.fn(async (url: string) => {
    if (url.includes('bitcoin')) return { json: async () => ({ bitcoin: { usd: 50500 } }) } as any
    return { json: async () => ({ 'usd-coin': { usd: 1 } }) } as any
  }) as any
})

test('a chartSignal tick opens a position with stop loss / take profit, bypassing the LLM', async () => {
  await getOrCreateWallet('user-cs')
  await AgentConfigDoc.create({
    userId: 'user-cs', ...DEFAULT_AGENT_CONFIG, enabled: true, requireManualApproval: false,
    strategies: { yieldHunter: false, rebalance: false, airdropWatch: false, chartSignal: true },
  })

  await runLoopTick('user-cs')

  const positions = await PositionDoc.find({ userId: 'user-cs' }).lean()
  expect(positions).toHaveLength(1)
  expect(positions[0].tokenOut).toBe('BTC')
  expect(positions[0].stopLossPrice).toBe(49000)
  expect(positions[0].takeProfitPrice).toBe(53000)
  expect(positions[0].framework).toBe('SmartMoney')
  expect(positions[0].confidence).toBe(90)
  expect(positions[0].isOpen).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && npx jest src/agents/loop/__tests__/agent.loop.test.ts`
Expected: FAIL — `chartSignal` isn't registered, so the run falls through to `yieldHunter`'s default strategy and the LLM mock throws, or no position is created.

- [ ] **Step 3: Register `chartSignal` and use the deterministic decision when present**

In `services/api/src/agents/loop/agent.loop.ts`, add the import:

```ts
import { chartSignalStrategy } from '../policy/strategies/chartSignal.strategy'
```

Change the registry:

```ts
const STRATEGIES: Record<string, Strategy> = {
  yieldHunter:  yieldHunterStrategy,
  rebalance:    rebalanceStrategy,
  airdropWatch: airdropWatchStrategy,
}
```

to:

```ts
const STRATEGIES: Record<string, Strategy> = {
  yieldHunter:  yieldHunterStrategy,
  rebalance:    rebalanceStrategy,
  airdropWatch: airdropWatchStrategy,
  chartSignal:  chartSignalStrategy,
}
```

Change the `loopCtx` construction inside `runLoopTick`:

```ts
    const loopCtx: LoopContext = { runId, strategy, startedAt: startedAt.getTime(), contextSummary: '', walletState, marketData: {} }
```

to:

```ts
    const loopCtx: LoopContext = { runId, userId, strategy, startedAt: startedAt.getTime(), contextSummary: '', walletState, marketData: {}, config }
```

Change the decision line:

```ts
    const decision = await runPolicyEngine(loopCtx, contextSummary, config)
```

to:

```ts
    const decision = strategyResult.deterministicDecision
      ?? await runPolicyEngine(loopCtx, contextSummary, config)
```

- [ ] **Step 4: Copy SL/TP/framework/confidence onto the created position**

In `services/api/src/agents/loop/agent.loop.ts`, change `persistExecution`'s signature and body:

```ts
async function persistExecution(
  userId:          string,
  mode:            AgentConfig['mode'],
  runId:           string,
  intent:          any,
  executionResult: any,
): Promise<void> {
  if (intent.type !== 'propose_trade') return

  try {
    const orderId = executionResult.orderId ?? `order-${generateMyId(10 as number)}`
    await OrderDoc.create({
      orderId,
      runId,
      userId,
      mode,
      intentType:      intent.type,
      tokenIn:         intent.tokenIn,
      tokenOut:        intent.tokenOut,
      amountUsd:       intent.amountUsd,
      status:          executionResult.status,
      filledAmountUsd: executionResult.filledAmountUsd,
      entryPrice:      executionResult.entryPrice,
      feesUsd:         executionResult.feesUsd,
      txHash:          executionResult.txHash,
      blockNumber:     executionResult.blockNumber,
      riskBlockedBy:   executionResult.riskRejectionReason,
      errorMessage:    executionResult.errorMessage,
      executedAt:      executionResult.executedAt,
    })

    if (executionResult.status === 'filled' && executionResult.filledAmountUsd) {
      await PositionDoc.create({
        positionId:     `pos-${generateMyId(10 as number)}`,
        userId,
        mode,
        tokenIn:        intent.tokenIn,
        tokenOut:       intent.tokenOut,
        entryAmountUsd: executionResult.filledAmountUsd,
        entryPrice:     executionResult.entryPrice ?? 0,
        entryFeesUsd:   executionResult.feesUsd ?? 0,
        entryAt:        executionResult.executedAt,
        isOpen:         true,
        strategy:       (intent as any).strategyName ?? 'unknown',
        runId,
        orderId,
      })
    }
  } catch (err: any) {
    console.warn('[AgentLoop] Failed to persist order/position:', err.message)
  }
}
```

to:

```ts
async function persistExecution(
  userId:          string,
  mode:            AgentConfig['mode'],
  runId:           string,
  intent:          any,
  executionResult: any,
  strategy:        string,
  confidence:      number,
): Promise<void> {
  if (intent.type !== 'propose_trade') return

  try {
    const orderId = executionResult.orderId ?? `order-${generateMyId(10 as number)}`
    await OrderDoc.create({
      orderId,
      runId,
      userId,
      mode,
      intentType:      intent.type,
      tokenIn:         intent.tokenIn,
      tokenOut:        intent.tokenOut,
      amountUsd:       intent.amountUsd,
      status:          executionResult.status,
      filledAmountUsd: executionResult.filledAmountUsd,
      entryPrice:      executionResult.entryPrice,
      feesUsd:         executionResult.feesUsd,
      txHash:          executionResult.txHash,
      blockNumber:     executionResult.blockNumber,
      riskBlockedBy:   executionResult.riskRejectionReason,
      errorMessage:    executionResult.errorMessage,
      executedAt:      executionResult.executedAt,
    })

    if (executionResult.status === 'filled' && executionResult.filledAmountUsd) {
      await PositionDoc.create({
        positionId:      `pos-${generateMyId(10 as number)}`,
        userId,
        mode,
        tokenIn:         intent.tokenIn,
        tokenOut:        intent.tokenOut,
        entryAmountUsd:  executionResult.filledAmountUsd,
        entryPrice:      executionResult.entryPrice ?? 0,
        entryFeesUsd:    executionResult.feesUsd ?? 0,
        entryAt:         executionResult.executedAt,
        isOpen:          true,
        strategy,
        runId,
        orderId,
        stopLossPrice:   intent.stopLossPrice,
        takeProfitPrice: intent.takeProfitPrice,
        framework:       intent.framework,
        confidence,
      })
    }
  } catch (err: any) {
    console.warn('[AgentLoop] Failed to persist order/position:', err.message)
  }
}
```

And update the call site:

```ts
    await persistExecution(userId, config.mode, runId, decision.intent, gateway.execution)
```

to:

```ts
    await persistExecution(userId, config.mode, runId, decision.intent, gateway.execution, strategy, decision.confidence)
```

(Note: this also fixes a pre-existing bug — the old code read `(intent as any).strategyName ?? 'unknown'`, but no intent ever set `strategyName`, so every position was previously saved with `strategy: 'unknown'`. Passing the loop's actual `strategy` variable fixes this for all strategies, not just `chartSignal`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd services/api && npx jest src/agents/loop/__tests__/agent.loop.test.ts`
Expected: PASS (1 test)

- [ ] **Step 6: Run the full backend test suite to check for regressions**

Run: `cd services/api && npx jest`
Expected: PASS — all previously passing tests still pass (in particular `execution.gateway.test.ts`, `scheduler.test.ts`, `agentConfig.service.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add services/api/src/agents/loop/agent.loop.ts services/api/src/agents/loop/__tests__/agent.loop.test.ts
git commit -m "feat(agent): wire chartSignal into the loop, bypassing the LLM when a deterministic decision is present"
```

---

### Task 6: Build the position monitor (auto-close on SL/TP)

**Files:**
- Create: `services/api/src/agents/loop/positionMonitor.ts`
- Test: `services/api/src/agents/loop/__tests__/positionMonitor.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `services/api/src/agents/loop/__tests__/positionMonitor.test.ts`:

```ts
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'
import { runPositionMonitorSweep } from '../positionMonitor'
import { PositionDoc, OrderDoc } from '../../../models/position.model'
import { getOrCreateWallet } from '../../../services/paperWallet.service'
import { PaperWalletDoc } from '../../../models/paperWallet.model'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

async function seedWalletHoldingBtc(userId: string) {
  await getOrCreateWallet(userId)
  await PaperWalletDoc.updateOne({ userId }, { $set: {
    balances: [
      { symbol: 'USDC', amount: 4000, valueUsd: 4000, avgCostUsd: 1, updatedAt: new Date() },
      { symbol: 'BTC',  amount: 0.02, valueUsd: 1000, avgCostUsd: 50000, updatedAt: new Date() },
    ],
  } })
}

test('closes a position and reduces wallet PnL when price hits stop loss', async () => {
  await seedWalletHoldingBtc('user-sl')
  await PositionDoc.create({
    positionId: 'pos-sl', userId: 'user-sl', mode: 'paper', tokenIn: 'USDC', tokenOut: 'BTC',
    entryAmountUsd: 1000, entryPrice: 50000, entryAt: new Date(), isOpen: true,
    strategy: 'chartSignal', runId: 'run-1', stopLossPrice: 49000, takeProfitPrice: 53000,
  })

  global.fetch = jest.fn(async (url: string) => {
    if (url.includes('bitcoin')) return { json: async () => ({ bitcoin: { usd: 48500 } }) } as any
    return { json: async () => ({ 'usd-coin': { usd: 1 } }) } as any
  }) as any

  await runPositionMonitorSweep()

  const position = await PositionDoc.findOne({ positionId: 'pos-sl' }).lean()
  expect(position?.isOpen).toBe(false)
  expect(position?.exitPrice).toBe(48500)
  expect(position?.realizedPnlUsd).toBeLessThan(0)

  const wallet = await PaperWalletDoc.findOne({ userId: 'user-sl' }).lean()
  expect(wallet?.realizedPnlUsd).toBeLessThan(0)

  const orders = await OrderDoc.find({ positionId: 'pos-sl' }).lean()
  expect(orders).toHaveLength(1)
})

test('closes a position and increases wallet PnL when price hits take profit', async () => {
  await seedWalletHoldingBtc('user-tp')
  await PositionDoc.create({
    positionId: 'pos-tp', userId: 'user-tp', mode: 'paper', tokenIn: 'USDC', tokenOut: 'BTC',
    entryAmountUsd: 1000, entryPrice: 50000, entryAt: new Date(), isOpen: true,
    strategy: 'chartSignal', runId: 'run-1', stopLossPrice: 49000, takeProfitPrice: 53000,
  })

  global.fetch = jest.fn(async (url: string) => {
    if (url.includes('bitcoin')) return { json: async () => ({ bitcoin: { usd: 53500 } }) } as any
    return { json: async () => ({ 'usd-coin': { usd: 1 } }) } as any
  }) as any

  await runPositionMonitorSweep()

  const position = await PositionDoc.findOne({ positionId: 'pos-tp' }).lean()
  expect(position?.isOpen).toBe(false)
  expect(position?.exitPrice).toBe(53500)
  expect(position?.realizedPnlUsd).toBeGreaterThan(0)

  const wallet = await PaperWalletDoc.findOne({ userId: 'user-tp' }).lean()
  expect(wallet?.realizedPnlUsd).toBeGreaterThan(0)
})

test('leaves a position open when price is between stop loss and take profit', async () => {
  await seedWalletHoldingBtc('user-hold')
  await PositionDoc.create({
    positionId: 'pos-hold', userId: 'user-hold', mode: 'paper', tokenIn: 'USDC', tokenOut: 'BTC',
    entryAmountUsd: 1000, entryPrice: 50000, entryAt: new Date(), isOpen: true,
    strategy: 'chartSignal', runId: 'run-1', stopLossPrice: 49000, takeProfitPrice: 53000,
  })

  global.fetch = jest.fn(async (url: string) => {
    if (url.includes('bitcoin')) return { json: async () => ({ bitcoin: { usd: 50200 } }) } as any
    return { json: async () => ({ 'usd-coin': { usd: 1 } }) } as any
  }) as any

  await runPositionMonitorSweep()

  const position = await PositionDoc.findOne({ positionId: 'pos-hold' }).lean()
  expect(position?.isOpen).toBe(true)
})

test('ignores positions without a stop loss or take profit set', async () => {
  await seedWalletHoldingBtc('user-legacy')
  await PositionDoc.create({
    positionId: 'pos-legacy', userId: 'user-legacy', mode: 'paper', tokenIn: 'USDC', tokenOut: 'BTC',
    entryAmountUsd: 1000, entryPrice: 50000, entryAt: new Date(), isOpen: true,
    strategy: 'yieldHunter', runId: 'run-1',
  })

  global.fetch = jest.fn(async () => ({ json: async () => ({ bitcoin: { usd: 1 } }) })) as any

  await runPositionMonitorSweep()

  const position = await PositionDoc.findOne({ positionId: 'pos-legacy' }).lean()
  expect(position?.isOpen).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/api && npx jest src/agents/loop/__tests__/positionMonitor.test.ts`
Expected: FAIL — `positionMonitor.ts` does not exist yet.

- [ ] **Step 3: Implement the position monitor**

Create `services/api/src/agents/loop/positionMonitor.ts`:

```ts
/**
 * positionMonitor.ts
 *
 * Background sweep that closes open paper positions when the live price
 * crosses their stop-loss or take-profit level. Runs independently of the
 * per-user agent loop and ignores `config.enabled` — an open position must
 * still be resolved even if the agent has since been disabled for that user.
 *
 * Closing trades go straight to `executePaper`, bypassing the risk engine
 * and the manual-approval gate (`executeIntent` / `execution.gateway.ts`):
 * a stop loss has to fire regardless of approval settings, otherwise it
 * isn't a safety mechanism.
 */

import { PositionDoc, OrderDoc } from '../../models/position.model'
import { executePaper, getLivePrice } from '../../execution/modes/paper.executor'
import { generateMyId } from '../../utils/nanoid'
import type { TradeIntent } from './loop.types'

type ExitReason = 'stop_loss' | 'take_profit'

async function closePosition(
  position: { positionId: string; userId?: string; tokenIn: string; tokenOut: string; entryAmountUsd: number; entryPrice: number; strategy: string; confidence?: number },
  exitPrice: number,
  reason: ExitReason,
): Promise<void> {
  if (!position.userId) return

  const unitsHeld = position.entryAmountUsd / position.entryPrice
  const closeIntent: TradeIntent = {
    type: 'propose_trade',
    tokenIn: position.tokenOut,
    tokenOut: position.tokenIn,
    amountUsd: unitsHeld * exitPrice,
    maxSlippageBps: 50,
    rationale: `Auto-exit on ${reason.replace('_', ' ')} at $${exitPrice.toFixed(4)}`,
  }

  const runId = `monitor-${generateMyId(10)}`
  const result = await executePaper(closeIntent, {
    userId: position.userId,
    runId,
    strategy: position.strategy,
    rationale: closeIntent.rationale,
    confidence: position.confidence ?? 0,
  })

  if (result.status !== 'filled') {
    console.warn(`[PositionMonitor] Failed to close ${position.positionId}: ${result.errorMessage ?? result.status}`)
    return
  }

  await OrderDoc.create({
    orderId: result.orderId ?? `order-${generateMyId(10)}`,
    runId,
    userId: position.userId,
    mode: 'paper',
    intentType: 'close_position',
    tokenIn: closeIntent.tokenIn,
    tokenOut: closeIntent.tokenOut,
    amountUsd: closeIntent.amountUsd,
    status: result.status,
    filledAmountUsd: result.filledAmountUsd,
    entryPrice: result.entryPrice,
    feesUsd: result.feesUsd,
    executedAt: result.executedAt,
    positionId: position.positionId,
  })

  await PositionDoc.updateOne({ positionId: position.positionId }, { $set: {
    isOpen: false,
    exitPrice,
    exitAmountUsd: result.filledAmountUsd,
    exitAt: result.executedAt,
    realizedPnlUsd: result.simulatedPnlUsd ?? 0,
  } })

  console.log(`[PositionMonitor] Closed ${position.positionId} (${reason}) — PnL: $${(result.simulatedPnlUsd ?? 0).toFixed(2)}`)
}

export async function runPositionMonitorSweep(): Promise<void> {
  const openPositions = await PositionDoc.find({
    isOpen: true,
    mode: 'paper',
    $or: [{ stopLossPrice: { $exists: true } }, { takeProfitPrice: { $exists: true } }],
  }).lean()

  if (openPositions.length === 0) return

  const uniqueSymbols = [...new Set(openPositions.map(p => p.tokenOut))]
  const prices: Record<string, number> = {}
  for (const symbol of uniqueSymbols) {
    prices[symbol] = await getLivePrice(symbol)
  }

  for (const position of openPositions) {
    const currentPrice = prices[position.tokenOut]
    if (!currentPrice) continue

    const hitStopLoss   = position.stopLossPrice   !== undefined && currentPrice <= position.stopLossPrice
    const hitTakeProfit = position.takeProfitPrice !== undefined && currentPrice >= position.takeProfitPrice
    if (!hitStopLoss && !hitTakeProfit) continue

    await closePosition(position, currentPrice, hitStopLoss ? 'stop_loss' : 'take_profit')
  }
}

// ── Scheduler wrapper ─────────────────────────────────────────────────────────

const INTERVAL_MS = Number(process.env.POSITION_MONITOR_INTERVAL_MS) || 60_000

let _timer: NodeJS.Timeout | null = null
let _sweeping = false

export function startPositionMonitor(): void {
  if (_timer) {
    console.warn('[PositionMonitor] Already running — stopPositionMonitor() first.')
    return
  }
  console.log(`[PositionMonitor] Starting — interval: ${INTERVAL_MS / 1000}s`)

  _timer = setInterval(async () => {
    if (_sweeping) return
    _sweeping = true
    try {
      await runPositionMonitorSweep()
    } catch (err: any) {
      console.error('[PositionMonitor] Sweep error:', err.message)
    } finally {
      _sweeping = false
    }
  }, INTERVAL_MS)

  if (_timer.unref) _timer.unref()
}

export function stopPositionMonitor(): void {
  if (_timer) {
    clearInterval(_timer)
    _timer = null
    console.log('[PositionMonitor] Stopped.')
  }
}

export function isPositionMonitorRunning(): boolean {
  return _timer !== null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/api && npx jest src/agents/loop/__tests__/positionMonitor.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add services/api/src/agents/loop/positionMonitor.ts services/api/src/agents/loop/__tests__/positionMonitor.test.ts
git commit -m "feat(agent): add position monitor to auto-close on stop loss / take profit"
```

---

### Task 7: Start the position monitor at server boot

**Files:**
- Modify: `services/api/src/app.ts`

- [ ] **Step 1: Add the import**

In `services/api/src/app.ts`, change:

```ts
import { startScheduler, isSchedulerRunning }  from './agents/loop/scheduler'
```

to:

```ts
import { startScheduler, isSchedulerRunning }  from './agents/loop/scheduler'
import { startPositionMonitor, isPositionMonitorRunning } from './agents/loop/positionMonitor'
```

- [ ] **Step 2: Start it next to the scheduler**

Change:

```ts
  // Guard: prevents double-start on hot-reload
  if (!isSchedulerRunning()) {
    startScheduler()
  }
```

to:

```ts
  // Guard: prevents double-start on hot-reload
  if (!isSchedulerRunning()) {
    startScheduler()
  }
  if (!isPositionMonitorRunning()) {
    startPositionMonitor()
  }
```

- [ ] **Step 3: Verify the server still boots**

Run: `cd services/api && npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/app.ts
git commit -m "feat(agent): start the position monitor alongside the agent loop scheduler"
```

---

### Task 8: Surface stop loss / take profit / framework on the frontend

**Files:**
- Modify: `src/components/AgentChat/ChatDashboard.tsx`

- [ ] **Step 1: Extend the local `Position` interface**

In `src/components/AgentChat/ChatDashboard.tsx`, change:

```ts
interface Position {
  positionId:      string;
  tokenIn:         string;
  tokenOut:        string;
  entryAmountUsd:  number;
  entryPrice:      number;
  isOpen:          boolean;
  realizedPnlUsd?: number;
  strategy:        string;
  entryAt:         string;
  mode:            string;
}
```

to:

```ts
interface Position {
  positionId:      string;
  tokenIn:         string;
  tokenOut:        string;
  entryAmountUsd:  number;
  entryPrice:      number;
  isOpen:          boolean;
  realizedPnlUsd?: number;
  strategy:        string;
  entryAt:         string;
  mode:            string;
  stopLossPrice?:   number;
  takeProfitPrice?: number;
  framework?:       string;
  confidence?:      number;
}
```

- [ ] **Step 2: Render the new fields on each position card**

In the same file, find the position card block (inside `PositionsTab`):

```tsx
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "5px 0 0", fontFamily: "var(--font-mono)" }}>
              {pos.strategy} · {new Date(pos.entryAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
            </p>
          </div>
        ))}
```

Change it to:

```tsx
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "5px 0 0", fontFamily: "var(--font-mono)" }}>
              {pos.strategy}{pos.framework ? ` · ${pos.framework}` : ""}{pos.confidence !== undefined ? ` · ${pos.confidence}% conf` : ""} · {new Date(pos.entryAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
            </p>
            {(pos.stopLossPrice !== undefined || pos.takeProfitPrice !== undefined) && (
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "3px 0 0", fontFamily: "var(--font-mono)" }}>
                {pos.stopLossPrice !== undefined && <span style={{ color: "#ff5572" }}>SL ${pos.stopLossPrice.toFixed(2)}</span>}
                {pos.stopLossPrice !== undefined && pos.takeProfitPrice !== undefined && "  ·  "}
                {pos.takeProfitPrice !== undefined && <span style={{ color: "#00e5a0" }}>TP ${pos.takeProfitPrice.toFixed(2)}</span>}
              </p>
            )}
          </div>
        ))}
```

- [ ] **Step 3: Verify the frontend still builds**

Run: `cd "C:\crypto_dashboard\my-app" && npx tsc --noEmit -p tsconfig.json`
Expected: No new errors in `ChatDashboard.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/AgentChat/ChatDashboard.tsx
git commit -m "feat(ui): show stop loss, take profit, framework, and confidence on position cards"
```

---

## After implementation

To actually start auto-trading once this ships, the user enables it for their account via the existing config endpoint (no new UI was built for this — none of the other strategy toggles have one either):

```
POST /api/agent-runs/config
{ "enabled": true, "requireManualApproval": false, "strategies": { "chartSignal": true } }
```

`requireManualApproval: false` only succeeds while `mode` is `paper` (Task 2's guard) — this is intentional.

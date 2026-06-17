# Chart Visualization + Manual Trade Approval Queue — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual approval queue (Approve/Reject pending trades) and embed live TradingView Lightweight Charts with S/R, trendlines, and strategy overlays into each approval card.

**Architecture:** The chartSignal strategy already computes all analysis locally; this plan persists a slim `ChartSnapshot` (S/R zones, trendlines from zigzag pivots, entry/SL/TP, framework overlays) into each AgentRunDoc, adds `approveRun`/`rejectRun` functions to the agent loop, exposes REST endpoints, and renders the chart in the frontend using `lightweight-charts` with live candles fetched through a new `/api/chart/ohlcv/:symbol` proxy.

**Tech Stack:** Mongoose (backend models), Express (REST), lightweight-charts v5 (frontend), TDD with connectTestDb + mockRes pattern.

## Global Constraints
- Paper mode only — no changes to live/CEX execution paths
- BTC and ETH only (chartSignal already enforces this)
- TDD: write the failing test first for every backend change
- `cd services/api && npx jest` must stay green after every backend task
- `npx tsc --noEmit` must pass in both `services/api` and the Next.js root after every task
- No new backend npm packages; one new frontend package: `lightweight-charts@^5`
- Follow existing patterns: `connectTestDb`/`clearTestDb`/`disconnectTestDb`, `mockRes()`, `apiClient.get/post`
- Overlays (S/R, trendlines) are derived from the 4H analysis timeframe and rendered on all timeframe views; only the candle stream changes per timeframe

---

## File Map

**Created**
- `services/api/src/agents/loop/__tests__/approvalQueue.test.ts`
- `services/api/src/controllers/__tests__/chart.controller.test.ts`
- `src/components/AgentChart/AgentChart.tsx`
- `src/components/AgentChart/ChartModal.tsx`
- `src/components/AgentChart/MiniChart.tsx`

**Modified**
- `services/api/src/agents/loop/loop.types.ts`
- `services/api/src/models/agentRun.model.ts`
- `services/api/src/agents/policy/strategies/chartSignal.strategy.ts`
- `services/api/src/agents/loop/agent.loop.ts`
- `services/api/src/controllers/chartAnalysis.controller.ts`
- `services/api/src/routes/chartAnalysis.routes.ts`
- `services/api/src/controllers/agentRun.controller.ts`
- `services/api/src/routes/agentRun.routes.ts`
- `src/services/agent.service.frontend.ts`
- `src/components/AgentChat/ChatDashboard.tsx`

---

## Task 1: Types and Data Model

**Files:**
- Modify: `services/api/src/agents/loop/loop.types.ts`
- Modify: `services/api/src/models/agentRun.model.ts`

**Interfaces:**
- Produces: `ChartSnapshot`, `ChartOverlayTimeframe`, `'rejected'` in `AgentRunStatus`, `chartSnapshot` field on `AgentRunRecord` — consumed by Tasks 2, 3, 5, 6

- [ ] **Step 1: Extend `loop.types.ts`**

Add after the existing `AgentRunRecord` block:

```typescript
// ── Chart snapshot (persisted per chartSignal run that produces a signal) ─────

export interface ChartOverlay {
  supportResistance: Array<{
    price:    number
    type:     'support' | 'resistance'
    strength: 'strong' | 'moderate' | 'weak'
  }>
  trendlines: Array<{
    p1:        { time: number; price: number }   // Unix ms timestamp
    p2:        { time: number; price: number }
    direction: 'up' | 'down'
  }>
  // Framework-specific (only one field is populated per run):
  orderBlocks?:     Array<{ high: number; low: number; type: 'bullish' | 'bearish'; status: string }>
  elliottPivots?:   Array<{ price: number; timestamp: number; waveLabel: string }>
  wyckoffRange?:    { high: number; low: number; phase: string }
  harmonicPattern?: { name: string; prz_high: number; prz_low: number; xabcd: Record<string, number>; xabcd_ts: Record<string, number> }
}

export interface ChartSnapshot {
  symbol:           string          // 'BTC' | 'ETH'
  binanceSymbol:    string          // 'BTCUSDT' | 'ETHUSDT'
  framework:        string          // 'SmartMoney' | 'Wyckoff' | 'ElliottWave' | 'Harmonic'
  snapshotAt:       Date
  entryZone:        { low: number; high: number }
  stopLoss:         number
  takeProfitLevels: number[]
  confidence:       number
  overlays:         ChartOverlay    // derived from 4H analysis; rendered on all timeframe views
}
```

Change `AgentRunStatus`:
```typescript
export type AgentRunStatus = 'running' | 'completed' | 'failed' | 'blocked' | 'pending_approval' | 'rejected'
```

Add `chartSnapshot` to `AgentRunRecord`:
```typescript
export interface AgentRunRecord {
  runId:           string
  userId:          string
  strategy:        string
  mode:            AgentMode
  startedAt:       Date
  completedAt?:    Date
  status:          AgentRunStatus
  contextSnapshot: string
  decision:        Decision | null
  executionResult?: ExecutionResult
  errorMessage?:   string
  chartSnapshot?:  ChartSnapshot   // ← add this line
}
```

- [ ] **Step 2: Extend `agentRun.model.ts`**

Add `ChartOverlaySchema` and `ChartSnapshotSchema` before `AgentRunSchema`:

```typescript
const ChartOverlaySchema = new Schema({
  supportResistance: [{ price: Number, type: String, strength: String, _id: false }],
  trendlines:        [{
    p1: { time: Number, price: Number, _id: false },
    p2: { time: Number, price: Number, _id: false },
    direction: String,
    _id: false,
  }],
  orderBlocks:     [{ high: Number, low: Number, type: String, status: String, _id: false }],
  elliottPivots:   [{ price: Number, timestamp: Number, waveLabel: String, _id: false }],
  wyckoffRange:    { high: Number, low: Number, phase: String, _id: false },
  harmonicPattern: { name: String, prz_high: Number, prz_low: Number, xabcd: Schema.Types.Mixed, xabcd_ts: Schema.Types.Mixed, _id: false },
}, { _id: false })

const ChartSnapshotSchema = new Schema({
  symbol:           String,
  binanceSymbol:    String,
  framework:        String,
  snapshotAt:       Date,
  entryZone:        { low: Number, high: Number, _id: false },
  stopLoss:         Number,
  takeProfitLevels: [Number],
  confidence:       Number,
  overlays:         { type: ChartOverlaySchema, default: undefined },
}, { _id: false })
```

Extend `IntentSchema` with the five missing fields:
```typescript
const IntentSchema = new Schema({
  type:             { type: String, required: true },
  tokenIn:          String,
  tokenOut:         String,
  amountUsd:        Number,
  maxSlippageBps:   Number,
  rationale:        String,
  venue:            String,
  coinId:           String,
  condition:        String,
  threshold:        Number,
  targetWeights:    Schema.Types.Mixed,
  // ── chartSignal fields ──────────────────────────
  stopLossPrice:    Number,
  takeProfitPrice:  Number,
  entryZoneLow:     Number,
  entryZoneHigh:    Number,
  framework:        String,
}, { _id: false })
```

Add `'rejected'` to the status enum and `chartSnapshot` field in `AgentRunSchema`:
```typescript
status: {
  type:    String,
  enum:    ['running', 'completed', 'failed', 'blocked', 'pending_approval', 'rejected'],
  default: 'running',
},
// after executionResult:
chartSnapshot: { type: ChartSnapshotSchema, default: undefined },
```

- [ ] **Step 3: Type-check**

Run from `services/api`:
```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/agents/loop/loop.types.ts services/api/src/models/agentRun.model.ts
git commit -m "feat(types): add ChartSnapshot, 'rejected' status, extend IntentSchema"
```

---

## Task 2: approveRun + rejectRun (TDD)

**Files:**
- Create: `services/api/src/agents/loop/__tests__/approvalQueue.test.ts`
- Modify: `services/api/src/agents/loop/agent.loop.ts`

**Interfaces:**
- Consumes: `AgentRunDoc`, `ChartSnapshot` (Task 1), `loadWalletState`, `persistExecution`, `executeIntent`, `getOrCreateConfig` (all already in agent.loop.ts)
- Produces: exported `approveRun(userId, runId): Promise<ExecutionResult>` and `rejectRun(userId, runId): Promise<void>` — consumed by Task 5

- [ ] **Step 1: Write failing tests**

Create `services/api/src/agents/loop/__tests__/approvalQueue.test.ts`:

```typescript
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'
import { AgentRunDoc } from '../../../models/agentRun.model'
import { PositionDoc } from '../../../models/position.model'
import { getOrCreateWallet } from '../../../services/paperWallet.service'
import { approveRun, rejectRun } from '../agent.loop'

// Prevent the chartSignal tick from needing Binance/Redis during these tests
jest.mock('../../../services/chartAnalysis.service', () => ({
  buildMarketPrimitives: jest.fn(async () => ({ meta: { symbol: 'BTC' } } as any)),
}))

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

function makePendingRun(overrides: Record<string, unknown> = {}) {
  return AgentRunDoc.create({
    runId:     'run-approve-1',
    userId:    'user-test',
    strategy:  'chartSignal',
    mode:      'paper',
    startedAt: new Date(),
    status:    'pending_approval',
    decision: {
      intent: {
        type:           'propose_trade',
        tokenIn:        'USDC',
        tokenOut:       'BTC',
        amountUsd:      100,
        maxSlippageBps: 50,
        rationale:      'test',
        stopLossPrice:  49000,
        takeProfitPrice: 53000,
        entryZoneLow:   50000,
        entryZoneHigh:  51000,
        framework:      'SmartMoney',
      },
      confidence:    85,
      reasoning:     'test signal',
      toolCallTrace: ['chartSignal:SmartMoney'],
    },
    ...overrides,
  })
}

test('approveRun executes the intent and flips run to completed', async () => {
  await getOrCreateWallet('user-test')
  await makePendingRun()

  const result = await approveRun('user-test', 'run-approve-1')

  expect(['filled', 'pending_limit', 'blocked_by_risk']).toContain(result.status)

  const updated = await AgentRunDoc.findOne({ runId: 'run-approve-1' }).lean()
  expect(updated!.status).toMatch(/completed|blocked/)
  expect(updated!.completedAt).toBeDefined()
})

test('approveRun for chart-signal intent creates a pending limit position', async () => {
  await getOrCreateWallet('user-test')
  await makePendingRun()

  await approveRun('user-test', 'run-approve-1')

  const positions = await PositionDoc.find({ userId: 'user-test' }).lean()
  // chart-signal uses a limit order (pending until price re-enters entry zone)
  expect(positions.length).toBeGreaterThanOrEqual(1)
  if (positions.length > 0) {
    expect(positions[0].tokenOut).toBe('BTC')
    expect(positions[0].stopLossPrice).toBe(49000)
  }
})

test('approveRun returns 404 if runId not found for this user', async () => {
  await getOrCreateWallet('user-test')
  await makePendingRun()

  await expect(approveRun('other-user', 'run-approve-1')).rejects.toThrow('not found')
})

test('rejectRun sets status to rejected and creates no position', async () => {
  await makePendingRun()

  await rejectRun('user-test', 'run-approve-1')

  const updated = await AgentRunDoc.findOne({ runId: 'run-approve-1' }).lean()
  expect(updated!.status).toBe('rejected')
  expect(updated!.completedAt).toBeDefined()

  const positions = await PositionDoc.find({ userId: 'user-test' }).lean()
  expect(positions).toHaveLength(0)
})

test('rejectRun returns 404 if runId not found for this user', async () => {
  await makePendingRun()
  await expect(rejectRun('other-user', 'run-approve-1')).rejects.toThrow('not found')
})
```

- [ ] **Step 2: Run to confirm failure**

```
cd services/api && npx jest approvalQueue --no-coverage
```
Expected: FAIL — `approveRun` and `rejectRun` are not exported.

- [ ] **Step 3: Implement approveRun and rejectRun in `agent.loop.ts`**

Add these two exported functions at the bottom of `agent.loop.ts`, after `runLoopTick`:

```typescript
// ── Manual approval actions ───────────────────────────────────────────────────

export async function approveRun(userId: string, runId: string): Promise<ExecutionResult> {
  const run = await AgentRunDoc.findOne({ runId, userId, status: 'pending_approval' }).lean()
  if (!run) throw Object.assign(new Error(`Run "${runId}" not found`), { statusCode: 404 })

  const intent    = run.decision!.intent
  const confidence = run.decision!.confidence
  const rationale  = run.decision!.reasoning

  const config      = await getOrCreateConfig(userId)
  const replayConfig: AgentConfig = { ...config, requireManualApproval: false, enabled: true }
  const walletState = await loadWalletState(userId, replayConfig)

  const gateway = await executeIntent(intent as any, walletState, {
    userId, config: replayConfig, runId, strategy: run.strategy, rationale, confidence,
  })

  await persistExecution(userId, replayConfig.mode, runId, intent, gateway.execution, run.strategy, confidence)

  const finalStatus = !gateway.riskPassed ? 'blocked' : 'completed'
  await AgentRunDoc.updateOne({ runId }, {
    $set: { status: finalStatus, executionResult: gateway.execution, completedAt: new Date() },
  })

  return gateway.execution
}

export async function rejectRun(userId: string, runId: string): Promise<void> {
  const result = await AgentRunDoc.updateOne(
    { runId, userId, status: 'pending_approval' },
    { $set: { status: 'rejected', completedAt: new Date() } },
  )
  if (result.matchedCount === 0) throw Object.assign(new Error(`Run "${runId}" not found`), { statusCode: 404 })
}
```

Also add the missing `AgentConfig` type import at the top of `agent.loop.ts` if not already present:
```typescript
import type { AgentConfig } from '@/config/agent.config'
```

- [ ] **Step 4: Run tests — expect pass**

```
cd services/api && npx jest approvalQueue --no-coverage
```
Expected: PASS (5 tests)

- [ ] **Step 5: Full test suite**

```
cd services/api && npx jest --no-coverage
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/agents/loop/agent.loop.ts \
        services/api/src/agents/loop/__tests__/approvalQueue.test.ts
git commit -m "feat(agent): export approveRun + rejectRun with TDD"
```

---

## Task 3: chartSignal — Build and Save ChartSnapshot

**Files:**
- Modify: `services/api/src/agents/policy/strategies/chartSignal.strategy.ts`
- Modify: `services/api/src/agents/loop/agent.loop.ts`

**Interfaces:**
- Consumes: `MarketPrimitives` (already in scope in chartSignal), `ChartSnapshot` (Task 1), `ohlcvIngest` (existing singleton), `extractZigZagPivots` from `structure.skill`
- Produces: `metadata.chartSnapshot: ChartSnapshot` passed through `StrategyResult` → saved to `AgentRunDoc`

- [ ] **Step 1: Add snapshot-builder helper in `chartSignal.strategy.ts`**

Add these imports at the top of `chartSignal.strategy.ts`:

```typescript
import { ohlcvIngest }          from '../../../read/ingestion/ohlcv.ingest'
import { extractZigZagPivots }  from '../../skills/structure.skill'
import type { ChartSnapshot, ChartOverlay } from '../../loop/loop.types'
import type { MarketPrimitives } from '../../../agents/chartAnalysis.types'
```

Add this function before the `chartSignalStrategy` export:

```typescript
async function buildChartSnapshot(
  symbol: string,
  binanceSymbol: string,
  primitives: MarketPrimitives,
  signal: import('./strategy.types').TradeSignal,
): Promise<ChartSnapshot> {
  // Fetch 4H candles (cache hit — buildMarketPrimitives already fetched them)
  let trendlines: ChartOverlay['trendlines'] = []
  try {
    const candleMap = await ohlcvIngest.fetchMultiTimeframe(binanceSymbol, ['4h'], 200)
    const candles4H = candleMap['4h'] ?? []
    const pivots    = extractZigZagPivots(candles4H)

    const highs = pivots.filter(p => p.type === 'high').slice(-4)
    const lows  = pivots.filter(p => p.type === 'low').slice(-4)

    if (highs.length >= 2) {
      const h1 = highs[highs.length - 2]
      const h2 = highs[highs.length - 1]
      trendlines.push({
        p1: { time: h1.timestamp, price: h1.price },
        p2: { time: h2.timestamp, price: h2.price },
        direction: h2.price < h1.price ? 'down' : 'up',
      })
    }
    if (lows.length >= 2) {
      const l1 = lows[lows.length - 2]
      const l2 = lows[lows.length - 1]
      trendlines.push({
        p1: { time: l1.timestamp, price: l1.price },
        p2: { time: l2.timestamp, price: l2.price },
        direction: l2.price > l1.price ? 'up' : 'down',
      })
    }
  } catch { /* trendlines are best-effort */ }

  const supportResistance: ChartOverlay['supportResistance'] =
    (primitives.structure?.key_levels ?? []).slice(0, 8).map(z => ({
      price:    z.price,
      type:     z.type as 'support' | 'resistance',
      strength: z.strength,
    }))

  const overlays: ChartOverlay = { supportResistance, trendlines }

  // Framework-specific overlays
  if (signal.framework === 'SmartMoney' && primitives.smart_money) {
    overlays.orderBlocks = primitives.smart_money.order_blocks.slice(0, 5).map(ob => ({
      high:   ob.price_high,
      low:    ob.price_low,
      type:   ob.type as 'bullish' | 'bearish',
      status: ob.status,
    }))
  }
  if (signal.framework === 'Wyckoff' && primitives.wyckoff) {
    overlays.wyckoffRange = {
      high:  primitives.wyckoff.range_high,
      low:   primitives.wyckoff.range_low,
      phase: primitives.wyckoff.phase,
    }
  }
  if (signal.framework === 'ElliottWave' && primitives.elliott) {
    overlays.elliottPivots = (primitives.elliott.pivots ?? []).map((price, i) => ({
      price,
      timestamp: primitives.elliott!.pivot_timestamps[i] ?? 0,
      waveLabel: `W${i + 1}`,
    }))
  }
  if (signal.framework === 'Harmonic' && primitives.harmonics) {
    const h = primitives.harmonics
    overlays.harmonicPattern = {
      name:     h.name,
      prz_high: h.prz_high,
      prz_low:  h.prz_low,
      xabcd:    { X: h.xabcd.X, A: h.xabcd.A, B: h.xabcd.B, C: h.xabcd.C, D: h.xabcd.D },
      xabcd_ts: { X: h.xabcd.X_ts, A: h.xabcd.A_ts, B: h.xabcd.B_ts, C: h.xabcd.C_ts, D: h.xabcd.D_ts },
    }
  }

  return {
    symbol,
    binanceSymbol,
    framework:        signal.framework,
    snapshotAt:       new Date(),
    entryZone:        signal.entry_zone,
    stopLoss:         signal.stop_loss,
    takeProfitLevels: signal.take_profit_levels,
    confidence:       signal.confidence,
    overlays,
  }
}
```

- [ ] **Step 2: Call `buildChartSnapshot` in `chartSignalStrategy.buildContext`**

In the `chartSignalStrategy.buildContext` method, in the `else` branch where `deterministicDecision` is built from `best.result.signal`, add after setting `deterministicDecision`:

```typescript
// Build chart snapshot (best-effort; errors don't fail the tick)
let chartSnapshot: ChartSnapshot | undefined
try {
  chartSnapshot = await buildChartSnapshot(best.symbol, best.binanceSymbol ?? `${best.symbol}USDT`, best.primitives, signal)
} catch { /* non-fatal */ }
```

But we need `best.primitives` — update the `candidates` array to also store the primitives:

Change the `candidates` declaration:
```typescript
const candidates: Array<{ symbol: string; binanceSymbol: string; result: ChartStrategyResult; primitives: MarketPrimitives }> = []
```

And where primitives are fetched and candidates are pushed:
```typescript
const primitives = await buildMarketPrimitives(binanceSymbol)
results = [
  runSmartMoneyStrategy(primitives),
  runWyckoffStrategy(primitives),
  runElliottStrategy(primitives),
  runHarmonicStrategy(primitives),
]
// ...
candidates.push({ symbol, binanceSymbol, result, primitives })
```

Pass `chartSnapshot` in metadata:
```typescript
return {
  strategyName: 'chartSignal',
  contextSummary: lines.join('\n'),
  metadata: { candidatesConsidered: candidates.length, deterministicDecision, chartSnapshot },
  deterministicDecision,
}
```

- [ ] **Step 3: Save chartSnapshot in `agent.loop.ts`**

In `runLoopTick`, after `persistExecution(...)` and before the `finalStatus` computation, add:

```typescript
// Save chart snapshot for chartSignal runs that produced a signal
const chartSnapshot = strategyResult.metadata?.chartSnapshot as import('@/agents/loop/loop.types').ChartSnapshot | undefined
if (chartSnapshot) {
  await AgentRunDoc.updateOne({ runId }, { $set: { chartSnapshot } }).catch(() => {})
}
```

- [ ] **Step 4: Run full test suite**

```
cd services/api && npx jest --no-coverage
```
Expected: all green (existing chartSignal test still passes — the new fields are additive).

- [ ] **Step 5: Type-check**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/agents/policy/strategies/chartSignal.strategy.ts \
        services/api/src/agents/loop/agent.loop.ts
git commit -m "feat(agent): build and persist ChartSnapshot on chartSignal runs"
```

---

## Task 4: OHLCV Proxy Endpoint (TDD)

**Files:**
- Create: `services/api/src/controllers/__tests__/chart.controller.test.ts`
- Modify: `services/api/src/controllers/chartAnalysis.controller.ts`
- Modify: `services/api/src/routes/chartAnalysis.routes.ts`

**Interfaces:**
- Consumes: `ohlcvIngest` (existing singleton)
- Produces: `GET /api/chart/ohlcv/:symbol?timeframe=4h&limit=300` → `{ symbol, timeframe, candles: Candle[] }` — consumed by frontend Task 6

- [ ] **Step 1: Write failing test**

Create `services/api/src/controllers/__tests__/chart.controller.test.ts`:

```typescript
import '../../config/env'
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'

jest.mock('../../read/ingestion/ohlcv.ingest', () => ({
  ohlcvIngest: {
    fetchMultiTimeframe: jest.fn(async (symbol: string, tfs: string[]) => ({
      [tfs[0]]: [
        { timestamp: 1700000000000, open: 40000, high: 41000, low: 39000, close: 40500, volume: 123 },
      ],
    })),
  },
}))

import { getOhlcv } from '../chartAnalysis.controller'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

function mockRes() {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json   = jest.fn(() => res)
  return res
}

test('getOhlcv returns candles for valid symbol and timeframe', async () => {
  const req: any = { params: { symbol: 'BTCUSDT' }, query: { timeframe: '4h', limit: '10' } }
  const res      = mockRes()
  await getOhlcv(req, res, jest.fn())

  const payload = res.json.mock.calls[0][0]
  expect(payload.symbol).toBe('BTCUSDT')
  expect(payload.timeframe).toBe('4h')
  expect(Array.isArray(payload.candles)).toBe(true)
  expect(payload.candles).toHaveLength(1)
})

test('getOhlcv rejects unknown symbol', async () => {
  const req: any = { params: { symbol: 'SCAMCOIN' }, query: { timeframe: '4h' } }
  const res      = mockRes()
  await getOhlcv(req, res, jest.fn())

  expect(res.status.mock.calls[0][0]).toBe(400)
})

test('getOhlcv rejects unknown timeframe', async () => {
  const req: any = { params: { symbol: 'BTCUSDT' }, query: { timeframe: '3h' } }
  const res      = mockRes()
  await getOhlcv(req, res, jest.fn())

  expect(res.status.mock.calls[0][0]).toBe(400)
})
```

- [ ] **Step 2: Run to confirm failure**

```
cd services/api && npx jest chart.controller --no-coverage
```
Expected: FAIL — `getOhlcv` not exported.

- [ ] **Step 3: Implement `getOhlcv` in `chartAnalysis.controller.ts`**

Add this function at the end of the existing `chartAnalysis.controller.ts` file:

```typescript
import { ohlcvIngest } from '../read/ingestion/ohlcv.ingest'
import type { Timeframe } from '../read/ingestion/ohlcv.ingest'

const ALLOWED_SYMBOLS   = new Set(['BTCUSDT', 'ETHUSDT'])
const ALLOWED_TIMEFRAMES = new Set<Timeframe>(['1m', '5m', '15m', '1h', '4h', '1d', '1w'])

export async function getOhlcv(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const symbol    = (req.params.symbol ?? '').toUpperCase()
    const timeframe = (req.query.timeframe as string ?? '4h') as Timeframe
    const limit     = Math.min(parseInt(req.query.limit as string) || 300, 500)

    if (!ALLOWED_SYMBOLS.has(symbol))    return res.status(400).json({ error: `Symbol "${symbol}" not supported. Use BTCUSDT or ETHUSDT.` })
    if (!ALLOWED_TIMEFRAMES.has(timeframe)) return res.status(400).json({ error: `Timeframe "${timeframe}" not supported.` })

    const candleMap = await ohlcvIngest.fetchMultiTimeframe(symbol, [timeframe], limit)
    const candles   = candleMap[timeframe] ?? []

    res.json({ symbol, timeframe, candles })
  } catch (err) { next(err) }
}
```

Note: `AuthRequest`, `Response`, `NextFunction` are already imported at the top of that file.

- [ ] **Step 4: Register route in `chartAnalysis.routes.ts`**

Add before the existing routes:

```typescript
import {
  analyzeSymbolHandler,
  getAnalysisHistory,
  getPrimitives,
  getOhlcv,              // ← add this
} from '../controllers/chartAnalysis.controller';

// Add this route:
router.get('/ohlcv/:symbol', getOhlcv);   // GET /api/chart/ohlcv/BTCUSDT?timeframe=4h&limit=300
```

- [ ] **Step 5: Run tests**

```
cd services/api && npx jest chart.controller --no-coverage
```
Expected: PASS (3 tests).

- [ ] **Step 6: Full suite + type-check**

```
cd services/api && npx jest --no-coverage && npx tsc --noEmit
```
Expected: all green, no type errors.

- [ ] **Step 7: Commit**

```bash
git add services/api/src/controllers/chartAnalysis.controller.ts \
        services/api/src/routes/chartAnalysis.routes.ts \
        services/api/src/controllers/__tests__/chart.controller.test.ts
git commit -m "feat(api): add GET /api/chart/ohlcv/:symbol endpoint"
```

---

## Task 5: Approval Queue REST Endpoints (TDD)

**Files:**
- Modify: `services/api/src/controllers/agentRun.controller.ts`
- Modify: `services/api/src/routes/agentRun.routes.ts`
- Modify: `services/api/src/controllers/__tests__/agentRun.controller.test.ts`

**Interfaces:**
- Consumes: `approveRun`, `rejectRun` (Task 2)
- Produces:
  - `GET /api/agent-runs/approvals`
  - `POST /api/agent-runs/:runId/approve`
  - `POST /api/agent-runs/:runId/reject`

- [ ] **Step 1: Write failing tests**

Append to `services/api/src/controllers/__tests__/agentRun.controller.test.ts`:

```typescript
import { listApprovals, approveRunCtrl, rejectRunCtrl } from '../agentRun.controller'

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
```

- [ ] **Step 2: Run to confirm failure**

```
cd services/api && npx jest agentRun.controller --no-coverage
```
Expected: FAIL — new exports not found.

- [ ] **Step 3: Implement the three controller functions**

Add to `services/api/src/controllers/agentRun.controller.ts`:

```typescript
import { approveRun as doApproveRun, rejectRun as doRejectRun } from '../agents/loop/agent.loop'

export async function listApprovals(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const approvals = await AgentRunDoc
      .find({ userId: req.userId, status: 'pending_approval' })
      .sort({ startedAt: -1 })
      .select('runId strategy decision chartSnapshot startedAt')
      .lean()
    res.json({ approvals, total: approvals.length })
  } catch (err) { next(err) }
}

export async function approveRunCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await doApproveRun(req.userId!, req.params.runId)
    res.json(result)
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message })
    next(err)
  }
}

export async function rejectRunCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await doRejectRun(req.userId!, req.params.runId)
    res.sendStatus(204)
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message })
    next(err)
  }
}
```

- [ ] **Step 4: Register routes in `agentRun.routes.ts`**

Replace the contents of the file with the full corrected version (routes must be in this exact order to prevent `/approvals` being captured as a `:runId`):

```typescript
import { Router } from 'express'
import { auth }   from '../middleware/auth'
import {
  listRuns,
  getRun,
  triggerRun,
  getConfig,
  updateConfig,
  getStats,
  listApprovals,
  approveRunCtrl,
  rejectRunCtrl,
} from '../controllers/agentRun.controller'

const router = Router()
router.use(auth)

router.get('/stats',             getStats)
router.get('/config',            getConfig)
router.put('/config',            updateConfig)
router.post('/trigger',          triggerRun)
router.get('/approvals',         listApprovals)       // ← before /:runId
router.post('/:runId/approve',   approveRunCtrl)      // ← before /:runId
router.post('/:runId/reject',    rejectRunCtrl)       // ← before /:runId
router.get('/',                  listRuns)
router.get('/:runId',            getRun)

export default router
```

- [ ] **Step 5: Run tests + type-check**

```
cd services/api && npx jest --no-coverage && npx tsc --noEmit
```
Expected: all green, no type errors.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/controllers/agentRun.controller.ts \
        services/api/src/routes/agentRun.routes.ts \
        services/api/src/controllers/__tests__/agentRun.controller.test.ts
git commit -m "feat(api): approval queue endpoints — list, approve, reject"
```

---

## Task 6: Frontend Types + Service Methods

**Files:**
- Modify: `src/services/agent.service.frontend.ts`

**Interfaces:**
- Consumes: `/api/agent-runs/approvals`, `/api/agent-runs/:runId/approve|reject`, `/api/chart/ohlcv/:symbol` (Tasks 4 + 5)
- Produces: `listApprovals()`, `approveRun(runId)`, `rejectRun(runId)`, `getOhlcv(symbol, timeframe, limit)`, `ChartOverlay`, `ChartSnapshot`, updated `AgentRun` type — consumed by Tasks 7 + 8

- [ ] **Step 1: Add types to `agent.service.frontend.ts`**

Add after the existing `AgentRun` interface:

```typescript
// ── Chart snapshot ────────────────────────────────────────────────────────────

export interface ChartOverlay {
  supportResistance: Array<{
    price:    number
    type:     'support' | 'resistance'
    strength: 'strong' | 'moderate' | 'weak'
  }>
  trendlines: Array<{
    p1:        { time: number; price: number }
    p2:        { time: number; price: number }
    direction: 'up' | 'down'
  }>
  orderBlocks?:     Array<{ high: number; low: number; type: 'bullish' | 'bearish'; status: string }>
  elliottPivots?:   Array<{ price: number; timestamp: number; waveLabel: string }>
  wyckoffRange?:    { high: number; low: number; phase: string }
  harmonicPattern?: { name: string; prz_high: number; prz_low: number; xabcd: Record<string, number>; xabcd_ts: Record<string, number> }
}

export interface ChartSnapshot {
  symbol:           string
  binanceSymbol:    string
  framework:        string
  snapshotAt:       string
  entryZone:        { low: number; high: number }
  stopLoss:         number
  takeProfitLevels: number[]
  confidence:       number
  overlays:         ChartOverlay
}

export interface Candle {
  timestamp: number
  open:      number
  high:      number
  low:       number
  close:     number
  volume:    number
}

export interface ApprovalRun {
  runId:          string
  strategy:       string
  startedAt:      string
  decision?:      AgentRunDecision
  chartSnapshot?: ChartSnapshot
}
```

Also add `chartSnapshot?: ChartSnapshot` to the existing `AgentRun` interface, and add `'rejected'` to `AgentRunStatus`:

```typescript
export type AgentRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "pending_approval"
  | "rejected";           // ← add this

// In AgentRun interface add:
chartSnapshot?: ChartSnapshot
```

- [ ] **Step 2: Add service functions**

Find the existing service functions (search for `export async function` or `export const`) and add alongside them. If the file uses a class or object export, add methods there; if it uses standalone exports, add at the bottom:

```typescript
export async function listApprovals(): Promise<ApprovalRun[]> {
  const data = await apiClient.get<{ approvals: ApprovalRun[] }>('/agent-runs/approvals')
  return data.approvals ?? []
}

export async function approveRun(runId: string): Promise<{ status: string }> {
  return apiClient.post<{ status: string }>(`/agent-runs/${runId}/approve`, {})
}

export async function rejectRun(runId: string): Promise<void> {
  await apiClient.post(`/agent-runs/${runId}/reject`, {})
}

export async function getOhlcv(
  symbol: string,
  timeframe: string,
  limit = 300,
): Promise<{ candles: Candle[] }> {
  return apiClient.get<{ candles: Candle[] }>(
    `/chart/ohlcv/${symbol}?timeframe=${timeframe}&limit=${limit}`,
  )
}
```

- [ ] **Step 3: Type-check frontend**

```
npx tsc --noEmit
```
(Run from the Next.js root `C:\crypto_dashboard\my-app`)
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/agent.service.frontend.ts
git commit -m "feat(frontend): add ChartSnapshot types and approval/ohlcv service methods"
```

---

## Task 7: AgentChart, ChartModal, MiniChart Components

**Files:**
- Create: `src/components/AgentChart/AgentChart.tsx`
- Create: `src/components/AgentChart/ChartModal.tsx`
- Create: `src/components/AgentChart/MiniChart.tsx`

**Interfaces:**
- Consumes: `ChartSnapshot`, `Candle`, `getOhlcv` (Task 6)
- Produces: `<AgentChart>`, `<ChartModal>`, `<MiniChart>` — consumed by Task 8

- [ ] **Step 1: Install lightweight-charts**

```
npm install lightweight-charts@^5
```
(Run from `C:\crypto_dashboard\my-app`)

- [ ] **Step 2: Create `AgentChart.tsx`**

Create `src/components/AgentChart/AgentChart.tsx`:

```tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { getOhlcv } from "@/services/agent.service.frontend";
import type { ChartSnapshot } from "@/services/agent.service.frontend";

interface Props {
  snapshot:  ChartSnapshot;
  timeframe: string;
  height:    number;
  compact?:  boolean;   // true = mini mode: only entry/SL/TP lines
}

const FRAMEWORK_COLORS: Record<string, string> = {
  SmartMoney:  "#36b6ff",
  Wyckoff:     "#a78bfa",
  ElliottWave: "#ffb020",
  Harmonic:    "#00e5a0",
};

function toSec(ms: number): UTCTimestamp {
  return Math.floor(ms / 1000) as UTCTimestamp;
}

export function AgentChart({ snapshot, timeframe, height, compact = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);

  const drawOverlays = useCallback((chart: IChartApi) => {
    const { overlays, entryZone, stopLoss, takeProfitLevels } = snapshot;

    // Entry zone — amber band (two horizontal lines)
    const ezHigh = chart.addSeries(LineSeries, { color: "#ffb020", lineWidth: 1, lineStyle: 2 })
    const ezLow  = chart.addSeries(LineSeries, { color: "#ffb020", lineWidth: 1, lineStyle: 2 })
    // Lightweight Charts LineSeries for horizontals: use priceLine instead
    chart.addSeries(LineSeries, { color: "#ffb020aa", lineWidth: 0 })
      .createPriceLine({ price: entryZone.high, color: "#ffb020", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "Entry Hi" })
    chart.addSeries(LineSeries, { color: "#ffb020aa", lineWidth: 0 })
      .createPriceLine({ price: entryZone.low,  color: "#ffb020", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "Entry Lo" })

    // Stop loss — red
    const slSeries = chart.addSeries(LineSeries, { color: "#ff5572", lineWidth: 0 })
    slSeries.createPriceLine({ price: stopLoss, color: "#ff5572", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "SL" })

    // Take profit levels — green
    takeProfitLevels.forEach((tp, i) => {
      const tpSeries = chart.addSeries(LineSeries, { color: "#00e5a0", lineWidth: 0 })
      tpSeries.createPriceLine({ price: tp, color: "#00e5a0", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: i === 0 ? "TP" : `TP${i + 1}` })
    })

    if (compact) return  // mini mode stops here

    // S/R zones
    overlays.supportResistance.forEach(sr => {
      const color = sr.type === "support" ? "#00e5a0" : "#ff5572"
      const s = chart.addSeries(LineSeries, { color, lineWidth: 0 })
      s.createPriceLine({ price: sr.price, color, lineWidth: sr.strength === "strong" ? 2 : 1, lineStyle: 0, axisLabelVisible: false, title: sr.type === "support" ? "S" : "R" })
    })

    // Trendlines — each as a two-point LineSeries
    overlays.trendlines.forEach(tl => {
      const color = tl.direction === "up" ? "#00e5a060" : "#ff557260"
      const tlSeries = chart.addSeries(LineSeries, { color, lineWidth: 1, lineStyle: 3 })
      tlSeries.setData([
        { time: toSec(tl.p1.time), value: tl.p1.price },
        { time: toSec(tl.p2.time), value: tl.p2.price },
      ])
    })

    // Wyckoff range rectangle (two horizontal lines)
    if (overlays.wyckoffRange) {
      const wHigh = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 0 })
      const wLow  = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 0 })
      wHigh.createPriceLine({ price: overlays.wyckoffRange.high, color: "#a78bfa80", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: `Wyckoff ${overlays.wyckoffRange.phase} Hi` })
      wLow.createPriceLine( { price: overlays.wyckoffRange.low,  color: "#a78bfa80", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: "Wyckoff Lo" })
    }

    // Elliott wave pivot markers — rendered as a connected line through pivot prices
    if (overlays.elliottPivots && overlays.elliottPivots.length >= 2) {
      const eSeries = chart.addSeries(LineSeries, { color: "#ffb020", lineWidth: 1, lineStyle: 3 })
      eSeries.setData(
        overlays.elliottPivots
          .filter(p => p.timestamp > 0)
          .map(p => ({ time: toSec(p.timestamp), value: p.price }))
      )
    }

    // Harmonic PRZ band
    if (overlays.harmonicPattern) {
      const hHigh = chart.addSeries(LineSeries, { color: "#00e5a0", lineWidth: 0 })
      const hLow  = chart.addSeries(LineSeries, { color: "#00e5a0", lineWidth: 0 })
      hHigh.createPriceLine({ price: overlays.harmonicPattern.prz_high, color: "#00e5a080", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: `${overlays.harmonicPattern.name} PRZ Hi` })
      hLow.createPriceLine(  { price: overlays.harmonicPattern.prz_low,  color: "#00e5a080", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: "PRZ Lo" })
    }
  }, [snapshot, compact])

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      height,
      layout:     { background: { color: "rgb(8,18,32)" }, textColor: "rgba(255,255,255,0.5)" },
      grid:       { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      crosshair:  { mode: 1 },
      timeScale:  { timeVisible: true, secondsVisible: false },
    })
    chartRef.current = chart

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:   "#00e5a0",
      downColor: "#ff5572",
      borderUpColor:   "#00e5a0",
      borderDownColor: "#ff5572",
      wickUpColor:     "#00e5a0",
      wickDownColor:   "#ff5572",
    })

    drawOverlays(chart)

    // Snapshot-at vertical marker — a single candle overlay at snapshotAt time
    const snapshotSec = toSec(new Date(snapshot.snapshotAt).getTime())

    // Load live candles
    getOhlcv(snapshot.binanceSymbol, timeframe)
      .then(({ candles }) => {
        const data = candles.map(c => ({
          time:  toSec(c.timestamp) as UTCTimestamp,
          open:  c.open,
          high:  c.high,
          low:   c.low,
          close: c.close,
        }))
        candleSeries.setData(data)
        chart.timeScale().fitContent()

        // Mark the snapshot timestamp with a vertical line via a custom marker
        candleSeries.setMarkers([{
          time:     snapshotSec,
          position: "aboveBar",
          color:    "#ffffff40",
          shape:    "arrowDown",
          text:     "Signal",
        }])
      })
      .catch(() => {/* ignore — chart still renders with overlays */})

    return () => { chart.remove(); chartRef.current = null }
  }, [snapshot, timeframe, height, drawOverlays])

  return <div ref={containerRef} style={{ width: "100%", height }} />
}
```

- [ ] **Step 3: Create `ChartModal.tsx`**

Create `src/components/AgentChart/ChartModal.tsx`:

```tsx
"use client";

import { useEffect, useCallback } from "react";
import { AgentChart }             from "./AgentChart";
import type { ChartSnapshot }     from "@/services/agent.service.frontend";

const TIMEFRAMES = ["15m", "1h", "4h", "1d", "1w"] as const;
type TF = (typeof TIMEFRAMES)[number];

const FRAMEWORK_COLORS: Record<string, string> = {
  SmartMoney:  "#36b6ff",
  Wyckoff:     "#a78bfa",
  ElliottWave: "#ffb020",
  Harmonic:    "#00e5a0",
};

interface Props {
  snapshot:  ChartSnapshot;
  timeframe: TF;
  onTimeframeChange: (tf: TF) => void;
  onClose: () => void;
}

export function ChartModal({ snapshot, timeframe, onTimeframeChange, onClose }: Props) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [handleKey])

  const frameworkColor = FRAMEWORK_COLORS[snapshot.framework] ?? "#94a3b8";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(1100px,96vw)", background: "rgb(8,14,26)",
          borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden", display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono)" }}>
            {snapshot.symbol}/USDC
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: frameworkColor, background: `${frameworkColor}20`, padding: "3px 9px", borderRadius: 6 }}>
            {snapshot.framework}
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            Confidence {snapshot.confidence}%
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>
            Signal at {new Date(snapshot.snapshotAt).toLocaleString()}
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}
          >×</button>
        </div>

        {/* Timeframe tabs */}
        <div style={{ display: "flex", gap: 4, padding: "10px 18px 0", background: "rgb(6,12,22)" }}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              style={{
                padding: "5px 14px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "var(--font-mono)",
                background: timeframe === tf ? frameworkColor : "rgba(255,255,255,0.06)",
                color:      timeframe === tf ? "#020609"         : "rgba(255,255,255,0.45)",
                transition: "all 0.15s ease",
              }}
            >{tf}</button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center", paddingBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#00e5a0", fontFamily: "var(--font-mono)" }}>
              SL {snapshot.stopLoss.toLocaleString()}
            </span>
            {snapshot.takeProfitLevels.map((tp, i) => (
              <span key={i} style={{ fontSize: 11, color: "#ff5572", fontFamily: "var(--font-mono)" }}>
                TP{i + 1} {tp.toLocaleString()}
              </span>
            ))}
          </div>
        </div>

        {/* Chart */}
        <AgentChart snapshot={snapshot} timeframe={timeframe} height={520} compact={false} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `MiniChart.tsx`**

Create `src/components/AgentChart/MiniChart.tsx`:

```tsx
"use client";

import { useState } from "react";
import { AgentChart }  from "./AgentChart";
import { ChartModal }  from "./ChartModal";
import type { ChartSnapshot } from "@/services/agent.service.frontend";

type TF = "15m" | "1h" | "4h" | "1d" | "1w";

interface Props {
  snapshot: ChartSnapshot;
}

export function MiniChart({ snapshot }: Props) {
  const [open, setOpen]           = useState(false);
  const [timeframe, setTimeframe] = useState<TF>("4h");

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        title="Click to expand chart"
        style={{ cursor: "pointer", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <AgentChart snapshot={snapshot} timeframe="4h" height={180} compact={true} />
      </div>

      {open && (
        <ChartModal
          snapshot={snapshot}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 5: Type-check**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/AgentChart/
git commit -m "feat(ui): add AgentChart, ChartModal, MiniChart with TradingView Lightweight Charts"
```

---

## Task 8: ChatDashboard — Pending Approval Section

**Files:**
- Modify: `src/components/AgentChat/ChatDashboard.tsx`

**Interfaces:**
- Consumes: `listApprovals`, `approveRun`, `rejectRun` (Task 6), `MiniChart` (Task 7), `ApprovalRun`, `ChartSnapshot` types (Task 6)
- Produces: "Pending Approval" section in the Runs tab with inline mini charts and Approve/Reject buttons

- [ ] **Step 1: Add imports to `ChatDashboard.tsx`**

At the top of the file, add:

```typescript
import { MiniChart }     from "@/components/AgentChart/MiniChart";
import {
  listApprovals as fetchApprovals,
  approveRun as doApprove,
  rejectRun  as doReject,
} from "@/services/agent.service.frontend";
import type { ApprovalRun } from "@/services/agent.service.frontend";
```

- [ ] **Step 2: Add state and fetch logic to `RunsTab`**

Inside the `RunsTab` component, add state for approvals after the existing `useState` declarations:

```typescript
const [approvals,  setApprovals]  = useState<ApprovalRun[]>([]);
const [approving,  setApproving]  = useState<string | null>(null);
```

Update the existing `load` callback to also fetch approvals:

```typescript
const load = useCallback(async () => {
  setLoading(true);
  try {
    const [r, s, a] = await Promise.all([
      apiClient.get<{ runs: AgentRun[]; total: number }>("/agent-runs?limit=20"),
      apiClient.get<AgentRunStats>("/agent-runs/stats"),
      fetchApprovals(),
    ]);
    setRuns(r.runs ?? []);
    setStats(s);
    setApprovals(a);
  } catch { /* ignore */ } finally { setLoading(false); }
}, []);
```

- [ ] **Step 3: Add Pending Approval section JSX inside `RunsTab`**

Add this block immediately before the `{/* Trigger button */}` comment in the `RunsTab` return:

```tsx
{/* ── Pending Approval ────────────────────────────────────────── */}
{approvals.length > 0 && (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <p style={{ fontSize: 10, color: "#a78bfa", letterSpacing: "0.08em", textTransform: "uppercase", margin: "4px 0 2px", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
      Pending Approval ({approvals.length})
    </p>
    {approvals.map(ap => {
      const intent = ap.decision?.intent;
      const isActing = approving === ap.runId;
      return (
        <div key={ap.runId} style={{
          borderRadius: 10, background: "rgb(8,18,32)",
          border: "1px solid rgba(167,139,250,0.25)",
          overflow: "hidden",
        }}>
          {/* Card header */}
          <div style={{ padding: "11px 12px 8px", display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <StatusBadge status="pending_approval" />
            {intent && <IntentBadge type={intent.type} />}
            {intent?.tokenOut && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono)" }}>
                {intent.tokenOut}/USDC
              </span>
            )}
            {intent?.amountUsd && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-mono)" }}>
                ${intent.amountUsd}
              </span>
            )}
            {ap.decision?.confidence != null && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
                {ap.decision.confidence}% conf
              </span>
            )}
          </div>

          {/* SL · TP summary */}
          {ap.chartSnapshot && (
            <div style={{ padding: "0 12px 8px", display: "flex", gap: 14 }}>
              <span style={{ fontSize: 11, color: "#ff5572", fontFamily: "var(--font-mono)" }}>
                SL {ap.chartSnapshot.stopLoss.toLocaleString()}
              </span>
              {ap.chartSnapshot.takeProfitLevels.slice(0, 2).map((tp, i) => (
                <span key={i} style={{ fontSize: 11, color: "#00e5a0", fontFamily: "var(--font-mono)" }}>
                  TP{i + 1} {tp.toLocaleString()}
                </span>
              ))}
              <span style={{ fontSize: 11, color: "#a78bfa", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>
                {ap.chartSnapshot.framework}
              </span>
            </div>
          )}

          {/* Mini chart (if snapshot available) */}
          {ap.chartSnapshot && (
            <div style={{ padding: "0 12px 10px" }}>
              <MiniChart snapshot={ap.chartSnapshot} />
            </div>
          )}

          {/* Approve / Reject buttons */}
          <div style={{ display: "flex", gap: 6, padding: "0 12px 12px" }}>
            <button
              disabled={isActing}
              onClick={async () => {
                setApproving(ap.runId);
                try { await doApprove(ap.runId); await load(); }
                catch { /* ignore */ }
                finally { setApproving(null); }
              }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                fontSize: 12, fontWeight: 700, cursor: isActing ? "not-allowed" : "pointer",
                background: isActing ? "rgba(0,229,160,0.2)" : "#00e5a0",
                color: isActing ? "rgba(255,255,255,0.3)" : "#020609",
                fontFamily: "var(--font-display,sans-serif)", transition: "all 0.15s ease",
              }}
            >{isActing ? "Processing…" : "✓ Approve"}</button>
            <button
              disabled={isActing}
              onClick={async () => {
                setApproving(ap.runId);
                try { await doReject(ap.runId); await load(); }
                catch { /* ignore */ }
                finally { setApproving(null); }
              }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid rgba(255,85,114,0.4)",
                fontSize: 12, fontWeight: 700, cursor: isActing ? "not-allowed" : "pointer",
                background: "transparent", color: isActing ? "rgba(255,255,255,0.2)" : "#ff5572",
                fontFamily: "var(--font-display,sans-serif)", transition: "all 0.15s ease",
              }}
            >✕ Reject</button>
          </div>
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 4: Type-check**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Full backend test suite**

```
cd services/api && npx jest --no-coverage
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/components/AgentChat/ChatDashboard.tsx
git commit -m "feat(ui): add Pending Approval section with MiniChart and Approve/Reject buttons"
```

---

## Self-Review

### Spec coverage check
- ✅ Manual approval queue: list/approve/reject endpoints + frontend section (Tasks 2, 5, 8)
- ✅ `IntentSchema` extended with SL/TP/entryZone/framework (Task 1)
- ✅ `'rejected'` status in enum and type (Task 1)
- ✅ `ChartSnapshot` data model (Task 1)
- ✅ chartSignal builds and passes snapshot via metadata (Task 3)
- ✅ agent.loop saves snapshot to AgentRunDoc (Task 3)
- ✅ OHLCV proxy endpoint (Task 4)
- ✅ TradingView Lightweight Charts component (Task 7)
- ✅ S/R lines overlay (Task 7 `drawOverlays`)
- ✅ Trendlines overlay (Tasks 3 + 7)
- ✅ Entry zone, SL, TP horizontal lines (Task 7)
- ✅ Framework-specific overlays: SmartMoney order blocks, Wyckoff range, Elliott pivots, Harmonic PRZ (Tasks 3 + 7)
- ✅ Snapshot-at vertical marker (Task 7)
- ✅ Multi-timeframe tabs 15m/1h/4h/1d/1w (Task 7 ChartModal)
- ✅ Mini preview on card + full-screen modal on click (Tasks 7 MiniChart + ChartModal)
- ✅ Approve bypasses kill switch by design (Task 2: `requireManualApproval: false, enabled: true`)
- ✅ Route order: `/approvals`, `/:runId/approve|reject` before `/:runId` (Task 5)
- ✅ TDD throughout backend tasks

### Type consistency check
- `ChartSnapshot` defined in `loop.types.ts` (Task 1) and mirrored in `agent.service.frontend.ts` (Task 6) — field names match exactly
- `ChartOverlay` (backend: `loop.types.ts`) matches frontend `ChartOverlay` interface — all field names identical
- `approveRun`/`rejectRun` exported from `agent.loop.ts` (Task 2) and imported in `agentRun.controller.ts` (Task 5) as `doApproveRun`/`doRejectRun`
- `getOhlcv` exported from `chartAnalysis.controller.ts` (Task 4) — matches test import
- `MiniChart` receives `ChartSnapshot` via `snapshot` prop — matches what `ChatDashboard` passes from `ap.chartSnapshot`

### Placeholder scan
No TBDs, TODOs, or "similar to Task N" references found. All code steps are complete.

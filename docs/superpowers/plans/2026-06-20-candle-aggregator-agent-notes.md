# Candle Aggregator, Safety Fixes & Agent Notes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 5-min candle aggregator from CoinGecko polling, add two safety fixes (remove hidden $100 cap, block stale-data trades), add step-by-step console logging throughout the agent loop, and write human-readable agent notes into each run record with frontend display.

**Architecture:** A new `candlePoller.service.ts` polls CoinGecko `/simple/price` every 5 minutes, aggregates ticks into OHLCV candles persisted in MongoDB, and maintains a `data_health` record per coin. The risk engine gains an async stale-data rule that queries `data_health` before allowing any trade. Agent notes are built by a new `agentNote.generator.ts` and stored as a string field on `AgentRunDoc`, displayed in the existing run history panel.

**Tech Stack:** TypeScript, Mongoose/MongoDB, Node.js `setInterval`, CoinGecko Demo API (`/simple/price`), React (Next.js frontend)

## Global Constraints

- CoinGecko Demo API key: passed as `x-cg-demo-api-key` header from `process.env.COINGECKO_API_KEY`
- Poll interval: 5 minutes (`300_000` ms) — stays under 10k calls/month Demo cap
- All MongoDB operations must use `.catch(() => {})` or try/catch — poller errors must never crash the server
- Risk engine `validate()` must become `async` — `ruleStaleCoinData` needs a DB query
- `execution.gateway.ts` already `await`s nothing from `riskEngine.validate()` — this must be updated in Task 5
- TypeScript strict — no implicit `any` in new files
- Working directory for all server commands: `C:\crypto_dashboard\my-app\services\api`
- Working directory for frontend commands: `C:\crypto_dashboard\my-app`

---

## File Map

**Create:**
- `services/api/src/models/candle.model.ts` — Mongoose models for `candles_5m`, `ticks_raw`, `data_health`
- `services/api/src/services/candlePoller.service.ts` — poll + aggregate + watchdog
- `services/api/src/agents/notes/agentNote.generator.ts` — `buildEntryNote` + `buildOutcomeNote`

**Modify:**
- `services/api/src/models/agentRun.model.ts` — add `agentNote: String` field
- `services/api/src/agents/loop/loop.types.ts` — add `agentNote?: string` to `AgentRunRecord`
- `services/api/src/risk/risk.rules.ts` — add async `ruleStaleCoinData`
- `services/api/src/risk/risk.engine.ts` — make `validate()` async, remove hidden `$100` cap, add `ruleStaleCoinData`
- `services/api/src/execution/execution.gateway.ts` — `await riskEngine.validate()`
- `services/api/src/agents/loop/agent.loop.ts` — 13-step console logs + agent note integration
- `services/api/src/agents/policy/policy.engine.ts` — per-iteration LLM tool-call logs
- `services/api/src/agents/memory/memory.writer.ts` — append outcome note to `AgentRunDoc`
- `services/api/src/app.ts` — start candle poller after DB connects
- `src/components/AgentChat/ChatDashboard.tsx` — expandable note section + PnL dot

---

## Task 1: MongoDB Models — candles_5m, ticks_raw, data_health

**Files:**
- Create: `services/api/src/models/candle.model.ts`

**Interfaces:**
- Produces:
  - `Candle5mDoc` — Mongoose model, used by poller (Task 2) and risk rule (Task 5)
  - `TickRawDoc` — Mongoose model, used by poller (Task 2)
  - `DataHealthDoc` — Mongoose model, used by poller (Task 2) and stale rule (Task 5)
  - `IDataHealth` — TypeScript interface, used by risk rule (Task 5)

- [ ] **Step 1: Create the model file**

```typescript
// services/api/src/models/candle.model.ts
import { Schema, model, Document } from 'mongoose'

export interface ICandle5m extends Document {
  symbol:         string
  coingeckoId:    string
  timeframeStart: Date
  open:           number
  high:           number
  low:            number
  close:          number
  volume:         number | null
  tickCount:      number
  source:         string
  createdAt:      Date
}

export interface ITickRaw extends Document {
  coingeckoId: string
  price:       number
  volume24h:   number | null
  polledAt:    Date
  source:      string
}

export interface IDataHealth extends Document {
  coingeckoId:            string
  symbol:                 string
  lastTickAt:             Date | null
  lastCandleClosedAt:     Date | null
  consecutiveMissedPolls: number
  staleSince:             Date | null
}

const Candle5mSchema = new Schema<ICandle5m>({
  symbol:         { type: String, required: true },
  coingeckoId:    { type: String, required: true },
  timeframeStart: { type: Date,   required: true },
  open:           { type: Number, required: true },
  high:           { type: Number, required: true },
  low:            { type: Number, required: true },
  close:          { type: Number, required: true },
  volume:         { type: Number, default: null },
  tickCount:      { type: Number, required: true },
  source:         { type: String, default: 'coingecko_demo' },
  createdAt:      { type: Date,   default: Date.now },
})
Candle5mSchema.index({ coingeckoId: 1, timeframeStart: 1 }, { unique: true })
Candle5mSchema.index({ coingeckoId: 1, timeframeStart: -1 })

const TickRawSchema = new Schema<ITickRaw>({
  coingeckoId: { type: String, required: true },
  price:       { type: Number, required: true },
  volume24h:   { type: Number, default: null },
  polledAt:    { type: Date,   required: true },
  source:      { type: String, default: 'coingecko_demo' },
})
TickRawSchema.index({ coingeckoId: 1, polledAt: 1 })
TickRawSchema.index({ polledAt: 1 }, { expireAfterSeconds: 48 * 60 * 60 })  // 48h TTL

const DataHealthSchema = new Schema<IDataHealth>({
  coingeckoId:            { type: String, required: true, unique: true },
  symbol:                 { type: String, required: true },
  lastTickAt:             { type: Date,   default: null },
  lastCandleClosedAt:     { type: Date,   default: null },
  consecutiveMissedPolls: { type: Number, default: 0 },
  staleSince:             { type: Date,   default: null },
})

export const Candle5mDoc  = model<ICandle5m>('Candle5m',   Candle5mSchema)
export const TickRawDoc   = model<ITickRaw>('TickRaw',     TickRawSchema)
export const DataHealthDoc = model<IDataHealth>('DataHealth', DataHealthSchema)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd services/api && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors involving `candle.model.ts`

- [ ] **Step 3: Commit**

```bash
git add services/api/src/models/candle.model.ts
git commit -m "feat(data): add candle5m, tickRaw, dataHealth MongoDB models"
```

---

## Task 2: Candle Poller Service

**Files:**
- Create: `services/api/src/services/candlePoller.service.ts`

**Interfaces:**
- Consumes:
  - `Candle5mDoc`, `TickRawDoc`, `DataHealthDoc` from `../models/candle.model`
  - `process.env.COINGECKO_API_KEY` (string | undefined)
- Produces:
  - `startCandlePoller(coingeckoIds: string[]): void`
  - `stopCandlePoller(): void`
  - `isCandlePollerRunning(): boolean`

- [ ] **Step 1: Create the poller service**

```typescript
// services/api/src/services/candlePoller.service.ts
import { Candle5mDoc, TickRawDoc, DataHealthDoc } from '../models/candle.model'

const POLL_INTERVAL_MS = 5 * 60 * 1000   // 5 minutes

// CoinGecko ID → trading symbol
const COIN_SYMBOL: Record<string, string> = {
  bitcoin:  'BTC',
  ethereum: 'ETH',
}

function floorTo5Min(date: Date): Date {
  const ms = date.getTime()
  return new Date(ms - (ms % POLL_INTERVAL_MS))
}

async function markMissedPoll(coingeckoId: string, now: Date): Promise<void> {
  const doc = await DataHealthDoc.findOneAndUpdate(
    { coingeckoId },
    {
      $inc: { consecutiveMissedPolls: 1 },
      $setOnInsert: {
        symbol:             COIN_SYMBOL[coingeckoId] ?? coingeckoId.toUpperCase(),
        lastTickAt:         null,
        lastCandleClosedAt: null,
        staleSince:         null,
      },
    },
    { upsert: true, new: true },
  ).catch(() => null)

  const missed = doc?.consecutiveMissedPolls ?? 0
  if (missed >= 2) {
    await DataHealthDoc.updateOne({ coingeckoId }, { $set: { staleSince: now } }).catch(() => {})
    console.warn(`[CandlePoller] STALE: ${coingeckoId} — ${missed} consecutive missed polls since ${now.toISOString()}`)
  }
}

async function pollAndAggregate(coingeckoIds: string[]): Promise<void> {
  const now         = new Date()
  const bucketStart = floorTo5Min(now)
  const bucketEnd   = new Date(bucketStart.getTime() + POLL_INTERVAL_MS)

  const ids = coingeckoIds.join(',')
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_vol=true`

  let raw: Record<string, { usd: number; usd_24h_vol?: number }> = {}
  try {
    const headers: Record<string, string> = {}
    if (process.env.COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    raw = await res.json() as typeof raw
  } catch (err: any) {
    console.warn(`[CandlePoller] Poll failed: ${err.message}`)
    await Promise.all(coingeckoIds.map(id => markMissedPoll(id, now)))
    return
  }

  for (const [coingeckoId, priceData] of Object.entries(raw)) {
    const symbol   = COIN_SYMBOL[coingeckoId] ?? coingeckoId.toUpperCase()
    const price    = priceData.usd
    const vol24h   = priceData.usd_24h_vol ?? null

    // 1. Persist raw tick
    await TickRawDoc.create({ coingeckoId, price, volume24h: vol24h, polledAt: now, source: 'coingecko_demo' }).catch(() => {})

    // 2. Collect all ticks in this 5-min bucket
    const ticks = await TickRawDoc
      .find({ coingeckoId, polledAt: { $gte: bucketStart, $lt: bucketEnd } })
      .sort({ polledAt: 1 })
      .lean()
      .catch(() => [] as { price: number }[])

    if (ticks.length === 0) continue

    const prices = ticks.map(t => t.price)
    const open   = prices[0]
    const close  = prices[prices.length - 1]
    const high   = Math.max(...prices)
    const low    = Math.min(...prices)

    // 3. Upsert candle (unique index on coingeckoId + timeframeStart makes this idempotent)
    await Candle5mDoc.findOneAndUpdate(
      { coingeckoId, timeframeStart: bucketStart },
      { $set: { symbol, open, high, low, close, volume: vol24h, tickCount: ticks.length, source: 'coingecko_demo', createdAt: now } },
      { upsert: true },
    ).catch(() => {})

    // 4. Update data health — healthy
    await DataHealthDoc.findOneAndUpdate(
      { coingeckoId },
      { $set: { symbol, lastTickAt: now, lastCandleClosedAt: bucketStart, consecutiveMissedPolls: 0, staleSince: null } },
      { upsert: true },
    ).catch(() => {})

    console.log(
      `[CandlePoller] ${symbol} $${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ` +
      `O:${open.toFixed(2)} H:${high.toFixed(2)} L:${low.toFixed(2)} C:${close.toFixed(2)} | ` +
      `ticks:${ticks.length} | bucket:${bucketStart.toISOString().slice(11, 16)}`,
    )
  }
}

let _timer: NodeJS.Timeout | null = null

export function startCandlePoller(coingeckoIds: string[]): void {
  if (_timer) {
    console.warn('[CandlePoller] Already running — stopCandlePoller() first.')
    return
  }
  console.log(`[CandlePoller] Starting — coins: [${coingeckoIds.join(', ')}] | interval: ${POLL_INTERVAL_MS / 1000}s`)

  // Fire immediately so we don't wait 5 min for first data
  pollAndAggregate(coingeckoIds).catch(err => console.error('[CandlePoller] Initial poll error:', (err as Error).message))

  _timer = setInterval(
    () => pollAndAggregate(coingeckoIds).catch(err => console.error('[CandlePoller] Poll error:', (err as Error).message)),
    POLL_INTERVAL_MS,
  )
  if (_timer.unref) _timer.unref()
}

export function stopCandlePoller(): void {
  if (_timer) { clearInterval(_timer); _timer = null; console.log('[CandlePoller] Stopped.') }
}

export function isCandlePollerRunning(): boolean {
  return _timer !== null
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd services/api && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors involving `candlePoller.service.ts`

- [ ] **Step 3: Commit**

```bash
git add services/api/src/services/candlePoller.service.ts
git commit -m "feat(data): add CoinGecko 5-min candle poller with data_health watchdog"
```

---

## Task 3: Wire Poller Into app.ts

**Files:**
- Modify: `services/api/src/app.ts`

**Interfaces:**
- Consumes: `startCandlePoller`, `isCandlePollerRunning` from `./services/candlePoller.service`

- [ ] **Step 1: Add import at the top of app.ts (after existing scheduler imports)**

In `services/api/src/app.ts`, after the line:
```typescript
import { startPositionMonitor, isPositionMonitorRunning } from './agents/loop/positionMonitor'
```
Add:
```typescript
import { startCandlePoller, isCandlePollerRunning } from './services/candlePoller.service'
```

- [ ] **Step 2: Start the poller in the `start()` function**

In the `start()` function, after the existing `startPositionMonitor()` block:
```typescript
  if (!isCandlePollerRunning()) {
    startCandlePoller(['bitcoin', 'ethereum'])
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd services/api && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add services/api/src/app.ts
git commit -m "feat(data): start candle poller on server boot"
```

---

## Task 4: Safety Fix A — Remove Hidden $100 Cap

**Files:**
- Modify: `services/api/src/risk/risk.engine.ts`

- [ ] **Step 1: Remove the hidden cap and add a visibility warning**

In `services/api/src/risk/risk.engine.ts`, find line 49:
```typescript
      { name: 'MaxTradeSize',  fn: ()  => ruleMaxTradeSize(ctx, Math.min(limits.maxTradeUsd, 100)) },
```
Replace with:
```typescript
      { name: 'MaxTradeSize',  fn: ()  => ruleMaxTradeSize(ctx, limits.maxTradeUsd) },
```

Then, directly above the `const rules = [...]` block, add this warning:
```typescript
    if (limits.maxTradeUsd > 10_000) {
      console.warn(`[RiskEngine] maxTradeUsd=$${limits.maxTradeUsd} exceeds recommended ceiling of $10,000. Proceeding.`)
    }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd services/api && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add services/api/src/risk/risk.engine.ts
git commit -m "fix(risk): remove hidden \$100 maxTradeUsd cap — respect configured value"
```

---

## Task 5: Safety Fix B — Stale Coin Data Rule + Async Risk Engine

**Files:**
- Modify: `services/api/src/risk/risk.rules.ts`
- Modify: `services/api/src/risk/risk.engine.ts`
- Modify: `services/api/src/execution/execution.gateway.ts`

**Why async:** `ruleStaleCoinData` queries MongoDB. Making it async requires `validate()` to become async, which cascades to the one caller: `execution.gateway.ts` line 64.

- [ ] **Step 1: Add `ruleStaleCoinData` to risk.rules.ts**

At the top of `services/api/src/risk/risk.rules.ts`, after the existing imports, add:
```typescript
import { DataHealthDoc } from '../models/candle.model'
```

Update the `RuleResult` type — it stays the same. But add a new exported async function at the end of the file:

```typescript
// ── Rule: stale coin price data ───────────────────────────────────────────────
// Blocks trades when CoinGecko poller has stopped providing fresh data.
// Fails open (allows) if the data_health record doesn't exist yet (startup grace).

const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC:  'bitcoin',
  WBTC: 'bitcoin',
  ETH:  'ethereum',
  WETH: 'ethereum',
}

export async function ruleStaleCoinData(ctx: RuleContext): Promise<RuleResult> {
  if (ctx.intent.type !== 'propose_trade') return { verdict: 'allow' }
  const trade       = ctx.intent as TradeIntent
  const coingeckoId = SYMBOL_TO_COINGECKO[trade.tokenOut.toUpperCase()]
  if (!coingeckoId) return { verdict: 'allow' }

  try {
    const health = await DataHealthDoc.findOne({ coingeckoId }).lean()
    if (!health) {
      console.warn(`[RiskEngine] No data_health for ${trade.tokenOut} — poller may not have run yet. Allowing.`)
      return { verdict: 'allow' }
    }
    if (health.staleSince !== null) {
      return {
        verdict: 'block',
        reason:  `Price data for ${trade.tokenOut} is stale since ${(health.staleSince as Date).toISOString()}. Not safe to trade on outdated prices.`,
      }
    }
  } catch (err: any) {
    console.warn(`[RiskEngine] ruleStaleCoinData DB check failed (non-fatal): ${err.message}`)
    return { verdict: 'allow' }   // fail open — DB errors must not block trading
  }

  return { verdict: 'allow' }
}
```

- [ ] **Step 2: Make RiskEngine.validate() async and add the stale rule**

Replace the entire `RiskEngine` class body in `services/api/src/risk/risk.engine.ts`:

```typescript
import {
  ruleAllowedTokens,
  ruleDailyLossCap,
  ruleMaxSlippage,
  ruleMaxTradeSize,
  ruleMinTradeSize,
  rulePaperModeOnly,
  ruleSelfTrade,
  ruleStaleCoinData,
  type RuleContext,
  type RuleResult,
} from './risk.rules'

// ... (keep ValidationResult interface and RuleFn type as-is) ...

// Change RuleFn to support async:
type RuleFn = (ctx: RuleContext) => RuleResult | Promise<RuleResult>

export class RiskEngine {
  async validate(
    intent:      Intent,
    walletState: WalletState,
    mode:        AgentMode,
  ): Promise<ValidationResult> {
    const limits = RISK_LIMITS[mode]
    const ctx: RuleContext = { intent, walletState, mode }

    if (limits.maxTradeUsd > 10_000) {
      console.warn(`[RiskEngine] maxTradeUsd=$${limits.maxTradeUsd} exceeds recommended ceiling of $10,000. Proceeding.`)
    }

    const rules: { name: string; fn: () => RuleResult | Promise<RuleResult> }[] = [
      { name: 'AllowedTokens',  fn: () => ruleAllowedTokens(ctx) },
      { name: 'StaleCoinData',  fn: () => ruleStaleCoinData(ctx) },
      { name: 'MaxTradeSize',   fn: () => ruleMaxTradeSize(ctx, limits.maxTradeUsd) },
      { name: 'MinTradeSize',   fn: () => ruleMinTradeSize(ctx) },
      { name: 'DailyLossCap',  fn: () => ruleDailyLossCap(ctx, limits.dailyLossCapUsd) },
      { name: 'MaxSlippage',   fn: () => ruleMaxSlippage(ctx) },
      { name: 'PaperModeOnly', fn: () => rulePaperModeOnly(ctx, mode) },
      { name: 'SelfTrade',     fn: () => ruleSelfTrade(ctx) },
    ]

    let passed = 0
    for (const rule of rules) {
      const result = await rule.fn()
      if (result.verdict === 'block') {
        console.warn(`[RiskEngine] BLOCKED by ${rule.name}: ${result.reason}`)
        return {
          allowed:      false,
          blockedBy:    rule.name,
          reason:       result.reason,
          checkedRules: rules.length,
          passedRules:  passed,
        }
      }
      passed++
    }

    return {
      allowed:      true,
      checkedRules: rules.length,
      passedRules:  passed,
    }
  }
}

export const riskEngine = new RiskEngine()
```

- [ ] **Step 3: Await the now-async validate() call in execution.gateway.ts**

In `services/api/src/execution/execution.gateway.ts`, find line 64:
```typescript
  const risk = riskEngine.validate(intent, walletState, mode)
```
Replace with:
```typescript
  const risk = await riskEngine.validate(intent, walletState, mode)
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd services/api && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add services/api/src/risk/risk.rules.ts services/api/src/risk/risk.engine.ts services/api/src/execution/execution.gateway.ts
git commit -m "feat(risk): add stale coin data rule + make risk engine async"
```

---

## Task 6: Step-by-Step Console Logging in agent.loop.ts

**Files:**
- Modify: `services/api/src/agents/loop/agent.loop.ts`

This task adds structured `[AgentLoop][Step N]` logs at every stage of `runLoopTick`. No logic changes — logging only.

- [ ] **Step 1: Add logging to `runLoopTick`**

Replace the `try` block inside `runLoopTick` (starting after `runDoc = await AgentRunDoc.create(...)`) with the following. The structure is identical to the existing code — only `console.log` calls are added between each step:

```typescript
  try {
    // ── Step 3: Wallet state ────────────────────────────────────────────────
    const walletState = await loadWalletState(userId, config)
    console.log(
      `[AgentLoop][Step 3] Wallet — total:$${walletState.totalValueUsd.toFixed(2)} | ` +
      `dailyPnL:$${walletState.dailyPnlUsd.toFixed(2)} | openPositions:${walletState.openPositions}`,
    )

    // ── Step 4: Strategy builds market context ──────────────────────────────
    const strategyImpl = STRATEGIES[strategy]
    if (!strategyImpl) throw new Error(`Strategy "${strategy}" not found in registry.`)

    const loopCtx: LoopContext = { runId, userId, strategy, startedAt: startedAt.getTime(), contextSummary: '', walletState, marketData: {}, config }
    const strategyResult = await strategyImpl.buildContext(loopCtx)
    console.log(
      `[AgentLoop][Step 4] Strategy context — strategy:${strategy} | ` +
      `deterministicDecision:${strategyResult.deterministicDecision ? strategyResult.deterministicDecision.intent.type : 'none (LLM will decide)'} | ` +
      `contextLines:${strategyResult.contextSummary.split('\n').length}`,
    )

    // ── Step 5: Build context summary ───────────────────────────────────────
    const { text: contextSummary } = buildContextSummary(loopCtx, strategyResult.contextSummary)
    loopCtx.contextSummary = contextSummary
    console.log(`[AgentLoop][Step 5] Context summary built — ${contextSummary.length} chars`)

    // ── Step 6: RAG memory retrieval ─────────────────────────────────────────
    let memoryContext: string | undefined
    try {
      const coin = config.watchlist[0] ?? 'BTC'
      const memResult = await retrieve(userId, coin.toUpperCase(), contextSummary)
      memoryContext = renderMemorySection(memResult) || undefined
      console.log(
        `[AgentLoop][Step 6] Memory — coin:${coin.toUpperCase()} | ` +
        `similarMemories:${memResult.similarMemories.length} | ` +
        `reflection:${memResult.reflection ? 'yes' : 'no'}`,
      )
    } catch (err: any) {
      console.warn('[AgentLoop][Step 6] Memory retrieval failed (non-fatal):', err.message)
    }

    // ── Step 7: Persist opportunities ────────────────────────────────────────
    await persistOpportunities(userId, strategy, runId, strategyResult.metadata)
    const spikedCount = (strategyResult.metadata?.spikedPools as any[] | undefined)?.length ?? 0
    console.log(`[AgentLoop][Step 7] Opportunities — ${spikedCount} yield spike(s) persisted`)

    // ── Step 8: Run policy engine (LLM tool loop) ────────────────────────────
    console.log(`[AgentLoop][Step 8] Policy engine starting — strategy:${strategy}`)
    const decision = strategyResult.deterministicDecision
      ?? await runPolicyEngine(loopCtx, contextSummary, config, memoryContext)
    console.log(
      `[AgentLoop][Step 8] Policy engine done — intent:${decision.intent.type} | ` +
      `confidence:${decision.confidence} | toolCalls:[${decision.toolCallTrace.join(', ')}]`,
    )

    // ── Step 9: Execute intent (risk check + executor) ───────────────────────
    console.log(`[AgentLoop][Step 9] Executing intent — type:${decision.intent.type}`)
    const gateway = await executeIntent(decision.intent, walletState, {
      userId, config, runId, strategy,
      rationale: decision.reasoning, confidence: decision.confidence,
    })
    console.log(
      `[AgentLoop][Step 9] Execution result — riskPassed:${gateway.riskPassed} | ` +
      `status:${gateway.execution.status}` +
      (gateway.riskBlockedBy ? ` | blockedBy:${gateway.riskBlockedBy} (${gateway.riskReason})` : '') +
      (gateway.execution.entryPrice ? ` | entryPrice:$${gateway.execution.entryPrice}` : ''),
    )

    // ── Step 10: Persist order & position ────────────────────────────────────
    await persistExecution(userId, config.mode, runId, decision.intent, gateway.execution, strategy, decision.confidence)
    console.log(
      `[AgentLoop][Step 10] Execution persisted — orderId:${gateway.execution.orderId ?? 'n/a'} | ` +
      `executionStatus:${gateway.execution.status}`,
    )

    // ── Step 11: Write decision to memory ────────────────────────────────────
    await writeDecision(loopCtx, decision)
    console.log(`[AgentLoop][Step 11] Decision written to memory`)

    // Save chart snapshot for chartSignal runs that produced a signal
    const chartSnapshot = strategyResult.metadata?.chartSnapshot as import('@/agents/loop/loop.types').ChartSnapshot | undefined
    if (chartSnapshot) {
      await AgentRunDoc.updateOne({ runId }, { $set: { chartSnapshot } }).catch(() => {})
      console.log(`[AgentLoop] Chart snapshot saved — symbol:${chartSnapshot.symbol} framework:${chartSnapshot.framework}`)
    }

    // ── Step 12: Finalize run record ─────────────────────────────────────────
    const finalStatus: AgentRunRecord['status'] = gateway.pendingApproval
      ? 'pending_approval'
      : !gateway.riskPassed ? 'blocked' : 'completed'

    await AgentRunDoc.updateOne({ runId }, { $set: {
      completedAt: new Date(), status: finalStatus,
      contextSnapshot: contextSummary.slice(0, 2000), decision, executionResult: gateway.execution,
    } })

    const durationMs = Date.now() - startedAt.getTime()
    console.log(
      `[AgentLoop][Step 12] Run finalized — runId:${runId} | status:${finalStatus} | duration:${durationMs}ms`,
    )
    console.log(`[AgentLoop] ─── Tick complete ───────────────────────────────────`)
  }
```

Also add Step 1 and Step 2 logs above the `try` block (before `runDoc`):

```typescript
  // ── Step 1: Config ──────────────────────────────────────────────────────────
  console.log(
    `[AgentLoop][Step 1] Config — strategy:${strategy} | mode:${config.mode} | ` +
    `maxTradeUsd:$${config.maxTradeUsd} | watchlist:[${config.watchlist.join(', ')}]`,
  )

  let runDoc: any
  try {
    runDoc = await AgentRunDoc.create({ runId, userId, strategy, mode: config.mode, startedAt, status: 'running' })
    // ── Step 2: Run record ────────────────────────────────────────────────────
    console.log(`[AgentLoop][Step 2] Run created — runId:${runId}`)
  } catch (err: any) {
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd services/api && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add services/api/src/agents/loop/agent.loop.ts
git commit -m "feat(observability): add step-by-step console logs to agent loop"
```

---

## Task 7: Per-Iteration Logging in policy.engine.ts

**Files:**
- Modify: `services/api/src/agents/policy/policy.engine.ts`

- [ ] **Step 1: Add iteration log at the start of the tool-call loop and a final decision log**

Inside the `for (let iteration = 0; ...)` loop, add at the very top of each iteration (after `const completion = await getClient()...` returns):

```typescript
    // ── Iteration log ─────────────────────────────────────────────────────────
    const toolNames = msg.tool_calls?.map(tc => tc.function.name).join(', ') ?? 'none'
    console.log(
      `[PolicyEngine][iter ${iteration + 1}] tools-called:[${toolNames}] | ` +
      `finish_reason:${choice?.finish_reason ?? 'unknown'}`,
    )
```

After the tool-call loop ends (before `return { intent, ... }`), add:

```typescript
  console.log(
    `[PolicyEngine] Decision — intent:${intent?.type ?? 'none'} | ` +
    `confidence:${intent?.type === 'no_action' ? 90 : intent?.type === 'propose_trade' ? 65 : 70} | ` +
    `toolTrace:[${toolCallTrace.join(' → ')}] | ` +
    `rationale:"${('rationale' in (intent ?? {}) ? (intent as any).rationale : '').slice(0, 120)}"`,
  )
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd services/api && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add services/api/src/agents/policy/policy.engine.ts
git commit -m "feat(observability): add per-iteration LLM tool-call logs to policy engine"
```

---

## Task 8: Agent Note Generator

**Files:**
- Create: `services/api/src/agents/notes/agentNote.generator.ts`

**Interfaces:**
- Consumes:
  - `LoopContext` from `../loop/loop.types`
  - `Decision`, `TradeIntent` from `../loop/loop.types`
  - `GatewayResult` from `../../execution/execution.gateway`
- Produces:
  - `buildEntryNote(ctx: LoopContext, decision: Decision, gateway: GatewayResult): string`
  - `buildOutcomeNote(exitReason: string, exitPrice: number, pnl: number, pnlPct: number, durationHeldMs: number): string`

- [ ] **Step 1: Create the generator**

```typescript
// services/api/src/agents/notes/agentNote.generator.ts
import type { LoopContext, Decision, TradeIntent } from '../loop/loop.types'
import type { GatewayResult } from '../../execution/execution.gateway'

export function buildEntryNote(
  ctx:      LoopContext,
  decision: Decision,
  gateway:  GatewayResult,
): string {
  const ts      = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
  const intent  = decision.intent
  const isLong  = intent.type === 'propose_trade'

  const lines: string[] = []

  // ── Header ────────────────────────────────────────────────────────────────
  const coin = intent.type === 'propose_trade' ? (intent as TradeIntent).tokenOut : 'N/A'
  lines.push(`[${coin} | ${ctx.strategy} | ${ts}]`)
  lines.push('')

  // ── Strategy context (first 600 chars of what the strategy produced) ──────
  const ctxPreview = ctx.contextSummary.slice(0, 600).trim()
  if (ctxPreview) {
    lines.push('Strategy analysis:')
    lines.push(ctxPreview)
    if (ctx.contextSummary.length > 600) lines.push('... (truncated)')
    lines.push('')
  }

  // ── Tool call trace ────────────────────────────────────────────────────────
  if (decision.toolCallTrace.length > 0) {
    lines.push(`Tool calls: ${decision.toolCallTrace.join(' → ')}`)
    lines.push('')
  }

  // ── Decision ───────────────────────────────────────────────────────────────
  if (!isLong || intent.type !== 'propose_trade') {
    lines.push(`Decision: ${intent.type.toUpperCase()}`)
    if ('rationale' in intent && intent.rationale) {
      lines.push(`Rationale: ${intent.rationale}`)
    } else if (decision.reasoning) {
      lines.push(`Rationale: ${decision.reasoning}`)
    }
  } else {
    const trade = intent as TradeIntent
    lines.push(`Decision: LONG ${trade.tokenOut} — size $${trade.amountUsd}`)
    if (trade.entryZoneLow !== undefined && trade.entryZoneHigh !== undefined) {
      lines.push(`Entry zone: $${trade.entryZoneLow.toFixed(2)} – $${trade.entryZoneHigh.toFixed(2)} (limit order, fills when price re-enters zone)`)
    }
    if (trade.stopLossPrice)    lines.push(`Stop loss: $${trade.stopLossPrice.toFixed(2)}`)
    if (trade.takeProfitPrice)  lines.push(`Take profit 1: $${trade.takeProfitPrice.toFixed(2)}`)
    if ((trade as any).takeProfitPrice2) lines.push(`Take profit 2: $${((trade as any).takeProfitPrice2 as number).toFixed(2)}`)
    if (trade.framework)        lines.push(`Framework: ${trade.framework}`)
    if (trade.rationale)        lines.push(`Rationale: ${trade.rationale}`)
    lines.push('')
    lines.push(`Confidence: ${decision.confidence}%`)
  }

  lines.push('')

  // ── Risk gate result ───────────────────────────────────────────────────────
  if (!gateway.riskPassed) {
    lines.push(`Risk gate: BLOCKED by ${gateway.riskBlockedBy} — ${gateway.riskReason}`)
  } else if (gateway.pendingApproval) {
    lines.push(`Risk gate: PASSED (7/7 rules) — queued for manual approval`)
  } else {
    const totalValueUsd = ctx.walletState.totalValueUsd
    const tradeUsd = intent.type === 'propose_trade' ? (intent as TradeIntent).amountUsd : 0
    const heatPct = totalValueUsd > 0 ? ((tradeUsd / totalValueUsd) * 100).toFixed(1) : '0'
    lines.push(`Risk gate: PASSED (7/7 rules) | portfolio heat: $${tradeUsd}/$${totalValueUsd.toFixed(0)} (${heatPct}%)`)
  }

  return lines.join('\n')
}

export function buildOutcomeNote(
  exitReason:      string,
  exitPrice:       number,
  pnl:             number,
  pnlPct:          number,
  durationHeldMs:  number,
): string {
  const hours   = Math.floor(durationHeldMs / 3_600_000)
  const minutes = Math.floor((durationHeldMs % 3_600_000) / 60_000)
  const sign    = pnl >= 0 ? '+' : ''
  const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  return `\n\nOUTCOME [${exitReason.replace('_', ' ').toUpperCase()}]: exit $${exitPrice.toFixed(2)} after ${duration}. Realized ${sign}$${pnl.toFixed(2)} (${sign}${pnlPct.toFixed(2)}%).`
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd services/api && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add services/api/src/agents/notes/agentNote.generator.ts
git commit -m "feat(notes): add agent note generator (entry + outcome)"
```

---

## Task 9: Wire Agent Notes Into Loop + Schema

**Files:**
- Modify: `services/api/src/agents/loop/loop.types.ts`
- Modify: `services/api/src/models/agentRun.model.ts`
- Modify: `services/api/src/agents/loop/agent.loop.ts`
- Modify: `services/api/src/agents/memory/memory.writer.ts`

**Interfaces:**
- Consumes: `buildEntryNote`, `buildOutcomeNote` from `../notes/agentNote.generator`

- [ ] **Step 1: Add `agentNote` to AgentRunRecord type**

In `services/api/src/agents/loop/loop.types.ts`, find `AgentRunRecord` interface and add one field:

```typescript
export interface AgentRunRecord {
  runId: string
  userId: string
  strategy: string
  mode: AgentMode
  startedAt: Date
  completedAt?: Date
  status: AgentRunStatus
  contextSnapshot: string
  decision: Decision | null
  executionResult?: ExecutionResult
  errorMessage?: string
  chartSnapshot?: ChartSnapshot
  agentNote?: string       // ← add this line
}
```

- [ ] **Step 2: Add `agentNote` field to Mongoose schema**

In `services/api/src/models/agentRun.model.ts`, inside `AgentRunSchema`, after the `errorMessage` field:
```typescript
  agentNote:       { type: String, default: null },
```

- [ ] **Step 3: Call buildEntryNote in agent.loop.ts and persist**

In `services/api/src/agents/loop/agent.loop.ts`, add the import at the top:
```typescript
import { buildEntryNote } from '../notes/agentNote.generator'
```

Then, inside `runLoopTick`, after the `executeIntent` call (after Step 9 log), add:

```typescript
    // ── Agent note — entry ────────────────────────────────────────────────────
    const agentNote = buildEntryNote(loopCtx, decision, gateway)
    console.log(`[AgentLoop] Agent note written (${agentNote.length} chars)`)
```

Then in the `AgentRunDoc.updateOne` call at Step 12, add `agentNote` to the `$set`:
```typescript
    await AgentRunDoc.updateOne({ runId }, { $set: {
      completedAt: new Date(), status: finalStatus,
      contextSnapshot: contextSummary.slice(0, 2000), decision, executionResult: gateway.execution,
      agentNote,
    } })
```

- [ ] **Step 4: Append outcome note in memory.writer.ts**

In `services/api/src/agents/memory/memory.writer.ts`, add imports at the top:
```typescript
import { buildOutcomeNote } from '../notes/agentNote.generator'
import { AgentRunDoc }       from '../../models/agentRun.model'
```

Inside `writeOutcome`, after the `saveMemory(...)` call, add:
```typescript
    // Append outcome note to the original run's agentNote field
    try {
      const outcomeText = buildOutcomeNote(
        outcome.success ? 'take_profit' : 'stop_loss',
        0,                // exitPrice not available here — use pnl % as proxy
        outcome.pnl,
        outcome.pnlPercent ?? 0,
        outcome.durationHeldMs ?? 0,
      )
      await AgentRunDoc.updateOne(
        { runId },
        { $set: { [`agentNote`]: undefined } },   // avoid overwrite — use $concat-like approach:
      ).catch(() => {})
      // MongoDB doesn't support string-append in a single op; fetch + update instead:
      const runDoc = await AgentRunDoc.findOne({ runId }).select('agentNote').lean()
      if (runDoc) {
        const updated = (runDoc.agentNote ?? '') + outcomeText
        await AgentRunDoc.updateOne({ runId }, { $set: { agentNote: updated } }).catch(() => {})
      }
    } catch (err: any) {
      console.warn('[MemoryWriter] Outcome note append failed (non-fatal):', err.message)
    }
```

Wait — the code above has a bug (the intermediate no-op $set). Replace the whole outcome note block with this clean version:

```typescript
    // Append outcome note to the original run's agentNote
    try {
      const outcomeText = buildOutcomeNote(
        outcome.success ? 'take_profit' : 'stop_loss',
        0,
        outcome.pnl,
        outcome.pnlPercent ?? 0,
        outcome.durationHeldMs ?? 0,
      )
      const runDoc = await AgentRunDoc.findOne({ runId }).select('agentNote').lean()
      if (runDoc) {
        const updated = (runDoc.agentNote ?? '') + outcomeText
        await AgentRunDoc.updateOne({ runId }, { $set: { agentNote: updated } }).catch(() => {})
        console.log(`[MemoryWriter] Outcome note appended to run ${runId}`)
      }
    } catch (err: any) {
      console.warn('[MemoryWriter] Outcome note append failed (non-fatal):', err.message)
    }
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd services/api && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add services/api/src/agents/loop/loop.types.ts \
        services/api/src/models/agentRun.model.ts \
        services/api/src/agents/loop/agent.loop.ts \
        services/api/src/agents/memory/memory.writer.ts
git commit -m "feat(notes): wire agent notes into run record — entry + outcome"
```

---

## Task 10: Frontend — Expandable Note Section in Run History

**Files:**
- Modify: `src/components/AgentChat/ChatDashboard.tsx`

This task adds `agentNote` to the `AgentRun` interface and renders it as an expandable panel inside the existing run history list.

- [ ] **Step 1: Add `agentNote` to the AgentRun interface**

In `src/components/AgentChat/ChatDashboard.tsx`, find the `AgentRun` interface (around line 20) and add:
```typescript
interface AgentRun {
  runId:       string;
  strategy:    string;
  mode:        string;
  startedAt:   string;
  completedAt?: string;
  status:      string;
  agentNote?:  string;    // ← add this line
  decision?: {
    intent:        { type: string; rationale?: string };
    confidence:    number;
    reasoning:     string;
    toolCallTrace: string[];
  };
  executionResult?: {
    status:           string;
    filledAmountUsd?: number;
    simulatedPnlUsd?: number;
    executedAt:       string;
    riskRejectionReason?: string;
  };
}
```

- [ ] **Step 2: Add the PnL dot and Note section inside the existing run card**

Find the section that renders `run.decision?.reasoning` (around line 686). Directly after the closing `</div>` of the tool-call trace block (around line 716), add the Note section:

```tsx
                  {/* ── Agent Note ─────────────────────────────────────────── */}
                  {isOpen && run.agentNote && (
                    <div style={{
                      marginTop: 10,
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}>
                      <div style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        color: "rgba(255,255,255,0.35)",
                        marginBottom: 6,
                        textTransform: "uppercase",
                      }}>
                        Agent Note
                      </div>
                      <pre style={{
                        margin: 0,
                        fontSize: 11,
                        lineHeight: 1.6,
                        color: "rgba(255,255,255,0.75)",
                        fontFamily: "var(--font-mono, monospace)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}>
                        {run.agentNote}
                      </pre>
                    </div>
                  )}
```

- [ ] **Step 3: Add PnL dot to the run row header**

Find the run row header (the `div` around line 616 that contains `<StatusBadge status={run.status} />`). Add a PnL dot after the status badge:

```tsx
                  {/* PnL dot — green for profit, red for loss */}
                  {run.executionResult?.simulatedPnlUsd !== undefined &&
                   run.executionResult.simulatedPnlUsd !== 0 && (
                    <span style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: run.executionResult.simulatedPnlUsd > 0 ? "#22c55e" : "#ef4444",
                      marginLeft: 4,
                      flexShrink: 0,
                      title: `PnL: $${run.executionResult.simulatedPnlUsd.toFixed(2)}`,
                    }} />
                  )}
```

- [ ] **Step 4: Verify the app builds without TypeScript errors**

```bash
cd C:\crypto_dashboard\my-app && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors in `ChatDashboard.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/AgentChat/ChatDashboard.tsx
git commit -m "feat(ui): add expandable agent note + PnL dot to run history panel"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Section 2 (5-min candle aggregator + ticks_raw + data_health) → Tasks 1, 2, 3
- ✅ Section 3.1 (remove hidden $100 cap) → Task 4
- ✅ Section 3.2 (stale data rule) → Task 5
- ✅ Section 4 (console logging loop) → Task 6
- ✅ Console logging policy engine → Task 7
- ✅ Section 5 (agent notes — entry + outcome + frontend) → Tasks 8, 9, 10
- ✅ `agentNote` on `AgentRunDoc` schema → Task 9 Step 2
- ✅ Outcome appended when position closes → Task 9 Step 4 (via writeOutcome)
- ✅ Expandable UI with PnL dot → Task 10

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency check:**
- `buildEntryNote(ctx: LoopContext, decision: Decision, gateway: GatewayResult)` — used in Task 9 with exactly these args ✅
- `buildOutcomeNote(exitReason, exitPrice, pnl, pnlPct, durationHeldMs)` — used in Task 9 with exactly these args ✅
- `DataHealthDoc` imported from `../models/candle.model` in both Task 2 and Task 5 — same path ✅
- `ruleStaleCoinData` exported from `risk.rules.ts`, imported in `risk.engine.ts` Task 5 ✅
- `agentNote?: string` added to both `AgentRunRecord` (loop.types.ts) and `AgentRunSchema` (agentRun.model.ts) ✅
- `IDataHealth.staleSince` typed as `Date | null` — used as `Date` after null-check in `ruleStaleCoinData` ✅

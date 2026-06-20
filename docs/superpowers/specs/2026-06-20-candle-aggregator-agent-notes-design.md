# Design Spec: Candle Aggregator, Safety Fixes & Agent Notes
**Date:** 2026-06-20
**Status:** Approved
**Scope:** Step 1 (data layer) + Step 2 (safety fixes) + console logging + agent notes

---

## 1. Overview

Four distinct improvements shipped together because they share a dependency chain:
the candle aggregator provides the data foundation, the safety fixes use that data to
block stale-coin trades, console logging threads through the existing loop, and agent
notes write structured reasoning into the same run record the frontend already reads.

**What is NOT in scope:** ATR-based sizing, confidence-from-convergence,
multi-strategy fan-out. Those are Step 3–5 and depend on candle history that doesn't
exist yet.

---

## 2. Data Layer — 5-Min Candle Aggregator

### 2.1 Why Aggregation

CoinGecko Demo plan's `market_chart/range` returns a single price point every 5 minutes
— that is a close price, not an OHLC candle. Feeding open=high=low=close candles into
pattern-detection strategies (Wyckoff, Elliott, Harmonic, SmartMoney) breaks any logic
that depends on wicks or range. The aggregator polls `/simple/price` and builds real
candles locally.

### 2.2 Poll Cadence

Poll every **5 minutes** via a single batched call:
```
GET /simple/price?ids=bitcoin,ethereum&include_24hr_vol=true&vs_currencies=usd
```
One call per poll cycle regardless of coin count (up to ~250 ids per call).
Monthly cost: ~8,640 calls/month — safely under the 10k Demo cap.

Trade-off: 5-min polling means each candle bucket gets only 1 tick, so early
`open=high=low=close` candles are expected. This corrects itself over time as
multiple ticks accumulate per bucket if the poll fires mid-bucket on restart.
The code handles N ticks per bucket without changes.

### 2.3 MongoDB Collections

#### `candles_5m`
```
{
  symbol:          String,           // "BTC"
  coingeckoId:     String,           // "bitcoin"
  timeframeStart:  Date,             // UTC, floored to :00/:05/:10...
  open:            Number,
  high:            Number,
  low:             Number,
  close:           Number,
  volume:          Number | null,    // null = CoinGecko didn't provide windowed vol
  tickCount:       Number,           // raw polls aggregated into this candle
  source:          "coingecko_demo",
  createdAt:       Date
}
```
**Indexes:**
- Compound unique on `(coingeckoId, timeframeStart)` — makes upsert idempotent
- Single on `(coingeckoId, timeframeStart: -1)` for range queries

#### `ticks_raw`
```
{
  coingeckoId:  String,
  price:        Number,
  volume24h:    Number | null,
  polledAt:     Date,
  source:       "coingecko_demo"
}
```
**Indexes:**
- TTL on `polledAt` (48h expiry) — auto-purged, never grows forever
- Single on `(coingeckoId, polledAt)` for candle reconstruction queries

#### `data_health`
```
{
  coingeckoId:             String,   // unique
  symbol:                  String,
  lastTickAt:              Date | null,
  lastCandleClosedAt:      Date | null,
  consecutiveMissedPolls:  Number,
  staleSince:              Date | null   // null = healthy
}
```
**Index:** Unique on `coingeckoId`

### 2.4 New Service: `candlePoller.service.ts`

**Location:** `services/api/src/services/candlePoller.service.ts`

**Responsibilities:**
1. `startCandlePoller(coingeckoIds: string[])` — starts `setInterval` at 5-min cadence
2. Per poll cycle:
   - Call `/simple/price` batched for all ids
   - Persist each price as `tick_raw`
   - For each coin: collect ticks within the current 5-min bucket, compute OHLCV, upsert `candles_5m`
   - Update `data_health` doc — set `lastTickAt`, reset `consecutiveMissedPolls`
   - Watchdog inline: if `lastTickAt` is older than 2x poll interval → set `staleSince`, emit warn log
3. On poll failure: increment `consecutiveMissedPolls`, set `staleSince` after 2 consecutive misses
4. `stopCandlePoller()` — clears interval
5. `getCandlePollerStatus()` — returns running state

**Integration:** Started in `server.ts` alongside `startScheduler()`. Reads watchlist
coin IDs from a config (initially hardcoded `['bitcoin', 'ethereum']`, later driven by
active user watchlists).

**Bucket floor helper:**
```typescript
function floorTo5Min(date: Date): Date {
  const ms = date.getTime()
  return new Date(ms - (ms % (5 * 60 * 1000)))
}
```

---

## 3. Safety Fixes

### 3.1 Remove Hidden $100 Cap

**File:** `services/api/src/risk/risk.engine.ts:49`

**Current:** `ruleMaxTradeSize(ctx, Math.min(limits.maxTradeUsd, 100))`
**Fix:** `ruleMaxTradeSize(ctx, limits.maxTradeUsd)`

Add a `console.warn` (not a block) if configured value exceeds $10,000:
```
[RiskEngine] WARNING: maxTradeUsd=$X exceeds recommended ceiling of $10,000. Proceeding.
```

### 3.2 Stale Coin Data Hard Rule

**File:** `services/api/src/risk/risk.rules.ts`

New exported rule `ruleStaleCoinData`:
- Only applies to `propose_trade` intents
- Derives `coingeckoId` from `tokenOut` (BTC → bitcoin, ETH → ethereum)
- Queries `data_health` collection
- If `staleSince !== null` → `verdict: 'block'` with reason:
  `"Price data for {token} is stale since {staleSince}. Not safe to trade on outdated prices."`
- If `data_health` doc doesn't exist yet (poller hasn't run) → `verdict: 'allow'` with a
  console warn (don't block on missing data during initial startup)

**Added to `risk.engine.ts` rule chain** after `ruleAllowedTokens` (second position —
check allowed first, then check freshness).

---

## 4. Console Logging — Step-by-Step Agent Loop

**File:** `services/api/src/agents/loop/agent.loop.ts`

Structured logs added at every step. Format: `[AgentLoop][Step N] ...`

| Step | What is logged |
|------|---------------|
| 1 | Config loaded: strategy, mode, maxTradeUsd, watchlist |
| 2 | Run created: runId |
| 3 | Wallet state: totalValueUsd, dailyPnL, openPositions count |
| 4 | Strategy result: which frameworks ran, which produced signals, confidence per signal |
| 5 | Context summary: char count |
| 6 | Memory retrieved: N similar memories, reflection present y/n |
| 7 | Opportunities: N yield spikes persisted |
| 8 | Policy engine: each LLM iteration with tool called + result summary |
| 9 | Risk check: N/7 rules passed, or blocked-by rule name + reason |
| 10 | Execution result: status, entryZone, SL, TP |
| 11 | Position persisted: positionId, status (open/pending/skipped) |
| 12 | Decision written to memory |
| 13 | Run finalized: final status, total duration ms |

**Policy engine logging** added to `policy.engine.ts`:
- Per LLM iteration: iteration number, tool called, key output value
- Final decision: intent type, confidence, rationale (first 200 chars)

**Position monitor logging** already exists; add outcome log on close:
```
[PositionMonitor] Outcome: pos-xxx | BTC | entry $103,200 | exit $105,820 (TP1) | PnL +$2.41 (+2.4%) | held 11.2h
```

---

## 5. Agent Notes

### 5.1 Storage

Agent notes live as a new `agentNote` field (String) on `AgentRunDoc`. No new
collection. The outcome note is appended when a position closes via
`memory.writer.ts → writeOutcome()`.

**Schema addition to `agentRun.model.ts`:**
```typescript
agentNote: { type: String, default: null }
```

### 5.2 Note Generator

**New file:** `services/api/src/agents/notes/agentNote.generator.ts`

Two exported functions:

**`buildEntryNote(ctx, decision, walletState, riskResult)`** — called after risk check,
before execution. Produces plain-English note covering:
- Which strategies ran and their signal/confidence (or skip reason)
- Why the agent acted or didn't act (convergence count, confidence vs threshold)
- Entry zone, SL, TP and the framework rationale behind each level
- Risk gate result: N/7 rules passed, portfolio heat %

**`buildOutcomeNote(position, exitReason, pnl, pnlPct, durationHeldMs)`** — called from
`writeOutcome()` when a position closes. Returns a short outcome string appended to the
existing `agentNote` on the run doc:
```
\n\nOUTCOME [{exitReason}]: exit $X after Nh. Realized ${pnl} ({pnlPct}%).
```

### 5.3 Integration Points

- `agent.loop.ts` — call `buildEntryNote()` after `executeIntent`, persist via
  `AgentRunDoc.updateOne({ runId }, { $set: { agentNote } })`
- `memory.writer.ts → writeOutcome()` — call `buildOutcomeNote()`, append to
  existing `agentNote` field on the linked run doc
- `positionMonitor.ts → closePosition()` — already calls `writeOutcome()`; no change
  needed there

### 5.4 Frontend

**Location:** existing agent run history panel (wherever `AgentRunDoc` records are
displayed).

Add an expandable "Note" section per run row:
- Collapsed by default — shows first line of note as preview
- Click to expand full note text
- If outcome has been appended, show it below a horizontal rule
- Closed/completed runs with outcome show a green (profit) or red (loss) dot on the row

---

## 6. Implementation Sequence

Do these in order — each step depends on the previous:

1. **MongoDB models** — `candles_5m`, `ticks_raw`, `data_health` schemas + models
2. **Candle poller service** — `candlePoller.service.ts` + integration in `server.ts`
3. **Safety fix A** — remove hidden $100 cap in `risk.engine.ts`
4. **Safety fix B** — `ruleStaleCoinData` in `risk.rules.ts` + wire into `risk.engine.ts`
5. **Console logging** — step-by-step logs in `agent.loop.ts` + `policy.engine.ts`
6. **Agent note generator** — `agentNote.generator.ts`
7. **Agent note integration** — wire into `agent.loop.ts` + `memory.writer.ts`
8. **AgentRunDoc schema update** — add `agentNote` field
9. **Frontend note display** — expandable note section in run history panel

---

## 7. What This Does NOT Change

- Existing OHLCV ingestion from Binance (`ohlcv.ingest.ts`) — untouched. The new
  candles complement it, they don't replace it.
- Agent strategy logic — untouched in this phase.
- Memory/RAG system — writeOutcome gains a note-append side effect only.
- Execution modes — paper/CEX/onchain unchanged.

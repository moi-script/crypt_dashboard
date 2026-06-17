# Design: Chart Visualization + Manual Trade Approval Queue

**Date:** 2026-06-18
**Branch:** feat/per-account-agent-wallet
**Status:** Approved

---

## Overview

Two tightly related features built together:

1. **Manual trade-approval queue** — when Auto-Trade is off, proposed trades surface as actionable cards (Approve / Reject) instead of being silently dropped.
2. **Chart visualization** — each proposal card embeds a live candlestick chart (TradingView Lightweight Charts) with the agent's analysis overlays drawn on it: support/resistance, trendlines, entry zone, SL, TP, and framework-specific patterns.

These two features compose naturally: you see the chart inside the approval card and decide whether to approve or reject the trade.

---

## Scope

### In scope
- Approval queue: list, approve, reject pending_approval runs
- Chart snapshot stored per chartSignal run (slim overlay data only)
- OHLCV proxy endpoint (backend → Binance via existing `ohlcvIngest`)
- `AgentChart` component (TradingView Lightweight Charts), mini preview + full-screen modal
- Timeframe tabs: 15m / 1h / 4h / 1d / 1w, freely switchable
- S/R lines, trendlines, entry zone band, SL/TP horizontal lines
- Framework-specific overlays: order blocks (SmartMoney), Elliott wave pivot labels, Wyckoff range box, harmonic XABCD zigzag + PRZ band
- Snapshot-at vertical marker on chart (shows when agent analyzed)

### Out of scope
- News / sentiment feeds
- Multi-coin scanning beyond BTC + ETH (chartSignal already limits to these)
- Approval expiry (90-day TTL inherited from AgentRunDoc)
- Live / CEX mode (paper only for now)

---

## Data Model

### `IntentSchema` extensions (`models/agentRun.model.ts`)

Add to existing `IntentSchema`:

```
stopLossPrice    Number
takeProfitPrice  Number
entryZoneLow     Number
entryZoneHigh    Number
framework        String
```

### Status enum extension

Add `'rejected'` to the `status` enum in `AgentRunSchema`.

### New `ChartSnapshot` type (`agents/loop/loop.types.ts`)

```typescript
interface ChartOverlayTimeframe {
  supportResistance: Array<{
    price: number
    type: 'support' | 'resistance'
    strength: 'strong' | 'moderate' | 'weak'
  }>
  trendlines: Array<{
    p1: { time: number; price: number }
    p2: { time: number; price: number }
    direction: 'up' | 'down'
  }>
  // Framework-specific (only one is populated per run)
  orderBlocks?: Array<{ high: number; low: number; type: 'bullish' | 'bearish'; status: string }>
  elliottPivots?: Array<{ price: number; timestamp: number; waveLabel: string }>
  wyckoffRange?: { high: number; low: number; phase: string }
  harmonicPattern?: { name: string; prz_high: number; prz_low: number; xabcd: Record<string, number>; xabcd_ts: Record<string, number> }
}

interface ChartSnapshot {
  symbol: string            // 'BTC' | 'ETH'
  binanceSymbol: string     // 'BTCUSDT' | 'ETHUSDT'
  framework: string         // 'SmartMoney' | 'Wyckoff' | 'ElliottWave' | 'Harmonic'
  snapshotAt: Date
  entryZone: { low: number; high: number }
  stopLoss: number
  takeProfitLevels: number[]
  confidence: number
  overlays: Record<'1h' | '4h' | '1d', ChartOverlayTimeframe>
}
```

Add `chartSnapshot?: ChartSnapshot` to `AgentRunRecord`.

Add `'rejected'` to `AgentRunStatus`.

**Size:** ~3–5 KB per run. 90-day TTL inherited from existing AgentRunDoc index.

---

## Backend Changes

### `models/agentRun.model.ts`
- Extend `IntentSchema` with `stopLossPrice`, `takeProfitPrice`, `entryZoneLow`, `entryZoneHigh`, `framework`
- Add `'rejected'` to status enum
- Add `ChartSnapshotSchema` (mirrors `ChartSnapshot` above) as optional field on `AgentRunSchema`

### `agents/loop/loop.types.ts`
- Add `'rejected'` to `AgentRunStatus`
- Add `chartSnapshot?: ChartSnapshot` to `AgentRunRecord`
- Export `ChartSnapshot` and `ChartOverlayTimeframe` interfaces

### `agents/policy/strategies/chartSignal.strategy.ts`
- When a winning signal is selected, the full `MarketPrimitives` for each symbol/timeframe is already in scope from `buildMarketPrimitives`
- Pass primitives into `metadata` keyed as `primitivesByTimeframe: Record<string, MarketPrimitives>` alongside the existing `deterministicDecision`
- No new fetches — data is already computed

### `agents/loop/agent.loop.ts`
- After `buildContext`, if `strategy === 'chartSignal'` and `metadata.primitivesByTimeframe` exists and the decision is a `propose_trade`:
  - Extract slim overlay data from primitives (S/R zones, trendlines from zigzag pivots, framework-specific structures)
  - Build `ChartSnapshot` and save it to the AgentRunDoc (`$set: { chartSnapshot }`)
- Export `approveRun(userId: string, runId: string): Promise<ExecutionResult>`
  - Find `pending_approval` run by runId + userId → 404 if missing
  - Build replay config with `requireManualApproval: false, enabled: true`
  - Call `loadWalletState` → `executeIntent` → `persistExecution`
  - Update run: `status: 'completed'`, `executionResult`, `completedAt`
  - Return execution result
- Export `rejectRun(userId: string, runId: string): Promise<void>`
  - Find `pending_approval` run → 404 if missing
  - Update: `status: 'rejected'`, `completedAt: new Date()`
  - Never creates a position

### `controllers/agentRun.controller.ts`
- `listApprovals(req, res)` → query `AgentRunDoc.find({ userId, status: 'pending_approval' })`, return `runId, strategy, decision, chartSnapshot, startedAt`
- `approveRunController(req, res)` → call `approveRun(userId, req.params.runId)`, return result
- `rejectRunController(req, res)` → call `rejectRun(userId, req.params.runId)`, return 204

### `routes/agentRun.routes.ts`
Register in this order (before existing `GET /:runId`):
```
GET  /approvals
POST /:runId/approve
POST /:runId/reject
GET  /:runId          (existing)
```
All under existing `router.use(auth)`.

### New `controllers/chart.controller.ts` + `routes/chart.routes.ts`
- `GET /api/chart/ohlcv?symbol=BTCUSDT&timeframe=4h&limit=300`
- Validates `symbol` (BTCUSDT | ETHUSDT), `timeframe` (15m|1h|4h|1d|1w), `limit` (max 500)
- Calls `ohlcvIngest({ symbol, timeframe, limit })` — reuses existing Binance client + Redis cache
- Returns `{ symbol, timeframe, candles: Candle[] }`
- Auth-gated

---

## Frontend Changes

### Package
```
npm install lightweight-charts
```
Install in the frontend package.

### `services/agent.service.frontend.ts`
Add:
```typescript
listApprovals(): Promise<ApprovalRun[]>
approveRun(runId: string): Promise<ExecutionResult>
rejectRun(runId: string): Promise<void>
getOhlcv(symbol: string, timeframe: string, limit: number): Promise<{ candles: Candle[] }>
```

### `components/AgentChart/AgentChart.tsx` (new)
Core chart component used in both mini and full-screen modes.

Props:
```typescript
{
  snapshot: ChartSnapshot
  timeframe: '15m' | '1h' | '4h' | '1d' | '1w'
  height: number
  compact?: boolean   // true = mini mode, fewer overlays
}
```

Behavior:
- On mount + timeframe change: fetch `getOhlcv(snapshot.binanceSymbol, timeframe, 300)`
- Render `CandlestickSeries` with live candles
- Render from snapshot overlays (frozen to what agent saw):
  - S/R: `LineSeries` horizontal lines, green=support / red=resistance, labeled with strength
  - Trendlines: `LineSeries` from p1→p2, dashed, direction color-coded
  - Entry zone: two horizontal `LineSeries` with amber fill band between them
  - SL: red dashed horizontal line
  - TP levels: green dashed horizontal lines (one per level)
  - `snapshotAt` vertical line: marks when the agent ran
  - Framework-specific (full mode only):
    - SmartMoney: order block rectangles (blue=bullish, orange=bearish)
    - Elliott: pivot point markers labeled Wave 1–5/A–C
    - Wyckoff: range rectangle + phase label
    - Harmonic: XABCD zigzag + PRZ band
- In `compact` mode: only entry zone + SL + TP rendered (keeps mini preview readable)

### `components/AgentChart/ChartModal.tsx` (new)
Full-screen modal.
- Timeframe tabs: `15m | 1h | 4h | 1d | 1w`
- Header: coin name + logo, framework badge (color per framework), confidence score, signal time
- Full-height `AgentChart` with all overlays
- Close on ESC or click-outside

### `components/AgentChart/MiniChart.tsx` (new)
Card-embedded preview.
- Fixed height 180px
- Defaults to 4h, no tabs
- `AgentChart` in `compact` mode
- Entire component is clickable → opens `ChartModal`

### `components/AgentChat/ChatDashboard.tsx` — Runs tab
- Fetch `listApprovals()` on load alongside existing run list
- Render "Pending Approval" section above the run list
- One card per approval:
  - Header: pair / amount / strategy / confidence
  - SL · TP summary line
  - `MiniChart` embedded (if `chartSnapshot` present)
  - Approve (green) / Reject (red) buttons
  - On Approve/Reject: call service method → reload both approvals and run list
- Reuse existing card styling, `pnlColor`, `IntentBadge` patterns

---

## Tests

**API tests** (`services/api`, using `connectTestDb` + `mockRes()` pattern):

1. Seed `pending_approval` AgentRunDoc with chart-signal intent (SL/TP + entryZone) → `approveRun` produces a pending limit `PositionDoc` and flips run to `completed`
2. Seed market `propose_trade` → `approveRun` fills and sets `executionResult`
3. `rejectRun` sets `status: 'rejected'`, never creates a position
4. Both functions are userId-scoped: another user's runId → 404
5. `listApprovals` returns only caller's `pending_approval` runs
6. `GET /api/chart/ohlcv` returns a `candles` array for valid symbol + timeframe; rejects invalid inputs

Write failing tests first (TDD), then implement to make them pass.

---

## Verification

1. `cd services/api && npx jest` — all green
2. `npx tsc --noEmit` — clean on both `services/api` and frontend
3. Manual flow:
   - Auto-Trade off → agent tick fires → chartSignal proposes a trade
   - Card appears in "Pending Approval" section of Runs tab with mini chart
   - Click chart → full-screen modal opens, timeframe tabs work, all overlay lines visible
   - Approve → position created (pending limit for chart-signal) → run flips to completed
   - Reject → run marked rejected, wallet balance unchanged

---

## Non-Goals

- No approval expiry (runs TTL at 90 days already)
- Approve bypasses kill switch by design (explicit human release)
- No news/sentiment integration
- No coins beyond BTC + ETH for chartSignal

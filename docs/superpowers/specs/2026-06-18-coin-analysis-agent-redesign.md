# Coin Analysis Agent Redesign
**Date:** 2026-06-18
**Branch:** feat/agent-rag-memory
**Status:** Approved

---

## Problem

The current agent loop burns tokens at an unsustainable rate. It iterates every coin on every user's watchlist, runs all 4 chart frameworks sequentially, and passes each through up to 5 LLM tool-call iterations — potentially 15,000+ tokens per scheduler tick per user. This can exhaust 40M tokens in a single day.

---

## Goal

Redesign the chart-signal path so that:
1. Analysis targets **one coin at a time**, selected by the user
2. **News articles** are embedded into RAG memory and injected as context into every analysis run
3. **All 4 strategy frameworks** run in parallel and each produce a self-contained output card (chart + LLM narrative + news impact)
4. An **auto/manual approval toggle** controls whether the best signal executes automatically or waits for a per-card button press
5. Token usage per run drops to ~1,200 output tokens (4 × 300-token narratives) vs 15,000+ today

---

## Approach

**Approach B — New `CoinAnalysisRun` pathway alongside the existing loop.**

A dedicated `runCoinAnalysis` function handles the chart-signal use case. The existing agent loop (`runLoopTick`) remains intact for non-chart strategies (yieldHunter, rebalance, airdropWatch). The scheduler calls the appropriate path based on which strategy is active in config.

---

## Architecture

### Entry Points

| Trigger | Path |
|---|---|
| Scheduler tick (watchlist coin) | `scheduler.ts` → `runCoinAnalysis(userId, watchlist[0], 'scheduler')` |
| On-demand button (any coin) | `POST /api/coin-analysis/trigger { symbol }` → `runCoinAnalysis(userId, symbol, 'on_demand')` |

### New Files

```
services/api/src/agents/coinAnalysis/
  coinAnalysis.runner.ts       # main runCoinAnalysis() function
  coinAnalysis.types.ts        # CoinAnalysisRun, StrategyCard, NewsImpact types
  coinAnalysis.routes.ts       # /trigger, /:runId/cards/:framework/approve|reject

services/api/src/agents/news/
  news.ingestor.ts             # embed + store news articles into RAG memory
  news.impact.ts               # scoreNewsImpact() pure function
```

### Modified Files

```
services/api/src/agents/loop/scheduler.ts          # route chartSignal → runCoinAnalysis
services/api/src/agents/memory/memory.types.ts     # add 'news' to MemoryEntryType
services/api/src/models/coinAnalysisRun.model.ts   # new Mongoose model
services/api/src/config/agent.config.ts            # add selectedCoin field
services/api/src/routes/index.ts                   # mount coinAnalysis.routes
```

---

## Data Model

### `CoinAnalysisRunDoc`

```typescript
coinAnalysisRunId  string
userId             string
symbol             string                          // e.g. "BTC"
triggeredBy        "scheduler" | "on_demand"
status             "running" | "completed" | "failed" | "pending_approval" | "auto_executed"
startedAt          Date
completedAt?       Date
strategyCards      StrategyCard[]                  // always 4, one per framework
autoMode           boolean                         // snapshot of requireManualApproval at run time
newsArticlesUsed   string[]                        // ArticleDoc _id strings
```

### `StrategyCard` (embedded)

```typescript
framework          "SmartMoney" | "Wyckoff" | "ElliottWave" | "Harmonic"
signal             TradeSignal | null
chartSnapshot      ChartSnapshot                   // existing type
llmNarrative       string                          // ≤300 tokens
newsImpact         {
  verdict          "supports" | "contradicts" | "neutral"
  confidenceDelta  number                          // -10 to +5 applied to signal.confidence
  headlines        Array<{ title: string; sentiment: number }>   // top 3
}
approvalStatus     "pending" | "approved" | "rejected" | "auto_executed" | "skipped"
```

### `NewsMemoryEntry` (extends `AgentMemoryEntry`)

New `type: 'news'` variant added to `MemoryEntryType`. Extra fields on the shared `AgentMemoryDoc`:
```typescript
articleId    string
headline     string
sentiment    number    // -1 to 1
coins        string[]
publishedAt  Date
```
Embedding is `headline + ". " + summary` — same DeepSeek embedder as decisions/outcomes.

---

## News RAG Pipeline (`news.ingestor.ts`)

Called at the start of every `runCoinAnalysis`:

1. `NewsService.getForCoin(symbol, 10)` — fetches up to 10 recent articles (existing service, no changes)
2. For each article not yet in `AgentMemoryDoc` (check by `articleId`): embed and save a `NewsMemoryEntry`
3. Return the **3 most recent articles** as direct context for this run
4. The existing `memory.retriever.ts` vector search surfaces past news entries naturally — no retriever changes needed

### News Impact Scoring (`news.impact.ts`)

Pure function `scoreNewsImpact(articles: NewsArticle[], signal: TradeSignal | null): NewsImpact`:

- Uses `article.sentiment` field (existing on `ArticleDoc`, currently `0` — populated by keyword scorer fallback until a model is wired)
- Keyword scorer: bullish keywords (`bullish`, `breakout`, `rally`, `adoption`, `ETF`, `ATH`) → +1; bearish keywords (`crash`, `ban`, `hack`, `SEC`, `lawsuit`, `dump`) → -1; neutral otherwise
- Aggregate = average of 3 article scores → `bullish (>0.2) | bearish (<-0.2) | neutral`
- If aggregate contradicts signal bias → `verdict: "contradicts"`, `confidenceDelta: -10`
- If aggregate supports signal bias → `verdict: "supports"`, `confidenceDelta: +5`
- Adjusted confidence = `signal.confidence + confidenceDelta` (clamped 0–100)

---

## Parallel Strategy Runner (`coinAnalysis.runner.ts`)

```
runCoinAnalysis(userId, symbol, triggeredBy):
  1. Create CoinAnalysisRunDoc { status: 'running' }
  2. news = await ingestAndFetchNews(userId, symbol)         // news.ingestor.ts
  3. primitives = await buildMarketPrimitives(binanceSymbol) // ONE fetch, shared
  4. contextSummary = buildContextSummary(...)
  5. memoryContext = await retrieve(userId, symbol, contextSummary)
  6. cards = await Promise.all([
       runStrategyCard('SmartMoney',  primitives, news, memoryContext),
       runStrategyCard('Wyckoff',     primitives, news, memoryContext),
       runStrategyCard('ElliottWave', primitives, news, memoryContext),
       runStrategyCard('Harmonic',    primitives, news, memoryContext),
     ])
  7. route to approval (Section below)
  8. Update CoinAnalysisRunDoc
```

**`runStrategyCard(framework, primitives, articles, memoryContext)`:**
1. Run deterministic strategy (e.g. `runSmartMoneyStrategy(primitives)`)
2. `scoreNewsImpact(articles, signal)` → `newsImpact`, adjusted confidence
3. `buildChartSnapshot(...)` (existing function, moved to shared util)
4. Single LLM call: narrative prompt with signal + news headlines → `llmNarrative` (`max_tokens: 300`)
5. Return `StrategyCard`

**Token budget per run:** 4 × ~300 output tokens = ~1,200 tokens. No tool-call loops during analysis.

---

## Approval Flow

### Auto Mode (`requireManualApproval: false`)

```
qualifying = cards where signal != null AND adjustedConfidence >= config.minSignalConfidence
if empty → status: 'completed', no trade
best = max(qualifying, by adjustedConfidence)
executeIntent(best.signal → TradeIntent)
best.approvalStatus = 'auto_executed'
others.approvalStatus = 'skipped'
CoinAnalysisRunDoc.status = 'auto_executed'
```

### Manual Mode (`requireManualApproval: true`)

```
CoinAnalysisRunDoc.status = 'pending_approval'
cards with signal → approvalStatus: 'pending'
cards with no signal → approvalStatus: 'skipped'
→ UI renders 4 cards each with Approve / Reject buttons
```

Multiple cards can be approved in one run (each produces its own order).

### Approval API Endpoints

| Method | Path | Action |
|---|---|---|
| `POST` | `/api/coin-analysis/trigger` | Start on-demand run, returns `coinAnalysisRunId` |
| `GET` | `/api/coin-analysis/:runId` | Poll run status + all 4 cards |
| `POST` | `/api/coin-analysis/:runId/cards/:framework/approve` | Execute that card's signal |
| `POST` | `/api/coin-analysis/:runId/cards/:framework/reject` | Mark card rejected |

---

## Scheduler Integration

`scheduler.ts` change (minimal):

```typescript
// Before (inside runLoopTick):
// always ran chartSignal as one of the strategies

// After (inside runEnabledUserTicks):
if (config.strategies.chartSignal && config.watchlist[0]) {
  await runCoinAnalysis(userId, config.watchlist[0], 'scheduler')
} else {
  await runLoopTick(userId)   // yieldHunter / rebalance / airdropWatch unchanged
}
```

---

## Coin Selection in AgentConfig

`AgentConfig` gains one optional field:

```typescript
selectedCoin?: string   // coin pinned for on-demand runs (e.g. "BTC")
                        // watchlist[0] is used for scheduled runs
```

The dashboard coin picker writes to `selectedCoin`. The "Run Analysis" button sends `{ symbol: config.selectedCoin ?? 'BTC' }` to the trigger endpoint.

---

## Out of Scope

- WebSocket push for real-time card results (polling via `GET /api/coin-analysis/:runId` is sufficient for now)
- Replacing the sentiment keyword scorer with a proper embedding-based model
- Short-biased signals (spot-only paper wallet cannot simulate shorts — existing constraint unchanged)
- Changes to yieldHunter, rebalance, or airdropWatch strategies

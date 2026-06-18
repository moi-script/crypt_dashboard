# Coin Analysis Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the token-burning multi-coin agent loop with a per-coin `CoinAnalysisRun` pathway that runs 4 strategy cards in parallel, embeds news into RAG, and routes to auto-execute or per-card approval buttons.

**Architecture:** A new `coinAnalysis/` module introduces `runCoinAnalysis()` as the entry point for the chart-signal path. The existing `runLoopTick()` loop is untouched and continues to serve yieldHunter/rebalance/airdropWatch. The scheduler routes `chartSignal`-enabled users to the new path; an on-demand API endpoint handles manual triggers.

**Tech Stack:** TypeScript, Express, Mongoose, Jest + ts-jest, DeepSeek via OpenAI SDK, HuggingFace Transformers (local embedder)

## Global Constraints

- All imports use `@/` alias (maps to `src/`) — never relative `../../../`
- Tests live in `__tests__/` subdirectories, file pattern `*.test.ts`
- Run tests with `npx jest <path>` from `services/api/`
- Never call `runPolicyEngine` from the coin analysis path — narratives use direct `deepseek.chat.completions.create` with `max_tokens: 300`
- `requireManualApproval: false` = auto mode, `true` = manual mode
- Paper wallet is spot-only — short-biased signals get `approvalStatus: 'skipped'`
- `buildMarketPrimitives` is called **once** per `runCoinAnalysis` and shared across all 4 strategy cards

---

## File Map

### New Files
```
services/api/src/agents/coinAnalysis/coinAnalysis.types.ts
services/api/src/agents/coinAnalysis/coinAnalysis.runner.ts
services/api/src/agents/coinAnalysis/chartSnapshot.util.ts
services/api/src/agents/coinAnalysis/__tests__/coinAnalysis.runner.test.ts
services/api/src/agents/news/news.impact.ts
services/api/src/agents/news/news.ingestor.ts
services/api/src/agents/news/__tests__/news.impact.test.ts
services/api/src/agents/news/__tests__/news.ingestor.test.ts
services/api/src/models/coinAnalysisRun.model.ts
services/api/src/routes/coinAnalysis.routes.ts
```

### Modified Files
```
services/api/src/agents/memory/memory.types.ts         — add 'news' to MemoryEntryType + news fields
services/api/src/models/agentMemory.model.ts           — add 'news' to enum + optional news fields
services/api/src/config/agent.config.ts                — add selectedCoin?: string
services/api/src/agents/loop/agent.loop.ts             — export loadWalletState
services/api/src/agents/policy/strategies/chartSignal.strategy.ts — import buildChartSnapshot from util
services/api/src/agents/loop/scheduler.ts              — route chartSignal → runCoinAnalysis
services/api/src/routes/index.ts                       — mount coinAnalysis.routes
```

---

## Task 1: Types, Model & Config Foundation

**Files:**
- Create: `services/api/src/agents/coinAnalysis/coinAnalysis.types.ts`
- Create: `services/api/src/models/coinAnalysisRun.model.ts`
- Modify: `services/api/src/agents/memory/memory.types.ts`
- Modify: `services/api/src/models/agentMemory.model.ts`
- Modify: `services/api/src/config/agent.config.ts`
- Modify: `services/api/src/agents/loop/agent.loop.ts`

**Interfaces produced (used by all later tasks):**
- `StrategyFramework`, `ApprovalStatus`, `CoinAnalysisRunStatus`, `AnalysisTrigger`, `NewsImpact`, `StrategyCard`, `CoinAnalysisRun` — all from `coinAnalysis.types.ts`
- `CoinAnalysisRunDoc` — Mongoose model from `coinAnalysisRun.model.ts`
- `loadWalletState(userId, config)` — exported from `agent.loop.ts`

- [ ] **Step 1: Create `coinAnalysis.types.ts`**

```typescript
// services/api/src/agents/coinAnalysis/coinAnalysis.types.ts
import type { TradeSignal } from '@/agents/policy/strategies/strategy.types'
import type { ChartSnapshot } from '@/agents/loop/loop.types'

export type StrategyFramework = 'SmartMoney' | 'Wyckoff' | 'ElliottWave' | 'Harmonic'
export type ApprovalStatus    = 'pending' | 'approved' | 'rejected' | 'auto_executed' | 'skipped'
export type CoinAnalysisRunStatus = 'running' | 'completed' | 'failed' | 'pending_approval' | 'auto_executed'
export type AnalysisTrigger   = 'scheduler' | 'on_demand'

export interface NewsImpact {
  verdict:         'supports' | 'contradicts' | 'neutral'
  confidenceDelta: number   // -10 to +5
  headlines:       Array<{ title: string; sentiment: number }>
}

export interface StrategyCard {
  framework:      StrategyFramework
  signal:         TradeSignal | null
  chartSnapshot:  ChartSnapshot | null
  llmNarrative:   string
  newsImpact:     NewsImpact
  approvalStatus: ApprovalStatus
  skippedReason?: string
}

export interface CoinAnalysisRun {
  _id?:              string
  coinAnalysisRunId: string
  userId:            string
  symbol:            string
  triggeredBy:       AnalysisTrigger
  status:            CoinAnalysisRunStatus
  startedAt:         Date
  completedAt?:      Date
  strategyCards:     StrategyCard[]
  autoMode:          boolean
  newsArticlesUsed:  string[]
  errorMessage?:     string
}
```

- [ ] **Step 2: Create `coinAnalysisRun.model.ts`**

```typescript
// services/api/src/models/coinAnalysisRun.model.ts
import { Schema, model } from 'mongoose'
import type { CoinAnalysisRun } from '@/agents/coinAnalysis/coinAnalysis.types'

const NewsImpactSchema = new Schema(
  {
    verdict:         { type: String, enum: ['supports', 'contradicts', 'neutral'], required: true },
    confidenceDelta: { type: Number, required: true },
    headlines:       [{ title: String, sentiment: Number, _id: false }],
  },
  { _id: false },
)

const StrategyCardSchema = new Schema(
  {
    framework:      { type: String, enum: ['SmartMoney', 'Wyckoff', 'ElliottWave', 'Harmonic'], required: true },
    signal:         { type: Schema.Types.Mixed, default: null },
    chartSnapshot:  { type: Schema.Types.Mixed, default: null },
    llmNarrative:   { type: String, default: '' },
    newsImpact:     { type: NewsImpactSchema, required: true },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'auto_executed', 'skipped'], required: true },
    skippedReason:  String,
  },
  { _id: false },
)

const CoinAnalysisRunSchema = new Schema<CoinAnalysisRun>(
  {
    coinAnalysisRunId: { type: String, required: true, unique: true, index: true },
    userId:            { type: String, required: true, index: true },
    symbol:            { type: String, required: true },
    triggeredBy:       { type: String, enum: ['scheduler', 'on_demand'], required: true },
    status:            { type: String, enum: ['running', 'completed', 'failed', 'pending_approval', 'auto_executed'], required: true },
    startedAt:         { type: Date, required: true },
    completedAt:       Date,
    strategyCards:     [StrategyCardSchema],
    autoMode:          { type: Boolean, required: true },
    newsArticlesUsed:  [String],
    errorMessage:      String,
  },
  { timestamps: true },
)

CoinAnalysisRunSchema.index({ userId: 1, startedAt: -1 })

export const CoinAnalysisRunDoc = model<CoinAnalysisRun>('CoinAnalysisRun', CoinAnalysisRunSchema)
```

- [ ] **Step 3: Update `memory.types.ts` — add 'news' variant**

In `services/api/src/agents/memory/memory.types.ts`, change line 1 and add optional fields to `AgentMemoryEntry`:

```typescript
// Change:
export type MemoryEntryType = 'decision' | 'observation' | 'outcome'
// To:
export type MemoryEntryType = 'decision' | 'observation' | 'outcome' | 'news'
```

Also add these optional fields to the `AgentMemoryEntry` interface (after the `tools` field):

```typescript
  // news-specific (only populated when type === 'news')
  articleId?:   string
  headline?:    string
  publishedAt?: Date
```

- [ ] **Step 4: Update `agentMemory.model.ts` — add 'news' to enum + optional fields**

In `services/api/src/models/agentMemory.model.ts`:

Change the `type` field enum:
```typescript
// Change:
type: { type: String, enum: ['decision', 'observation', 'outcome'], required: true },
// To:
type: { type: String, enum: ['decision', 'observation', 'outcome', 'news'], required: true },
```

Add these fields before the closing `}, { timestamps: true })`:
```typescript
  articleId:   String,
  headline:    String,
  publishedAt: Date,
```

- [ ] **Step 5: Add `selectedCoin` to `agent.config.ts`**

In `services/api/src/config/agent.config.ts`, add to the `AgentConfig` interface after `requireManualApproval`:

```typescript
  /** Coin pinned for on-demand analysis runs (e.g. "BTC"). watchlist[0] is used for scheduled runs. */
  selectedCoin?: string
```

- [ ] **Step 6: Export `loadWalletState` from `agent.loop.ts`**

In `services/api/src/agents/loop/agent.loop.ts`, change the function declaration from:
```typescript
async function loadWalletState(userId: string, config: AgentConfig): Promise<WalletState> {
```
To:
```typescript
export async function loadWalletState(userId: string, config: AgentConfig): Promise<WalletState> {
```

- [ ] **Step 7: Build the project to confirm no type errors**

```bash
cd services/api && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add services/api/src/agents/coinAnalysis/coinAnalysis.types.ts \
        services/api/src/models/coinAnalysisRun.model.ts \
        services/api/src/agents/memory/memory.types.ts \
        services/api/src/models/agentMemory.model.ts \
        services/api/src/config/agent.config.ts \
        services/api/src/agents/loop/agent.loop.ts
git commit -m "feat(coin-analysis): add types, model, config fields, export loadWalletState"
```

---

## Task 2: News Impact Scorer

**Files:**
- Create: `services/api/src/agents/news/news.impact.ts`
- Create: `services/api/src/agents/news/__tests__/news.impact.test.ts`

**Interfaces:**
- Produces: `scoreNewsImpact(articles: NewsArticleInput[], signal: Pick<TradeSignal, 'bias'> | null): NewsImpact`
- `NewsArticleInput` is a local type; `NewsImpact` is from `coinAnalysis.types.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// services/api/src/agents/news/__tests__/news.impact.test.ts
import { scoreNewsImpact } from '../news.impact'

const longSignal  = { bias: 'long'  as const }
const shortSignal = { bias: 'short' as const }

describe('scoreNewsImpact', () => {
  test('returns neutral with empty articles', () => {
    expect(scoreNewsImpact([], longSignal)).toEqual({
      verdict: 'neutral', confidenceDelta: 0, headlines: [],
    })
  })

  test('returns neutral when signal is null', () => {
    const result = scoreNewsImpact([{ title: 'BTC rally', summary: '', sentiment: 0 }], null)
    expect(result).toEqual({ verdict: 'neutral', confidenceDelta: 0, headlines: [] })
  })

  test('bullish keyword supports a long signal', () => {
    const result = scoreNewsImpact(
      [{ title: 'BTC breakout to ATH confirmed', summary: '', sentiment: 0 }],
      longSignal,
    )
    expect(result.verdict).toBe('supports')
    expect(result.confidenceDelta).toBe(5)
    expect(result.headlines).toHaveLength(1)
    expect(result.headlines[0].title).toBe('BTC breakout to ATH confirmed')
  })

  test('bullish keyword contradicts a short signal', () => {
    const result = scoreNewsImpact(
      [{ title: 'Bitcoin golden cross rally breakout', summary: '', sentiment: 0 }],
      shortSignal,
    )
    expect(result.verdict).toBe('contradicts')
    expect(result.confidenceDelta).toBe(-10)
  })

  test('bearish keyword contradicts a long signal', () => {
    const result = scoreNewsImpact(
      [{ title: 'BTC crash SEC lawsuit filed FUD', summary: '', sentiment: 0 }],
      longSignal,
    )
    expect(result.verdict).toBe('contradicts')
    expect(result.confidenceDelta).toBe(-10)
  })

  test('bearish keyword supports a short signal', () => {
    const result = scoreNewsImpact(
      [{ title: 'Bitcoin death cross breakdown capitulation', summary: '', sentiment: 0 }],
      shortSignal,
    )
    expect(result.verdict).toBe('supports')
    expect(result.confidenceDelta).toBe(5)
  })

  test('uses stored sentiment field when non-zero', () => {
    const result = scoreNewsImpact(
      [{ title: 'neutral title text here', summary: '', sentiment: 0.9 }],
      longSignal,
    )
    expect(result.verdict).toBe('supports')
    expect(result.confidenceDelta).toBe(5)
  })

  test('caps headlines to 3 even when more articles are passed', () => {
    const articles = Array.from({ length: 5 }, (_, i) => ({
      title: `Article ${i}`, summary: '', sentiment: 0,
    }))
    const result = scoreNewsImpact(articles, longSignal)
    expect(result.headlines).toHaveLength(3)
  })

  test('mixed signals average to neutral band', () => {
    const result = scoreNewsImpact(
      [
        { title: 'Bitcoin rally to ATH', summary: '', sentiment: 0 },
        { title: 'BTC crash SEC ban', summary: '', sentiment: 0 },
      ],
      longSignal,
    )
    expect(result.verdict).toBe('neutral')
    expect(result.confidenceDelta).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd services/api && npx jest src/agents/news/__tests__/news.impact.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../news.impact'`

- [ ] **Step 3: Implement `news.impact.ts`**

```typescript
// services/api/src/agents/news/news.impact.ts
import type { TradeSignal } from '@/agents/policy/strategies/strategy.types'
import type { NewsImpact } from '@/agents/coinAnalysis/coinAnalysis.types'

export interface NewsArticleInput {
  title:     string
  summary:   string
  sentiment: number   // stored value; 0 means "not yet scored"
}

const BULLISH_KEYWORDS: string[] = [
  'bullish', 'breakout', 'rally', 'adoption', 'etf', 'ath', 'all-time high',
  'accumulation', 'buy the dip', 'golden cross', 'oversold', 'support held',
  'bounce', 'reversal', 'uptrend', 'higher high', 'higher low', 'momentum',
  'inflow', 'institutional buying', 'spot etf', 'halving', 'approval',
  'listing', 'partnership', 'upgrade', 'mainnet', 'launch', 'record high',
  'price target', 'outperform', 'squeeze', 'short squeeze',
  'cup and handle', 'ascending', 'breakout confirmed', 'demand zone', 'liquidity grab',
]

const BEARISH_KEYWORDS: string[] = [
  'crash', 'ban', 'hack', 'sec', 'lawsuit', 'dump', 'sell-off', 'bearish',
  'breakdown', 'death cross', 'overbought', 'resistance', 'rejection',
  'downtrend', 'lower low', 'lower high', 'outflow', 'capitulation',
  'liquidation', 'regulation', 'crackdown', 'fine', 'exploit', 'rug pull',
  'exit scam', 'bankruptcy', 'insolvency', 'delisting', 'flash crash',
  'panic sell', 'distribution', 'supply zone', 'descending',
  'head and shoulders', 'double top', 'divergence', 'fud', 'fear',
  'whale dump', 'massive sell', 'warning',
]

const SCALE = Math.max(BULLISH_KEYWORDS.length, BEARISH_KEYWORDS.length) / 10

function keywordScore(title: string, summary: string): number {
  const text = `${title} ${summary}`.toLowerCase()
  let score = 0
  for (const kw of BULLISH_KEYWORDS) if (text.includes(kw)) score += 1
  for (const kw of BEARISH_KEYWORDS) if (text.includes(kw)) score -= 1
  return Math.max(-1, Math.min(1, score / SCALE))
}

export function scoreNewsImpact(
  articles: NewsArticleInput[],
  signal:   Pick<TradeSignal, 'bias'> | null,
): NewsImpact {
  if (!articles.length || !signal) {
    return { verdict: 'neutral', confidenceDelta: 0, headlines: [] }
  }

  const top3 = articles.slice(0, 3)
  const headlines = top3.map(a => ({
    title:     a.title,
    sentiment: a.sentiment !== 0 ? a.sentiment : keywordScore(a.title, a.summary),
  }))

  const avg    = headlines.reduce((s, h) => s + h.sentiment, 0) / headlines.length
  const isLong = signal.bias === 'long'

  let verdict:         'supports' | 'contradicts' | 'neutral'
  let confidenceDelta: number

  if (avg > 0.2) {
    verdict         = isLong ? 'supports' : 'contradicts'
    confidenceDelta = isLong ? 5 : -10
  } else if (avg < -0.2) {
    verdict         = isLong ? 'contradicts' : 'supports'
    confidenceDelta = isLong ? -10 : 5
  } else {
    verdict         = 'neutral'
    confidenceDelta = 0
  }

  return { verdict, confidenceDelta, headlines }
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
cd services/api && npx jest src/agents/news/__tests__/news.impact.test.ts --no-coverage
```
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add services/api/src/agents/news/news.impact.ts \
        services/api/src/agents/news/__tests__/news.impact.test.ts
git commit -m "feat(coin-analysis): add news impact scorer with trader keyword vocabulary"
```

---

## Task 3: News Ingestor

**Files:**
- Create: `services/api/src/agents/news/news.ingestor.ts`
- Create: `services/api/src/agents/news/__tests__/news.ingestor.test.ts`

**Interfaces:**
- Consumes: `NewsService.getForCoin(coinId, 10)`, `embed(text)`, `saveMemory(entry)`, `AgentMemoryDoc.exists({ type: 'news', articleId })`
- Produces: `ingestAndFetchNews(userId: string, symbol: string): Promise<IngestResult>` where `IngestResult = { articles: NewsArticleInput[], articleIds: string[] }`

- [ ] **Step 1: Write the failing test**

```typescript
// services/api/src/agents/news/__tests__/news.ingestor.test.ts
jest.mock('@/services/news.service', () => ({
  NewsService: jest.fn().mockImplementation(() => ({
    getForCoin: jest.fn(async () => [
      { id: 'art-1', title: 'BTC rally continues', summary: 'Bitcoin surges', sentiment: 0, publishedAt: new Date().toISOString(), coins: ['BTC'], url: 'http://a.com/1', source: 'Test' },
      { id: 'art-2', title: 'Already embedded article', summary: '', sentiment: 0, publishedAt: new Date().toISOString(), coins: ['BTC'], url: 'http://a.com/2', source: 'Test' },
    ]),
  })),
}))

jest.mock('@/agents/memory/memory.embedder', () => ({
  embed: jest.fn(async () => Array(768).fill(0.1)),
}))

jest.mock('@/agents/memory/memory.store', () => ({
  saveMemory: jest.fn(async (e: any) => e),
}))

jest.mock('@/models/agentMemory.model', () => ({
  AgentMemoryDoc: {
    exists: jest.fn(async ({ articleId }: any) => articleId === 'art-2'),
  },
}))

import { ingestAndFetchNews } from '../news.ingestor'
import { embed }              from '@/agents/memory/memory.embedder'
import { saveMemory }         from '@/agents/memory/memory.store'

test('returns all articles and embeds only unseen ones', async () => {
  const result = await ingestAndFetchNews('user-1', 'BTC')

  expect(result.articles).toHaveLength(2)
  expect(result.articleIds).toEqual(['art-1', 'art-2'])

  // art-2 already exists — only art-1 should be embedded and saved
  expect(embed).toHaveBeenCalledTimes(1)
  expect(saveMemory).toHaveBeenCalledTimes(1)

  const savedArg = (saveMemory as jest.Mock).mock.calls[0][0]
  expect(savedArg.type).toBe('news')
  expect(savedArg.articleId).toBe('art-1')
  expect(savedArg.coin).toBe('BTC')
})

test('maps common symbols to CoinGecko IDs for the news query', async () => {
  const { NewsService } = require('@/services/news.service')
  const getForCoin = NewsService.mock.results[0].value.getForCoin as jest.Mock
  getForCoin.mockClear()

  await ingestAndFetchNews('user-1', 'ETH')
  expect(getForCoin).toHaveBeenCalledWith('ethereum', 10)
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd services/api && npx jest src/agents/news/__tests__/news.ingestor.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../news.ingestor'`

- [ ] **Step 3: Implement `news.ingestor.ts`**

```typescript
// services/api/src/agents/news/news.ingestor.ts
import { NewsService }      from '@/services/news.service'
import { embed }            from '@/agents/memory/memory.embedder'
import { saveMemory }       from '@/agents/memory/memory.store'
import { AgentMemoryDoc }   from '@/models/agentMemory.model'
import type { NewsArticleInput } from './news.impact'

export interface IngestResult {
  articles:    NewsArticleInput[]
  articleIds:  string[]
}

const SYMBOL_TO_COIN_ID: Record<string, string> = {
  BTC:   'bitcoin',
  ETH:   'ethereum',
  SOL:   'solana',
  BNB:   'binancecoin',
  ADA:   'cardano',
  DOT:   'polkadot',
  MATIC: 'matic-network',
  AVAX:  'avalanche-2',
  LINK:  'chainlink',
  UNI:   'uniswap',
  DOGE:  'dogecoin',
  XRP:   'ripple',
  LTC:   'litecoin',
  ATOM:  'cosmos',
  FIL:   'filecoin',
}

function symbolToCoinId(symbol: string): string {
  return SYMBOL_TO_COIN_ID[symbol.toUpperCase()] ?? symbol.toLowerCase()
}

const newsService = new NewsService()

export async function ingestAndFetchNews(userId: string, symbol: string): Promise<IngestResult> {
  const coinId = symbolToCoinId(symbol)
  const raw    = await newsService.getForCoin(coinId, 10)

  for (const article of raw) {
    const exists = await AgentMemoryDoc.exists({ type: 'news', articleId: article.id })
    if (exists) continue

    const text      = `${article.title}. ${article.summary}`.slice(0, 8000)
    const embedding = await embed(text)

    await saveMemory({
      agentId:     userId,
      runId:       `news-${article.id}`,
      timestamp:   new Date(article.publishedAt),
      coin:        symbol.toUpperCase(),
      type:        'news',
      summary:     article.title,
      fullContext: { url: article.url, source: article.source },
      embedding,
      marketRegime: 'unknown',
      signals:     [],
      tools:       [],
      articleId:   article.id,
      headline:    article.title,
      publishedAt: new Date(article.publishedAt),
    } as any)
  }

  return {
    articles:   raw.map(a => ({ title: a.title, summary: a.summary ?? '', sentiment: a.sentiment })),
    articleIds: raw.map(a => a.id),
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
cd services/api && npx jest src/agents/news/__tests__/news.ingestor.test.ts --no-coverage
```
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add services/api/src/agents/news/news.ingestor.ts \
        services/api/src/agents/news/__tests__/news.ingestor.test.ts
git commit -m "feat(coin-analysis): add news ingestor — embeds and deduplicates articles in RAG"
```

---

## Task 4: Extract `buildChartSnapshot` to Shared Util

**Files:**
- Create: `services/api/src/agents/coinAnalysis/chartSnapshot.util.ts`
- Modify: `services/api/src/agents/policy/strategies/chartSignal.strategy.ts`

**Interfaces:**
- Produces: `buildChartSnapshot(symbol, binanceSymbol, primitives, signal): Promise<ChartSnapshot>` — same signature, new location

- [ ] **Step 1: Create `chartSnapshot.util.ts`** by copying the function verbatim from `chartSignal.strategy.ts`

```typescript
// services/api/src/agents/coinAnalysis/chartSnapshot.util.ts
import { ohlcvIngest }          from '@/read/ingestion/ohlcv.ingest'
import { extractZigZagPivots }  from '@/agents/skills/structure.skill'
import type { ChartSnapshot, ChartOverlay } from '@/agents/loop/loop.types'
import type { MarketPrimitives }            from '@/agents/chartAnalysis.types'
import type { TradeSignal }                 from '@/agents/policy/strategies/strategy.types'

export async function buildChartSnapshot(
  symbol:        string,
  binanceSymbol: string,
  primitives:    MarketPrimitives,
  signal:        TradeSignal,
): Promise<ChartSnapshot> {
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
        p1:        { time: h1.timestamp, price: h1.price },
        p2:        { time: h2.timestamp, price: h2.price },
        direction: h2.price < h1.price ? 'down' : 'up',
      })
    }
    if (lows.length >= 2) {
      const l1 = lows[lows.length - 2]
      const l2 = lows[lows.length - 1]
      trendlines.push({
        p1:        { time: l1.timestamp, price: l1.price },
        p2:        { time: l2.timestamp, price: l2.price },
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
      xabcd:    { X: h.xabcd.X,    A: h.xabcd.A,    B: h.xabcd.B,    C: h.xabcd.C,    D: h.xabcd.D    },
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

- [ ] **Step 2: Update `chartSignal.strategy.ts` to import from the util**

Replace the `buildChartSnapshot` function in `services/api/src/agents/policy/strategies/chartSignal.strategy.ts`.

Remove the entire `async function buildChartSnapshot(...)` block (lines ~33–123) and add this import at the top of the file (after existing imports):

```typescript
import { buildChartSnapshot } from '@/agents/coinAnalysis/chartSnapshot.util'
```

Also remove these imports that are now only needed by the util (if they appear in chartSignal.strategy.ts but not used elsewhere in that file):
```typescript
// Remove these if present:
import { ohlcvIngest }          from '../../../read/ingestion/ohlcv.ingest'
import { extractZigZagPivots }  from '../../skills/structure.skill'
import type { ChartOverlay }    from '../../loop/loop.types'
```

- [ ] **Step 3: Build to confirm no type errors**

```bash
cd services/api && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Run existing chartSignal tests to confirm nothing broke**

```bash
cd services/api && npx jest src/agents/policy/strategies/__tests__/chartSignal.strategy.test.ts --no-coverage
```
Expected: PASS (existing tests unchanged)

- [ ] **Step 5: Commit**

```bash
git add services/api/src/agents/coinAnalysis/chartSnapshot.util.ts \
        services/api/src/agents/policy/strategies/chartSignal.strategy.ts
git commit -m "refactor(coin-analysis): extract buildChartSnapshot to shared util"
```

---

## Task 5: Strategy Card Runner + Main `runCoinAnalysis`

**Files:**
- Create: `services/api/src/agents/coinAnalysis/coinAnalysis.runner.ts`
- Create: `services/api/src/agents/coinAnalysis/__tests__/coinAnalysis.runner.test.ts`

**Interfaces:**
- Consumes: `buildMarketPrimitives`, `ingestAndFetchNews`, `retrieve`, `renderMemorySection`, `runSmartMoneyStrategy`, `runWyckoffStrategy`, `runElliottStrategy`, `runHarmonicStrategy`, `buildChartSnapshot`, `scoreNewsImpact`, `executeIntent`, `loadWalletState`, `CoinAnalysisRunDoc`, `generateMyId`
- Produces:
  - `runCoinAnalysis(userId, symbol, triggeredBy): Promise<string>` — returns `coinAnalysisRunId`
  - `approveCard(userId, coinAnalysisRunId, framework): Promise<ExecutionResult>`
  - `rejectCard(userId, coinAnalysisRunId, framework): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```typescript
// services/api/src/agents/coinAnalysis/__tests__/coinAnalysis.runner.test.ts
import { connectTestDb, clearTestDb, disconnectTestDb } from '@/__tests__/helpers/db'

jest.mock('@/services/chartAnalysis.service', () => ({
  buildMarketPrimitives: jest.fn(async () => ({ meta: { symbol: 'BTCUSDT' } } as any)),
}))

jest.mock('@/agents/news/news.ingestor', () => ({
  ingestAndFetchNews: jest.fn(async () => ({
    articles:   [{ title: 'BTC rally', summary: '', sentiment: 0 }],
    articleIds: ['art-1'],
  })),
}))

jest.mock('@/agents/memory/memory.retriever', () => ({
  retrieve: jest.fn(async () => ({ similarMemories: [], reflection: null })),
}))

jest.mock('@/agents/policy/prompts/memory.section.prompt', () => ({
  renderMemorySection: jest.fn(() => ''),
}))

const mockSignal = {
  symbol: 'BTC', framework: 'SmartMoney' as const, bias: 'long' as const,
  setup_name: 'OB retest', entry_zone: { high: 51000, low: 50000 },
  stop_loss: 49000, take_profit_levels: [54000], risk_reward: 2,
  confidence: 80, invalidation: 'x', reasoning: 'Strong OB', confluence_factors: [],
  generated_at: new Date().toISOString(),
}

jest.mock('@/agents/policy/strategies/smartMoney.strategy', () => ({
  runSmartMoneyStrategy: jest.fn(() => ({ skipped: false, signal: mockSignal })),
}))
jest.mock('@/agents/policy/strategies/wyckoff.strategy',  () => ({ runWyckoffStrategy:  jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'no range' })) }))
jest.mock('@/agents/policy/strategies/elliott.strategy',  () => ({ runElliottStrategy:  jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'no waves' })) }))
jest.mock('@/agents/policy/strategies/harmonic.strategy', () => ({ runHarmonicStrategy: jest.fn(() => ({ skipped: true, signal: null, skip_reason: 'no pattern' })) }))

jest.mock('@/agents/coinAnalysis/chartSnapshot.util', () => ({
  buildChartSnapshot: jest.fn(async () => ({
    symbol: 'BTC', binanceSymbol: 'BTCUSDT', framework: 'SmartMoney',
    snapshotAt: new Date(), entryZone: { low: 50000, high: 51000 },
    stopLoss: 49000, takeProfitLevels: [54000], confidence: 80,
    overlays: { supportResistance: [], trendlines: [] },
  })),
}))

jest.mock('@/execution/execution.gateway', () => ({
  executeIntent: jest.fn(async () => ({
    execution: { status: 'pending_limit', executedAt: new Date() },
    riskPassed: true,
    pendingApproval: false,
  })),
}))

// Mock DeepSeek LLM call
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(async () => ({
          choices: [{ message: { content: 'SmartMoney sees a clean OB retest with bullish news.' } }],
        })),
      },
    },
  }))
})

import { runCoinAnalysis, approveCard, rejectCard } from '../coinAnalysis.runner'
import { CoinAnalysisRunDoc } from '@/models/coinAnalysisRun.model'
import { AgentConfigDoc }     from '@/models/agentConfig.model'
import { DEFAULT_AGENT_CONFIG } from '@/config/agent.config'
import { getOrCreateWallet }  from '@/services/paperWallet.service'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

async function setupUser(overrides: Record<string, any> = {}) {
  await getOrCreateWallet('user-ca')
  await AgentConfigDoc.create({
    userId: 'user-ca',
    ...DEFAULT_AGENT_CONFIG,
    enabled: true,
    requireManualApproval: true,
    strategies: { yieldHunter: false, rebalance: false, airdropWatch: false, chartSignal: true },
    ...overrides,
  })
}

test('creates a CoinAnalysisRunDoc with 4 strategy cards', async () => {
  await setupUser()
  const runId = await runCoinAnalysis('user-ca', 'BTC', 'on_demand')

  const doc = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId: runId }).lean()
  expect(doc).not.toBeNull()
  expect(doc!.strategyCards).toHaveLength(4)
  expect(doc!.symbol).toBe('BTC')
  expect(doc!.triggeredBy).toBe('on_demand')
})

test('manual mode: cards with signals are pending, cards without are skipped', async () => {
  await setupUser({ requireManualApproval: true })
  const runId = await runCoinAnalysis('user-ca', 'BTC', 'on_demand')

  const doc = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId: runId }).lean()
  const smartMoney = doc!.strategyCards.find(c => c.framework === 'SmartMoney')!
  const wyckoff    = doc!.strategyCards.find(c => c.framework === 'Wyckoff')!

  expect(smartMoney.approvalStatus).toBe('pending')
  expect(wyckoff.approvalStatus).toBe('skipped')
  expect(doc!.status).toBe('pending_approval')
})

test('auto mode: executes the best signal and marks others skipped', async () => {
  await setupUser({ requireManualApproval: false })
  const runId = await runCoinAnalysis('user-ca', 'BTC', 'on_demand')

  const doc = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId: runId }).lean()
  const smartMoney = doc!.strategyCards.find(c => c.framework === 'SmartMoney')!

  expect(smartMoney.approvalStatus).toBe('auto_executed')
  expect(doc!.status).toBe('auto_executed')
})

test('each card has llmNarrative, newsImpact, and chartSnapshot', async () => {
  await setupUser()
  const runId = await runCoinAnalysis('user-ca', 'BTC', 'on_demand')

  const doc = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId: runId }).lean()
  const smartMoney = doc!.strategyCards.find(c => c.framework === 'SmartMoney')!

  expect(typeof smartMoney.llmNarrative).toBe('string')
  expect(smartMoney.llmNarrative.length).toBeGreaterThan(0)
  expect(smartMoney.newsImpact).toBeDefined()
  expect(smartMoney.chartSnapshot).not.toBeNull()
})

test('approveCard executes the trade and sets approvalStatus to approved', async () => {
  await setupUser({ requireManualApproval: true })
  const runId = await runCoinAnalysis('user-ca', 'BTC', 'on_demand')

  const result = await approveCard('user-ca', runId, 'SmartMoney')
  expect(result.status).toBe('pending_limit')

  const doc = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId: runId }).lean()
  const card = doc!.strategyCards.find(c => c.framework === 'SmartMoney')!
  expect(card.approvalStatus).toBe('approved')
})

test('rejectCard sets approvalStatus to rejected', async () => {
  await setupUser({ requireManualApproval: true })
  const runId = await runCoinAnalysis('user-ca', 'BTC', 'on_demand')

  await rejectCard('user-ca', runId, 'SmartMoney')

  const doc = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId: runId }).lean()
  const card = doc!.strategyCards.find(c => c.framework === 'SmartMoney')!
  expect(card.approvalStatus).toBe('rejected')
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd services/api && npx jest src/agents/coinAnalysis/__tests__/coinAnalysis.runner.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../coinAnalysis.runner'`

- [ ] **Step 3: Implement `coinAnalysis.runner.ts`**

```typescript
// services/api/src/agents/coinAnalysis/coinAnalysis.runner.ts
import OpenAI from 'openai'

import { buildMarketPrimitives }     from '@/services/chartAnalysis.service'
import { getOrCreateConfig }         from '@/services/agentConfig.service'
import { executeIntent }             from '@/execution/execution.gateway'
import { retrieve }                  from '@/agents/memory/memory.retriever'
import { renderMemorySection }       from '@/agents/policy/prompts/memory.section.prompt'
import { loadWalletState }           from '@/agents/loop/agent.loop'
import { ingestAndFetchNews }        from '@/agents/news/news.ingestor'
import { scoreNewsImpact }           from '@/agents/news/news.impact'
import { buildChartSnapshot }        from './chartSnapshot.util'
import { CoinAnalysisRunDoc }        from '@/models/coinAnalysisRun.model'
import { runSmartMoneyStrategy }     from '@/agents/policy/strategies/smartMoney.strategy'
import { runWyckoffStrategy }        from '@/agents/policy/strategies/wyckoff.strategy'
import { runElliottStrategy }        from '@/agents/policy/strategies/elliott.strategy'
import { runHarmonicStrategy }       from '@/agents/policy/strategies/harmonic.strategy'
import { generateMyId }              from '@/utils/nanoid'
import type { AgentConfig }          from '@/config/agent.config'
import type { TradeIntent, ExecutionResult } from '@/agents/loop/loop.types'
import type { MarketPrimitives }     from '@/agents/chartAnalysis.types'
import type { ChartStrategyResult, TradeSignal } from '@/agents/policy/strategies/strategy.types'
import type {
  StrategyCard, StrategyFramework, CoinAnalysisRunStatus, AnalysisTrigger, NewsImpact,
} from './coinAnalysis.types'
import type { NewsArticleInput }     from '@/agents/news/news.impact'

// ── DeepSeek client (same config as policy.engine.ts) ─────────────────────────

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey:  process.env.DEEPSEEK_API_KEY ?? '',
})

// ── Framework → strategy runner map ───────────────────────────────────────────

type StrategyRunner = (p: MarketPrimitives) => ChartStrategyResult

const RUNNERS: Record<StrategyFramework, StrategyRunner> = {
  SmartMoney:  runSmartMoneyStrategy,
  Wyckoff:     runWyckoffStrategy,
  ElliottWave: runElliottStrategy,
  Harmonic:    runHarmonicStrategy,
}

const FRAMEWORKS: StrategyFramework[] = ['SmartMoney', 'Wyckoff', 'ElliottWave', 'Harmonic']

// ── LLM narrative (one call per card, 300 tokens max) ────────────────────────

async function generateNarrative(
  signal:     TradeSignal,
  newsImpact: NewsImpact,
  articles:   NewsArticleInput[],
): Promise<string> {
  const headlineLines = articles.slice(0, 3).map(a => `- ${a.title}`).join('\n')
  const prompt = [
    `Framework: ${signal.framework} | Bias: ${signal.bias.toUpperCase()} | Symbol: ${signal.symbol}`,
    `Setup: ${signal.setup_name} | Confidence: ${signal.confidence}%`,
    `Entry: $${signal.entry_zone.low}–$${signal.entry_zone.high} | SL: $${signal.stop_loss} | TP: $${signal.take_profit_levels[0]}`,
    `Key factors: ${signal.confluence_factors.slice(0, 3).join(', ')}`,
    `Reasoning: ${signal.reasoning.slice(0, 300)}`,
    '',
    `News verdict: ${newsImpact.verdict} this signal`,
    headlineLines,
    '',
    'Write a 2-3 sentence trading narrative for an experienced trader. State the setup, what the chart structure says, and how the news aligns or conflicts.',
  ].join('\n')

  try {
    const completion = await deepseek.chat.completions.create({
      model:       'deepseek-chat',
      max_tokens:  300,
      temperature: 0.4,
      messages: [
        { role: 'system', content: 'You are a concise crypto trading analyst. No fluff. Write for a trader who reads fast.' },
        { role: 'user',   content: prompt },
      ],
    })
    return completion.choices?.[0]?.message?.content ?? signal.reasoning.slice(0, 300)
  } catch {
    return signal.reasoning.slice(0, 300)
  }
}

// ── Single strategy card ──────────────────────────────────────────────────────

async function runStrategyCard(
  framework:     StrategyFramework,
  symbol:        string,
  binanceSymbol: string,
  primitives:    MarketPrimitives,
  articles:      NewsArticleInput[],
  memoryContext: string | undefined,
): Promise<StrategyCard> {
  const runner = RUNNERS[framework]
  const result = runner(primitives)

  const noSignalCard = (skippedReason: string): StrategyCard => ({
    framework,
    signal:         null,
    chartSnapshot:  null,
    llmNarrative:   '',
    newsImpact:     { verdict: 'neutral', confidenceDelta: 0, headlines: [] },
    approvalStatus: 'skipped',
    skippedReason,
  })

  if (result.skipped || !result.signal) {
    return noSignalCard(result.skip_reason ?? 'No signal')
  }

  // Paper wallet is spot-only — skip short signals
  if (result.signal.bias !== 'long') {
    return noSignalCard(`Short bias not supported (${framework})`)
  }

  const signal    = result.signal
  const newsImpact = scoreNewsImpact(articles, signal)

  const [chartSnapshot, llmNarrative] = await Promise.all([
    buildChartSnapshot(symbol, binanceSymbol, primitives, signal).catch(() => null),
    generateNarrative(signal, newsImpact, articles),
  ])

  return {
    framework,
    signal,
    chartSnapshot,
    llmNarrative,
    newsImpact,
    approvalStatus: 'pending',  // overwritten later by routing logic
  }
}

// ── Auto-execute: pick best qualifying card ───────────────────────────────────

async function autoExecuteBest(
  userId:           string,
  coinAnalysisRunId: string,
  symbol:           string,
  cards:            StrategyCard[],
  config:           AgentConfig,
): Promise<CoinAnalysisRunStatus> {
  const qualifying = cards.filter(c =>
    c.signal !== null &&
    c.signal.bias === 'long' &&
    (c.signal.confidence + c.newsImpact.confidenceDelta) >= config.minSignalConfidence,
  )

  if (!qualifying.length) {
    for (const card of cards) card.approvalStatus = 'skipped'
    return 'completed'
  }

  const best = qualifying.reduce((a, b) =>
    (a.signal!.confidence + a.newsImpact.confidenceDelta) >=
    (b.signal!.confidence + b.newsImpact.confidenceDelta) ? a : b,
  )

  const walletState = await loadWalletState(userId, config)
  const adjustedConf = best.signal!.confidence + best.newsImpact.confidenceDelta

  const intent: TradeIntent = {
    type:            'propose_trade',
    tokenIn:         'USDC',
    tokenOut:        symbol,
    amountUsd:       config.maxTradeUsd,
    maxSlippageBps:  50,
    rationale:       best.signal!.reasoning,
    stopLossPrice:   best.signal!.stop_loss,
    takeProfitPrice: best.signal!.take_profit_levels[0],
    entryZoneLow:    best.signal!.entry_zone.low,
    entryZoneHigh:   best.signal!.entry_zone.high,
    framework:       best.framework,
  }

  await executeIntent(intent, walletState, {
    userId, config, runId: coinAnalysisRunId, strategy: 'chartSignal',
    rationale: best.signal!.reasoning, confidence: adjustedConf,
  })

  for (const card of cards) {
    card.approvalStatus = card === best ? 'auto_executed' : 'skipped'
  }

  return 'auto_executed'
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runCoinAnalysis(
  userId:      string,
  symbol:      string,
  triggeredBy: AnalysisTrigger,
): Promise<string> {
  const coinAnalysisRunId = `car-${generateMyId(10 as number)}`
  const config            = await getOrCreateConfig(userId)
  const autoMode          = !config.requireManualApproval
  const binanceSymbol     = `${symbol.toUpperCase()}USDT`

  await CoinAnalysisRunDoc.create({
    coinAnalysisRunId,
    userId,
    symbol:          symbol.toUpperCase(),
    triggeredBy,
    status:          'running',
    startedAt:       new Date(),
    autoMode,
    strategyCards:   [],
    newsArticlesUsed: [],
  })

  try {
    // 1. News (embed new articles into RAG, return top articles for this run)
    const { articles, articleIds } = await ingestAndFetchNews(userId, symbol)

    // 2. Market primitives — ONE fetch shared by all 4 cards
    const primitives = await buildMarketPrimitives(binanceSymbol)

    // 3. RAG memory context
    const contextSummary = `Chart analysis for ${symbol.toUpperCase()} — ${new Date().toISOString()}`
    let memoryContext: string | undefined
    try {
      const memResult = await retrieve(userId, symbol.toUpperCase(), contextSummary)
      memoryContext = renderMemorySection(memResult) || undefined
    } catch { /* non-fatal */ }

    // 4. All 4 strategy cards in parallel
    const cards = await Promise.all(
      FRAMEWORKS.map(fw =>
        runStrategyCard(fw, symbol.toUpperCase(), binanceSymbol, primitives, articles, memoryContext),
      ),
    )

    // 5. Route: auto-execute or mark pending
    let finalStatus: CoinAnalysisRunStatus
    if (autoMode) {
      finalStatus = await autoExecuteBest(userId, coinAnalysisRunId, symbol.toUpperCase(), cards, config)
    } else {
      finalStatus = 'pending_approval'
      for (const card of cards) {
        if (!card.signal) card.approvalStatus = 'skipped'
      }
    }

    await CoinAnalysisRunDoc.updateOne(
      { coinAnalysisRunId },
      { $set: { status: finalStatus, completedAt: new Date(), strategyCards: cards, newsArticlesUsed: articleIds } },
    )

    console.log(`[CoinAnalysis] Run complete: ${coinAnalysisRunId} symbol=${symbol} status=${finalStatus}`)
    return coinAnalysisRunId
  } catch (err: any) {
    console.error(`[CoinAnalysis] Run failed: ${err.message}`)
    await CoinAnalysisRunDoc.updateOne(
      { coinAnalysisRunId },
      { $set: { status: 'failed', completedAt: new Date(), errorMessage: err.message } },
    ).catch(() => {})
    throw err
  }
}

// ── Manual approval actions ───────────────────────────────────────────────────

export async function approveCard(
  userId:            string,
  coinAnalysisRunId: string,
  framework:         StrategyFramework,
): Promise<ExecutionResult> {
  const run = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId, userId }).lean()
  if (!run) throw Object.assign(new Error(`Run "${coinAnalysisRunId}" not found`), { statusCode: 404 })

  const card = run.strategyCards.find(c => c.framework === framework)
  if (!card)           throw Object.assign(new Error(`Card "${framework}" not found`), { statusCode: 404 })
  if (card.approvalStatus !== 'pending') throw Object.assign(new Error(`Card "${framework}" is not pending approval`), { statusCode: 400 })
  if (!card.signal)    throw Object.assign(new Error(`Card "${framework}" has no signal`), { statusCode: 400 })

  const config      = await getOrCreateConfig(userId)
  const walletState = await loadWalletState(userId, config)
  const adjustedConf = card.signal.confidence + card.newsImpact.confidenceDelta

  const intent: TradeIntent = {
    type:            'propose_trade',
    tokenIn:         'USDC',
    tokenOut:        run.symbol,
    amountUsd:       config.maxTradeUsd,
    maxSlippageBps:  50,
    rationale:       card.signal.reasoning,
    stopLossPrice:   card.signal.stop_loss,
    takeProfitPrice: card.signal.take_profit_levels[0],
    entryZoneLow:    card.signal.entry_zone.low,
    entryZoneHigh:   card.signal.entry_zone.high,
    framework:       card.framework,
  }

  const gateway = await executeIntent(intent, walletState, {
    userId, config, runId: coinAnalysisRunId, strategy: 'chartSignal',
    rationale: card.signal.reasoning, confidence: adjustedConf,
  })

  await CoinAnalysisRunDoc.updateOne(
    { coinAnalysisRunId, 'strategyCards.framework': framework },
    { $set: { 'strategyCards.$.approvalStatus': 'approved' } },
  )

  // Mark run completed once all pending cards are resolved
  const updated = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId }).lean()
  const allDone = updated?.strategyCards.every(c => c.approvalStatus !== 'pending') ?? false
  if (allDone) {
    await CoinAnalysisRunDoc.updateOne({ coinAnalysisRunId }, { $set: { status: 'completed', completedAt: new Date() } })
  }

  return gateway.execution
}

export async function rejectCard(
  userId:            string,
  coinAnalysisRunId: string,
  framework:         StrategyFramework,
): Promise<void> {
  const result = await CoinAnalysisRunDoc.updateOne(
    { coinAnalysisRunId, userId, 'strategyCards.framework': framework, 'strategyCards.approvalStatus': 'pending' },
    { $set: { 'strategyCards.$.approvalStatus': 'rejected' } },
  )
  if (result.matchedCount === 0) {
    throw Object.assign(new Error(`Card "${framework}" not found or not pending`), { statusCode: 404 })
  }

  const updated = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId }).lean()
  const allDone = updated?.strategyCards.every(c => c.approvalStatus !== 'pending') ?? false
  if (allDone) {
    await CoinAnalysisRunDoc.updateOne({ coinAnalysisRunId }, { $set: { status: 'completed', completedAt: new Date() } })
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
cd services/api && npx jest src/agents/coinAnalysis/__tests__/coinAnalysis.runner.test.ts --no-coverage
```
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add services/api/src/agents/coinAnalysis/coinAnalysis.runner.ts \
        services/api/src/agents/coinAnalysis/__tests__/coinAnalysis.runner.test.ts
git commit -m "feat(coin-analysis): add runCoinAnalysis, runStrategyCard, approveCard, rejectCard"
```

---

## Task 6: API Routes

**Files:**
- Create: `services/api/src/routes/coinAnalysis.routes.ts`
- Modify: `services/api/src/routes/index.ts`

**Interfaces:**
- Consumes: `runCoinAnalysis`, `approveCard`, `rejectCard` from `coinAnalysis.runner.ts`; `CoinAnalysisRunDoc`
- Produces: REST endpoints at `/api/coin-analysis/...`

- [ ] **Step 1: Create `coinAnalysis.routes.ts`**

Check how auth middleware is imported in any existing route file (e.g. `agentRun.routes.ts`) and use the same pattern. The middleware attaches `req.user.id`.

```typescript
// services/api/src/routes/coinAnalysis.routes.ts
import { Router }       from 'express'
import { authenticate } from '@/middleware/auth'
import { runCoinAnalysis, approveCard, rejectCard } from '@/agents/coinAnalysis/coinAnalysis.runner'
import { CoinAnalysisRunDoc }   from '@/models/coinAnalysisRun.model'
import type { StrategyFramework } from '@/agents/coinAnalysis/coinAnalysis.types'

const VALID_FRAMEWORKS = new Set<StrategyFramework>(['SmartMoney', 'Wyckoff', 'ElliottWave', 'Harmonic'])

const router = Router()
router.use(authenticate)

// POST /api/coin-analysis/trigger  { symbol?: string }
router.post('/trigger', async (req, res) => {
  try {
    const userId = (req as any).user.id
    const symbol = ((req.body as any).symbol as string | undefined)?.toUpperCase() ?? 'BTC'
    const coinAnalysisRunId = await runCoinAnalysis(userId, symbol, 'on_demand')
    res.json({ coinAnalysisRunId })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/coin-analysis/:runId
router.get('/:runId', async (req, res) => {
  try {
    const userId = (req as any).user.id
    const run = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId: req.params.runId, userId }).lean()
    if (!run) return res.status(404).json({ error: 'Run not found' })
    res.json(run)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/coin-analysis/:runId/cards/:framework/approve
router.post('/:runId/cards/:framework/approve', async (req, res) => {
  try {
    const userId    = (req as any).user.id
    const framework = req.params.framework as StrategyFramework
    if (!VALID_FRAMEWORKS.has(framework)) return res.status(400).json({ error: 'Invalid framework' })

    const result = await approveCard(userId, req.params.runId, framework)
    res.json({ execution: result })
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ error: err.message })
  }
})

// POST /api/coin-analysis/:runId/cards/:framework/reject
router.post('/:runId/cards/:framework/reject', async (req, res) => {
  try {
    const userId    = (req as any).user.id
    const framework = req.params.framework as StrategyFramework
    if (!VALID_FRAMEWORKS.has(framework)) return res.status(400).json({ error: 'Invalid framework' })

    await rejectCard(userId, req.params.runId, framework)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ error: err.message })
  }
})

export default router
```

- [ ] **Step 2: Mount the router in `routes/index.ts`**

Add these two lines in `services/api/src/routes/index.ts`:

```typescript
// Add import after existing imports:
import coinAnalysisRoutes from './coinAnalysis.routes'

// Add mount after existing router.use lines:
router.use('/coin-analysis', coinAnalysisRoutes)
```

- [ ] **Step 3: Build to confirm no type errors**

```bash
cd services/api && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add services/api/src/routes/coinAnalysis.routes.ts \
        services/api/src/routes/index.ts
git commit -m "feat(coin-analysis): add REST routes — trigger, poll, approve, reject"
```

---

## Task 7: Scheduler Integration

**Files:**
- Modify: `services/api/src/agents/loop/scheduler.ts`
- Modify: `services/api/src/agents/loop/__tests__/scheduler.test.ts`

**Goal:** When a user's config has `strategies.chartSignal: true` AND `watchlist[0]` is set, `runEnabledUserTicks` calls `runCoinAnalysis` instead of `runLoopTick`.

- [ ] **Step 1: Update the scheduler test to cover the new routing**

In `services/api/src/agents/loop/__tests__/scheduler.test.ts`, add the following mock and test after the existing tests:

```typescript
// Add this mock at the top of the file (alongside the existing runLoopTick mock):
jest.mock('@/agents/coinAnalysis/coinAnalysis.runner', () => ({
  runCoinAnalysis: jest.fn(async (userId: string) => { ticked.push(`coin:${userId}`) }),
}))
```

Add this test:

```typescript
test('routes chartSignal users to runCoinAnalysis, others to runLoopTick', async () => {
  await AgentConfigDoc.create({
    userId: 'user-chart', ...DEFAULT_AGENT_CONFIG, enabled: true,
    strategies: { yieldHunter: false, rebalance: false, airdropWatch: false, chartSignal: true },
    watchlist: ['BTC'],
  })
  await AgentConfigDoc.create({
    userId: 'user-yield', ...DEFAULT_AGENT_CONFIG, enabled: true,
    strategies: { yieldHunter: true, rebalance: false, airdropWatch: false, chartSignal: false },
  })

  await runEnabledUserTicks()

  expect(ticked).toContain('coin:user-chart')
  expect(ticked).toContain('user-yield')
  expect(ticked).not.toContain('user-chart')       // should NOT go through runLoopTick
  expect(ticked).not.toContain('coin:user-yield')  // should NOT go through runCoinAnalysis
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd services/api && npx jest src/agents/loop/__tests__/scheduler.test.ts --no-coverage
```
Expected: FAIL on the new test — `runLoopTick` is called instead of `runCoinAnalysis`

- [ ] **Step 3: Update `scheduler.ts`**

Replace the `runEnabledUserTicks` function body with:

```typescript
export async function runEnabledUserTicks(): Promise<void> {
  const enabled = await AgentConfigDoc
    .find({ enabled: true })
    .select('userId watchlist strategies')
    .lean()

  const userIds = enabled.map(c => c.userId).filter(id => !_inFlight.has(id))

  for (let i = 0; i < userIds.length; i += MAX_CONCURRENT_TICKS) {
    const batch = userIds.slice(i, i + MAX_CONCURRENT_TICKS)
    await Promise.all(batch.map(async userId => {
      _inFlight.add(userId)
      try {
        const cfg = enabled.find(c => c.userId === userId)!
        const isChartSignal = cfg.strategies?.chartSignal && (cfg.watchlist ?? [])[0]

        if (isChartSignal) {
          const symbol = (cfg.watchlist[0] as string).replace('bitcoin', 'BTC').replace('ethereum', 'ETH').toUpperCase()
          const { runCoinAnalysis } = await import('@/agents/coinAnalysis/coinAnalysis.runner')
          await runCoinAnalysis(userId, symbol, 'scheduler')
        } else {
          await runLoopTick(userId)
        }
      } catch (err: any) {
        console.error(`[Scheduler] Tick failed for ${userId}:`, err.message)
      } finally {
        _inFlight.delete(userId)
      }
    }))
  }
}
```

Also add this import at the top of `scheduler.ts` (static import, replaces the dynamic one used above for clarity — use whichever pattern avoids circular dep issues in the project):

Check for circular dependencies first: `coinAnalysis.runner` imports `agent.loop` (for `loadWalletState`). `scheduler` imports `agent.loop`. There is no circular dependency — keep the dynamic import to be safe.

- [ ] **Step 4: Run the full scheduler test suite**

```bash
cd services/api && npx jest src/agents/loop/__tests__/scheduler.test.ts --no-coverage
```
Expected: PASS — all tests including the new routing test

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
cd services/api && npx jest --no-coverage
```
Expected: PASS — no regressions in any existing test

- [ ] **Step 6: Commit**

```bash
git add services/api/src/agents/loop/scheduler.ts \
        services/api/src/agents/loop/__tests__/scheduler.test.ts
git commit -m "feat(coin-analysis): route chartSignal users to runCoinAnalysis in scheduler"
```

---

## Self-Review

### Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Coin selection: watchlist[0] for scheduled runs | Task 7 — scheduler routing |
| Coin selection: `selectedCoin` field + on-demand trigger | Task 1 (config field) + Task 6 (POST /trigger) |
| News articles embedded into RAG (type: 'news') | Task 1 (type update) + Task 3 (ingestor) |
| Top 3 news headlines injected as LLM context | Task 5 (generateNarrative) |
| Sentiment bias modifier (keyword scorer) | Task 2 (news.impact.ts) |
| News impact adjusts confidence delta | Task 2 + Task 5 (scoreNewsImpact called in runStrategyCard) |
| 4 strategy cards run in parallel | Task 5 (Promise.all in runCoinAnalysis) |
| One shared buildMarketPrimitives call | Task 5 (called once, passed to all 4 cards) |
| buildChartSnapshot moved to shared util | Task 4 |
| Each card: chart + LLM narrative + news impact | Task 5 (runStrategyCard output) |
| Auto mode: execute best signal | Task 5 (autoExecuteBest) |
| Manual mode: pending_approval + per-card buttons | Task 5 + Task 6 (approve/reject endpoints) |
| Auto/manual toggle = requireManualApproval | Task 1 (no new field needed — existing flag) |
| CoinAnalysisRunDoc model | Task 1 |
| POST /trigger, GET /:runId, /approve, /reject | Task 6 |
| Scheduler routing | Task 7 |

**No gaps found.**

### Type Consistency Check

- `NewsImpact` defined in `coinAnalysis.types.ts` — used by `scoreNewsImpact` return type (Task 2), `StrategyCard.newsImpact` (Task 1), and `coinAnalysis.runner.ts` (Task 5). ✓
- `StrategyFramework` used as parameter type in `approveCard`/`rejectCard` and routes — same type imported from `coinAnalysis.types.ts`. ✓
- `NewsArticleInput` defined in `news.impact.ts` — imported by `news.ingestor.ts` (for `IngestResult.articles`) and `coinAnalysis.runner.ts` (for `articles` parameter). ✓
- `buildChartSnapshot` signature unchanged — same 4 parameters in both the old location and the new util. ✓
- `loadWalletState` exported from `agent.loop.ts` in Task 1 — imported in `coinAnalysis.runner.ts` in Task 5. ✓

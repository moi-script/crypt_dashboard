# 00_SESSION_PRIMER — Two-Tier Chart Analysis System
> Paste this at the start of every new session. All files below are COMPLETE unless marked ⬜ TODO or 🔧 IN-PROGRESS.

---

## System Overview

**Two-Tier Architecture:**
- **Tier 1**: Pure math skills (TypeScript) → produces `MarketPrimitives` (structured JSON)
- **Tier 2**: Claude LLM (claude-opus-4-5) → consumes `MarketPrimitives` → produces `ChartAnalysisResult`
- **Intelligence Layer**: BTC-first → scores coin universe → parallel LLM analysis on top N coins

**Backend**: Node.js + Express + TypeScript + MongoDB + Redis + Binance API  
**Frontend**: Next.js (App Router)

---

## ✅ COMPLETE FILES (do NOT regenerate these)

### Types & Config
- `src/agents/chartAnalysis.types.ts` — ALL interfaces (Candle, MarketPrimitives, ChartAnalysisResult, BtcContext, IntelligenceScan, CoinIntelligenceCard, CascadeEntry, OrderBlock, FairValueGap, BreakOfStructure, LiquiditySweep, SwingPivot, WyckoffContext, ElliottWaveResult, HarmonicPattern, MultiTimeframeContext, IchimokuCloud, VWAPData, FibonacciLevels, PivotPoints, MarketRegime, DominanceData, CorrelationData, CascadeStatus)
- `src/config/coinUniverse.config.ts` — COIN_UNIVERSE_CONFIG (tier1/2/3), OPPORTUNITY_SCORE_WEIGHTS, MAX_FULL_ANALYSIS_PER_TICK (8), MIN_OPPORTUNITY_SCORE_THRESHOLD (0.45), DEFAULT_BETA, DEFAULT_LAG_HOURS, CoinTier

### Ingestion
- `src/read/ingestion/ohlcv.ingest.ts` — OHLCVIngest class + ohlcvIngest singleton. Methods: fetch, fetchMultiTimeframe, fetchOrderBook, fetchFundingRate, fetchOpenInterest. Redis TTL caching per timeframe.

### Skills (ALL COMPLETE)
- `src/agents/skills/structure.skill.ts` — extractZigZagPivots, buildVolumeProfile, detectSupportResistance, detectPsychologicalLevels, detectTrend
- `src/agents/skills/smartMoney.skill.ts` — detectOrderBlocks, detectFairValueGaps, detectBreakOfStructure, detectChangeOfCharacter, detectLiquiditySweeps, detectBullishOrderBlocks, detectBearishOrderBlocks
- `src/agents/skills/indicators.skill.ts` — computeAllIndicators (master bundle), calculateRSI, calculateMACD, calculateStochastic, calculateBollingerBands, calculateATR, calculateADX, calculateCCI, calculateWilliamsR, calculateOBVTrend, calculateCMF, calculateMFI, calculateIchimoku, calculateVWAP, ema, emaLast, smaLast
- `src/agents/skills/fibonacci.skill.ts` — calculateFibonacciLevels, calculateFibFan, calculateFibTimeZones, isPriceNearFibLevel, findFibClusters
- `src/agents/skills/pivots.skill.ts` — calculateStandardPivots, calculateCamarillaPivots, calculateFibonacciPivots, nearestPivotLevel, isPriceAtPivot
- `src/agents/skills/elliott.skill.ts` — analyzeElliottWave, validateElliottRules, getElliottTargets
- `src/agents/skills/wyckoff.skill.ts` — detectWyckoffRange
- `src/agents/skills/harmonics.skill.ts` — analyzeHarmonics, detectHarmonicPatterns, isPriceInPRZ
- `src/agents/skills/multiTimeframe.skill.ts` — buildMultiTimeframeContext, getHTFBias, isAllTimeframesAligned
- `src/agents/skills/correlation.skill.ts` — calculateCorrelation, calculateSectorCorrelation, expectedMove
- `src/agents/skills/dominance.skill.ts` — analyzeDominance, getDominanceSummary, getDominanceMultiplier, getDefaultDominance. Also exports: DominanceSnapshot interface

### Utils
- `src/agents/utils/chartTransform.util.ts` — toHeikinAshi, getHAConsecutiveCount, toRenko, getRenkoTrend, smoothCandles

### Services (COMPLETE)
- `src/services/chartAnalysis.service.ts` — buildMarketPrimitives, runChartAnalysis, analyzeSymbol. Uses claude-opus-4-5, Zod validation on output.
- `src/services/intelligence.service.ts` — runIntelligenceScan, getCoinCard. BTC-first → score universe → parallel analysis.
- `src/services/coinUniverse.service.ts` — prescreenUniverse, getWindowOpenCoins, getSectorLeaderCoins, getCoinsByTier, getScanSummary. Exports: ScoredCoin interface.

### Prompts (COMPLETE)
- `src/agents/policy/prompts/chartAnalyst.prompt.ts` — CHART_ANALYST_SYSTEM_PROMPT, REGIME_CONTEXT_ADDONS
- `src/agents/policy/prompts/crossAsset.prompt.ts` — buildBtcContextBlock, buildCrossAssetSystemPrompt, injectBtcContextIntoMessage, CROSS_ASSET_PROMPT_ADDON

### Risk
- `src/risk/chartAnalysis.risk.ts` — validateChartAnalysisTrade (11 rules), meetsMinimumThreshold. Exports: RiskCheckResult interface.

### Controllers & Routes (COMPLETE)
- `src/controllers/intelligence.controller.ts` — getLatestScan, getCoinIntelligence, getCascadeMap, getTopOpportunities, triggerScan
- `src/routes/intelligence.routes.ts` — GET /scan, POST /trigger, GET /top, GET /cascade, GET /coin/:symbol. All routes use auth middleware.

---

## ⬜ TODO — PRIORITY ORDER FOR NEXT SESSION

### Priority 1: regimeDetector.service.ts
**File**: `src/services/regimeDetector.service.ts`  
**Purpose**: Fast regime detection with Redis caching. Called before full LLM analysis.  
**Imports**: `ohlcvIngest`, `computeAllIndicators`, `detectTrend`, `extractZigZagPivots`, `buildVolumeProfile`, `detectWyckoffRange`, `MarketRegime` (from chartAnalysis.types)  
**Exports**: `detectRegime(symbol, candles): MarketRegime`, `getCachedRegime(symbol): MarketRegime | null`, `cacheRegime(symbol, regime): void`  
**Key logic**: ADX > 25 = trending, ADX < 20 = ranging. Wyckoff phase maps to accumulation/distribution. Post-ATH breakout = price_discovery. Redis TTL: 5 min.  
**Prompt addition needed**: `src/agents/policy/prompts/regimeDetector.prompt.ts` — fast regime classification prompt (lightweight, no tool use)

### Priority 2: orderBlock.service.ts
**File**: `src/services/orderBlock.service.ts`  
**Purpose**: OB lifecycle management — tracks active → mitigated transitions across ticks.  
**Imports**: `detectOrderBlocks`, `detectBullishOrderBlocks`, `detectBearishOrderBlocks` (from smartMoney.skill), `OrderBlock`, `Candle` (from chartAnalysis.types), `ohlcvIngest`, MongoDB model (orderBlock.model)  
**Exports**: `syncOrderBlocks(symbol, candles): Promise<OrderBlock[]>`, `getActiveOrderBlocks(symbol): Promise<OrderBlock[]>`, `markMitigated(id): Promise<void>`, `getOrderBlocksNearPrice(symbol, price, tolerancePct): Promise<OrderBlock[]>`  
**Key logic**: On each tick, re-run detectOrderBlocks, diff against DB. If OB was active and price has traded through it → mark mitigated. Persist to MongoDB for historical tracking.

### Priority 3: chartAnalysis.tools.ts (LLM tool wrappers)
**File**: `src/agents/tools/chartAnalysis.tools.ts`  
**Purpose**: Tool definitions for agentic drill-down — LLM can call these to get more data.  
**Exports as Anthropic tool definitions array**: `CHART_ANALYSIS_TOOLS`  
**Tools to implement**:
- `analyze_market_structure` — runs structure.skill on a given symbol/timeframe
- `get_market_pivots` — returns extractZigZagPivots result
- `get_htf_context` — returns buildMultiTimeframeContext result
- `detect_harmonic_setup` — runs harmonics.skill
- `get_confluence_zones` — finds overlapping S/R + OB + Fib + Pivot levels
- `get_pivot_points` — returns calculateStandardPivots + calculateCamarillaPivots
- `get_ichimoku_detail` — returns calculateIchimoku with interpretation
- `get_vwap_bands` — returns calculateVWAP with band analysis

### Priority 4: multiTimeframe.tools.ts
**File**: `src/agents/tools/multiTimeframe.tools.ts`  
**Purpose**: HTF/LTF context tools for agentic timeframe analysis.  
**Exports**: `MTF_TOOLS` (Anthropic tool definitions)  
**Tools**: `get_htf_context`, `get_confluence_zones`, `get_timeframe_bias`, `compare_timeframe_structures`

### Priority 5: gann.skill.ts (OPTIONAL — flag off by default)
**File**: `src/agents/skills/gann.skill.ts`  
**Purpose**: Gann angles and time cycle detection.  
**Exports**: `calculateGannAngles(candles, pivots): GannAngle[]`, `detectGannTimeCycles(candles): GannCycle[]`  
**Feature flag**: Check `process.env.ENABLE_GANN === 'true'` before running. Return empty arrays if disabled.

### Priority 6: Strategies (convert skill output → TradeSignal)
- `src/agents/policy/strategies/smartMoney.strategy.ts` — ICT OB + ChoCH/BOS → TradeSignal
- `src/agents/policy/strategies/wyckoff.strategy.ts` — Spring/UTAD → TradeSignal
- `src/agents/policy/strategies/elliott.strategy.ts` — Wave 3/5 targets → TradeSignal
- `src/agents/policy/strategies/harmonic.strategy.ts` — PRZ entry → TradeSignal

### Priority 7: Mongoose Models & Schemas
- `src/models/schemes/orderBlock.schema.ts` — OrderBlock mongoose schema (id, type, high, low, origin_timestamp, timeframe, status, strength, associated_fvg, symbol)
- `src/models/schemes/marketRegime.schema.ts` — MarketRegime mongoose schema (symbol, regime, detected_at, confidence, adx, wyckoff_phase)
- `src/models/orderBlock.model.ts` — mongoose model from orderBlock.schema
- `src/models/marketRegime.model.ts` — mongoose model from marketRegime.schema
- `src/models/chartAnalysis.model.ts` — mongoose model to persist ChartAnalysisResult per symbol

### Priority 8: Controllers & Routes (new endpoints)
- `src/controllers/chartAnalysis.controller.ts` — analyze endpoint, history endpoint
- `src/controllers/orderBlock.controller.ts` — CRUD for order blocks
- `src/routes/chartAnalysis.routes.ts` — GET /analyze/:symbol, GET /history/:symbol
- `src/routes/orderBlock.routes.ts` — GET /active/:symbol, GET /near/:symbol/:price

### Priority 9: Frontend
- `app/intelligence/page.tsx` — scanner page (use IntelligenceScanner component)
- `app/intelligence/[coinId]/page.tsx` — deep-dive page (use ChartAnalysisDrawer)
- `components/IntelligenceScanner.tsx` — container: BtcContextBar + CoinIntelligenceCard list + CascadeMap sidebar
- `components/CoinIntelligenceCard.tsx` — single card: price, cascade status, confluence bar, bias badge, top framework
- `components/BtcContextBar.tsx` — full-width header: BTC regime, bias, dominance phase, minutes since signal
- `components/CascadeMap.tsx` — sidebar timeline: coins ordered by window_remaining_minutes
- `components/ConfluenceBar.tsx` — reusable 0-9 score bar with labeled factors
- `components/ChartAnalysisDrawer.tsx` — slide-over: full ChartAnalysisResult, entry zone, SL, TPs, R:R, reasoning
- `services/intelligence.service.frontend.ts` — getScan(), getCoinCard(symbol), triggerScan()

---

## Dependency Graph (NEVER import in reverse order)

```
chartAnalysis.types.ts          (no imports from src)
    ↓
coinUniverse.config.ts          (imports CoinTier)
nanoid.ts                       (no imports)
    ↓
ohlcv.ingest.ts                 (imports Candle, Timeframe)
    ↓
structure.skill.ts              (imports Candle, SwingPivot, VolumeProfileLevel)
    ↓
smartMoney.skill.ts             (imports structure.skill + types + nanoid)
indicators.skill.ts             (imports Candle, IchimokuCloud, VWAPData)
fibonacci.skill.ts              (imports structure.skill)
pivots.skill.ts                 (imports Candle, PivotPoints)
    ↓
elliott.skill.ts                (imports structure.skill)
wyckoff.skill.ts                (imports structure.skill)
harmonics.skill.ts              (imports structure.skill)
    ↓
multiTimeframe.skill.ts         (imports structure.skill + ohlcv.ingest)
correlation.skill.ts            (imports Candle + coinUniverse.config)
dominance.skill.ts              (imports DominanceData type only)
    ↓
chartAnalyst.prompt.ts          (no skill imports)
crossAsset.prompt.ts            (imports BtcContext, DominanceData)
regimeDetector.prompt.ts        (no skill imports — just string export)        ← TODO
    ↓
chartTransform.util.ts          (imports Candle only)
    ↓
regimeDetector.service.ts       (imports indicators + structure + wyckoff + ohlcvIngest)  ← TODO
    ↓
chartAnalysis.service.ts        (imports ALL skills + ohlcvIngest + prompts)
    ↓
chartAnalysis.risk.ts           (imports ChartAnalysisResult, MarketPrimitives)
orderBlock.service.ts           (imports smartMoney.skill + ohlcvIngest + DB model)       ← TODO
    ↓
coinUniverse.service.ts         (imports correlation + dominance + ohlcvIngest)
intelligence.service.ts         (imports chartAnalysis.service + coinUniverse.service + all skills)
    ↓
intelligence.controller.ts      (imports intelligence.service)
intelligence.routes.ts          (imports intelligence.controller)
```

---

## Key Constants & Thresholds

| Constant | Value | Location |
|---|---|---|
| MAX_FULL_ANALYSIS_PER_TICK | 8 | coinUniverse.config.ts |
| MIN_OPPORTUNITY_SCORE_THRESHOLD | 0.45 | coinUniverse.config.ts |
| MIN_CONFIDENCE_TO_EXECUTE | 40 | chartAnalysis.risk.ts |
| MIN_CONFIDENCE_FULL_SIZE | 70 | chartAnalysis.risk.ts |
| MIN_RR SmartMoney | 2.0 | chartAnalysis.risk.ts |
| MIN_RR Wyckoff | 3.0 | chartAnalysis.risk.ts |
| MIN_RR ElliottWave | 3.0 | chartAnalysis.risk.ts |
| MIN_RR Harmonic | 2.0 | chartAnalysis.risk.ts |
| BTC Season threshold | BTC.D > 55% rising | dominance.skill.ts |
| Alt Season threshold | BTC.D < 40% falling | dominance.skill.ts |
| LLM Model | claude-opus-4-5 | chartAnalysis.service.ts |
| Cache TTL (intelligence) | 15 min | intelligence.controller.ts |
| VALUE_AREA_PCT | 70% | structure.skill.ts |
| WYCKOFF_RANGE_LOOKBACK | 60 bars | wyckoff.skill.ts |
| ZIGZAG_THRESHOLD | 3% (env) | structure.skill.ts |
| HARMONIC_TOLERANCE | ±2.5% | harmonics.skill.ts |
| VOLUME_SPIKE_MULTIPLIER | 2.0x | wyckoff.skill.ts |

---

## Environment Variables Required

```env
BINANCE_BASE_URL=https://api.binance.com
BINANCE_API_KEY=
REDIS_URL=redis://localhost:6379
CHART_ANALYSIS_CACHE_TTL=0         # 0 = use per-timeframe defaults
ZIGZAG_THRESHOLD=0.03
VOLUME_PROFILE_BUCKETS=24
WYCKOFF_RANGE_LOOKBACK=60
ENABLE_GANN=false
ANTHROPIC_API_KEY=
```

---

## Existing Infrastructure (DO NOT RECREATE)

These files exist and should be imported/modified, not recreated:
- `src/agents/loop/agent.loop.ts` — agent loop (add REGIME_TO_SKILLS mapping here)
- `src/agents/loop/loop.types.ts`
- `src/agents/loop/scheduler.ts`
- `src/agents/policy/policy.engine.ts` — add import regimeDetector.service
- `src/agents/emotion.state.ts`
- `src/agents/emotion.types.ts`
- `src/agents/orchestrator.ts` — add chartAnalysis pipeline
- `src/agents/report.generator.ts`
- `src/agents/tools/act.tools.ts`
- `src/agents/tools/read.tools.ts` — MODIFY: add chartAnalysis tools
- `src/agents/tools/tool.registry.ts` — MODIFY: register chartAnalysis + MTF tools
- `src/agents/tools/tool.types.ts`
- `src/config/agent.config.ts` — MODIFY: add chartAnalysis config keys
- `src/config/chains.config.ts`
- `src/config/coingecko.client.ts`
- `src/config/db.ts`
- `src/config/env.ts` — MODIFY: add ENABLE_GANN, CHART_ANALYSIS_CACHE_TTL
- `src/config/redis.ts`
- `src/execution/**` — all executors
- `src/middleware/**` — all middleware
- `src/models/agent.model.ts`, agentRun, alert, analysis, coin, coingecko, news, opportunity, paperWallet, position, user models
- `src/read/context.builder.ts` — MODIFY: add MTF builder integration
- `src/risk/risk.config.ts`, risk.engine.ts, risk.rules.ts — MODIFY: integrate chartAnalysis.risk.ts
- `src/routes/index.ts` — MODIFY: add `app.use('/api/intelligence', intelligenceRouter)`
- All existing controllers, routes, services not listed in TODO above
- `src/utils/nanoid.ts`
- `src/views/useCoinGecko.ts`
- `src/websocket/**`

---

## ChartAnalysisResult Schema (LLM output — Zod validated)

```typescript
{
  regime: 'trending_up' | 'trending_down' | 'ranging' | 'accumulation' | 'distribution' | 'price_discovery'
  bias: 'long' | 'short' | 'neutral'
  primary_framework: 'SmartMoney' | 'Wyckoff' | 'ElliottWave' | 'Harmonic' | 'Hybrid'
  setup_name: string
  entry_zone: { high: number; low: number }
  stop_loss: number
  take_profit_levels: number[]  // always 3 targets
  risk_reward: number
  confidence: number  // 0-100
  invalidation: string
  reasoning: string
  framework_scores: Record<string, number>
  confluence_score: number  // 0-9
  confluence_factors: string[]
}
```

---

## Quick "What to build next" Checklist

If starting a session with no other instructions, build in this order:
1. `regimeDetector.service.ts` + `regimeDetector.prompt.ts`
2. `orderBlock.service.ts` + Mongoose schemas (orderBlock, marketRegime)
3. `chartAnalysis.tools.ts` + `multiTimeframe.tools.ts`
4. Strategy files (smartMoney, wyckoff, elliott, harmonic)
5. Frontend components (BtcContextBar → CoinIntelligenceCard → CascadeMap → ConfluenceBar → ChartAnalysisDrawer)
6. `gann.skill.ts` (optional, last)

---

## Stub Files Already Created (safe to implement body)

The following stub files exist with correct exports and correct import paths — they will NOT cause import errors. Fill in the function bodies:
- `src/services/regimeDetector.service.ts`
- `src/agents/policy/prompts/regimeDetector.prompt.ts`
- `src/services/orderBlock.service.ts`
- `src/agents/tools/chartAnalysis.tools.ts`
- `src/agents/tools/multiTimeframe.tools.ts`
- `src/agents/skills/gann.skill.ts`
- `src/agents/policy/strategies/smartMoney.strategy.ts`
- `src/agents/policy/strategies/wyckoff.strategy.ts`
- `src/agents/policy/strategies/elliott.strategy.ts`
- `src/agents/policy/strategies/harmonic.strategy.ts`
- `src/models/schemes/orderBlock.schema.ts`
- `src/models/schemes/marketRegime.schema.ts`
- `src/models/orderBlock.model.ts`
- `src/models/marketRegime.model.ts`
- `src/models/chartAnalysis.model.ts`
- `src/read/multiTimeframe.builder.ts`
- `src/controllers/chartAnalysis.controller.ts`
- `src/controllers/orderBlock.controller.ts`
- `src/routes/chartAnalysis.routes.ts`
- `src/routes/orderBlock.routes.ts`









📁 src/
├── __tests__
├── agents
│   ├── loop
│   │   ├── agent.loop.ts
│   │   ├── loop.types.ts
│   │   └── scheduler.ts
│   ├── policy
│   │   ├── prompts
│   │   │   └── regimeDetector.prompt.ts          ← NEW S03 | Single-turn LLM regime classifier prompt + REGIME_TO_SKILLS map for policy.engine.ts
│   │   ├── strategies
│   │   │   ├── strategy.types.ts                 ← NEW S03 | Shared TradeSignal + StrategyResult interfaces used by all 4 strategies
│   │   │   ├── smartMoney.strategy.ts            ← NEW S03 | ICT Order Block + BOS/ChoCH → TradeSignal (min R:R 2.0)
│   │   │   ├── wyckoff.strategy.ts               ← NEW S03 | Spring/UTAD → TradeSignal (min R:R 3.0, enforces no-front-run)
│   │   │   ├── elliott.strategy.ts               ← NEW S03 | Wave 3 / Wave 5 / Wave C scenarios → TradeSignal
│   │   │   └── harmonic.strategy.ts              ← NEW S03 | PRZ entry → TradeSignal (requires ≥85% pattern completion)
│   │   └── policy.engine.ts
│   ├── skills
│   │   ├── correlation.skill.ts
│   │   ├── dominance.skill.ts
│   │   ├── elliott.skill.ts
│   │   ├── fibonacci.skill.ts
│   │   ├── gann.skill.ts                         ← NEW S03 | Gann angles + time cycles (Square of 9, Fibonacci bars), guarded by ENABLE_GANN=true
│   │   ├── harmonics.skill.ts
│   │   ├── indicators.skill.ts
│   │   ├── momentum.skill.ts
│   │   ├── multiTimeframe.skill.ts
│   │   ├── pattern.skill.ts
│   │   ├── pivots.skill.ts
│   │   ├── rotation.skills.ts
│   │   ├── sentiment.skill.ts
│   │   ├── smartMoney.skill.ts
│   │   ├── structure.skill.ts
│   │   ├── trend.skill.ts
│   │   ├── volatility.skill.ts
│   │   ├── wyckoff.skill.ts
│   │   └── yield.skill.ts
│   ├── tools
│   │   ├── act.tools.ts
│   │   ├── chartAnalysis.tools.ts                ← NEW S03 | 8 Anthropic tool defs + full handleChartAnalysisTool() dispatcher for agentic drill-down
│   │   ├── multiTimeframe.tools.ts               ← NEW S03 | 4 MTF tool defs + handler (HTF context, confluence zones, TF bias, TF structure compare)
│   │   ├── read.tools.ts
│   │   ├── tool.registry.ts
│   │   └── tool.types.ts
│   ├── utils
│   │   └── chartTransform.util.ts
│   ├── chartAnalysis.types.ts
│   ├── emotion.state.ts
│   ├── emotion.types.ts
│   ├── orchestrator.ts
│   └── report.generator.ts
├── config
│   ├── agent.config.ts
│   ├── chains.config.ts
│   ├── coingecko.client.ts
│   ├── coinUniverse.config.ts
│   ├── db.ts
│   ├── env.ts
│   └── redis.ts
├── controllers
│   ├── agent.controller.ts
│   ├── agentRun.controller.ts
│   ├── alert.controller.ts
│   ├── analysis.controller.ts
│   ├── auth.controller.ts
│   ├── chartAnalysis.controller.ts               ← NEW S03 | Handlers: analyzeSymbol, getAnalysisHistory, getPrimitives — runs risk gate + persists to DB
│   ├── coin.controller.ts
│   ├── coingecko.controller.ts
│   ├── intelligence.controller.ts
│   ├── news.controller.ts
│   ├── opportunity.controller.ts
│   ├── orderBlock.controller.ts                  ← NEW S03 | Handlers: getActive, getNear, getNearest, sync, mitigate — CRUD for OB lifecycle
│   ├── paperWallet.controller.ts
│   ├── portfolio.controller.ts
│   └── position.controller.ts
├── execution
│   ├── modes
│   │   ├── cex.executor.ts
│   │   ├── onchain.executor.ts
│   │   └── paper.executor.ts
│   ├── wallet
│   │   └── keystore.ts
│   └── execution.gateway.ts
├── middleware
│   ├── article.scraper.ts
│   ├── auth.ts
│   ├── errorHandler.ts
│   ├── rateLimit.ts
│   └── validate.ts
├── models
│   ├── schemes
│   │   ├── chartAnalysis.schema.ts               ← NEW S03 | Mongoose schema for persisting ChartAnalysisResult + risk gate output, 72h TTL
│   │   ├── marketRegime.schema.ts
│   │   ├── ohlcv.schema.ts
│   │   └── orderBlock.schema.ts
│   ├── agent.model.ts
│   ├── agentRun.model.ts
│   ├── alert.model.ts
│   ├── analysis.model.ts
│   ├── chartAnalysis.model.ts                    ← NEW S03 | Mongoose model wrapping chartAnalysis.schema, hot-reload safe
│   ├── coin.model.ts
│   ├── coingecko.model.ts
│   ├── marketRegime.model.ts                     ← NEW S03 | Mongoose model wrapping marketRegime.schema, hot-reload safe
│   ├── news.model.ts
│   ├── opportunity.model.ts
│   ├── orderBlock.model.ts                       ← NEW S03 | Mongoose model wrapping orderBlock.schema, hot-reload safe
│   ├── paperWallet.model.ts
│   ├── position.model.ts
│   └── user.model.ts
├── read
│   ├── ingestion
│   │   ├── defillama.ingest.ts
│   │   └── ohlcv.ingest.ts
│   ├── context.builder.ts
│   └── multiTimeframe.builder.ts                 ← NEW S03 | buildMTFContextForSymbol(), formatMTFForPrompt() — integration point for context.builder.ts
├── risk
│   ├── chartAnalysis.risk.ts
│   ├── risk.config.ts
│   ├── risk.engine.ts
│   └── risk.rules.ts
├── routes
│   ├── agent.routes.ts
│   ├── agentRun.routes.ts
│   ├── alert.routes.ts
│   ├── analysis.routes.ts
│   ├── auth.routes.ts
│   ├── chartAnalysis.routes.ts                   ← NEW S03 | Routes: POST /api/chart/analyze/:symbol, GET /api/chart/history/:symbol, GET /api/chart/primitives/:symbol
│   ├── coin.routes.ts
│   ├── index.ts
│   ├── intelligence.routes.ts
│   ├── news.routes.ts
│   ├── orderBlock.routes.ts                      ← NEW S03 | Routes: GET active/near/nearest, POST sync, PATCH mitigate — all under /api/orderblocks
│   ├── paperWallet.routes.ts
│   ├── portfolio.routes.ts
│   └── position.routes.ts
├── services
│   ├── agent.service.ts
│   ├── alert.service.ts
│   ├── analysis.service.ts
│   ├── articles.scraper.ts
│   ├── auth.service.ts
│   ├── chartAnalysis.service.ts
│   ├── coin.service.ts
│   ├── coingecko.service.ts
│   ├── coinUniverse.service.ts
│   ├── intelligence.service.ts
│   ├── news.service.ts
│   ├── orderBlock.service.ts                     ← NEW S03 | Diff-based OB lifecycle sync, MongoDB CRUD, graceful in-memory fallback when DB offline
│   ├── paperWallet.service.ts
│   ├── portfolio.service.ts
│   ├── regimeDetector.service.ts                 ← NEW S03 | ADX+Wyckoff+EMA → MarketRegime, 5-min Redis cache, detectRegimeForSymbol() convenience fn
│   └── position.service.ts
├── utils
│   └── nanoid.ts
├── views
│   └── useCoinGecko.ts
├── websocket
│   ├── redisSubscriber.ts
│   └── wsServer.ts
├── .env.additions
├── app.ts
├── FACTORS.md
├── migrate-session-userid.ts
├── NEW_SKILLS.md
├── NEXT_TO_FIX.md
├── PATCH_app.ts.md
├── PLANNED_NEW_FEATURESV2.md
├── ProgressFile.md
└── README.md
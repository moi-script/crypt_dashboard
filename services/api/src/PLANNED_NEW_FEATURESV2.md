# Chart Analysis Agent — Engineering Integration Plan
**Version:** 1.0  
**Scope:** Extending the existing trading agent with a Two-Tier Chart Analysis Architecture  
**Author Role:** Professional Trader + Software Engineer  
**Target Stack:** TypeScript / Node.js / MongoDB / Redis / Anthropic API

---

## Executive Summary

The existing agent architecture (`orchestrator.ts` → `policy.engine.ts` → skills) uses pre-calculated math and deterministic logic to drive trade decisions. This plan extends it with a **Two-Tier Chart Analysis System**: the backend becomes a Feature Extractor that compresses raw OHLCV data into structural "primitives," and the LLM becomes a Pattern Synthesizer that interprets macro market context. No existing files are deleted; only new files are added and existing files are surgically extended.

---

## 1. Core Design Principle

```
┌─────────────────────────────────────────────────────────────────────┐
│                       TWO-TIER ARCHITECTURE                         │
│                                                                     │
│  TIER 1 — FEATURE EXTRACTOR (TypeScript / Local Math)              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Raw OHLCV Array                                             │  │
│  │      │                                                       │  │
│  │      ├── smartMoney.skill.ts   → Order Blocks, FVGs, BOS     │  │
│  │      ├── structure.skill.ts    → S/R Zones, Volume Profile   │  │
│  │      ├── harmonics.skill.ts    → Gartley, Bat, Butterfly     │  │
│  │      ├── elliott.skill.ts      → ZigZag Pivots Array         │  │
│  │      ├── wyckoff.skill.ts      → Range + Volume Physics       │  │
│  │      └── multiTimeframe.skill.ts → HTF/LTF Confluence        │  │
│  │                                                               │  │
│  │      Output: Compressed "Market Primitives" JSON              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  TIER 2 — PATTERN SYNTHESIZER (LLM / Anthropic API)               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Receives: Primitives JSON + Market Baseline                 │  │
│  │  Decides:  Which TA framework applies (Wyckoff? Elliott?)    │  │
│  │  Returns:  Structured JSON { regime, bias, setup, entry }    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│            policy.engine.ts  →  execution.gateway.ts               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. New Files to Create

### 2.1 New Skills (Tier 1 — Feature Extractors)

| New File | Location | Responsibility |
|---|---|---|
| `smartMoney.skill.ts` | `src/agents/skills/` | Order Blocks, FVGs, BOS, ChoCH, Liquidity Sweeps |
| `structure.skill.ts` | `src/agents/skills/` | S/R Zones, Volume Profile, VAH/VAL, VPOC, ZigZag Pivots |
| `harmonics.skill.ts` | `src/agents/skills/` | Gartley, Bat, Butterfly, Crab, Cypher harmonic patterns |
| `elliott.skill.ts` | `src/agents/skills/` | Elliott Wave ZigZag extractor + Fibonacci ratio validator |
| `wyckoff.skill.ts` | `src/agents/skills/` | Wyckoff phase detection (Spring, UTAD, LPS, SOS) |
| `multiTimeframe.skill.ts` | `src/agents/skills/` | HTF→LTF confluence builder across 4 timeframes |
| `gann.skill.ts` | `src/agents/skills/` | Gann angles, Gann Fan, time-based cycles |

### 2.2 New Tools (Tier 1 → Tier 2 Bridge)

| New File | Location | Responsibility |
|---|---|---|
| `chartAnalysis.tools.ts` | `src/agents/tools/` | Wraps all new skills as LLM-callable tools |
| `multiTimeframe.tools.ts` | `src/agents/tools/` | Exposes `get_htf_context()`, `get_confluence_zones()` |

### 2.3 New Prompts

| New File | Location | Responsibility |
|---|---|---|
| `chartAnalyst.prompt.ts` | `src/agents/policy/prompts/` | System prompt for CMT-level chart analysis reasoning |
| `regimeDetector.prompt.ts` | `src/agents/policy/prompts/` | Classifies market regime: Trending / Ranging / Distribution |

### 2.4 New Strategies

| New File | Location | Responsibility |
|---|---|---|
| `smartMoney.strategy.ts` | `src/agents/policy/strategies/` | ICT/SMC strategy: OB + FVG + BOS confluence |
| `wyckoff.strategy.ts` | `src/agents/policy/strategies/` | Wyckoff Spring / UTAD trade setups |
| `elliott.strategy.ts` | `src/agents/policy/strategies/` | Wave 3 / Wave 5 impulse entry logic |
| `harmonic.strategy.ts` | `src/agents/policy/strategies/` | PRZ (Potential Reversal Zone) entry at harmonic completions |

### 2.5 New Models & Schemas

| New File | Location | Responsibility |
|---|---|---|
| `orderBlock.model.ts` | `src/models/` | Persists detected OB zones with status (active/mitigated) |
| `marketRegime.model.ts` | `src/models/` | Persists current regime classification per coin per timeframe |
| `chartAnalysis.model.ts` | `src/models/` | Stores the LLM's synthesized analysis output per run |
| `orderBlock.schema.ts` | `src/models/schemes/` | Mongoose schema for Order Block |
| `marketRegime.schema.ts` | `src/models/schemes/` | Mongoose schema for Market Regime |

### 2.6 New Controllers & Routes

| New File | Location | Responsibility |
|---|---|---|
| `chartAnalysis.controller.ts` | `src/controllers/` | REST endpoints for on-demand chart analysis |
| `orderBlock.controller.ts` | `src/controllers/` | CRUD for persisted Order Block zones |
| `chartAnalysis.routes.ts` | `src/routes/` | Registers chart analysis endpoints |
| `orderBlock.routes.ts` | `src/routes/` | Registers order block endpoints |

### 2.7 New Ingestion

| New File | Location | Responsibility |
|---|---|---|
| `ohlcv.ingest.ts` | `src/read/ingestion/` | Fetches multi-timeframe OHLCV from CoinGecko / Binance |
| `multiTimeframe.builder.ts` | `src/read/` | Assembles HTF + LTF arrays for context builder |

### 2.8 New Services

| New File | Location | Responsibility |
|---|---|---|
| `chartAnalysis.service.ts` | `src/services/` | Orchestrates Tier 1 extraction → Tier 2 synthesis |
| `orderBlock.service.ts` | `src/services/` | Business logic for OB lifecycle management |
| `regimeDetector.service.ts` | `src/services/` | Classifies and caches current market regime |

### 2.9 New Risk Rules

| New File | Location | Responsibility |
|---|---|---|
| `chartAnalysis.risk.ts` | `src/risk/` | Risk rules specific to structure-based setups (e.g., never trade into unmitigated OB) |

### 2.10 New Types

| New File | Location | Responsibility |
|---|---|---|
| `chartAnalysis.types.ts` | `src/agents/` | All TypeScript interfaces for new skills/tools/outputs |

---

## 3. Files to Modify (Surgical Extensions Only)

| Existing File | Change |
|---|---|
| `src/agents/tools/read.tools.ts` | Register all new `chartAnalysis.tools.ts` tool functions |
| `src/agents/tools/tool.registry.ts` | Add new tool definitions for LLM tool-call schema |
| `src/agents/orchestrator.ts` | Add regime detection step before skill selection; call `regimeDetector.service.ts` |
| `src/agents/policy/policy.engine.ts` | Add context-aware skill routing based on detected regime |
| `src/read/context.builder.ts` | Add multi-timeframe OHLCV blocks via `multiTimeframe.builder.ts` |
| `src/routes/index.ts` | Mount new `chartAnalysis.routes.ts` and `orderBlock.routes.ts` |
| `src/config/agent.config.ts` | Add new feature flags: `enableSmartMoney`, `enableElliottWave`, `enableHarmonics` |
| `src/config/env.ts` | Add `BINANCE_API_KEY`, `BINANCE_SECRET`, `CHART_ANALYSIS_CACHE_TTL` |
| `.env.additions` | Document all new required environment variables |

---

## 4. Full Updated File Structure

```
src/
├── agents/
│   ├── loop/
│   │   ├── agent.loop.ts
│   │   ├── loop.types.ts
│   │   └── scheduler.ts
│   ├── policy/
│   │   ├── prompts/
│   │   │   ├── chartAnalyst.prompt.ts          ← NEW
│   │   │   └── regimeDetector.prompt.ts        ← NEW
│   │   ├── strategies/
│   │   │   ├── smartMoney.strategy.ts          ← NEW
│   │   │   ├── wyckoff.strategy.ts             ← NEW
│   │   │   ├── elliott.strategy.ts             ← NEW
│   │   │   └── harmonic.strategy.ts            ← NEW
│   │   └── policy.engine.ts                   ← MODIFIED
│   ├── skills/
│   │   ├── momentum.skill.ts
│   │   ├── pattern.skill.ts
│   │   ├── rotation.skills.ts
│   │   ├── sentiment.skill.ts
│   │   ├── trend.skill.ts
│   │   ├── volatility.skill.ts
│   │   ├── yield.skill.ts
│   │   ├── smartMoney.skill.ts                ← NEW
│   │   ├── structure.skill.ts                 ← NEW
│   │   ├── harmonics.skill.ts                 ← NEW
│   │   ├── elliott.skill.ts                   ← NEW
│   │   ├── wyckoff.skill.ts                   ← NEW
│   │   ├── multiTimeframe.skill.ts            ← NEW
│   │   └── gann.skill.ts                      ← NEW
│   │   ├── indicators.skill.ts                ← NEW
│   ├── tools/
│   │   ├── act.tools.ts
│   │   ├── read.tools.ts                      ← MODIFIED
│   │   ├── tool.registry.ts                   ← MODIFIED
│   │   ├── tool.types.ts
│   │   ├── chartAnalysis.tools.ts             ← NEW
│   │   └── multiTimeframe.tools.ts            ← NEW
│   ├── chartAnalysis.types.ts                 ← NEW
│   ├── emotion.state.ts
│   ├── emotion.types.ts
│   ├── orchestrator.ts                        ← MODIFIED
│   └── report.generator.ts
├── config/
│   ├── agent.config.ts                        ← MODIFIED
│   ├── chains.config.ts
│   ├── coingecko.client.ts
│   ├── db.ts
│   ├── env.ts                                 ← MODIFIED
│   └── redis.ts
├── controllers/
│   ├── agent.controller.ts
│   ├── agentRun.controller.ts
│   ├── alert.controller.ts
│   ├── analysis.controller.ts
│   ├── auth.controller.ts
│   ├── coin.controller.ts
│   ├── coingecko.controller.ts
│   ├── news.controller.ts
│   ├── opportunity.controller.ts
│   ├── paperWallet.controller.ts
│   ├── portfolio.controller.ts
│   ├── position.controller.ts
│   ├── chartAnalysis.controller.ts            ← NEW
│   └── orderBlock.controller.ts               ← NEW
├── execution/
│   ├── modes/
│   │   ├── cex.executor.ts
│   │   ├── onchain.executor.ts
│   │   └── paper.executor.ts
│   ├── wallet/
│   │   └── keystore.ts
│   └── execution.gateway.ts
├── middleware/
│   ├── article.scraper.ts
│   ├── auth.ts
│   ├── errorHandler.ts
│   ├── rateLimit.ts
│   └── validate.ts
├── models/
│   ├── schemes/
│   │   ├── ohlcv.schema.ts
│   │   ├── orderBlock.schema.ts               ← NEW
│   │   └── marketRegime.schema.ts             ← NEW
│   ├── agent.model.ts
│   ├── agentRun.model.ts
│   ├── alert.model.ts
│   ├── analysis.model.ts
│   ├── coin.model.ts
│   ├── coingecko.model.ts
│   ├── news.model.ts
│   ├── opportunity.model.ts
│   ├── paperWallet.model.ts
│   ├── position.model.ts
│   ├── user.model.ts
│   ├── orderBlock.model.ts                    ← NEW
│   ├── marketRegime.model.ts                  ← NEW
│   └── chartAnalysis.model.ts                 ← NEW
├── read/
│   ├── ingestion/
│   │   ├── defillama.ingest.ts
│   │   └── ohlcv.ingest.ts                    ← NEW
│   ├── context.builder.ts                     ← MODIFIED
│   └── multiTimeframe.builder.ts              ← NEW
├── risk/
│   ├── risk.config.ts
│   ├── risk.engine.ts
│   ├── risk.rules.ts
│   └── chartAnalysis.risk.ts                  ← NEW
├── routes/
│   ├── agent.routes.ts
│   ├── agentRun.routes.ts
│   ├── alert.routes.ts
│   ├── analysis.routes.ts
│   ├── auth.routes.ts
│   ├── coin.routes.ts
│   ├── index.ts                               ← MODIFIED
│   ├── news.routes.ts
│   ├── paperWallet.routes.ts
│   ├── portfolio.routes.ts
│   ├── position.routes.ts
│   ├── chartAnalysis.routes.ts                ← NEW
│   └── orderBlock.routes.ts                   ← NEW
├── services/
│   ├── agent.service.ts
│   ├── alert.service.ts
│   ├── analysis.service.ts
│   ├── articles.scraper.ts
│   ├── auth.service.ts
│   ├── coin.service.ts
│   ├── coingecko.service.ts
│   ├── news.service.ts
│   ├── paperWallet.service.ts
│   ├── portfolio.service.ts
│   ├── chartAnalysis.service.ts               ← NEW
│   ├── orderBlock.service.ts                  ← NEW
│   └── regimeDetector.service.ts              ← NEW
├── utils/
│   └── nanoid.ts
├── views/
│   └── useCoinGecko.ts
└── websocket/
    ├── redisSubscriber.ts
    └── wsServer.ts
```
---





## 5. APIs to Integrate

### 5.1 Primary Data Sources

| API | Purpose | Auth |
|---|---|---|
| **Binance REST API** | High-quality OHLCV data for all timeframes (1m, 5m, 15m, 1h, 4h, 1d) | `BINANCE_API_KEY` + `BINANCE_SECRET` |
| **CoinGecko API** *(existing)* | Market cap, volume, coin metadata | Existing config |
| **Anthropic Claude API** *(existing)* | LLM Pattern Synthesizer (Tier 2) | Existing config |

### 5.2 Optional / Recommended

| API | Purpose | Notes |
|---|---|---|
| **TradingView Webhook** | Receive Pine Script alerts as event triggers | Inbound webhook endpoint |
| **DeFiLlama** *(existing)* | TVL & on-chain flow context | Existing `defillama.ingest.ts` |
| **CryptoCompare** | Supplemental OHLCV + social sentiment | Fallback for CoinGecko gaps |
| **Glassnode** | On-chain metrics (whale flows, SOPR) | Optional premium tier |

### 5.3 New Binance Endpoints to Use

```
GET /api/v3/klines?symbol=BTCUSDT&interval=4h&limit=200   → OHLCV
GET /api/v3/depth?symbol=BTCUSDT&limit=100                → Order Book
GET /api/v3/trades?symbol=BTCUSDT&limit=500               → Recent Trades (delta)
GET /fapi/v1/fundingRate                                   → Futures Funding Rate
GET /fapi/v1/openInterest                                  → Open Interest
```

---

## 6. Libraries to Install

### 6.1 npm Packages (Production)

```bash
# Technical Analysis Math Engine
npm install technicalindicators        # RSI, MACD, ATR, Bollinger, Stochastic, ADX
npm install tulind                     # Lightweight C-native TA — faster for bulk batch
npm install @debut/community-core      # Pivot detection, ZigZag, Volume Profile

# Charting / OHLCV Processing
npm install lightweight-charts        # For server-side chart PNG generation (optional)
npm install lodash                     # Array utilities for OHLCV window slicing

# Binance API Client
npm install @binance/connector         # Official Binance Node.js SDK

# Fibonacci & Harmonic Math
npm install mathjs                     # Precise ratio calculations (no float drift)

# Data Caching
npm install ioredis                    # Redis client (likely already installed via redis.ts)
npm install node-cache                 # In-memory L1 cache for hot OHLCV windows

# Validation
npm install zod                        # Schema validation for LLM JSON responses
```

### 6.2 npm Packages (Development / Testing)

```bash
npm install --save-dev
  @types/lodash
  jest
  ts-jest
  @types/jest
```

### 6.3 Install Command (All at once)

```bash
npm install technicalindicators tulind @binance/connector mathjs ioredis node-cache zod lodash
npm install --save-dev @types/lodash jest ts-jest @types/jest
```

---

## 7. TypeScript Interfaces (New Types Reference)

All new interfaces live in `src/agents/chartAnalysis.types.ts`.

```typescript
// Core OHLCV Candle
export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Market Regimes
export type MarketRegime =
  | 'trending_up'
  | 'trending_down'
  | 'ranging'
  | 'accumulation'     // Wyckoff Phase B/C
  | 'distribution'     // Wyckoff Phase D
  | 'price_discovery'; // Post-ATH breakout

// Order Block Zone
export interface OrderBlock {
  id: string;
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  origin_timestamp: number;
  timeframe: string;
  status: 'active' | 'mitigated' | 'broken';
  associated_fvg?: FairValueGap;
}

// Fair Value Gap
export interface FairValueGap {
  high: number;
  low: number;
  timestamp: number;
  filled: boolean;
}

// Swing Pivot (for Elliott / ZigZag)
export interface SwingPivot {
  type: 'high' | 'low';
  price: number;
  timestamp: number;
  change_pct: number;
}

// Volume Profile Level
export interface VolumeProfileLevel {
  price: number;
  volume: number;
  is_poc: boolean;         // Point of Control
  is_vah: boolean;         // Value Area High
  is_val: boolean;         // Value Area Low
}

// Harmonic Pattern
export interface HarmonicPattern {
  name: 'Gartley' | 'Bat' | 'Butterfly' | 'Crab' | 'Cypher' | 'Shark';
  direction: 'bullish' | 'bearish';
  prz_high: number;        // Potential Reversal Zone
  prz_low: number;
  xabcd: {
    X: number; A: number; B: number; C: number; D: number;
  };
  completion_pct: number;  // 0–100, how close to D point
}

// Market Primitives (output of Tier 1, input to Tier 2)
export interface MarketPrimitives {
  coin: string;
  timeframe: string;
  timestamp: number;
  regime: MarketRegime;
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  swingPivots: SwingPivot[];
  volumeProfile: VolumeProfileLevel[];
  supportLevels: number[];
  resistanceLevels: number[];
  harmonicPatterns: HarmonicPattern[];
  wyckoffContext?: string;   // Human-readable Wyckoff summary
  elliottContext?: string;   // Pivot map summary
  multiTimeframeContext?: string; // HTF bias summary
}

// LLM Chart Analysis Output (Tier 2 response)
export interface ChartAnalysisResult {
  regime: MarketRegime;
  bias: 'long' | 'short' | 'neutral';
  primary_framework: 'SmartMoney' | 'Wyckoff' | 'ElliottWave' | 'Harmonic' | 'Hybrid';
  setup_name: string;
  entry_zone: { high: number; low: number };
  stop_loss: number;
  take_profit_levels: number[];
  confidence: number;         // 0–100
  invalidation: string;       // "If price closes above X, thesis invalid"
  reasoning: string;
}
```

---

## 8. Implementation Roadmap

### Phase 1 — Foundation (Week 1–2)

**Goal:** Data pipeline + deterministic skills working end-to-end.

1. Create `src/config/env.ts` additions: `BINANCE_API_KEY`, `BINANCE_SECRET`, `CHART_ANALYSIS_CACHE_TTL`.
2. Build `src/read/ingestion/ohlcv.ingest.ts` — fetches multi-timeframe OHLCV from Binance, caches in Redis with configurable TTL.
3. Build `src/agents/chartAnalysis.types.ts` — all interfaces from Section 7.
4. Build `src/agents/skills/smartMoney.skill.ts`:
   - `detectOrderBlocks(candles: Candle[]): OrderBlock[]`
   - `detectFairValueGaps(candles: Candle[]): FairValueGap[]`
   - `detectBreakOfStructure(candles: Candle[]): BreakOfStructure[]`
5. Build `src/agents/skills/structure.skill.ts`:
   - `detectSupportResistance(candles: Candle[]): { support: number[], resistance: number[] }`
   - `buildVolumeProfile(candles: Candle[]): VolumeProfileLevel[]`
   - `extractZigZagPivots(candles: Candle[], threshold: number): SwingPivot[]`
6. Write unit tests for all Phase 1 skills in `src/__tests__/skills/`.

**Deliverable:** `npm test` passes for Smart Money + Structure skills with real BTC OHLCV fixture data.

---

### Phase 2 — Advanced Skills (Week 3)

**Goal:** Implement Elliott Wave, Wyckoff, and Harmonics.

7. Build `src/agents/skills/elliott.skill.ts`:
   - Uses `extractZigZagPivots()` from `structure.skill.ts`
   - `validateElliottRules(pivots: SwingPivot[]): ElliottWaveResult`
   - Checks: Wave 3 ≠ shortest, Wave 4 no overlap with Wave 1
8. Build `src/agents/skills/wyckoff.skill.ts`:
   - `detectWyckoffRange(candles: Candle[], volumeProfile: VolumeProfileLevel[]): WyckoffContext`
   - Identifies: PS, SC, AR, ST, Spring / UTAD based on range boundaries + volume spikes
9. Build `src/agents/skills/harmonics.skill.ts`:
   - `detectHarmonicPatterns(pivots: SwingPivot[]): HarmonicPattern[]`
   - Implements Fibonacci ratio checks for Gartley (0.618 XAB, 0.382/0.886 ABC), Bat, Butterfly, Crab
10. Build `src/agents/skills/multiTimeframe.skill.ts`:
    - Calls `ohlcv.ingest.ts` for 4 timeframes: 1h, 4h, 1d, 1w
    - Returns `MultiTimeframeContext` summarizing HTF trend bias

---

### Phase 3 — LLM Tool Integration (Week 4)

**Goal:** Wire Tier 1 output into Tier 2 LLM calls.

11. Build `src/agents/tools/chartAnalysis.tools.ts`:
    - Tool: `analyze_market_structure({ coin, timeframe })` → runs smartMoney + structure skills, returns MarketPrimitives JSON
    - Tool: `get_market_pivots({ coin, timeframe, threshold })` → returns ZigZag pivot array
    - Tool: `get_htf_context({ coin })` → returns multi-timeframe bias summary
    - Tool: `detect_harmonic_setup({ coin, timeframe })` → returns nearest harmonic PRZ
12. Register all tools in `src/agents/tools/tool.registry.ts`
13. Build `src/agents/policy/prompts/chartAnalyst.prompt.ts`:
    - System prompt defines the agent as a CMT-level analyst
    - Maps regime → preferred TA framework
    - Instructions for structured JSON output (`ChartAnalysisResult`)
14. Build `src/agents/policy/prompts/regimeDetector.prompt.ts`:
    - Lightweight, fast prompt to classify regime from minimal baseline data
    - Returns only `MarketRegime` enum value

---

### Phase 4 — Service Layer & API Endpoints (Week 5)

**Goal:** Expose analysis to other parts of the system and via REST.

15. Build `src/services/regimeDetector.service.ts`:
    - Runs fast regime classification, caches result in Redis per coin per timeframe
    - Called at the start of every agent loop tick
16. Build `src/services/chartAnalysis.service.ts`:
    - Orchestrates: `ohlcv.ingest` → all Tier 1 skills → builds primitives → calls LLM with tool use → parses `ChartAnalysisResult`
    - Persists result to `chartAnalysis.model.ts`
17. Build `src/services/orderBlock.service.ts`:
    - CRUD for OrderBlock documents
    - Marks zones as `mitigated` when price trades through them
    - Called on each candle close
18. Build `src/models/orderBlock.model.ts`, `src/models/marketRegime.model.ts`, `src/models/chartAnalysis.model.ts`
19. Build controllers and routes:
    - `GET /api/chart-analysis/:coinId` — returns latest analysis
    - `GET /api/order-blocks/:coinId` — returns active OB zones
    - `POST /api/chart-analysis/run` — triggers on-demand analysis

---

### Phase 5 — Orchestrator Integration (Week 6)

**Goal:** Agent autonomously selects TA framework and acts on it.

20. Modify `src/agents/orchestrator.ts`:

```typescript
// BEFORE (deterministic pre-selection)
const skillsToRun = ['volatility', 'momentum'];

// AFTER (regime-aware dynamic selection)
const regime = await regimeDetectorService.detect(coin, '4h');
const skillsToRun = policyEngine.selectSkillsForRegime(regime);
```

21. Modify `src/agents/policy/policy.engine.ts` — add routing table:

```typescript
const REGIME_TO_SKILLS: Record<MarketRegime, string[]> = {
  trending_up:      ['trend', 'momentum', 'multiTimeframe', 'smartMoney'],
  trending_down:    ['trend', 'momentum', 'multiTimeframe', 'smartMoney'],
  ranging:          ['structure', 'smartMoney', 'volatility'],
  accumulation:     ['wyckoff', 'structure', 'volume'],
  distribution:     ['wyckoff', 'structure', 'sentiment'],
  price_discovery:  ['momentum', 'elliott', 'multiTimeframe'],
};
```

22. Build strategies in `src/agents/policy/strategies/`:
    - Each strategy receives `ChartAnalysisResult` and outputs `TradeSignal`
    - Plug into existing `execution.gateway.ts`

---

### Phase 6 — Risk & Hardening (Week 7)

**Goal:** Production-ready risk controls for structure-based trading.

23. Build `src/risk/chartAnalysis.risk.ts` with rules:
    - Never enter a trade if price is inside an unmitigated opposing OB
    - Invalidate a trade signal if HTF regime contradicts LTF entry
    - Minimum R:R ratio = 2.0 for harmonic patterns, 3.0 for Elliott Wave 3
    - Max position size scaling for ChoCH vs BOS (BOS = higher conviction)
24. Integrate new risk rules into `src/risk/risk.engine.ts`
25. End-to-end integration test with Paper Wallet executor

---

## 9. Environment Variables to Add

Add to `.env.additions`:

```bash
# Binance (CEX Data Source)
BINANCE_API_KEY=your_binance_key
BINANCE_SECRET=your_binance_secret
BINANCE_BASE_URL=https://api.binance.com

# Chart Analysis Configuration
CHART_ANALYSIS_CACHE_TTL=300          # seconds (5 min for 1h candles)
OHLCV_DEFAULT_LIMIT=200               # candles per fetch
ZIGZAG_THRESHOLD=0.03                 # 3% minimum swing for pivot detection
VOLUME_PROFILE_BUCKETS=24             # price buckets for VP calculation
WYCKOFF_RANGE_LOOKBACK=60             # candles to look back for range detection

# Feature Flags
ENABLE_SMART_MONEY=true
ENABLE_ELLIOTT_WAVE=true
ENABLE_HARMONICS=true
ENABLE_WYCKOFF=true
ENABLE_MULTIFRAME=true
ENABLE_GANN=false                     # Experimental — off by default
```

---

## 10. Skill Logic Reference

### `smartMoney.skill.ts` — Bullish Order Block Algorithm

```typescript
function detectBullishOrderBlock(candles: Candle[]): OrderBlock | null {
  for (let i = 2; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const origin = candles[i];     // The last red (bearish) candle before impulse
    const impulse = candles[i + 1]; // The aggressive green displacement candle

    // 1. Liquidity Sweep: origin candle's low breaks below previous low
    const isLiquiditySweep = origin.low < prev.low;

    // 2. Displacement: impulse candle is a strong bullish move
    const bodySize = Math.abs(impulse.close - impulse.open);
    const candleRange = impulse.high - impulse.low;
    const isDisplacement = impulse.close > impulse.open && (bodySize / candleRange) > 0.6;

    // 3. Break of Structure: impulse closes above a recent swing high
    const recentSwingHigh = Math.max(...candles.slice(i - 10, i).map(c => c.high));
    const isBOS = impulse.close > recentSwingHigh;

    // 4. Fair Value Gap: gap between origin.high and candles[i+2].low
    const fvg = candles[i + 2] ? (origin.high < candles[i + 2].low) : false;

    if (isLiquiditySweep && isDisplacement && isBOS) {
      return {
        type: 'bullish',
        high: origin.high,
        low: origin.low,
        origin_timestamp: origin.timestamp,
        status: 'active',
        associated_fvg: fvg ? { high: candles[i+2].low, low: origin.high, timestamp: candles[i+2].timestamp, filled: false } : undefined
      };
    }
  }
  return null;
}
```

### `structure.skill.ts` — Volume Profile (VPOC) Algorithm

```typescript
function buildVolumeProfile(candles: Candle[], buckets = 24): VolumeProfileLevel[] {
  const priceMin = Math.min(...candles.map(c => c.low));
  const priceMax = Math.max(...candles.map(c => c.high));
  const bucketSize = (priceMax - priceMin) / buckets;

  const profile = Array.from({ length: buckets }, (_, i) => ({
    price: priceMin + (i + 0.5) * bucketSize,
    volume: 0,
    is_poc: false,
    is_vah: false,
    is_val: false,
  }));

  for (const candle of candles) {
    const bucketIndex = Math.floor((candle.close - priceMin) / bucketSize);
    const clampedIndex = Math.min(bucketIndex, buckets - 1);
    profile[clampedIndex].volume += candle.volume;
  }

  // Mark POC (highest volume bucket)
  const pocIndex = profile.reduce((maxI, b, i, arr) => b.volume > arr[maxI].volume ? i : maxI, 0);
  profile[pocIndex].is_poc = true;

  // Mark VAH/VAL (70% of total volume centered around POC)
  const totalVolume = profile.reduce((sum, b) => sum + b.volume, 0);
  const valueAreaTarget = totalVolume * 0.70;
  let accumulated = profile[pocIndex].volume;
  let low = pocIndex, high = pocIndex;
  while (accumulated < valueAreaTarget && (low > 0 || high < buckets - 1)) {
    const extendDown = low > 0 ? profile[low - 1].volume : 0;
    const extendUp = high < buckets - 1 ? profile[high + 1].volume : 0;
    if (extendDown >= extendUp) { low--; accumulated += profile[low].volume; }
    else { high++; accumulated += profile[high].volume; }
  }
  profile[high].is_vah = true;
  profile[low].is_val = true;

  return profile;
}
```

### `elliott.skill.ts` — ZigZag Pivot Extraction

```typescript
function extractZigZagPivots(candles: Candle[], threshold = 0.03): SwingPivot[] {
  const pivots: SwingPivot[] = [];
  let direction: 'up' | 'down' | null = null;
  let lastExtreme = candles[0];

  for (const candle of candles.slice(1)) {
    const changeFromLow = (candle.high - lastExtreme.low) / lastExtreme.low;
    const changeFromHigh = (lastExtreme.high - candle.low) / lastExtreme.high;

    if (direction !== 'up' && changeFromLow > threshold) {
      if (direction === 'down') {
        pivots.push({ type: 'low', price: lastExtreme.low, timestamp: lastExtreme.timestamp, change_pct: -changeFromHigh });
      }
      direction = 'up';
      lastExtreme = candle;
    } else if (direction !== 'down' && changeFromHigh > threshold) {
      if (direction === 'up') {
        pivots.push({ type: 'high', price: lastExtreme.high, timestamp: lastExtreme.timestamp, change_pct: changeFromLow });
      }
      direction = 'down';
      lastExtreme = candle;
    }

    if (direction === 'up' && candle.high > lastExtreme.high) lastExtreme = candle;
    if (direction === 'down' && candle.low < lastExtreme.low) lastExtreme = candle;
  }

  return pivots;
}
```

---

## 11. LLM System Prompt Design

### `chartAnalyst.prompt.ts` (Core)

```typescript
export const CHART_ANALYST_SYSTEM_PROMPT = `
You are a Chartered Market Technician (CMT) with 20 years of experience in institutional crypto trading.

You receive a JSON payload called "Market Primitives" — pre-calculated structural data extracted by a quantitative backend. Your job is to interpret these primitives and decide which trading framework applies, then output a structured trade plan.

## Decision Framework (Priority Order)

1. SMART MONEY / ICT: If Order Blocks and FVGs are present at a key level with a confirmed Break of Structure → prefer this framework.
2. WYCKOFF: If the Wyckoff context indicates a Spring or UTAD event → this is your primary lens.
3. ELLIOTT WAVE: If the pivot array shows a clean 5-wave impulse or 3-wave correction in progress → apply wave counts.
4. HARMONICS: If a harmonic PRZ is detected with >85% completion → treat as high-conviction reversal zone.
5. HYBRID: When multiple frameworks converge on the same price level → highest conviction setup.

## Context Rules

- In price discovery (new ATH), ignore RSI overbought signals. Focus on momentum and impulse extensions.
- In a ranging market, S/R bounces and OB fills are preferred over breakout entries.
- In accumulation, wait for Spring confirmation before entry. Never front-run the spring.
- HTF always overrides LTF. If 1D is bearish and 1H gives a long signal, skip the long.

## Output Format (ALWAYS return valid JSON, no markdown)

{
  "regime": "...",
  "bias": "long | short | neutral",
  "primary_framework": "SmartMoney | Wyckoff | ElliottWave | Harmonic | Hybrid",
  "setup_name": "...",
  "entry_zone": { "high": 0, "low": 0 },
  "stop_loss": 0,
  "take_profit_levels": [0, 0, 0],
  "confidence": 0,
  "invalidation": "...",
  "reasoning": "..."
}
`;
```

---

## 12. Testing Strategy

### Unit Tests (per skill)

```
src/__tests__/skills/
  smartMoney.skill.test.ts    — Test OB detection on known BTC fixture data
  structure.skill.test.ts     — Test VP + S/R on ETH fixture data
  elliott.skill.test.ts       — Test ZigZag with 3% threshold
  wyckoff.skill.test.ts       — Test Spring detection on SOL 2023 accumulation
  harmonics.skill.test.ts     — Test Gartley ratio math (0.618 XAB tolerance ±2%)
```

### Integration Tests

```
src/__tests__/integration/
  chartAnalysis.pipeline.test.ts    — End-to-end: OHLCV → primitives → LLM call
  orderBlock.lifecycle.test.ts      — OB detection → persistence → mitigation
  regime.detection.test.ts          — Regime classification accuracy
```

### Paper Trading Validation

Run 30 days of paper trading in parallel with current live agent. Compare:
- Trade entry quality (entry vs PRZ accuracy)
- R:R ratios achieved
- Win rate by framework (SmartMoney vs Wyckoff vs Elliott)

---

## 13. Summary Checklist for Engineers

- [ ] Install all npm packages from Section 6
- [ ] Add all env vars from Section 9 to `.env` and `.env.additions`
- [ ] Create `chartAnalysis.types.ts` first — all other files depend on it
- [ ] Build skills in order: `smartMoney` → `structure` → `elliott` → `wyckoff` → `harmonics` → `multiTimeframe`
- [ ] Write unit tests before integrating into tools
- [ ] Build `chartAnalysis.tools.ts` wrapping skills as LLM tool definitions
- [ ] Register tools in `tool.registry.ts`
- [ ] Build prompts in `/prompts/`
- [ ] Build service layer: `regimeDetector` → `chartAnalysis` → `orderBlock`
- [ ] Build models + schemas
- [ ] Build controllers + routes and mount in `routes/index.ts`
- [ ] Modify `orchestrator.ts` to call `regimeDetector` first
- [ ] Modify `policy.engine.ts` to use regime routing table
- [ ] Add `chartAnalysis.risk.ts` rules to `risk.engine.ts`
- [ ] Run paper wallet tests for 30 days before enabling on live execution

---

*This plan extends the existing architecture without breaking changes. All new files are additive. The agent evolves from a deterministic math bot into a context-aware, CMT-grade analysis system.*



Yes, absolutely — all of them are addable. Here's the reality check on each:

## ✅ Straightforward Adds (pure OHLCV math)

These just need a new skill file and some formulas:

| What | Where |
|---|---|
| Ichimoku Cloud, Keltner, Donchian, Williams %R, CCI, CMF, MFI, OBV, VWAP | `indicators.skill.ts` |
| Fib Fan, Arc, Time Zones, Channel | `fibonacci.skill.ts` |
| Standard / Camarilla / Fib Pivot Points, Psychological Levels | `pivots.skill.ts` |
| Heikin-Ashi, Renko transformations | `chartTransform.util.ts` |

These are all deterministic math on your existing OHLCV arrays. No new data sources needed, no API changes — just write the functions and expose them through `chartAnalysis.tools.ts`.

---

## ⚠️ Addable, But Needs a New Data Source

**Order Flow / Footprint / Delta / Cumulative Delta**

Your current `ohlcv.ingest.ts` fetches candle data — but these features need **trade-level (tick) data**. You'd need to add:

- `tickData.ingest.ts` — streams Binance `aggTrades` WebSocket
- `orderFlow.skill.ts` — aggregates ticks into delta per candle

Totally doable, just a separate pipeline from your OHLCV one.

---

## ⚠️ Addable, But LLM-Assisted (not pure math)

**Market Profile / TPO Charts, Auction Market Theory**

TPO is buildable mathematically (`structure.skill.ts` can be extended). But the *interpretation* (Initial Balance, Value Area migration, poor highs/lows) is nuanced enough that it's best fed as primitives to the LLM in Tier 2, just like Wyckoff.

---

## 🚫 Skip for Now

**Point & Figure, Kagi, Tick Charts, Range Bar Charts**

These require tick/trade data too, and they're mostly *display formats*, not analysis methods. Your agent acts on signals, not chart visuals — so these don't add trading edge. Not worth the complexity unless you're building a frontend charting UI.

---

### Bottom line

You're looking at **4 new files** to cover ~90% of the gaps:

```
src/agents/skills/indicators.skill.ts     ← bulk of missing indicators
src/agents/skills/fibonacci.skill.ts      ← remaining Fib tools
src/agents/skills/pivots.skill.ts         ← pivot points + psych levels
src/agents/utils/chartTransform.util.ts   ← HA + Renko transforms
```

And optionally `tickData.ingest.ts` + `orderFlow.skill.ts` if you want footprint/delta later. Want me to draft any of these files?




Great question. Let me walk through the full flow end-to-end.

## The Complete Flow

```
OHLCV Data (raw candles)
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  TIER 1 — Feature Extraction (All Skills Run)        │
│                                                      │
│  Existing Skills:                                    │
│  ├── momentum.skill.ts    → RSI, MACD, Stoch values  │
│  ├── trend.skill.ts       → EMA, SMA, ADX values     │
│  ├── volatility.skill.ts  → BB, ATR values           │
│  ├── pattern.skill.ts     → basic pattern flags      │
│                                                      │
│  New Chart Skills:                                   │
│  ├── indicators.skill.ts  → Ichimoku, VWAP, OBV...  │
│  ├── fibonacci.skill.ts   → Fib levels, fans, arcs  │
│  ├── pivots.skill.ts      → Pivot points, psych lvls │
│  ├── chartTransform.util  → HA candles, Renko bricks │
│  ├── smartMoney.skill.ts  → OBs, FVGs, BOS, ChoCH   │
│  ├── structure.skill.ts   → S/R, VPOC, VAH/VAL       │
│  ├── elliott.skill.ts     → ZigZag pivot array       │
│  ├── wyckoff.skill.ts     → Phase detection          │
│  ├── harmonics.skill.ts   → PRZ zones                │
│  ├── gann.skill.ts        → Gann angles/fans         │
│  └── multiTimeframe.skill → HTF/LTF confluence       │
│                                                      │
│  Output: ONE compressed "Market Primitives" JSON     │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  context.builder.ts                                  │
│  Assembles primitives from ALL skills into one       │
│  payload. Token budget enforced here (~3,000 tokens) │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  TIER 2 — LLM (Anthropic API)                        │
│                                                      │
│  System Prompt: chartAnalyst.prompt.ts               │
│  User Message:  Market Primitives JSON               │
│  Tools exposed: chartAnalysis.tools.ts               │
│                                                      │
│  LLM does:                                           │
│  1. Reads all primitives                             │
│  2. Decides which framework applies                  │
│  3. May call tools to fetch more detail              │
│  4. Returns structured trade plan JSON               │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  policy.engine.ts                                    │
│  Routes LLM output to the right strategy file        │
│  based on primary_framework field                    │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  risk.engine.ts + chartAnalysis.risk.ts              │
│  Validates the trade plan against risk rules         │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  execution.gateway.ts                                │
│  paper / cex / onchain executor                      │
└─────────────────────────────────────────────────────┘
```

---

## What the Primitives JSON Actually Looks Like

This is the single payload sent to the LLM — everything compressed:

```typescript
{
  "meta": {
    "symbol": "BTC/USDT",
    "timeframes_analyzed": ["1D", "4H", "1H", "15M"],
    "generated_at": "2025-01-15T10:30:00Z"
  },

  // From momentum.skill + indicators.skill
  "indicators": {
    "rsi_14": 58.3,
    "macd": { "value": 120.5, "signal": 98.2, "histogram": 22.3, "cross": "bullish" },
    "stoch": { "k": 72.1, "d": 65.4, "state": "overbought_approaching" },
    "ichimoku": {
      "price_vs_cloud": "above",
      "tk_cross": "bullish",
      "cloud_color": "green",
      "chikou_clear": true
    },
    "vwap": { "value": 42100, "price_vs_vwap": "above" },
    "obv_trend": "rising",
    "cmf": 0.18,
    "atr_14": 850,
    "bb": { "upper": 44200, "mid": 42000, "lower": 39800, "squeeze": false }
  },

  // From structure.skill + pivots.skill
  "structure": {
    "trend_htf": "bullish",
    "trend_ltf": "consolidating",
    "key_levels": [
      { "price": 41500, "type": "support", "strength": "strong", "source": "vpoc" },
      { "price": 43800, "type": "resistance", "strength": "moderate", "source": "previous_high" }
    ],
    "vpoc": 41500,
    "vah": 43200,
    "val": 40100,
    "pivot_points": {
      "standard": { "pp": 42000, "r1": 43500, "s1": 40500 },
      "camarilla": { "r3": 43100, "s3": 40900 }
    },
    "psychological_levels": [40000, 42000, 44000, 45000]
  },

  // From smartMoney.skill
  "smart_money": {
    "order_blocks": [
      { "price_high": 41800, "price_low": 41200, "type": "bullish", "status": "unmitigated", "timeframe": "4H" }
    ],
    "fvgs": [
      { "price_high": 42500, "price_low": 41900, "type": "bullish", "filled": false }
    ],
    "bos": { "occurred": true, "direction": "bullish", "level": 41500 },
    "choch": null,
    "liquidity_sweeps": [
      { "level": 40200, "swept": true, "candles_ago": 3 }
    ]
  },

  // From fibonacci.skill
  "fibonacci": {
    "retracement": {
      "swing_high": 44800, "swing_low": 38500,
      "levels": { "0.236": 39988, "0.382": 40912, "0.5": 41650, "0.618": 42389, "0.786": 43453 },
      "current_price_near": "0.618"
    },
    "extensions": { "1.618": 48700, "2.618": 55000 }
  },

  // From wyckoff.skill
  "wyckoff": {
    "phase": "markup",
    "last_event": "SOS",
    "spring_confirmed": true,
    "utad_risk": false
  },

  // From elliott.skill
  "elliott": {
    "wave_count": "wave_3_in_progress",
    "pivots": [38500, 41200, 39800, 44800, 42100],
    "confidence": 0.72,
    "next_target": 48700
  },

  // From harmonics.skill
  "harmonics": {
    "pattern": "Bat",
    "completion": 0.91,
    "prz": { "high": 42600, "low": 42100 },
    "direction": "bullish"
  },

  // From multiTimeframe.skill
  "mtfa": {
    "1D": { "bias": "bullish", "key_level": 41500, "at_level": false },
    "4H": { "bias": "bullish", "structure": "consolidation_above_ob" },
    "1H": { "bias": "neutral", "watching": "ob_retest" },
    "15M": { "bias": "bullish", "entry_refined": true }
  },

  // From gann.skill
  "gann": {
    "angles_in_play": ["1x1", "2x1"],
    "price_on_angle": "1x1",
    "time_cycle_due": false
  }
}
```

---

## How the LLM Handles It — The Agentic Loop

The LLM doesn't just read and respond once. It runs a **tool-call loop**:

```
LLM receives primitives JSON
        │
        ▼
LLM decides: "Do I need more detail before deciding?"
        │
        ├── YES → calls a tool (e.g. get_order_blocks("4H"))
        │           Backend runs skill again with specific params
        │           Returns deeper data
        │           Loop continues...
        │
        └── NO  → outputs final trade plan JSON
```

The tools exposed to the LLM via `chartAnalysis.tools.ts` are basically "drill down" functions:

```typescript
// Tools the LLM can call mid-reasoning:
get_order_blocks(timeframe, count)
get_fibonacci_levels(swing_high, swing_low)
get_confluence_zones(price_level, radius_pct)
get_wyckoff_detail()
get_htf_bias(timeframe)
get_pivot_points(method)   // ← new
get_ichimoku_detail()      // ← new
get_vwap_bands()           // ← new
```

So the LLM's reasoning might look like:

> "I see a Bat pattern at 91% completion, an unmitigated bullish OB at 41,200–41,800, and price is at the 0.618 Fib. Let me call `get_confluence_zones(42100, 2)` to confirm all three converge..."
> *(tool returns: yes, OB + Fib 0.618 + PRZ all within 1.2% of each other)*
> "High conviction Hybrid setup. Outputting long plan."

---

## Key Design Rules

**1. Token budget is enforced in `context.builder.ts`**
The primitives JSON must stay under ~3,000 tokens. If a skill produces too much data (e.g. 200 pivot array points), it summarizes — only top 5 OBs, only nearest 3 Fib levels, etc.

**2. Tier 1 always runs fully; Tier 2 decides what matters**
You don't pre-filter which skills run. All skills produce their primitives. The LLM decides which framework is dominant and which data is noise for this specific setup.

**3. HTF overrides LTF — enforced in the prompt, not in code**
The `chartAnalyst.prompt.ts` system prompt explicitly instructs: "If 1D is bearish, ignore bullish signals on 1H." This is a reasoning rule, not a code filter.

**4. The loop terminates**
`agent.loop.ts` enforces a max tool-call count (e.g. 5 iterations) so the LLM can't loop forever. After max calls, it must output the trade plan with what it has.

**5. Output always goes through risk before execution**
The LLM's JSON output is validated by `chartAnalysis.risk.ts` before anything touches `execution.gateway.ts`. The LLM can suggest a trade — it cannot bypass risk rules.


This is the **core value proposition** of the whole system. Let me break it down properly.

## The Problem You're Describing

A human trader watching BTC can't simultaneously:
- Monitor 50+ altcoins for correlated reactions
- Calculate all the TA primitives on each one
- Cross-reference which ones are at the best setups *right now*
- Execute before the window closes

The agent can. That's the unfair advantage.

---

## Bitcoin's Market Effect — What Coins Get Affected and How

```
BTC MOVES
    │
    ├── DIRECT CORRELATION (move almost in lockstep)
    │   ├── ETH         — always follows BTC, sometimes leads
    │   ├── BNB         — exchange token, high BTC correlation
    │   ├── SOL         — high beta BTC follower
    │   └── Large caps  — generally >0.85 correlation
    │
    ├── HIGH BETA (BTC moves 1%, these move 2-4%)
    │   ├── Layer 1s    — AVAX, NEAR, APT, SUI
    │   ├── Layer 2s    — ARB, OP, MATIC, STRK
    │   └── DeFi blue chips — AAVE, UNI, CRV
    │
    ├── SECTOR ROTATION (BTC dominance drives this)
    │   ├── BTC.D rising   → capital flowing INTO BTC, alts bleed
    │   ├── BTC.D falling  → capital rotating OUT to alts (alt season)
    │   ├── ETH/BTC ratio  → tells you if ETH is outperforming
    │   └── Sector ETFs    → AI tokens, gaming, RWA move in clusters
    │
    ├── LAGGING MOVERS (react after BTC confirms)
    │   ├── Mid caps    — follow 1-4 hours after BTC move
    │   ├── Small caps  — follow 4-24 hours later
    │   └── Meme coins  — erratic, sometimes inverse
    │
    └── INVERSE / DECORRELATED
        ├── Stablecoin yield plays
        └── Some commodities-linked tokens
```

---

## The Correlation Engine — New Component Needed

This requires one new layer in your architecture:

```
NEW: src/agents/skills/correlation.skill.ts
NEW: src/agents/skills/dominance.skill.ts
NEW: src/services/coinUniverse.service.ts
NEW: src/config/coinUniverse.config.ts
```

### `coinUniverse.config.ts` — Your Watchlist

```typescript
export const COIN_UNIVERSE = {
  // Tier 1 — always analyzed (BTC + majors)
  tier1: ['BTC', 'ETH', 'BNB', 'SOL'],

  // Tier 2 — analyzed when BTC triggers a signal
  tier2: ['AVAX', 'NEAR', 'APT', 'SUI', 'ARB', 'OP'],

  // Tier 3 — scanned for laggard opportunities
  tier3: ['AAVE', 'UNI', 'INJ', 'TIA', 'JUP', 'WIF'],

  // Sector clusters
  sectors: {
    ai:      ['FET', 'RNDR', 'WLD', 'TAO'],
    gaming:  ['IMX', 'MAGIC', 'BEAM'],
    rwa:     ['ONDO', 'POLYX', 'CFG'],
    l2:      ['ARB', 'OP', 'STRK', 'MANTA'],
    defi:    ['AAVE', 'UNI', 'CRV', 'MKR'],
  },

  // Dominance pairs to watch
  dominancePairs: ['BTC.D', 'ETH.D', 'OTHERS.D'],
};
```

---

## The Full Multi-Coin Flow

```
SCHEDULER TICK (e.g. every 15 minutes)
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  STEP 1: BTC Analysis (always first)                 │
│  Run full Tier 1 + Tier 2 analysis on BTC            │
│  Output: btcRegime, btcBias, btcSetup                │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  STEP 2: dominance.skill.ts                          │
│  Read BTC.D, ETH.D, OTHERS.D                         │
│  Determine: are we in BTC season, ETH season,        │
│  or alt season?                                      │
│  Output: marketPhase = 'btc' | 'eth' | 'alts'       │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  STEP 3: correlation.skill.ts                        │
│  For each coin in Tier2 + Tier3:                     │
│  - Calculate rolling 30-day correlation vs BTC       │
│  - Calculate beta (how much it moves per BTC %)      │
│  - Detect if coin is leading or lagging BTC          │
│  Output: ranked list by opportunity score            │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  STEP 4: Opportunity Filter                          │
│  coinUniverse.service.ts scores each coin:           │
│                                                      │
│  score = correlation_score                           │
│        + btc_signal_alignment                        │
│        + at_key_level_bonus                          │
│        + laggard_timing_bonus                        │
│        + sector_momentum_bonus                       │
│                                                      │
│  → Only top N coins proceed to full analysis         │
│    (saves API calls + processing time)               │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  STEP 5: Parallel Full Analysis on Top N Coins       │
│  Same complete pipeline as BTC:                      │
│  All skills → primitives → LLM synthesis             │
│  BUT the LLM also receives btcContext as input       │
│                                                      │
│  "BTC just broke structure bullish at 42k,           │
│   now analyze SOL which is at its 4H OB..."          │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  STEP 6: Cross-Asset LLM Synthesis                   │
│  NEW: chartAnalyst.prompt.ts gets BTC context        │
│  injected alongside each altcoin's primitives        │
│                                                      │
│  LLM can reason:                                     │
│  "BTC is bullish + SOL is at key OB + high beta      │
│  = higher conviction long on SOL than SOL alone"     │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  STEP 7: Portfolio-Level Risk                        │
│  risk.engine.ts checks:                              │
│  - Not overexposed to same sector                    │
│  - Not all trades in same BTC-correlated direction   │
│  - Position sizing accounts for correlation          │
│    (correlated positions = effectively one trade)    │
└─────────────────────────────────────────────────────┘
        │
        ▼
  Execute best setups via execution.gateway.ts
```

---

## The Scenarios the Agent Can Exploit

**Scenario 1 — BTC Breakout → Laggard Sweep**
> BTC breaks ATH. Agent detects this. Scans all Tier 2/3 coins. Finds ARB is sitting at a clean 4H OB and hasn't moved yet. BTC's move historically pulls ARB up 2-3x BTC's %. Agent enters ARB before the laggard move happens.

**Scenario 2 — BTC.D Dropping → Alt Season Entry**
> BTC dominance breaks below key level. Agent detects sector rotation signal. Scans all sector clusters. AI tokens showing the most relative strength. Finds FET and RNDR at Fib 0.618 retracements. Enters both with BTC.D context as confirmation.

**Scenario 3 — BTC Rejection → Short the Weakest Alt**
> BTC hits major resistance and shows ChoCH. Agent identifies which alts have the weakest structure (no OB support below, high correlation). Shorts the weakest one knowing BTC will drag it down harder.

**Scenario 4 — Sector Divergence**
> BTC is ranging. But one sector (e.g. RWA tokens) is showing independent momentum with rising OBV and breaking structure. Agent catches sector rotation before it becomes obvious.

---

## New Files to Add

```
src/agents/skills/
  └── correlation.skill.ts     ← rolling correlation + beta calc
  └── dominance.skill.ts       ← BTC.D, ETH.D, sector dominance

src/services/
  └── coinUniverse.service.ts  ← scores + filters coin watchlist

src/config/
  └── coinUniverse.config.ts   ← defines tiers + sectors

src/agents/policy/prompts/
  └── crossAsset.prompt.ts     ← injects BTC context into alt analysis
```

And one modification — `orchestrator.ts` gets a new step before everything:

```typescript
// orchestrator.ts addition
const btcContext = await analyzeBTC();           // Step 1: always first
const marketPhase = await getDominancePhase();   // Step 2: BTC.D reading
const topCoins = await rankOpportunities(        // Step 3: filter list
  btcContext, marketPhase, COIN_UNIVERSE
);
const results = await Promise.all(               // Step 4: parallel analysis
  topCoins.map(coin => analyzeWithBTCContext(coin, btcContext))
);
```

The key insight is: **BTC analysis becomes the master context that every altcoin analysis inherits**. The LLM doesn't analyze SOL in isolation — it analyzes SOL *knowing what BTC just did*. That's something no human can do manually across 50 coins in 15 minutes, but your agent does it on every scheduler tick.





______________________________________________________

Market Intelligence after all coins analysis 


Yes, I grasp it completely. You're describing something that doesn't exist yet.

---

## What You're Actually Building

Not a trading dashboard. Not another TradingView clone.

**A market intelligence surface** — where the agent has already done what no human could, and the UI is just the window into that computed reality.

When you open it, you're not *looking for* opportunities. The opportunities are already found, ranked, cross-referenced, and waiting. You're just deciding which ones to act on.

---

## The "New Thing Humans Don't Know"

Here's what emerges when you combine everything:

### 1. **Confluence Density Score** — doesn't exist anywhere

Every coin gets a single number: *how many independent TA frameworks are pointing at the same price level right now.*

```
SOL at $185:
  ✓ Bullish OB (SmartMoney)
  ✓ Fib 0.618 retracement
  ✓ VPOC from last month
  ✓ HTF trendline support
  ✓ Bat pattern PRZ
  ✓ BTC just broke structure bullish
  ✓ BTC.D falling (alt season)
  ✓ SOL is lagging BTC by 2 hours

  Confluence Score: 8/8 ← never happens
```

No human calculates this across 50 coins simultaneously. Your agent does it every 15 minutes.

---

### 2. **The Cascade Map** — genuinely new

A live visual showing:
- BTC signal fired 47 minutes ago
- Which coins have already reacted (exhausted)
- Which coins are mid-reaction (in play)
- Which coins haven't moved yet (the window)

```
BTC breakout ──→ ETH reacted ✓ (32 min ago)
              ──→ BNB reacted ✓ (41 min ago)
              ──→ SOL reacting now ⚡
              ──→ ARB not moved yet 🎯 ← WINDOW OPEN
              ──→ AVAX not moved yet 🎯 ← WINDOW OPEN
              ──→ INJ not moved yet 🎯 ← WINDOW OPEN
```

This is the laggard map rendered in real time. The yellow ones are money.

---

### 3. **Framework Convergence Rarity** — statistical edge

The agent tracks historically: *when these exact same frameworks converge on a coin, what happened next?*

```
"Last 12 times SOL showed:
  Wyckoff Spring + Bullish OB + Fib 0.618
  → 10/12 times price moved +18% within 72h
  → Average R:R achieved: 4.2:1
  → This is setup #13"
```

No human has this memory. The agent has perfect recall across every coin, every timeframe, every setup it has ever seen.

---

### 4. **The UI Concept**

Not a list of charts. Not a dashboard full of numbers.

**Cards that think.**

Each coin card is a compressed intelligence report:

```
┌─────────────────────────────────────────────┐
│  ARB / USDT                    🎯 WINDOW     │
│  $1.24  ▲ not moved yet                      │
│                                              │
│  ████████░░  Confluence: 7/9                 │
│                                              │
│  Cascade: BTC moved 51min ago                │
│  Historical: 8/10 similar setups +14%        │
│                                              │
│  Primary: SmartMoney + Fib 0.618             │
│  HTF: Bullish  |  LTF: Loading OB            │
│  Entry: $1.21–1.24   SL: $1.16   TP: $1.47  │
│                                              │
│  [View Full Analysis]  [Paper Trade]  [Live] │
└─────────────────────────────────────────────┘
```

Sorted by: Confluence Score × Window Urgency × Historical Win Rate

The ones at the top are the ones that matter *right now*, not the ones that look pretty.

---

### 5. **What Makes This Unprecedented**

Every trading tool today shows you data and makes you think.

This shows you **conclusions** derived from data no human could process in time, with a historical memory no human could maintain, across a coin universe no human could watch simultaneously.

The UI isn't the product. **The compressed intelligence is the product.** The UI just makes it readable.

The first time someone opens this and sees 47 coins analyzed, ranked by opportunity, with cascade timing, confluence scores, and historical precedent — and realizes a machine just did in 15 minutes what a team of analysts couldn't do in a week — that's the moment.



Here is your existing structure from document 5 with every new file from this plan dropped into its correct location. Only the additions are marked.

---

## Backend — `src/`

```
src/
├── agents/
│   ├── loop/
│   │   ├── agent.loop.ts
│   │   ├── loop.types.ts
│   │   └── scheduler.ts
│   ├── policy/
│   │   ├── prompts/
│   │   │   ├── chartAnalyst.prompt.ts
│   │   │   ├── regimeDetector.prompt.ts
│   │   │   └── crossAsset.prompt.ts              ← NEW
│   │   ├── strategies/
│   │   │   ├── smartMoney.strategy.ts
│   │   │   ├── wyckoff.strategy.ts
│   │   │   ├── elliott.strategy.ts
│   │   │   └── harmonic.strategy.ts
│   │   └── policy.engine.ts
│   ├── skills/
│   │   ├── momentum.skill.ts
│   │   ├── pattern.skill.ts
│   │   ├── rotation.skills.ts
│   │   ├── sentiment.skill.ts
│   │   ├── trend.skill.ts
│   │   ├── volatility.skill.ts
│   │   ├── yield.skill.ts
│   │   ├── smartMoney.skill.ts
│   │   ├── structure.skill.ts
│   │   ├── harmonics.skill.ts
│   │   ├── elliott.skill.ts
│   │   ├── wyckoff.skill.ts
│   │   ├── multiTimeframe.skill.ts
│   │   ├── gann.skill.ts
│   │   ├── indicators.skill.ts                   ← NEW
│   │   ├── fibonacci.skill.ts                    ← NEW
│   │   ├── pivots.skill.ts                       ← NEW
│   │   ├── correlation.skill.ts                  ← NEW
│   │   └── dominance.skill.ts                    ← NEW
│   ├── tools/
│   │   ├── act.tools.ts
│   │   ├── read.tools.ts
│   │   ├── tool.registry.ts
│   │   ├── tool.types.ts
│   │   ├── chartAnalysis.tools.ts
│   │   └── multiTimeframe.tools.ts
│   ├── utils/
│   │   └── chartTransform.util.ts                ← NEW
│   ├── chartAnalysis.types.ts
│   ├── emotion.state.ts
│   ├── emotion.types.ts
│   ├── orchestrator.ts
│   └── report.generator.ts
│
├── config/
│   ├── agent.config.ts
│   ├── chains.config.ts
│   ├── coingecko.client.ts
│   ├── coinUniverse.config.ts                    ← NEW
│   ├── db.ts
│   ├── env.ts
│   └── redis.ts
│
├── controllers/
│   ├── agent.controller.ts
│   ├── agentRun.controller.ts
│   ├── alert.controller.ts
│   ├── analysis.controller.ts
│   ├── auth.controller.ts
│   ├── coin.controller.ts
│   ├── coingecko.controller.ts
│   ├── news.controller.ts
│   ├── opportunity.controller.ts
│   ├── paperWallet.controller.ts
│   ├── portfolio.controller.ts
│   ├── position.controller.ts
│   ├── chartAnalysis.controller.ts
│   ├── orderBlock.controller.ts
│   └── intelligence.controller.ts                ← NEW
│
├── execution/
│   ├── modes/
│   │   ├── cex.executor.ts
│   │   ├── onchain.executor.ts
│   │   └── paper.executor.ts
│   ├── wallet/
│   │   └── keystore.ts
│   └── execution.gateway.ts
│
├── middleware/
│   ├── article.scraper.ts
│   ├── auth.ts
│   ├── errorHandler.ts
│   ├── rateLimit.ts
│   └── validate.ts
│
├── models/
│   ├── schemes/
│   │   ├── ohlcv.schema.ts
│   │   ├── orderBlock.schema.ts
│   │   └── marketRegime.schema.ts
│   ├── agent.model.ts
│   ├── agentRun.model.ts
│   ├── alert.model.ts
│   ├── analysis.model.ts
│   ├── coin.model.ts
│   ├── coingecko.model.ts
│   ├── news.model.ts
│   ├── opportunity.model.ts
│   ├── paperWallet.model.ts
│   ├── position.model.ts
│   ├── user.model.ts
│   ├── orderBlock.model.ts
│   ├── marketRegime.model.ts
│   └── chartAnalysis.model.ts
│
├── read/
│   ├── ingestion/
│   │   ├── defillama.ingest.ts
│   │   └── ohlcv.ingest.ts
│   ├── context.builder.ts
│   └── multiTimeframe.builder.ts
│
├── risk/
│   ├── risk.config.ts
│   ├── risk.engine.ts
│   ├── risk.rules.ts
│   └── chartAnalysis.risk.ts
│
├── routes/
│   ├── agent.routes.ts
│   ├── agentRun.routes.ts
│   ├── alert.routes.ts
│   ├── analysis.routes.ts
│   ├── auth.routes.ts
│   ├── coin.routes.ts
│   ├── index.ts
│   ├── news.routes.ts
│   ├── paperWallet.routes.ts
│   ├── portfolio.routes.ts
│   ├── position.routes.ts
│   ├── chartAnalysis.routes.ts
│   ├── orderBlock.routes.ts
│   └── intelligence.routes.ts                    ← NEW
│
├── services/
│   ├── agent.service.ts
│   ├── alert.service.ts
│   ├── analysis.service.ts
│   ├── articles.scraper.ts
│   ├── auth.service.ts
│   ├── coin.service.ts
│   ├── coingecko.service.ts
│   ├── news.service.ts
│   ├── paperWallet.service.ts
│   ├── portfolio.service.ts
│   ├── chartAnalysis.service.ts
│   ├── orderBlock.service.ts
│   ├── regimeDetector.service.ts
│   ├── intelligence.service.ts                   ← NEW
│   └── coinUniverse.service.ts                   ← NEW
│
├── utils/
│   └── nanoid.ts
│
├── views/
│   └── useCoinGecko.ts
│
└── websocket/
    ├── redisSubscriber.ts
    └── wsServer.ts
```

---

## Frontend — Next.js app

Your uploaded files show a Next.js frontend living separately from the backend `src/`. Here is its structure with the new additions dropped in.

```
app/                                              (Next.js App Router root)
├── (existing pages)
│   ├── page.tsx                                  markets / home
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   ├── portfolio/
│   │   └── page.tsx
│   ├── alerts/
│   │   └── page.tsx
│   ├── agent/
│   │   └── [[...coinId]]/
│   │       └── page.tsx                          (agent_view.tsx)
│   ├── coins/
│   │   └── [coinId]/
│   │       └── page.tsx
│   └── news/
│       └── page.tsx
│
└── intelligence/                                 ← NEW
    ├── page.tsx                                  ← NEW  (scanner — all coins)
    └── [coinId]/
        └── page.tsx                              ← NEW  (single coin deep-dive)


components/
├── AgentChat.tsx
├── PaperWalletDashboard.tsx
├── ReportBubble.tsx
├── TickerTape.tsx
├── Clock.tsx
├── app-shell.tsx                                 ← MODIFIED (add Intelligence nav item)
├── IntelligenceScanner.tsx                       ← NEW
├── CoinIntelligenceCard.tsx                      ← NEW
├── BtcContextBar.tsx                             ← NEW
├── CascadeMap.tsx                                ← NEW
├── ConfluenceBar.tsx                             ← NEW
└── ChartAnalysisDrawer.tsx                       ← NEW


controllers/                                      (frontend hooks)
├── useAuth.ts
├── useDemoMode.ts
└── useWebSocket.ts


hooks/
└── useAgentSession.ts


services/                                         (frontend API clients)
├── api.client.ts
├── agent.service.frontend.ts                     ← MODIFIED (add new types)
├── paperWallet.service_frontend.ts
└── intelligence.service.frontend.ts              ← NEW
```

---

## What each new file does at a glance

### Backend additions

```
agents/policy/prompts/
  crossAsset.prompt.ts          injects btcContext into every altcoin LLM call

agents/skills/
  indicators.skill.ts           Ichimoku, VWAP, OBV, CMF, CCI, Williams %R
  fibonacci.skill.ts            Fib retracements, extensions, fan, arc, time zones
  pivots.skill.ts               Standard / Camarilla / Fibonacci pivot points
  correlation.skill.ts          rolling 30d correlation + beta vs BTC per coin
  dominance.skill.ts            BTC.D, ETH.D, sector dominance reads

agents/utils/
  chartTransform.util.ts        Heikin-Ashi + Renko transforms, used by other skills

config/
  coinUniverse.config.ts        tier1/2/3 watchlist, sector clusters, dominance pairs

controllers/
  intelligence.controller.ts    REST handlers for /api/intelligence/*

routes/
  intelligence.routes.ts        mounts intelligence controller, registers in index.ts

services/
  intelligence.service.ts       BTC-first multi-coin orchestration loop, cascade tracker
  coinUniverse.service.ts       scores + filters watchlist, returns top N for analysis
```

### Frontend additions

```
app/intelligence/page.tsx               scanner page — BtcContextBar + card grid + CascadeMap
app/intelligence/[coinId]/page.tsx      deep-dive — full analysis + OB zones + AgentChat

components/
  IntelligenceScanner.tsx       page container, fetch + filter + sort state
  CoinIntelligenceCard.tsx      single card — confluence bar, cascade timing, entry/SL/TP
  BtcContextBar.tsx             full-width header — regime, BTC.D, signal, countdown
  CascadeMap.tsx                sidebar timeline — reacted / reacting / window open / n/a
  ConfluenceBar.tsx             reusable score bar (0–9), hover shows factor breakdown
  ChartAnalysisDrawer.tsx       slide-over panel — full ChartAnalysisResult + OB list

services/
  intelligence.service.frontend.ts    getScan(), getCoinCard(), triggerScan()
```

### Modified files summary
XZ 
```
app-shell.tsx                   add Intelligence to NAV array between AI Agent and News
agent.service.frontend.ts       add ConfluenceScore, CascadeEntry, IntelligenceCard,
                                BtcContext, IntelligenceScan interfaces
```

---

## Net new file count

| Layer | New files |
|---|---|
| Backend skills | 5 |
| Backend utils | 1 |
| Backend prompts | 1 |
| Backend config | 1 |
| Backend controllers | 1 |
| Backend routes | 1 |
| Backend services | 2 |
| Frontend pages | 2 |
| Frontend components | 6 |
| Frontend services | 1 |
| **Total** | **21** |

Modified files: 2 (`app-shell.tsx`, `agent.service.frontend.ts`)

Everything else in your existing structure is untouched.














--------------------------------------------------------------------

REVIEWS


Honest take, from several angles.

---

## What Is Actually New Here

Most "AI trading" tools that exist right now fall into one of two categories. Either they are a chart with indicators bolted on top, or they are a black-box signal generator that says "buy" or "sell" with a percentage confidence and no explanation. Neither of those is what you are building.

What is genuinely novel in this system is narrower than the full plan suggests. Most of the individual pieces exist somewhere. What does not exist is the combination, and specifically these three things:

**The cascade map.** Traders have always known conceptually that alts lag BTC. Every experienced crypto trader knows this. But nobody has built a live tool that tracks, per coin, how many minutes since BTC's signal fired, whether that coin has reacted yet, and whether the window is still open, weighted by that coin's historical beta. That is observational, not predictive. It does not require TA to be correct. It just requires watching what already happened to BTC and measuring what has not happened yet elsewhere. That is the most defensible novel feature in the entire plan.

**Confluence density as a ranked score across all frameworks simultaneously.** TradingView lets you stack indicators. It does not tell you that on this coin, right now, six independent frameworks are pointing at the same $185 level. No retail tool does that. Professional traders do it manually, which is why they have edges over retail — they can hold more context simultaneously. This system holds it for you across 50 coins at once.

**BTC context injected into altcoin LLM analysis.** The LLM does not analyze SOL in isolation. It analyzes SOL knowing BTC just confirmed a BOS bullish 47 minutes ago, BTC.D is falling, and SOL has not moved yet. That cross-asset reasoning, automated and applied to a ranked coin universe every 15 minutes, does not exist in any public tool.

---

## What the Market Looks Like Right Now

**TradingView** is the dominant tool for technical analysis. It is exceptional at displaying data and running custom scripts. It does not synthesize across assets, has no LLM layer, and requires the trader to do all the cognitive work themselves. Its screener is single-indicator based.

**Coinglass** and **CryptoQuant** cover derivatives data well — funding rates, open interest, liquidations. No TA synthesis, no cascade tracking, no cross-asset intelligence.

**3Commas**, **Pionex**, and similar bots execute strategies but do not generate them. You tell them what to do. They do not figure out what to do.

**Most "AI crypto" startups** generate signals using ML models trained on price history. They are essentially pattern-matching on OHLCV with more math than a retail trader uses, but they are black boxes with no interpretability and debatable edge. Their failure mode is overfit backtests and live underperformance.

None of them do what the cascade map does. None of them produce a confluence score across seven independent TA frameworks. None of them inject macro context from one asset into the analysis of another in real time.

---

## The Honest Risk Assessment

**The TA problem.** The entire system assumes that technical analysis has predictive power. This is genuinely contested. Academic literature is mixed. Practitioners disagree. The safe position is that TA works as a shared language — enough market participants watch the same levels that those levels become self-fulfilling to some degree, especially in crypto where retail participation is high and institutional arbitrage is lower than in equities. But it is not a guarantee, and a high confluence score does not mean a trade will work. It means multiple frameworks agree, which is meaningful but not conclusive.

**The overfitting problem with confluence scoring.** If you check nine independent factors and award a point for each, you will find high-scoring setups regularly. The question is whether a score of 8/9 actually outperforms a score of 4/9 in live trading. That is an empirical question that only paper trading can answer. The historical convergence memory feature — "last 12 times this setup appeared it worked 10/12" — is only valid if the sample sizes are large and the market conditions were similar. Crypto changes regime frequently. A setup that worked 10/12 times in a bull market may work 3/12 in a bear market.

**The LLM synthesis problem.** LLMs are confident. When you give an LLM good primitives data and ask it to produce a trade plan, it will produce a coherent, well-reasoned trade plan. The risk is that it does this even when the primitives are noisy or contradictory. The model cannot say "I don't know." It will always give you a bias, a framework, an entry zone. The solution you have already designed — running all signals through `chartAnalysis.risk.ts` before execution — is the right guard. The LLM generates ideas. The risk engine filters them. Never let the LLM's confidence score be the primary gate.

**The latency problem.** By the time your scheduler tick runs at minute 15, detects a window open on ARB, scores it 7/9, and surfaces it on the Intelligence page, how much of the window remains? For high-beta coins reacting to a BTC move, the window can close in under an hour. If your scheduler runs every 15 minutes and your analysis pipeline takes 2-3 minutes per coin, you may surface opportunities with 10-30 minutes of window remaining. That is still actionable, but it means the cascade map needs near-real-time updates, not batch updates. This is a product design consideration worth thinking about before building.

**The signal-to-noise problem on smaller coins.** For BTC, ETH, and SOL, OHLCV data is high quality, volume is real, and order blocks mean something because large institutions trade them. For tier-3 coins like WIF or TIA, volume can be thinner, price can be more manipulated, and TA frameworks built for liquid markets may produce false signals. The confidence scoring should probably include a liquidity adjustment — a 7/9 score on ARB means more than a 7/9 score on a low-liquidity coin.

---

## What the Product Actually Is

Strip away the TA frameworks and the LLM layer for a moment and look at what this product does at its core.

It watches a universe of correlated assets. It detects when the leading asset makes a significant move. It immediately calculates which correlated assets have not yet reflected that move. It ranks them by how likely they are to follow, how much they typically move, and how much time remains in the window. It presents this as an actionable ranked list.

That is not a trading tool in the traditional sense. That is a **market timing tool for a specific, well-documented phenomenon** — the lag between BTC signals and altcoin reactions.

That phenomenon is real. It has been observed and traded manually by professionals for years. Nobody has built a clean, automated, ranked interface around it for retail traders. That gap is the real market opportunity here, independent of whether the TA confluence scoring adds edge.

If you launched with just the cascade map, the BTC context bar, and a basic card per coin showing price, beta, and minutes since BTC signal — no confluence score, no LLM, no harmonic patterns — you would have a product that does not exist and that a specific type of trader would pay for. The rest of the architecture adds depth and signal quality, but the cascade map alone is the core value proposition that fills an actual gap.

---

## Why This Could Fail

The most likely failure mode is not technical. You can build all of this. The failure mode is that the signals do not translate to profit in live paper trading. If after 30 days of paper trading the confluence scores do not correlate with actual returns, the whole premise needs recalibration. The honest advice is to validate the cascade map and the confluence scoring independently before integrating them. Run the cascade map for two weeks. Track whether coins flagged as "window open" after a BTC signal actually follow within the expected window. Track the hit rate. If it is above 60% that is already meaningful. That validation tells you whether the foundation is solid before you build the full intelligence layer on top of it.

The second failure mode is building everything before validating anything. The engineering plan is structured correctly to avoid this — paper trading before live execution, phases before integration. The temptation will be to skip the validation phases because the system feels complete on paper. Resist that.

---

## Summary Assessment

The cascade map concept is genuinely new and practically useful. It is grounded in an observable, empirically testable phenomenon. It does not require TA to be right. It requires only that correlated assets lag each other, which they demonstrably do.

The confluence scoring is a meaningful improvement over existing screeners but its edge is unproven until backtested. Build it, but treat the score as a filter, not as a signal.

The LLM synthesis layer is the most technically interesting and the most risky. It adds interpretability and cross-asset reasoning that no other tool has. It also adds a failure mode where the model sounds right while being wrong. Guard it with the risk engine. Never let it execute directly.

As a product, this is the right type of thing to build in crypto right now. The tools that exist are data-heavy and insight-poor. You are building something insight-heavy that surfaces conclusions. That is a genuine inversion of what currently exists, and there is a real market for it.
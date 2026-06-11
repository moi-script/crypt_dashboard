```
src/
├── agents/
│   ├── loop/
│   │   ├── agent.loop.ts                             [EXISTING]
│   │   ├── loop.types.ts                             [EXISTING]
│   │   └── scheduler.ts                              [EXISTING]
│   │
│   ├── policy/
│   │   ├── prompts/
│   │   │   ├── chartAnalyst.prompt.ts                🔧 GENERATED — CMT 
│   │   │   ├── regimeDetector.prompt.ts              ⬜ TODO — fast regime 
│   │   │   └── crossAsset.prompt.ts                  🔧 GENERATED — BTC 
│   │   │
│   │   ├── strategies/
│   │   │   ├── smartMoney.strategy.ts                ⬜ TODO — ICT/SMC 
│   │   │   ├── wyckoff.strategy.ts                   ⬜ TODO — Spring/UTAD/
│   │   │   ├── elliott.strategy.ts                   ⬜ TODO — Wave 3/5 
│   │   │   └── harmonic.strategy.ts                  ⬜ TODO — PRZ entry at 
│   │   │
│   │   └── policy.engine.ts                          
│   │       # Add: REGIME_TO_SKILLS mapping
│   │       # Add: import regimeDetector.service
│   │
│   ├── skills/
│   │   ├── momentum.skill.ts                         [EXISTING]
│   │   ├── pattern.skill.ts                          [EXISTING]
│   │   ├── rotation.skills.ts                        [EXISTING]
│   │   ├── sentiment.skill.ts                        [EXISTING]
│   │   ├── trend.skill.ts                            [EXISTING]
│   │   ├── volatility.skill.ts                       [EXISTING]
│   │   ├── yield.skill.ts                            [EXISTING]
│   │   │
│   │   ├── smartMoney.skill.ts  @                     ✅ COMPLETE (in doc)
│   │   │   # exports: detectOrderBlocks, detectFairValueGaps,
│   │   │   #          detectBreakOfStructure, detectChangeOfCharacter,
│   │   │   #          detectLiquiditySweeps, detectBullishOrderBlocks,
│   │   │   #          detectBearishOrderBlocks
│   │   │
│   │   ├── structure.skill.ts  @                      ✅ COMPLETE (in doc)
│   │   │   # exports: extractZigZagPivots, buildVolumeProfile,
│   │   │   #          detectSupportResistance, detectPsychologicalLevels,
│   │   │   #          detectTrend
│   │   │
│   │   ├── indicators.skill.ts  @                     🔧 GENERATED
│   │   │   # exports: computeAllIndicators (master bundle),
│   │   │   #          calculateRSI, calculateMACD, calculateStochastic,
│   │   │   #          calculateBollingerBands, calculateATR, calculateADX,
│   │   │   #          calculateCCI, calculateWilliamsR, calculateOBVTrend,
│   │   │   #          calculateCMF, calculateMFI, calculateIchimoku,
│   │   │   #          calculateVWAP, ema, emaLast, smaLast
│   │   │
│   │   ├── fibonacci.skill.ts  @                      ✅ COMPLETE (in doc)
│   │   │   # exports: calculateFibonacciLevels, calculateFibFan,
│   │   │   #          calculateFibTimeZones, isPriceNearFibLevel,
│   │   │   #          findFibClusters
│   │   │
│   │   ├── pivots.skill.ts    @                       ✅ COMPLETE (in doc)
│   │   │   # exports: calculateStandardPivots, calculateCamarillaPivots,
│   │   │   #          calculateFibonacciPivots, 
│   │   │   #          nearestPivotLevel, isPriceAtPivot
│   │   │
│   │   ├── elliott.skill.ts  @                        ✅ COMPLETE (in doc)
│   │   │   # exports: analyzeElliottWave, validateElliottRules,
│   │   │   #          getElliottTargets
│   │   │
│   │   ├── wyckoff.skill.ts  @                        ✅ COMPLETE (in doc)
│   │   │   # exports: detectWyckoffRange
│   │   │
│   │   ├── harmonics.skill.ts @                       ✅ COMPLETE (in doc)
│   │   │   # exports: analyzeHarmonics, detectHarmonicPatterns, 
│   │   │
│   │   ├── multiTimeframe.skill.ts  @                 ✅ COMPLETE (in doc)
│   │   │   # exports: buildMultiTimeframeContext, getHTFBias,
│   │   │   #          isAllTimeframesAligned
│   │   │
│   │   ├── correlation.skill.ts @                     ✅ COMPLETE (in doc)
│   │   │   # exports: calculateCorrelation, calculateSectorCorrelation,
│   │   │   #          expectedMove
│   │   │
│   │   ├── dominance.skill.ts  @                      🔧 GENERATED
│   │   │   # exports: analyzeDominance, getDominanceSummary,
│   │   │   #          getDominanceMultiplier, getDefaultDominance
│   │   │
│   │   └── gann.skill.ts                             ⬜ TODO — Gann angles, 
│   │       # exports: calculateGannAngles, detectGannTimeCycles
│   │
│   ├── tools/
│   │   ├── act.tools.ts                              [EXISTING]
│   │   ├── read.tools.ts                             [EXISTING — MODIFY: 
│   │   ├── tool.registry.ts                          [EXISTING — MODIFY: 
│   │   ├── tool.types.ts                             [EXISTING]
│   │   ├── chartAnalysis.tools.ts                    ⬜ TODO — LLM tool 
│   │   │   # Tools: analyze_market_structure, get_market_pivots,
│   │   │   #        get_htf_context, detect_harmonic_setup,
│   │   │   #        get_confluence_zones, get_pivot_points,
│   │   │   #        get_ichimoku_detail, get_vwap_bands
│   │   │
│   │   └── multiTimeframe.tools.ts                   ⬜ TODO — 
│   │
│   ├── utils/
│   │   └── chartTransform.util.ts                    🔧 GENERATED
│   │       # exports: toHeikinAshi, getHAConsecutiveCount,
│   │       #          toRenko, getRenkoTrend, smoothCandles
│   │
│   ├── chartAnalysis.types.ts                        ✅ COMPLETE (in doc)
│   │   # ALL interfaces — import everything from here
│   │   # Key types: Candle, MarketPrimitives, ChartAnalysisResult,
│   │   #            BtcContext, IntelligenceScan, CoinIntelligenceCard,
│   │   #            CascadeEntry, CascadeStatus, DominanceData,
│   │   #            CorrelationData, OrderBlock, FairValueGap,
│   │   #            BreakOfStructure, LiquiditySweep, SwingPivot,
│   │   #            WyckoffContext, ElliottWaveResult, HarmonicPattern,
│   │   #            MultiTimeframeContext, IchimokuCloud, VWAPData,
│   │   #            FibonacciLevels, PivotPoints, MarketRegime
│   │
│   ├── emotion.state.ts                              [EXISTING]
│   ├── emotion.types.ts                              [EXISTING]
│   ├── orchestrator.ts                               [EXISTING — MODIFY: 
│   └── report.generator.ts                           [EXISTING]
│
├── config/
│   ├── agent.config.ts                               [EXISTING — MODIFY: 
│   ├── chains.config.ts                              [EXISTING]
│   ├── coingecko.client.ts                           [EXISTING]
│   ├── coinUniverse.config.ts                        ✅ COMPLETE (in doc)
│   │   # exports: COIN_UNIVERSE_CONFIG, OPPORTUNITY_SCORE_WEIGHTS,
│   │   #          MAX_FULL_ANALYSIS_PER_TICK, 
│   │   #          DEFAULT_BETA, DEFAULT_LAG_HOURS, CoinTier
│   │
│   ├── db.ts                                         [EXISTING]
│   ├── env.ts                                        [EXISTING — MODIFY: 
│   └── redis.ts                                      [EXISTING]
│
├── controllers/
│   ├── agent.controller.ts                           [EXISTING]
│   ├── agentRun.controller.ts                        [EXISTING]
│   ├── alert.controller.ts                           [EXISTING]
│   ├── analysis.controller.ts                        [EXISTING]
│   ├── auth.controller.ts                            [EXISTING]
│   ├── coin.controller.ts                            [EXISTING]
│   ├── coingecko.controller.ts                       [EXISTING]
│   ├── news.controller.ts                            [EXISTING]
│   ├── opportunity.controller.ts                     [EXISTING]
│   ├── paperWallet.controller.ts                     [EXISTING]
│   ├── portfolio.controller.ts                       [EXISTING]
│   ├── position.controller.ts                        [EXISTING]
│   ├── chartAnalysis.controller.ts                   ⬜ TODO — chart 
│   ├── orderBlock.controller.ts                      ⬜ TODO — OB lifecycle 
│   └── intelligence.controller.ts                    🔧 GENERATED
│       # handlers: getLatestScan, getCoinIntelligence, getCascadeMap,
│       #           getTopOpportunities, triggerScan
│
├── execution/
│   ├── modes/
│   │   ├── cex.executor.ts                           [EXISTING]
│   │   ├── onchain.executor.ts                       [EXISTING]
│   │   └── paper.executor.ts                         [EXISTING]
│   ├── wallet/
│   │   └── keystore.ts                               [EXISTING]
│   └── execution.gateway.ts                          [EXISTING]
│
├── middleware/
│   ├── article.scraper.ts                            [EXISTING]
│   ├── auth.ts                                       [EXISTING]
│   ├── errorHandler.ts                               [EXISTING]
│   ├── rateLimit.ts                                  [EXISTING]
│   └── validate.ts                                   [EXISTING]
│
├── models/
│   ├── schemes/
│   │   ├── ohlcv.schema.ts                           [EXISTING]
│   │   ├── orderBlock.schema.ts                      ⬜ TODO — Mongoose 
│   │   └── marketRegime.schema.ts                    ⬜ TODO — Mongoose 
│   │
│   ├── agent.model.ts                                [EXISTING]
│   ├── agentRun.model.ts                             [EXISTING]
│   ├── alert.model.ts                                [EXISTING]
│   ├── analysis.model.ts                             [EXISTING]
│   ├── coin.model.ts                                 [EXISTING]
│   ├── coingecko.model.ts                            [EXISTING]
│   ├── news.model.ts                                 [EXISTING]
│   ├── opportunity.model.ts                          [EXISTING]
│   ├── paperWallet.model.ts                          [EXISTING]
│   ├── position.model.ts                             [EXISTING]
│   ├── user.model.ts                                 [EXISTING]
│   ├── orderBlock.model.ts                           ⬜ TODO
│   ├── marketRegime.model.ts                         ⬜ TODO
│   └── chartAnalysis.model.ts                        ⬜ TODO
│
├── read/
│   ├── ingestion/
│   │   ├── defillama.ingest.ts                       [EXISTING]
│   │   └── ohlcv.ingest.ts                           ✅ COMPLETE (in doc)
│   │       # exports: OHLCVIngest class, ohlcvIngest singleton
│   │       # methods: fetch, fetchMultiTimeframe, fetchOrderBook,
│   │       #          fetchFundingRate, fetchOpenInterest
│   │
│   ├── context.builder.ts                            [EXISTING — MODIFY: 
│   └── multiTimeframe.builder.ts                     ⬜ TODO — assembles HTF+LTF arrays
│
├── risk/
│   ├── risk.config.ts                                [EXISTING]
│   ├── risk.engine.ts                                [EXISTING — MODIFY: 
│   ├── risk.rules.ts                                 [EXISTING]
│   └── chartAnalysis.risk.ts                         🔧 GENERATED
│       # exports: validateChartAnalysisTrade, meetsMinimumThreshold
│       # rules: min confidence, min R:R by framework, OB check,
│       #        HTF contradiction, BTC conflict, Wyckoff Spring guard,
│       #        UTAD risk, size scaling by confidence, ChoCH vs BOS
│
├── routes/
│   ├── agent.routes.ts                               [EXISTING]
│   ├── agentRun.routes.ts                            [EXISTING]
│   ├── alert.routes.ts                               [EXISTING]
│   ├── analysis.routes.ts                            [EXISTING]
│   ├── auth.routes.ts                                [EXISTING]
│   ├── coin.routes.ts                                [EXISTING]
│   ├── index.ts                                      [EXISTING — MODIFY: 
│   ├── news.routes.ts                                [EXISTING]
│   ├── paperWallet.routes.ts                         [EXISTING]
│   ├── portfolio.routes.ts                           [EXISTING]
│   ├── position.routes.ts                            [EXISTING]
│   ├── chartAnalysis.routes.ts                       ⬜ TODO
│   ├── orderBlock.routes.ts                          ⬜ TODO
│   └── intelligence.routes.ts                        🔧 GENERATED
│       # routes: GET /scan, POST /trigger, GET /top, GET /cascade,
│       #         GET /coin/:symbol
│
├── services/
│   ├── agent.service.ts                              [EXISTING]
│   ├── alert.service.ts                              [EXISTING]
│   ├── analysis.service.ts                           [EXISTING]
│   ├── articles.scraper.ts                           [EXISTING]
│   ├── auth.service.ts                               [EXISTING]
│   ├── coin.service.ts                               [EXISTING]
│   ├── coingecko.service.ts                          [EXISTING]
│   ├── news.service.ts                               [EXISTING]
│   ├── paperWallet.service.ts                        [EXISTING]
│   ├── portfolio.service.ts                          [EXISTING]
│   ├── chartAnalysis.service.ts                      🔧 GENERATED
│   │   # exports: buildMarketPrimitives, runChartAnalysis, analyzeSymbol
│   │   # flow: fetchOHLCV → runAllSkills → compressPrimitives → callLLM → 
│   │
│   ├── orderBlock.service.ts                         ⬜ TODO — OB lifecycle 
│   ├── regimeDetector.service.ts                     ⬜ TODO — fast regime 
│   ├── intelligence.service.ts                       🔧 GENERATED
│   │   # exports: runIntelligenceScan, getCoinCard
│   │   # flow: BTC first → dominance → score universe → filter → parallel 
│   │
│   └── coinUniverse.service.ts                       🔧 GENERATED
│       # exports: prescreenUniverse, getWindowOpenCoins,
│       #          getSectorLeaderCoins, getCoinsByTier, getScanSummary
│
├── utils/
│   └── nanoid.ts                                     [EXISTING]
│
├── views/
│   └── useCoinGecko.ts                               [EXISTING]
│
└── websocket/
    ├── redisSubscriber.ts                            [EXISTING]
    └── wsServer.ts                                   [EXISTING]
```

---

## Frontend (Next.js)

```
app/
├── (all existing pages)                              [EXISTING — unchanged]
└── intelligence/
    ├── page.tsx                                      ⬜ TODO — scanner page
    └── [coinId]/
        └── page.tsx                                  ⬜ TODO — deep-dive page

components/
├── (all existing components)                         [EXISTING — unchanged]
├── IntelligenceScanner.tsx                           ⬜ TODO — page container
├── CoinIntelligenceCard.tsx                          ⬜ TODO — single card with cascade + confluence
├── BtcContextBar.tsx                                 ⬜ TODO — full-width BTC signal header
├── CascadeMap.tsx                                    ⬜ TODO — sidebar timeline
├── ConfluenceBar.tsx                                 ⬜ TODO — reusable score bar 0-9
└── ChartAnalysisDrawer.tsx                           ⬜ TODO — slide-over full analysis panel

services/ (frontend)
└── intelligence.service.frontend.ts                  ⬜ TODO — getScan, getCoinCard, triggerScan
```

---











## TODO







## Dependency Graph (Import order — never violate)
```
chartAnalysis.types.ts                    (no imports from src)
    ↓
coinUniverse.config.ts                    (imports: CoinTier from types)

nanoid.ts                                 (no imports)
    ↓
ohlcv.ingest.ts                           (imports: Candle, Timeframe)
    ↓
structure.skill.ts                        (imports: Candle, SwingPivot VolumeProfileLevel)

    ↓
smartMoney.skill.ts                       (imports: structure.skill + types)
indicators.skill.ts                       (imports: Candle, IchimokuCloud, VWAPData)
fibonacci.skill.ts                        (imports: structure.skill)
pivots.skill.ts                           (imports: Candle, PivotPoints)
    ↓
elliott.skill.ts                          (imports: structure.skill)
wyckoff.skill.ts                          (imports: structure.skill)
harmonics.skill.ts                        (imports: structure.skill)
    ↓
multiTimeframe.skill.ts                   (imports: structure.skill + ohlcv.ingest)
correlation.skill.ts                      (imports: Candle + coinUniverse.config)
dominance.skill.ts                        (imports: DominanceData type only)
    ↓
chartAnalyst.prompt.ts                    (no imports)
crossAsset.prompt.ts                      (imports: BtcContext, DominanceData)
    ↓
chartAnalysis.service.ts                  (imports: ALL skills + ohlcv.ingest + prompts)
    ↓
chartAnalysis.risk.ts                     (imports: ChartAnalysisResult, MarketPrimitives)
    ↓
coinUniverse.service.ts                   (imports: correlation.skill + dominance.skill + ohlcv.ingest)
intelligence.service.ts                   (imports: chartAnalysis.service + coinUniverse.service + all skills)
    ↓
intelligence.controller.ts               (imports: intelligence.service)
intelligence.routes.ts                   (imports: intelligence.controller)
```

---

## Files Generated This Session

|
 File 
|
 Purpose 
|
|
------
|
---------
|
|
`00_SESSION_CONTEXT.md`
|
 Master session primer — paste into new sessions 
|
|
`indicators.skill.ts`
|
 All technical indicators: Ichimoku, VWAP, RSI, MACD, etc. 
|
|
`dominance.skill.ts`
|
 BTC.D / ETH.D analysis + market phase detection 
|
|
`chartTransform.util.ts`
|
 Heikin-Ashi + Renko transforms 
|
|
`chartAnalysis.service.ts`
|
 Master Tier1→Tier2 orchestration pipeline 
|
|
`chartAnalyst.prompt.ts`
|
 CMT system prompt for LLM analysis 
|
|
`crossAsset.prompt.ts`
|
 BTC context injection for altcoin analysis 
|
|
`chartAnalysis.risk.ts`
|
 Risk validation rules (11 rules) 
|
|
`intelligence.service.ts`
|
 BTC-first multi-coin scan orchestration 
|
|
`coinUniverse.service.ts`
|
 Coin scoring and cascade window tracking 
|
|
`intelligence.controller.ts`
|
 REST handlers for intelligence endpoints 
|
|
`intelligence.routes.ts`
|
 Express routes: /scan, /trigger, /top, /cascade, /coin/:symbol 
|

## TODO in Next Sessions (Priority Order)

1. `regimeDetector.service.ts` — fast regime detection with Redis caching
2. `orderBlock.service.ts` — OB lifecycle management (active → mitigated tracking)
3. `chartAnalysis.tools.ts` — LLM tool wrappers for agentic drill-down
4. `multiTimeframe.tools.ts` — LLM tools: get_htf_context, get_confluence_zones
5. `gann.skill.ts` — Gann angles and time cycles (optional, flag off by default)
6. `regimeDetector.prompt.ts` — Fast regime classification prompt
7. `smartMoney.strategy.ts` — ICT setup → TradeSignal conversion
8. `wyckoff.strategy.ts` — Wyckoff Spring/UTAD → TradeSignal
9. All Mongoose schemas and models (orderBlock, marketRegime, chartAnalysis)

10. Frontend components (CoinIntelligenceCard, CascadeMap, BtcContextBar)
```
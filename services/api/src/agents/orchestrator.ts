import { CoinGeckoService }   from '../services/coingecko.service'
import { ArticleDoc }         from '../models/news.model'
import { AnalysisDoc, CoinBehaviourDoc, type SkillResult, type ReasoningStep } from '../models/analysis.model'
import { runTrendSkill }      from './skills/trend.skill'
import { runMomentumSkill }   from './skills/momentum.skill'
import { runVolatilitySkill } from './skills/volatility.skill'
import { runSentimentSkill }  from './skills/sentiment.skill'
import { runPatternSkill }    from './skills/pattern.skill'

// ── New Two-Tier imports ───────────────────────────────────────────────────────
import { detectRegimeForSymbol } from '../services/regimeDetector.service'
import { selectSkillsForRegime } from './policy/policy.engine'
import { analyzeSymbol }         from '../services/chartAnalysis.service'
import { MarketRegime }          from './chartAnalysis.types'
import { ohlcvIngest }           from '../read/ingestion/ohlcv.ingest'

const cg = new CoinGeckoService()

export interface OrchestratorResult {
  coinId:        string
  coinName:      string
  symbol:        string
  price:         number
  skills:        SkillResult[]
  skillsUsed:    string[]
  reasoning:     ReasoningStep[]
  newsCount:     number
  sentimentAvg:  number
  pastAnalyses:  number
  behaviourNotes: string
  priceHistory:  { time: number; price: number }[]
  ohlcv:         { time: number; open: number; high: number; low: number; close: number; volume: number }[]
  newsHeadlines: string[]
  // ── New: chart analysis result attached when Two-Tier runs ────
  regime?:       MarketRegime
  chartSetup?:   string   // setup_name from ChartAnalysisResult
  chartBias?:    'long' | 'short' | 'neutral'
  chartConfidence?: number
}

interface MarketContext {
  hasEnoughHistory: boolean
  isHighVolatility: boolean
  hasNewsData:      boolean
  hasEnoughOHLCV:   boolean
  isLowConfidence:  boolean
}

const SKILL_WEIGHTS: Record<string, number> = {
  trend:      0.30,
  momentum:   0.25,
  volatility: 0.20,
  sentiment:  0.15,
  pattern:    0.10,
}

// ── Map CoinGecko coinId → Binance symbol for regime detection ────────────────
// Extend this as you add coins to the watchlist
const COINGECKO_TO_BINANCE: Record<string, string> = {
  bitcoin:   'BTCUSDT',
  ethereum:  'ETHUSDT',
  solana:    'SOLUSDT',
  binancecoin: 'BNBUSDT',
  avalanche: 'AVAXUSDT',
  near:      'NEARUSDT',
  aptos:     'APTUSDT',
  sui:       'SUIUSDT',
  arbitrum:  'ARBUSDT',
  optimism:  'OPUSDT',
}

export async function orchestrate(coinId: string): Promise<OrchestratorResult> {
  console.log(`[Orchestrator] Starting analysis for ${coinId}`)

  const reasoning: ReasoningStep[] = []
  let stepNum = 0
  const addStep = (step: Omit<ReasoningStep, 'step'>) => {
    reasoning.push({ step: ++stepNum, ...step })
  }

  // ── 1. Fetch data ─────────────────────────────────────────────────────

  // Pre-check Binance symbol so we can conditionally skip CoinGecko OHLC
  const earlyBinanceSymbol = COINGECKO_TO_BINANCE[coinId]

  const [detail, chart30d, ohlcRaw] = await Promise.all([
    cg.getCoinDetail(coinId, { marketData: true }),
    cg.getMarketChart(coinId, 'usd', 30, 'daily'),
    // Only fetch CoinGecko OHLC when we have no Binance mapping — it returns
    // zero volume and must be patched with smeared daily aggregates (unreliable)
    earlyBinanceSymbol ? Promise.resolve(null) : cg.getOHLC(coinId, 'usd', 30),
  ])

  const price    = detail.market_data?.current_price?.usd ?? 0
  const coinName = detail.name
  const symbol   = detail.symbol.toUpperCase()

  const priceHistory = chart30d.prices.map(([ts, p]) => ({
    time: Math.round(ts / 1000), price: p,
  }))

  // ── Build OHLCV: real Binance candles when mapped, CoinGecko fallback otherwise
  let ohlcv: { time: number; open: number; high: number; low: number; close: number; volume: number }[]
  let ohlcvSource = 'coingecko'

  if (earlyBinanceSymbol) {
    try {
      // Fetch 30 real 1D candles from Binance — genuine per-candle volume
      const binanceResult = await ohlcvIngest.fetch({
        symbol:    earlyBinanceSymbol,
        timeframe: '1d',
        limit:     30,
      })
      ohlcv = binanceResult.candles.map(c => ({
        time:   Math.round(c.timestamp / 1000),
        open:   c.open,
        high:   c.high,
        low:    c.low,
        close:  c.close,
        volume: c.volume,
      }))
      ohlcvSource = `binance:${earlyBinanceSymbol}`
    } catch (binErr: any) {
      console.warn(`[Orchestrator] Binance 1D fetch failed for ${earlyBinanceSymbol}, falling back to CoinGecko OHLC:`, binErr.message)
      const fallbackRaw = ohlcRaw ?? await cg.getOHLC(coinId, 'usd', 30)
      ohlcv = (fallbackRaw as number[][]).map(([ts, open, high, low, close]) => ({
        time: Math.round(ts / 1000), open, high, low, close, volume: 0,
      }))
      const volumes = chart30d.total_volumes
      ohlcv.forEach(bar => {
        const match = volumes.find(([ts]: [number, number]) => Math.abs(Math.round(ts / 1000) - bar.time) < 43200)
        if (match) bar.volume = match[1]
      })
    }
  } else {
    // No Binance mapping: use CoinGecko OHLC and patch volume from daily aggregates
    ohlcv = (ohlcRaw as number[][] ?? []).map(([ts, open, high, low, close]) => ({
      time: Math.round(ts / 1000), open, high, low, close, volume: 0,
    }))
    const volumes = chart30d.total_volumes
    ohlcv.forEach(bar => {
      const match = volumes.find(([ts]: [number, number]) => Math.abs(Math.round(ts / 1000) - bar.time) < 43200)
      if (match) bar.volume = match[1]
    })
  }

  const change7d = priceHistory.length >= 7
    ? ((price - priceHistory[priceHistory.length - 7].price) / priceHistory[priceHistory.length - 7].price) * 100
    : 0

  const change30d = priceHistory.length >= 2
    ? ((price - priceHistory[0].price) / priceHistory[0].price) * 100
    : 0

  addStep({
    phase:    'context',
    title:    'Market data loaded',
    detail:   `Fetched ${priceHistory.length} daily price points and ${ohlcv.length} OHLCV candles for ${coinName} (${symbol}). ` +
              `Volume source: ${ohlcvSource === 'coingecko' ? 'CoinGecko daily aggregates (smeared — no Binance mapping)' : `Binance 1D candles (${ohlcvSource}) — real per-candle volume`}. ` +
              `Current price: $${price.toFixed(4)}. 7-day change: ${change7d.toFixed(2)}%. 30-day change: ${change30d.toFixed(2)}%.`,
    decision: `Working with ${priceHistory.length} days of price history`,
  })

  // ── 1b. Regime Detection (NEW) ───────────────────────────────────────
  // Detect the current market regime before selecting which skills to run.
  // Uses Binance 4H candles via ohlcvIngest → Redis-cached.

  let detectedRegime: MarketRegime = 'ranging'
  let regimeSkills: string[] = []
  const binanceSymbol = earlyBinanceSymbol

  if (binanceSymbol) {
    try {
      detectedRegime = await detectRegimeForSymbol(binanceSymbol)
      regimeSkills   = selectSkillsForRegime(detectedRegime)

      addStep({
        phase:    'context',
        title:    `Market regime detected: ${detectedRegime.toUpperCase()}`,
        detail:   `Regime detection using 4H Binance candles for ${binanceSymbol}. ` +
                  `Regime: ${detectedRegime}. ` +
                  `Priority skills for this regime: ${regimeSkills.join(', ')}.`,
        decision: `Regime-aware skill routing active. Two-Tier analysis will run for ${binanceSymbol}.`,
      })
    } catch (err: any) {
      console.warn(`[Orchestrator] Regime detection failed for ${coinId}:`, err.message)
      addStep({
        phase:    'context',
        title:    'Regime detection skipped',
        detail:   `Could not detect regime for ${binanceSymbol}: ${err.message}. Falling back to standard skill selection.`,
        decision: 'Standard skill selection will be used.',
      })
    }
  } else {
    addStep({
      phase:    'context',
      title:    'Regime detection skipped — no Binance symbol mapping',
      detail:   `No Binance symbol mapping found for coinId "${coinId}". Add it to COINGECKO_TO_BINANCE in orchestrator.ts.`,
      decision: 'Standard skill selection will be used.',
    })
  }

  // ── 2. Fetch news ─────────────────────────────────────────────────────

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 14)

  const articles = await ArticleDoc.find({
    publishedAt: { $gte: cutoff },
    $or: [
      { title:   { $regex: coinId,   $options: 'i' } },
      { title:   { $regex: coinName, $options: 'i' } },
      { summary: { $regex: coinId,   $options: 'i' } },
      { coins:   coinId },
    ],
  }).sort({ publishedAt: -1 }).limit(30).lean()

  const sentimentAvg = articles.length > 0
    ? articles.reduce((s, a) => s + (a.sentiment ?? 0), 0) / articles.length
    : 0

  const bullishNews = articles.filter(a => (a.sentiment ?? 0) > 0.15).length
  const bearishNews = articles.filter(a => (a.sentiment ?? 0) < -0.15).length

  addStep({
    phase:    'context',
    title:    'News context loaded',
    detail:   `Found ${articles.length} recent articles mentioning ${coinName}. Sentiment breakdown: ${bullishNews} bullish, ${bearishNews} bearish, ${articles.length - bullishNews - bearishNews} neutral. Weighted average sentiment: ${sentimentAvg.toFixed(3)} (${sentimentAvg > 0.15 ? 'positive lean' : sentimentAvg < -0.15 ? 'negative lean' : 'neutral'}).`,
    score:    Math.round(sentimentAvg * 100),
    decision: articles.length >= 3 ? 'Sufficient news data — sentiment skill will be activated' : 'Thin news coverage — sentiment skill skipped',
  })

  // ── 3. Load memory ────────────────────────────────────────────────────

  const [behaviour, lastAnalysis, pastCount] = await Promise.all([
    CoinBehaviourDoc.findOne({ coinId }).lean(),
    AnalysisDoc.findOne({ coinId }).sort({ runAt: -1 }).lean(),
    AnalysisDoc.countDocuments({ coinId }),
  ])

  addStep({
    phase:    'context',
    title:    'Memory recalled',
    detail:   pastCount === 0
      ? `No previous analyses found for ${coinName}. This is the first run.`
      : `Recalled ${pastCount} previous analyses. Last verdict: ${lastAnalysis?.verdict ?? 'unknown'} (score ${lastAnalysis?.score ?? 0}). Behaviour notes: "${behaviour?.notes || 'none yet'}". Rolling average score: ${behaviour?.avgScore ?? 0}.`,
    decision: lastAnalysis
      ? `Prior context available — will factor last verdict (${lastAnalysis.verdict}) into confidence`
      : 'No prior context — confidence will be lower on first run',
  })

  // ── 4. Determine market context and select skills ─────────────────────

  const isHighVol = ohlcv.length >= 14 && (() => {
    const closes = ohlcv.slice(-14).map(b => b.close)
    const mean   = closes.reduce((a, b) => a + b, 0) / closes.length
    const std    = Math.sqrt(closes.reduce((a, b) => a + (b - mean) ** 2, 0) / closes.length)
    return (std / mean) * 100 > 3
  })()

  const ctx: MarketContext = {
    hasEnoughHistory: priceHistory.length >= 20,
    isHighVolatility: isHighVol,
    hasNewsData:      articles.length >= 3,
    hasEnoughOHLCV:   ohlcv.length >= 14,
    isLowConfidence:  lastAnalysis ? (lastAnalysis.confidence ?? 100) < 40 : false,
  }

  const skillsToRun: string[] = ['trend', 'momentum']
  const selectionReasons: string[] = [
    'Trend — always active: core directional read on price vs moving averages.',
    'Momentum — always active: RSI and MACD show whether buyers or sellers are in control.',
  ]

  if (ctx.hasEnoughOHLCV) {
    skillsToRun.push('volatility')
    selectionReasons.push(`Volatility — activated: ${ohlcv.length} OHLCV candles available.`)
  }

  if (ctx.hasNewsData) {
    skillsToRun.push('sentiment')
    selectionReasons.push(`Sentiment — activated: ${articles.length} news articles found.`)
  }

  if (ctx.hasEnoughOHLCV) {
    skillsToRun.push('pattern')
    selectionReasons.push(`Pattern — activated: enough OHLCV data to detect candle patterns.`)
  }

  if (ctx.isLowConfidence && !skillsToRun.includes('volatility')) {
    skillsToRun.push('volatility')
    selectionReasons.push(`Volatility — also activated: last analysis had low confidence.`)
  }

  // Note which regime-aware skills are scheduled for the Two-Tier pass
  if (regimeSkills.length > 0) {
    selectionReasons.push(
      `Regime-aware Two-Tier skills queued: ${regimeSkills.join(', ')} ` +
      `(will run via chartAnalysis.service after base skills complete).`
    )
  }

  addStep({
    phase:    'skill_selection',
    title:    `${skillsToRun.length} base skills selected${regimeSkills.length > 0 ? ' + Two-Tier chart analysis' : ''}`,
    detail:   selectionReasons.join('\n'),
    decision: `Running: ${skillsToRun.join(', ')}`,
  })

  // ── 5. Run base skills ─────────────────────────────────────────────────

  const skillResults: SkillResult[] = []

  const runAndLog = (name: string, fn: () => SkillResult) => {
    const result = fn()
    skillResults.push(result)

    const weight    = SKILL_WEIGHTS[name] ?? 0.1
    const contrib   = Math.round(result.score * weight)
    const direction = result.verdict === 'bullish' ? '▲ bullish' : result.verdict === 'bearish' ? '▼ bearish' : '■ neutral'

    addStep({
      phase:    'skill_result',
      title:    `${name.charAt(0).toUpperCase() + name.slice(1)} skill → ${direction}`,
      detail:   result.summary,
      score:    result.score,
      weight:   weight,
      decision: `Contributes ${contrib > 0 ? '+' : ''}${contrib} points to final score`,
    })

    return result
  }

  if (skillsToRun.includes('trend'))      runAndLog('trend',      () => runTrendSkill(priceHistory))
  if (skillsToRun.includes('momentum'))   runAndLog('momentum',   () => runMomentumSkill(priceHistory))
  if (skillsToRun.includes('volatility')) runAndLog('volatility', () => runVolatilitySkill(ohlcv))
  if (skillsToRun.includes('sentiment'))  runAndLog('sentiment',  () => runSentimentSkill(coinId, articles.map(a => ({
    title:       a.title,
    sentiment:   a.sentiment ?? 0,
    publishedAt: a.publishedAt instanceof Date ? a.publishedAt.toISOString() : String(a.publishedAt),
    coins:       a.coins ?? [],
  }))))
  if (skillsToRun.includes('pattern'))    runAndLog('pattern',    () => runPatternSkill(ohlcv))

  // ── 5b. Two-Tier Chart Analysis (NEW) ────────────────────────────────
  // Run the full Two-Tier pipeline if we have a Binance symbol.
  // This runs in parallel to base skills and supplements them.

  let chartSetup:       string | undefined
  let chartBias:        'long' | 'short' | 'neutral' | undefined
  let chartConfidence:  number | undefined

  if (binanceSymbol) {
    try {
      const { result: chartResult } = await analyzeSymbol(binanceSymbol)

      chartSetup      = chartResult.setup_name
      chartBias       = chartResult.bias
      chartConfidence = chartResult.confidence

      addStep({
        phase:    'skill_result',
        title:    `Two-Tier Chart Analysis → ${chartResult.bias.toUpperCase()} (${chartResult.primary_framework})`,
        detail:   `Regime: ${chartResult.regime}. Setup: ${chartResult.setup_name}. ` +
                  `Confidence: ${chartResult.confidence}/100. R:R: ${chartResult.risk_reward.toFixed(2)}. ` +
                  `Confluence: ${chartResult.confluence_score}/9 (${chartResult.confluence_factors.slice(0, 3).join(', ')}). ` +
                  `Entry: ${chartResult.entry_zone.low.toFixed(4)}–${chartResult.entry_zone.high.toFixed(4)}. ` +
                  `SL: ${chartResult.stop_loss.toFixed(4)}. ` +
                  `Reasoning: ${chartResult.reasoning.slice(0, 200)}`,
        score:    chartResult.confidence,
        decision: `Chart analysis bias: ${chartResult.bias}. Invalidation: ${chartResult.invalidation.slice(0, 100)}`,
      })
    } catch (err: any) {
      console.warn(`[Orchestrator] Two-Tier chart analysis failed for ${binanceSymbol}:`, err.message)
      addStep({
        phase:    'skill_result',
        title:    'Two-Tier Chart Analysis — skipped',
        detail:   `Failed for ${binanceSymbol}: ${err.message}`,
        decision: 'Base skill scores will be used for final verdict.',
      })
    }
  }

  // ── 6. Compute weighted score ─────────────────────────────────────────

  let totalWeight = 0
  let weightedSum = 0
  const scoreBreakdown: string[] = []

  for (const skill of skillResults) {
    const w = SKILL_WEIGHTS[skill.name] ?? 0.1
    weightedSum += skill.score * w
    totalWeight += w
    scoreBreakdown.push(`${skill.name}: ${skill.score > 0 ? '+' : ''}${skill.score} × ${w} = ${(skill.score * w).toFixed(1)}`)
  }

  const rawScore      = totalWeight > 0 ? weightedSum / totalWeight : 0
  const weightedScore = Math.round(rawScore)

  const skillAgreement = skillResults.filter(s => s.verdict === 'bullish').length
  const skillDisagree  = skillResults.filter(s => s.verdict === 'bearish').length
  const allAgree       = skillAgreement === skillResults.length || skillDisagree === skillResults.length
  const conflicted     = skillAgreement > 0 && skillDisagree > 0

  addStep({
    phase:    'synthesis',
    title:    'Skill scores synthesised',
    detail:   `Score breakdown:\n${scoreBreakdown.join('\n')}\n\nWeighted total: ${weightedScore}/100. Skill consensus: ${allAgree ? 'all skills agree' : conflicted ? 'skills are conflicting' : 'mixed signals'}. ${chartBias ? `Two-Tier chart bias: ${chartBias} (confidence ${chartConfidence}).` : ''}`,
    score:    weightedScore,
    decision: `Pre-AI weighted score: ${weightedScore}. Chart analysis bias: ${chartBias ?? 'not run'}.`,
  })

  console.log(`[Orchestrator] ${skillResults.length} skills completed for ${coinId} — weighted score: ${weightedScore}${chartBias ? `, chart bias: ${chartBias}` : ''}`)

  return {
    coinId,
    coinName,
    symbol,
    price,
    skills:        skillResults,
    skillsUsed:    skillResults.map(s => s.name),
    reasoning,
    newsCount:     articles.length,
    sentimentAvg,
    pastAnalyses:  pastCount,
    behaviourNotes: behaviour?.notes ?? '',
    priceHistory,
    ohlcv,
    newsHeadlines: articles.slice(0, 10).map(a => a.title),
    regime:        detectedRegime,
    chartSetup,
    chartBias,
    chartConfidence,
  }
}
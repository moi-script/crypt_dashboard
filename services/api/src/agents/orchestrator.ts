import { CoinGeckoService }   from '../services/coingecko.service'
import { ArticleDoc }         from '../models/news.model'
import { AnalysisDoc, CoinBehaviourDoc, type SkillResult, type ReasoningStep } from '../models/analysis.model'
import { runTrendSkill }      from './skills/trend.skill'
import { runMomentumSkill }   from './skills/momentum.skill'
import { runVolatilitySkill } from './skills/volatility.skill'
import { runSentimentSkill }  from './skills/sentiment.skill'
import { runPatternSkill }    from './skills/pattern.skill'

const cg = new CoinGeckoService()

export interface OrchestratorResult {
  coinId:        string
  coinName:      string
  symbol:        string
  price:         number
  skills:        SkillResult[]
  skillsUsed:    string[]
  reasoning:     ReasoningStep[]   // ← full trace
  newsCount:     number
  sentimentAvg:  number
  pastAnalyses:  number
  behaviourNotes: string
  priceHistory:  { time: number; price: number }[]
  ohlcv:         { time: number; open: number; high: number; low: number; close: number; volume: number }[]
  newsHeadlines: string[]
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

export async function orchestrate(coinId: string): Promise<OrchestratorResult> {
  console.log(`[Orchestrator] Starting analysis for ${coinId}`)

  // Reasoning chain — appended throughout the run
  const reasoning: ReasoningStep[] = []
  let stepNum = 0
  const addStep = (step: Omit<ReasoningStep, 'step'>) => {
    reasoning.push({ step: ++stepNum, ...step })
  }

  // ── 1. Fetch data ─────────────────────────────────────────────────────

  const [detail, chart30d, ohlcRaw] = await Promise.all([
    cg.getCoinDetail(coinId, { marketData: true }),
    cg.getMarketChart(coinId, 'usd', 30, 'daily'),
    cg.getOHLC(coinId, 'usd', 30),
  ])

  const price    = detail.market_data?.current_price?.usd ?? 0
  const coinName = detail.name
  const symbol   = detail.symbol.toUpperCase()

  const priceHistory = chart30d.prices.map(([ts, p]) => ({
    time: Math.round(ts / 1000), price: p,
  }))

  const ohlcv = ohlcRaw.map(([ts, open, high, low, close]) => ({
    time: Math.round(ts / 1000), open, high, low, close, volume: 0,
  }))

  const volumes = chart30d.total_volumes
  ohlcv.forEach(bar => {
    const match = volumes.find(([ts]) => Math.abs(Math.round(ts / 1000) - bar.time) < 43200)
    if (match) bar.volume = match[1]
  })

  const change7d = priceHistory.length >= 7
    ? ((price - priceHistory[priceHistory.length - 7].price) / priceHistory[priceHistory.length - 7].price) * 100
    : 0

  const change30d = priceHistory.length >= 2
    ? ((price - priceHistory[0].price) / priceHistory[0].price) * 100
    : 0

  addStep({
    phase:    'context',
    title:    'Market data loaded',
    detail:   `Fetched ${priceHistory.length} daily price points and ${ohlcv.length} OHLCV candles for ${coinName} (${symbol}). Current price: $${price.toFixed(4)}. 7-day change: ${change7d.toFixed(2)}%. 30-day change: ${change30d.toFixed(2)}%.`,
    decision: `Working with ${priceHistory.length} days of price history`,
  })

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
      ? `No previous analyses found for ${coinName}. This is the first run — the agent has no learned behaviour for this coin yet.`
      : `Recalled ${pastCount} previous analyses. Last verdict: ${lastAnalysis?.verdict ?? 'unknown'} (score ${lastAnalysis?.score ?? 0}). Behaviour notes: "${behaviour?.notes || 'none yet'}". Rolling average score: ${behaviour?.avgScore ?? 0}.`,
    decision: lastAnalysis
      ? `Prior context available — will factor last verdict (${lastAnalysis.verdict}) into confidence`
      : 'No prior context — confidence will be lower on first run',
  })

  // ── 4. Determine market context and select skills ─────────────────────

  // Compute volatility inline for context detection
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

  // Build skills list with explicit reasoning per skill
  const skillsToRun: string[] = ['trend', 'momentum']

  const selectionReasons: string[] = [
    'Trend — always active: core directional read on price vs moving averages.',
    'Momentum — always active: RSI and MACD show whether buyers or sellers are in control.',
  ]

  if (ctx.hasEnoughOHLCV) {
    skillsToRun.push('volatility')
    selectionReasons.push(`Volatility — activated: ${ohlcv.length} OHLCV candles available (need ≥14). Will check Bollinger Bands and ATR.`)
  } else {
    selectionReasons.push(`Volatility — skipped: only ${ohlcv.length} candles available, need ≥14.`)
  }

  if (ctx.hasNewsData) {
    skillsToRun.push('sentiment')
    selectionReasons.push(`Sentiment — activated: ${articles.length} news articles found (need ≥3). Average sentiment ${sentimentAvg.toFixed(2)}.`)
  } else {
    selectionReasons.push(`Sentiment — skipped: only ${articles.length} articles found, need ≥3 for meaningful signal.`)
  }

  if (ctx.hasEnoughOHLCV) {
    skillsToRun.push('pattern')
    selectionReasons.push(`Pattern — activated: enough OHLCV data to detect candle patterns and S/R levels.`)
  } else {
    selectionReasons.push(`Pattern — skipped: insufficient OHLCV data for pattern detection.`)
  }

  if (ctx.isLowConfidence && !skillsToRun.includes('volatility')) {
    skillsToRun.push('volatility')
    selectionReasons.push(`Volatility — also activated: last analysis had low confidence (${lastAnalysis?.confidence}%), running extra skill defensively.`)
  }

  if (isHighVol) {
    selectionReasons.push(`Note: market is in HIGH VOLATILITY regime (rolling std dev > 3%). Volatility skill findings will be weighted cautiously.`)
  }

  addStep({
    phase:    'skill_selection',
    title:    `${skillsToRun.length} skills selected`,
    detail:   selectionReasons.join('\n'),
    decision: `Running: ${skillsToRun.join(', ')}`,
  })

  // ── 5. Run skills + log each one ─────────────────────────────────────

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
      decision: `Contributes ${contrib > 0 ? '+' : ''}${contrib} points to final score (score ${result.score} × weight ${weight})`,
    })

    return result
  }

  if (skillsToRun.includes('trend')) {
    runAndLog('trend', () => runTrendSkill(priceHistory))
  }
  if (skillsToRun.includes('momentum')) {
    runAndLog('momentum', () => runMomentumSkill(priceHistory))
  }
  if (skillsToRun.includes('volatility')) {
    runAndLog('volatility', () => runVolatilitySkill(ohlcv))
  }
  if (skillsToRun.includes('sentiment')) {
    runAndLog('sentiment', () => runSentimentSkill(coinId, articles.map(a => ({
      title:       a.title,
      sentiment:   a.sentiment ?? 0,
      publishedAt: a.publishedAt instanceof Date ? a.publishedAt.toISOString() : String(a.publishedAt),
      coins:       a.coins ?? [],
    }))))
  }
  if (skillsToRun.includes('pattern')) {
    runAndLog('pattern', () => runPatternSkill(ohlcv))
  }

  // ── 6. Compute weighted score and log synthesis ───────────────────────

  let totalWeight = 0
  let weightedSum = 0
  const scoreBreakdown: string[] = []

  for (const skill of skillResults) {
    const w = SKILL_WEIGHTS[skill.name] ?? 0.1
    weightedSum += skill.score * w
    totalWeight += w
    scoreBreakdown.push(`${skill.name}: ${skill.score > 0 ? '+' : ''}${skill.score} × ${w} = ${(skill.score * w).toFixed(1)}`)
  }

  const rawScore     = totalWeight > 0 ? weightedSum / totalWeight : 0
  const weightedScore = Math.round(rawScore)

  const skillAgreement = skillResults.filter(s => s.verdict === 'bullish').length
  const skillDisagree  = skillResults.filter(s => s.verdict === 'bearish').length
  const allAgree       = skillAgreement === skillResults.length || skillDisagree === skillResults.length
  const conflicted     = skillAgreement > 0 && skillDisagree > 0

  addStep({
    phase:    'synthesis',
    title:    'Skill scores synthesised',
    detail:   `Score breakdown:\n${scoreBreakdown.join('\n')}\n\nWeighted total: ${weightedScore}/100. Skill consensus: ${allAgree ? 'all skills agree' : conflicted ? 'skills are conflicting' : 'mixed signals'}. ${conflicted ? 'Conflicting signals reduce confidence.' : allAgree ? 'Strong agreement boosts confidence.' : ''}`,
    score:    weightedScore,
    decision: `Pre-AI weighted score: ${weightedScore}. This will be reviewed and potentially adjusted by the report generator.`,
  })

  console.log(`[Orchestrator] ${skillResults.length} skills completed for ${coinId} — weighted score: ${weightedScore}`)

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
  }
}
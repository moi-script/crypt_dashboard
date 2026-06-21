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
import { PositionDoc }               from '@/models/position.model'
import { runSmartMoneyStrategy }     from '@/agents/policy/strategies/smartMoney.strategy'
import { runWyckoffStrategy }        from '@/agents/policy/strategies/wyckoff.strategy'
import { runElliottStrategy }        from '@/agents/policy/strategies/elliott.strategy'
import { runHarmonicStrategy }       from '@/agents/policy/strategies/harmonic.strategy'
import { runPolicyEngine }           from '@/agents/policy/policy.engine'
import { generateMyId }              from '@/utils/nanoid'
import type { AgentConfig }          from '@/config/agent.config'
import type { TradeIntent, ExecutionResult, LoopContext } from '@/agents/loop/loop.types'
import type { MarketPrimitives }     from '@/agents/chartAnalysis.types'
import type { ChartStrategyResult, TradeSignal } from '@/agents/policy/strategies/strategy.types'
import type {
  StrategyCard, StrategyFramework, CoinAnalysisRunStatus, AnalysisTrigger, NewsImpact,
} from './coinAnalysis.types'
import type { NewsArticleInput }     from '@/agents/news/news.impact'

// ── DeepSeek client (same config as policy.engine.ts) ─────────────────────────

let _deepseek: OpenAI | null = null
function getClient(): OpenAI {
  if (!_deepseek) {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set')
    _deepseek = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey })
  }
  return _deepseek
}

// ── Correlated asset groups — max 2 open from any one group ──────────────────
// Groups reflect actual on-chain / market correlation, not just "crypto".
// BTC/ETH are their own group; major L1s are a second group; L2s a third.

const CORRELATED_GROUPS: Set<string>[] = [
  new Set(['BTC', 'WBTC']),                              // BTC family — highly correlated
  new Set(['ETH', 'WETH', 'stETH']),                     // ETH / LSTs — move together
  new Set(['SOL', 'AVAX', 'NEAR', 'APT', 'SUI']),        // Alt-L1s — high beta to each other
  new Set(['ARB', 'OP', 'MATIC', 'BASE']),               // L2 rollups — correlated governance & TVL flows
  new Set(['BNB', 'INJ', 'TIA']),                        // BNB-ecosystem / Cosmos cluster
]

// ── Session / macro-event risk ────────────────────────────────────────────────

function getNthWeekday(year: number, month: number, weekday: number, n: number): number {
  // Returns the date of the nth occurrence of weekday (0=Sun) in a given month
  const first = new Date(Date.UTC(year, month, 1))
  const diff  = (weekday - first.getUTCDay() + 7) % 7
  return 1 + diff + (n - 1) * 7
}

function getSessionRisk(): { session: string; block: boolean; confidenceDelta: number; reason?: string } {
  const now = new Date()
  const h   = now.getUTCHours()
  const m   = now.getUTCMinutes()
  const day = now.getUTCDay()   // 0=Sun
  const dom = now.getUTCDate()
  const yr  = now.getUTCFullYear()
  const mon = now.getUTCMonth() // 0-indexed

  if (h >= 22) {
    return { session: 'Dead Zone', block: true, confidenceDelta: 0, reason: `Post-NY dead zone (${h}:${String(m).padStart(2, '0')} UTC) — skip new entries` }
  }

  // NFP: first Friday of month 12:30–14:30 UTC
  if (day === 5 && dom <= 7 && h >= 12 && (h < 14 || (h === 14 && m < 30))) {
    return { session: 'NFP Window', block: true, confidenceDelta: 0, reason: 'First-Friday 12:30–14:30 UTC NFP window — high slippage, skipping' }
  }

  // CPI: 2nd Tuesday of month 12:30–13:30 UTC (US inflation print)
  const cpiDate = getNthWeekday(yr, mon, 2, 2) // 2nd Tuesday
  if (dom === cpiDate && day === 2 && h >= 12 && h < 14) {
    return { session: 'CPI Window', block: true, confidenceDelta: 0, reason: `2nd-Tuesday CPI print window 12:30–14:00 UTC — extreme vol, skipping` }
  }

  // PPI: day after CPI date
  if (dom === cpiDate + 1 && day === 3 && h >= 12 && h < 13) {
    return { session: 'PPI Window', block: true, confidenceDelta: 0, reason: 'PPI print window (day after CPI) — skipping' }
  }

  // Jobless Claims: every Thursday 12:30–13:30 UTC
  if (day === 4 && h === 12 && m >= 30) {
    return { session: 'Jobless Claims', block: false, confidenceDelta: -10, reason: 'Thursday 12:30 UTC jobless claims — confidence -10' }
  }

  // FOMC: exact meeting dates — announcement at ~19:00 UTC (2pm ET / 1pm EDT)
  // Block 18:00–21:00 UTC on these specific dates to catch prep + statement + press conf
  // Dates are the SECOND day of each 2-day FOMC meeting (announcement day).
  const FOMC_DATES: [number, number, number][] = [
    // [year, month(1-12), day]
    [2025, 1, 29], [2025, 3, 19], [2025, 5, 7],  [2025, 6, 18],
    [2025, 7, 30], [2025, 9, 17], [2025, 10, 29], [2025, 12, 10],
    [2026, 1, 28], [2026, 3, 18], [2026, 4, 29],  [2026, 6, 10],
    [2026, 7, 29], [2026, 9, 16], [2026, 10, 28], [2026, 12, 9],
  ]
  const isFomcDay = FOMC_DATES.some(([y, mo, d]) => yr === y && mon + 1 === mo && dom === d)
  if (isFomcDay && h >= 18 && h < 21) {
    return { session: 'FOMC Window', block: false, confidenceDelta: -15, reason: 'FOMC announcement window 18:00–21:00 UTC — statement + Powell presser, confidence -15' }
  }
  // FOMC prep: first day of meeting, low confidence all afternoon
  const FOMC_PREP_DATES: [number, number, number][] = [
    [2025, 1, 28], [2025, 3, 18], [2025, 5, 6],  [2025, 6, 17],
    [2025, 7, 29], [2025, 9, 16], [2025, 10, 28], [2025, 12, 9],
    [2026, 1, 27], [2026, 3, 17], [2026, 4, 28],  [2026, 6, 9],
    [2026, 7, 28], [2026, 9, 15], [2026, 10, 27], [2026, 12, 8],
  ]
  const isFomcPrepDay = FOMC_PREP_DATES.some(([y, mo, d]) => yr === y && mon + 1 === mo && dom === d)
  if (isFomcPrepDay && h >= 14) {
    return { session: 'FOMC Day 1', block: false, confidenceDelta: -10, reason: 'FOMC meeting day 1 afternoon — markets on hold, confidence -10' }
  }

  const sessionName = h < 8 ? 'Asian' : h < 16 ? 'London' : 'New York'
  return { session: sessionName, block: false, confidenceDelta: 0 }
}

// ── Market regime filter: trend + volatility ──────────────────────────────────

function getMarketRegime(primitives: MarketPrimitives): {
  regime: 'trending_bull' | 'trending_bear' | 'ranging' | 'unknown'
  adx: number
  htfTrend: string
  confidenceDelta: number
  warning?: string
} {
  const adx      = primitives.indicators?.adx ?? 0
  const htfTrend = primitives.structure?.trend_htf ?? 'neutral'
  const atr      = primitives.indicators?.atr_14 ?? 0
  const bb       = primitives.indicators?.bb

  // ADX-based regime
  const isRanging  = adx > 0 && adx < 22
  const isTrending = adx >= 25

  // Bollinger squeeze also signals low-volatility range
  const bbSqueeze  = bb?.squeeze ?? false

  const regime = isRanging || bbSqueeze
    ? 'ranging'
    : htfTrend === 'bullish' ? 'trending_bull'
    : htfTrend === 'bearish' ? 'trending_bear'
    : 'unknown'

  // In a ranging market, breakout signals have low hit rate — reduce confidence
  const confidenceDelta = isRanging ? -15 : bbSqueeze ? -10 : htfTrend === 'neutral' ? -5 : 0

  const warning = isRanging
    ? `Market ranging (ADX ${adx.toFixed(0)}) — breakout signals unreliable, confidence -15`
    : bbSqueeze
    ? `Bollinger squeeze active (ATR ${atr.toFixed(0)}) — low volatility, confidence -10`
    : undefined

  return { regime, adx, htfTrend, confidenceDelta, warning }
}

// ── Funding rate — extreme positive funding crowds longs ──────────────────────

async function fetchFundingRate(symbol: string): Promise<number | null> {
  try {
    const r = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}USDT`)
    if (!r.ok) return null
    const d = await r.json() as { lastFundingRate?: string }
    return d.lastFundingRate ? parseFloat(d.lastFundingRate) : null
  } catch { return null }
}

// ── Daily max loss: halt if today's realised P&L < -2% of portfolio ──────────

async function checkDailyMaxLoss(userId: string, config: AgentConfig, portfolioUsd = 10_000): Promise<{ halt: boolean; reason?: string; dailyPnl: number }> {
  // "Trading day" resets at 22:00 UTC (post-NY close / dead zone start), not UTC midnight.
  // This prevents a 23:50 UTC blowup from resetting in 10 minutes.
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setUTCHours(22, 0, 0, 0)
  if (now.getUTCHours() < 22) cutoff.setUTCDate(cutoff.getUTCDate() - 1)
  const closedToday = await PositionDoc.find({
    userId, mode: config.mode, status: 'closed',
    exitAt: { $gte: cutoff },
  }).lean()
  if (!closedToday.length) return { halt: false, dailyPnl: 0 }

  const dailyPnl = closedToday.reduce((s, p) => s + (p.realizedPnlUsd ?? 0), 0)
  const limitPct = (config.dailyLossLimitPct ?? 2) / 100
  const DAILY_LOSS_LIMIT = -Math.max(200, portfolioUsd * limitPct)
  if (dailyPnl <= DAILY_LOSS_LIMIT) {
    return {
      halt:     true,
      reason:   `Daily loss limit: -$${Math.abs(dailyPnl).toFixed(2)} today exceeds ${config.dailyLossLimitPct ?? 2}% of $${portfolioUsd.toFixed(0)} portfolio — no new entries until tomorrow`,
      dailyPnl,
    }
  }
  return { halt: false, dailyPnl }
}

// ── Intraday BTC momentum: block longs on sell-off, shorts on pump ───────────

async function fetchBtcMomentum(): Promise<{ movePct: number; block: boolean; blockShorts: boolean; note: string }> {
  try {
    const [r4h, r1h] = await Promise.all([
      fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=2'),
      fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=2'),
    ])
    if (!r4h.ok) return { movePct: 0, block: false, blockShorts: false, note: '' }

    const klines4h = await r4h.json() as number[][]
    const prevClose4h = parseFloat(String(klines4h[0][4]))
    const currOpen4h  = parseFloat(String(klines4h[1][1]))
    const move4h = prevClose4h > 0 ? (currOpen4h - prevClose4h) / prevClose4h * 100 : 0

    let move1h = 0
    if (r1h.ok) {
      const klines1h   = await r1h.json() as number[][]
      const prevClose1h = parseFloat(String(klines1h[0][4]))
      const currOpen1h  = parseFloat(String(klines1h[1][1]))
      move1h = prevClose1h > 0 ? (currOpen1h - prevClose1h) / prevClose1h * 100 : 0
    }

    // Block longs: 4H alone bearish -2.5%, OR compounding weakness on both TFs
    const block = move4h <= -2.5 || (move4h <= -1.5 && move1h <= -1.5)
    // Block shorts: 4H alone pumping +3%, OR compounding strength on both TFs
    const blockShorts = move4h >= 3.0 || (move4h >= 2.0 && move1h >= 1.5)

    const movePct = move4h  // primary reference for logging
    const note = block
      ? ` [⚠ BTC 4H ${move4h.toFixed(1)}% / 1H ${move1h.toFixed(1)}% — long risk elevated, blocking]`
      : blockShorts
      ? ` [⚠ BTC 4H +${move4h.toFixed(1)}% / 1H +${move1h.toFixed(1)}% — short squeeze risk, blocking]`
      : move4h <= -1.5
      ? ` [BTC -${Math.abs(move4h).toFixed(1)}% on 4H — caution]`
      : ''
    return { movePct, block, blockShorts, note }
  } catch { return { movePct: 0, block: false, blockShorts: false, note: '' } }
}

// ── Framework win-rate check: disable if rolling 10-trade WR < 35% ────────────

async function getFrameworkWinRates(userId: string, config: AgentConfig, regime?: string): Promise<Record<string, { winRate: number; tradeCount: number; disabled: boolean }>> {
  const recent = await PositionDoc.find({ userId, mode: config.mode, status: 'closed', framework: { $exists: true } })
    .sort({ exitAt: -1 }).limit(40).lean()

  const byFw: Record<string, { wins: number; total: number }> = {}
  for (const p of recent) {
    const fw = p.framework as string
    if (!byFw[fw]) byFw[fw] = { wins: 0, total: 0 }
    if (byFw[fw].total >= 10) continue  // only rolling 10
    byFw[fw].total++
    if ((p.realizedPnlUsd ?? 0) > 0) byFw[fw].wins++
  }

  // In ranging markets all frameworks underperform by definition — use lower thresholds
  // to avoid incorrectly disabling good frameworks that are temporarily in the wrong regime.
  const isRanging = regime === 'ranging'
  const disableAt     = isRanging ? 0.20 : 0.35
  const fastDisableAt = isRanging ? 0.15 : 0.25

  const result: Record<string, { winRate: number; tradeCount: number; disabled: boolean }> = {}
  for (const [fw, s] of Object.entries(byFw)) {
    const winRate = s.total > 0 ? s.wins / s.total : 1
    result[fw] = { winRate, tradeCount: s.total, disabled: (s.total >= 10 && winRate < disableAt) || (s.total >= 5 && winRate < fastDisableAt) }
  }
  return result
}

// ── Equity curve halt: stop trading after 10% drawdown from peak ──────────────

async function checkEquityCurveHalt(userId: string, config: AgentConfig, currentEquity = 10_000): Promise<{ halt: boolean; reason?: string; drawdownPct: number }> {
  const allClosed = await PositionDoc.find({ userId, mode: config.mode, status: 'closed' })
    .sort({ exitAt: 1 }).lean()
  if (allClosed.length < 5) return { halt: false, drawdownPct: 0 }

  // Reconstruct equity curve from current value (most accurate) plus closed P&L
  const totalRealised = allClosed.reduce((s, p) => s + (p.realizedPnlUsd ?? 0), 0)
  const impliedStart  = currentEquity - totalRealised

  let balance = impliedStart
  let peak    = impliedStart
  for (const p of allClosed) {
    balance += p.realizedPnlUsd ?? 0
    if (balance > peak) peak = balance
  }

  const drawdownPct = peak > 0 ? (peak - balance) / peak * 100 : 0
  const haltThreshold = config.maxDrawdownPct ?? 10
  if (drawdownPct >= haltThreshold) {
    return {
      halt:         true,
      reason:       `Circuit breaker: ${drawdownPct.toFixed(1)}% drawdown from $${peak.toFixed(0)} peak (limit ${haltThreshold}%) — halting all new entries until manual reset`,
      drawdownPct,
    }
  }
  return { halt: false, drawdownPct }
}

// ── 24h Binance spot volume ───────────────────────────────────────────────────

async function fetch24hVolumeUsd(binanceSymbol: string): Promise<number | null> {
  try {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`)
    if (!r.ok) return null
    const d = await r.json() as { quoteVolume: string }
    return parseFloat(d.quoteVolume)
  } catch { return null }
}

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
    const completion = await getClient().chat.completions.create({
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
  config:        AgentConfig,
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

  // Reject short signals unless config.allowShorts is explicitly enabled
  if (result.signal.bias !== 'long' && !config.allowShorts) {
    return noSignalCard(`Short bias disabled — enable allowShorts in config to trade both directions`)
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

// ── Build a compact text summary of all strategy cards for the policy engine ──

function buildCardsSummary(cards: StrategyCard[], symbol: string): string {
  const lines = [`Chart signal summary for ${symbol}:`]
  for (const card of cards) {
    if (card.signal) {
      const conf = card.signal.confidence + card.newsImpact.confidenceDelta
      lines.push(
        `  ${card.framework}: ${card.signal.bias.toUpperCase()} ${conf}% — ` +
        `${card.signal.setup_name} | entry $${card.signal.entry_zone.low}–$${card.signal.entry_zone.high} ` +
        `SL $${card.signal.stop_loss} TP $${card.signal.take_profit_levels[0]} R:R ${card.signal.risk_reward} | ` +
        `news=${card.newsImpact.verdict}`,
      )
    } else {
      lines.push(`  ${card.framework}: SKIPPED — ${card.skippedReason ?? 'no signal'}`)
    }
  }
  const agreeingBias = cards.filter(c => c.signal?.bias === 'long').length > cards.filter(c => c.signal?.bias === 'short').length ? 'long' : 'short'
  const agreementCount = cards.filter(c => c.signal?.bias === agreeingBias).length
  if (agreementCount >= 2) {
    lines.push(`  CONFLUENCE: ${agreementCount} frameworks agree on ${agreeingBias.toUpperCase()} — stronger signal.`)
  }
  return lines.join('\n')
}

// ── Auto-execute: pick best qualifying card ───────────────────────────────────

async function autoExecuteBest(
  userId:            string,
  coinAnalysisRunId: string,
  symbol:            string,
  cards:             StrategyCard[],
  config:            AgentConfig,
  walletState:       Awaited<ReturnType<typeof loadWalletState>>,
  memoryContext:     string | undefined,
  cardsSummary:      string,
  primitives:        MarketPrimitives,
): Promise<CoinAnalysisRunStatus> {
  const skipAll = (reason: string) => {
    for (const card of cards) { card.approvalStatus = 'skipped'; if (card.signal) card.skippedReason = reason }
  }

  const portfolioUsd = walletState.totalValueUsd ?? 10_000
  const anyLong  = cards.some(c => c.signal?.bias === 'long')
  const anyShort = cards.some(c => c.signal?.bias === 'short')
  const signalBias = anyLong ? 'long' : 'short'

  // ── Session and regime computed first — needed by pre-filter calls ────────
  const sessionRisk = getSessionRisk()
  if (sessionRisk.block) {
    skipAll(`Session blocked [${sessionRisk.session}]: ${sessionRisk.reason}`)
    return 'completed'
  }
  const regime = getMarketRegime(primitives)

  // ── Parallel pre-filters (independent DB + network calls) ────────────────
  const [equityCheck, dailyCheck, btcMomentum, fwWinRates, allPositions, recentStopOut, fundingRate, vol24h] = await Promise.all([
    checkEquityCurveHalt(userId, config, portfolioUsd),
    checkDailyMaxLoss(userId, config, portfolioUsd),
    fetchBtcMomentum(),
    getFrameworkWinRates(userId, config, regime.regime),
    // Include pending limit orders — committed capital counts toward caps
    PositionDoc.find({ userId, mode: config.mode, status: { $in: ['open', 'pending'] } }).lean(),
    PositionDoc.findOne({
      userId, tokenOut: symbol.toUpperCase(), mode: config.mode, status: 'closed',
      exitAt: { $gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
      realizedPnlUsd: { $lt: 0 },
    }).lean(),
    fetchFundingRate(symbol),
    fetch24hVolumeUsd(`${symbol}USDT`),
  ])
  // allOpen: only truly open positions are needed for heat/correlation logic
  const allOpen = allPositions.filter(p => p.status === 'open')

  // ── Equity curve circuit breaker ─────────────────────────────────────────
  if (equityCheck.halt) {
    skipAll(`[Circuit breaker] ${equityCheck.reason}`)
    return 'completed'
  }

  // ── Daily max loss halt ───────────────────────────────────────────────────
  if (dailyCheck.halt) {
    skipAll(`[Daily limit] ${dailyCheck.reason}`)
    return 'completed'
  }

  // ── Market regime filter ──────────────────────────────────────────────────
  if (anyLong && regime.htfTrend === 'bearish' && regime.adx >= 25) {
    skipAll(`[Regime] Counter-trend long blocked — HTF trend bearish with ADX ${regime.adx.toFixed(0)} (strong downtrend)`)
    return 'completed'
  }

  // ── Intraday BTC momentum filter: block longs on sell-off, shorts on pump ──
  if (anyLong && btcMomentum.block) {
    skipAll(`[BTC Momentum] ${btcMomentum.note.trim()}`)
    return 'completed'
  }
  if (anyShort && btcMomentum.blockShorts) {
    skipAll(`[BTC Momentum] ${btcMomentum.note.trim()}`)
    return 'completed'
  }

  // ── Framework win-rate filter ─────────────────────────────────────────────
  for (const card of cards) {
    if (!card.signal || card.approvalStatus === 'skipped') continue
    const fwStats = fwWinRates[card.framework]
    if (fwStats?.disabled) {
      card.approvalStatus = 'skipped'
      card.skippedReason  = `[Framework disabled] ${card.framework} WR ${(fwStats.winRate * 100).toFixed(0)}% over last ${fwStats.tradeCount} trades — below threshold`
    }
  }

  // ── Max concurrent positions hard cap (open + pending limit orders) ──────
  const maxPositions = config.maxConcurrentPositions ?? 6
  if (allPositions.length >= maxPositions) {
    const pendingCount = allPositions.length - allOpen.length
    skipAll(`[Position cap] ${allOpen.length} open + ${pendingCount} pending = ${allPositions.length} at max ${maxPositions} — close or cancel one first`)
    return 'completed'
  }

  // ── Max new positions per trading day ────────────────────────────────────
  const maxNewPerDay = config.maxNewPositionsPerDay ?? 3
  if (maxNewPerDay > 0) {
    const dayCutoff = new Date()
    dayCutoff.setUTCHours(22, 0, 0, 0)
    if (dayCutoff.getUTCHours() < 22 || new Date().getUTCHours() < 22) dayCutoff.setUTCDate(dayCutoff.getUTCDate() - 1)
    const openedToday = await PositionDoc.countDocuments({
      userId, mode: config.mode,
      entryAt: { $gte: dayCutoff },
      status: { $in: ['open', 'pending', 'closed'] },
    })
    if (openedToday >= maxNewPerDay) {
      skipAll(`[Daily entry cap] ${openedToday} positions entered today (max ${maxNewPerDay}) — wait for next trading day (22:00 UTC)`)
      return 'completed'
    }
  }

  // ── De-duplication: don't stack positions in the same symbol ──────────────
  const alreadyOpen = allOpen.filter(p => p.tokenOut === symbol.toUpperCase()).length
  if (alreadyOpen > 0) {
    for (const card of cards) {
      card.approvalStatus = 'skipped'
      if (card.signal) card.skippedReason = `Already in open ${symbol} position — skipping to avoid stacking`
    }
    return 'completed'
  }

  // ── Re-entry block: 4h cooldown after stop-out, same direction only ──────
  if (recentStopOut) {
    const stoppedBias = (recentStopOut as any).bias as string | undefined
    // If bias wasn't stored (legacy position), block conservatively
    const blocked = !stoppedBias || stoppedBias === signalBias
    if (blocked) {
      const oppDir = signalBias === 'long' ? 'short' : 'long'
      const hint = stoppedBias ? '' : ` (bias unknown — reverse ${oppDir} setup may be allowed once position records bias)`
      skipAll(`[Re-entry block] ${symbol} stopped out $${(recentStopOut.realizedPnlUsd ?? 0).toFixed(2)} in last 4h — ${signalBias} cooldown active${hint}`)
      return 'completed'
    }
  }

  // ── Correlation filter: max 2 positions from any correlated group ──────────
  for (const group of CORRELATED_GROUPS) {
    if (group.has(symbol.toUpperCase())) {
      const correlatedOpen = allOpen.filter(p => group.has(p.tokenOut))
      if (correlatedOpen.length >= 2) {
        const held = correlatedOpen.map(p => p.tokenOut).join(', ')
        for (const card of cards) {
          card.approvalStatus = 'skipped'
          if (card.signal) card.skippedReason = `Correlation risk: already holding ${held} — max 2 correlated positions`
        }
        return 'completed'
      }
    }
  }

  // ── Portfolio heat check: use live prices so heat reflects current distance to SL ──
  // Remaining risk = |livePrice - SL| × units. Avoids overstating heat on a position
  // that is already deep in profit (SL ratcheted up) and understating on a loser near its SL.
  const riskPct    = (config.riskPerTradePct ?? 1.0) / 100
  const heatCapPct = (config.maxPortfolioHeatPct ?? 5.0) / 100

  let totalOpenRiskUsd = 0
  if (allOpen.length > 0) {
    const openSymbols = [...new Set(allOpen.map(p => p.tokenOut))]
    const livePrices: Record<string, number> = {}
    await Promise.all(openSymbols.map(async sym => {
      try {
        const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}USDT`)
        if (r.ok) { const d = await r.json() as { price: string }; livePrices[sym] = parseFloat(d.price) }
      } catch { /* use entry price as fallback */ }
    }))

    for (const pos of allOpen) {
      if (!pos.entryPrice || !pos.stopLossPrice || !pos.entryAmountUsd) continue
      const livePrice = livePrices[pos.tokenOut] ?? pos.entryPrice
      const units     = pos.entryAmountUsd / pos.entryPrice
      const remaining = Math.abs(livePrice - pos.stopLossPrice) * units
      totalOpenRiskUsd += Math.max(0, remaining)
    }
  }

  const heatCapUsd = portfolioUsd * heatCapPct
  if (totalOpenRiskUsd >= heatCapUsd) {
    skipAll(`[Portfolio heat] Live open risk $${totalOpenRiskUsd.toFixed(0)} at ${(heatCapPct * 100).toFixed(0)}% cap ($${heatCapUsd.toFixed(0)}) — wait for exits or trailing SL tightening`)
    return 'completed'
  }

  // ── Funding rate filter ───────────────────────────────────────────────────
  let fundingDelta = 0
  let fundingNote  = ''
  if (fundingRate !== null) {
    if (fundingRate > 0.001) {
      fundingDelta = -20
      fundingNote  = ` [⚠ funding +${(fundingRate * 100).toFixed(3)}% — crowded longs, conf -20]`
    } else if (fundingRate < -0.0005) {
      fundingDelta = +5
      fundingNote  = ` [funding ${(fundingRate * 100).toFixed(3)}% — short squeeze risk, conf +5]`
    }
  }

  // ── Minimum R:R filter: use worst-case fill (zone high for longs) ─────────
  const MIN_RAW_RR = 1.5
  for (const card of cards) {
    if (!card.signal || card.approvalStatus === 'skipped') continue
    const worstEntry = card.signal.bias === 'long'
      ? card.signal.entry_zone.high   // worst long fill = top of zone
      : card.signal.entry_zone.low    // worst short fill = bottom of zone
    const risk   = worstEntry > 0 && card.signal.stop_loss > 0 ? Math.abs(worstEntry - card.signal.stop_loss) / worstEntry : 0
    const reward = worstEntry > 0 && card.signal.take_profit_levels[0] ? Math.abs(card.signal.take_profit_levels[0] - worstEntry) / worstEntry : 0
    const rawRr  = risk > 0 ? reward / risk : 0
    if (rawRr < MIN_RAW_RR) {
      card.approvalStatus = 'skipped'
      card.skippedReason  = `R:R ${rawRr.toFixed(2)} (worst-case fill) below minimum 1.5 — not worth the fee drag`
    }
  }

  // ── Confidence threshold (session delta + regime delta applied to qualifying) ──
  const baseThreshold = config.minSignalConfidence
  const sessionDelta  = sessionRisk.confidenceDelta  // negative = harder to pass
  const confidenceThreshold = baseThreshold - sessionDelta  // e.g. base 65, delta -10 → need 75

  const qualifying = cards.filter(c =>
    c.signal !== null &&
    c.approvalStatus !== 'skipped' &&
    (c.signal.bias === 'long' || config.allowShorts) &&
    (c.signal.confidence + c.newsImpact.confidenceDelta + regime.confidenceDelta + fundingDelta) >= confidenceThreshold,
  )

  if (!qualifying.length) {
    for (const card of cards) {
      card.approvalStatus = 'skipped'
      if (card.signal && !card.skippedReason) {
        const adj = card.signal.confidence + card.newsImpact.confidenceDelta + regime.confidenceDelta + fundingDelta
        const modifiers = [
          sessionRisk.confidenceDelta !== 0 ? `${sessionRisk.session} ${sessionRisk.confidenceDelta}` : '',
          regime.confidenceDelta !== 0      ? `${regime.regime} ${regime.confidenceDelta}` : '',
          fundingDelta !== 0                ? `funding ${fundingDelta}` : '',
        ].filter(Boolean).join(', ')
        card.skippedReason = `Adj. confidence ${adj} below ${confidenceThreshold}${modifiers ? ` (${modifiers})` : ''}`
      }
    }
    return 'completed'
  }

  // ── Cooldown: require +15% confidence if same symbol rejected in last 2h ──
  const recentRejection = await CoinAnalysisRunDoc.findOne({
    userId,
    symbol: symbol.toUpperCase(),
    completedAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    'strategyCards.approvalStatus': 'rejected',
  }).lean()

  if (recentRejection) {
    const cooldownThreshold = confidenceThreshold + 15
    const afterCooldown = qualifying.filter(c =>
      (c.signal!.confidence + c.newsImpact.confidenceDelta) >= cooldownThreshold,
    )
    if (!afterCooldown.length) {
      for (const card of qualifying) {
        card.approvalStatus = 'skipped'
        card.skippedReason = `Cooldown: ${symbol} rejected <2h ago — need ${cooldownThreshold}%+ confidence (got ${card.signal!.confidence + card.newsImpact.confidenceDelta}%)`
      }
      return 'completed'
    }
    qualifying.length = 0
    qualifying.push(...afterCooldown)
  }

  // ── Cross-symbol ranking: don't execute if a better signal exists in watchlist ──
  // Prevents taking a 65% signal on SOL when BTC just ran an 82% signal in the same loop.
  // Uses recent CoinAnalysisRun records (<30 min) for other watchlist symbols.
  const thisConf = Math.max(...qualifying.map(c => c.signal!.confidence + c.newsImpact.confidenceDelta))
  try {
    const watchlistSymbols = (config.watchlist ?? []).map(s => s.toUpperCase()).filter(s => s !== symbol.toUpperCase())
    if (watchlistSymbols.length > 0) {
      const recentOtherRuns = await CoinAnalysisRunDoc.find({
        userId,
        symbol: { $in: watchlistSymbols },
        status: { $in: ['completed', 'auto_executed', 'pending_approval'] },
        completedAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
      }).select('symbol strategyCards').lean()

      let bestOtherConf = 0
      let bestOtherSymbol = ''
      for (const run of recentOtherRuns) {
        for (const card of run.strategyCards ?? []) {
          if (!card.signal || card.approvalStatus === 'skipped') continue
          const conf = (card.signal as any).confidence + ((card.newsImpact as any)?.confidenceDelta ?? 0)
          if (conf > bestOtherConf) { bestOtherConf = conf; bestOtherSymbol = run.symbol }
        }
      }

      // Only defer if the other signal is meaningfully stronger (>5% margin to avoid flip-flopping)
      if (bestOtherConf > thisConf + 5) {
        skipAll(`[Cross-symbol rank] ${symbol} ${thisConf}% conf — deferring to ${bestOtherSymbol} (${bestOtherConf}%) in same loop`)
        return 'completed'
      }
    }
  } catch { /* non-fatal — proceed if ranking check fails */ }

  // ── Policy engine gate: LLM validates card results before execution ───────
  // The LLM sees the deterministic strategy signals AND can call read tools.
  // If it disagrees with the chart signals, it vetoes the trade.
  try {
    const loopCtx: LoopContext = {
      runId:          coinAnalysisRunId,
      userId,
      strategy:       'chartSignal',
      startedAt:      Date.now(),
      contextSummary: cardsSummary,
      walletState,
      marketData:     {},
      config,
    }
    const decision = await runPolicyEngine(loopCtx, cardsSummary, config, memoryContext)
    if (decision.intent.type === 'no_action') {
      for (const card of cards) {
        card.approvalStatus = 'skipped'
        if (card.signal && !card.skippedReason) {
          card.skippedReason = `LLM vetoed: ${decision.reasoning.slice(0, 120)}`
        }
      }
      return 'completed'
    }
  } catch (err: any) {
    console.warn('[CoinAnalysis] Policy engine veto check failed (non-fatal, proceeding):', err.message)
  }

  // ── Pick best card — highest adjusted confidence ──────────────────────────
  const best = qualifying.reduce((a, b) =>
    (a.signal!.confidence + a.newsImpact.confidenceDelta) >=
    (b.signal!.confidence + b.newsImpact.confidenceDelta) ? a : b,
  )
  const adjustedConf = best.signal!.confidence + best.newsImpact.confidenceDelta

  // ── TP sanity check: must clear entry zone by at least 0.5% ──────────────
  const tp1 = best.signal!.take_profit_levels[0]
  const tp2 = best.signal!.take_profit_levels[1]
  const tpEntryRef = best.signal!.bias === 'long' ? best.signal!.entry_zone.high : best.signal!.entry_zone.low
  const tp1Valid = tp1 && (
    best.signal!.bias === 'long'  ? tp1 > tpEntryRef * 1.005 :
                                    tp1 < tpEntryRef * 0.995
  )
  const tp2Valid = !tp2 || (
    best.signal!.bias === 'long'  ? tp2 > tp1! :
                                    tp2 < tp1!
  )
  if (!tp1Valid || !tp2Valid) {
    for (const card of cards) {
      card.approvalStatus = 'skipped'
      if (card.signal && !card.skippedReason)
        card.skippedReason = `TP level invalid: TP1 $${tp1} must clear entry zone (${best.signal!.bias} $${tpEntryRef}) by ≥0.5%${!tp2Valid ? ', TP2 ordering wrong' : ''}`
    }
    return 'completed'
  }

  // ── Confluence: 2+ frameworks agree — modest size bonus ──────────────────
  const agreeingCount = qualifying.filter(c => c.signal?.bias === best.signal!.bias).length
  const confluenceMultiplier = Math.min(1.15, 1 + (agreeingCount - 1) * 0.08)

  // ── Position sizing: risk-based with absolute dollar cap ─────────────────
  // Use worst-case fill (zone high for longs) for consistency with R:R filter.
  // Cap dollar risk at min(portfolio%, maxRiskPerTradeUsd) to prevent giant notional
  // positions on tight SLs (e.g. 0.2% SL distance on $10k portfolio = $50k position).
  const worstFillEntry = best.signal!.bias === 'long'
    ? best.signal!.entry_zone.high
    : best.signal!.entry_zone.low
  const slDistance = worstFillEntry > 0 && best.signal!.stop_loss > 0
    ? Math.abs(worstFillEntry - best.signal!.stop_loss) / worstFillEntry
    : 0.02
  const portfolioRiskPct = portfolioUsd * riskPct
  const maxRiskUsd       = Math.min(portfolioRiskPct, config.maxRiskPerTradeUsd ?? 150)
  const riskBasedSize    = slDistance > 0 ? maxRiskUsd / slDistance : config.maxTradeUsd
  const tradeAmount      = Math.min(riskBasedSize * confluenceMultiplier, config.maxTradeUsd)

  // ── Volume (already fetched in parallel above) ────────────────────────────
  const isLowVol = vol24h !== null && vol24h < 30_000_000
  const volumeSizeMultiplier = isLowVol ? 0.5 : 1.0
  const volumeTag = vol24h !== null
    ? ` [vol $${(vol24h / 1e6).toFixed(0)}M${isLowVol ? ' ⚠ low-vol → 50% size' : ''}]`
    : ''

  // ── Drawdown-based size reduction: streak on fully-closed positions only ────
  // Exclude positions with tp1ScaledOut (partial-exit P&L on open pos distorts streak)
  const recentClosed = await PositionDoc.find({
    userId, mode: config.mode, status: 'closed',
    $or: [{ tp1ScaledOut: { $ne: true } }, { tp1ScaledOut: { $exists: false } }],
  }).sort({ exitAt: -1 }).limit(5).lean()
  let lossStreak = 0
  for (const p of recentClosed) { if ((p.realizedPnlUsd ?? 0) < 0) lossStreak++; else break }
  const drawdownSizeMultiplier = lossStreak >= 3 ? 0.5 : lossStreak >= 2 ? 0.75 : 1.0
  const drawdownNote = lossStreak >= 2 ? ` [⚠ ${lossStreak}-loss streak → ${drawdownSizeMultiplier * 100}% size]` : ''

  // ── ATR noise check: half size if SL distance < 0.5×ATR ─────────────────
  const atr14 = primitives.indicators?.atr_14 ?? 0
  let atrSizeMultiplier = 1.0
  let atrNote = ''
  if (atr14 > 0 && worstFillEntry > 0) {
    const slDistAbs = Math.abs(worstFillEntry - best.signal!.stop_loss)
    const halfAtr   = atr14 * 0.5
    if (slDistAbs < halfAtr) {
      atrSizeMultiplier = 0.5
      atrNote = ` [⚠ SL $${slDistAbs.toFixed(0)} < 0.5×ATR $${halfAtr.toFixed(0)} — inside noise, size halved]`
    }
  }

  // ── SL buffer: push SL 0.3×ATR past structural level to survive wicks ─────
  const slBufferAbs = atr14 > 0 ? atr14 * 0.3 : 0
  const adjustedSL  = best.signal!.bias === 'long'
    ? parseFloat((best.signal!.stop_loss - slBufferAbs).toFixed(4))
    : parseFloat((best.signal!.stop_loss + slBufferAbs).toFixed(4))
  const slBufferNote = slBufferAbs > 0 ? ` [SL buffered 0.3×ATR $${slBufferAbs.toFixed(0)} beyond structural level]` : ''

  const MIN_TRADE_USD = 20  // exchange minimums; below this fees eat all profit
  const finalTradeAmount = tradeAmount * drawdownSizeMultiplier * atrSizeMultiplier * volumeSizeMultiplier
  if (finalTradeAmount < MIN_TRADE_USD) {
    skipAll(`[Min trade] Computed size $${finalTradeAmount.toFixed(2)} below $${MIN_TRADE_USD} minimum (after drawdown/ATR/vol multipliers) — not worth the fee drag`)
    return 'completed'
  }
  const regimeNote = regime.warning ? ` [${regime.warning}]` : ` [regime: ${regime.regime} ADX ${regime.adx.toFixed(0)}]`

  const signalBiasDir = best.signal!.bias as 'long' | 'short'
  const intent: TradeIntent = {
    type:             'propose_trade',
    tokenIn:          'USDC',
    tokenOut:         symbol,
    amountUsd:        finalTradeAmount,
    maxSlippageBps:   50,
    rationale:        best.signal!.reasoning +
                      (agreeingCount >= 2 ? ` [${agreeingCount} frameworks confluent]` : '') +
                      ` [risk-sized: $${maxRiskUsd.toFixed(0)} max-risk / ${(slDistance * 100).toFixed(1)}% SL = $${finalTradeAmount.toFixed(0)} notional]` +
                      volumeTag + drawdownNote + atrNote + slBufferNote + regimeNote + fundingNote + btcMomentum.note,
    stopLossPrice:    adjustedSL,
    takeProfitPrice:  best.signal!.take_profit_levels[0],
    takeProfitPrice2: best.signal!.take_profit_levels[1],
    entryZoneLow:     best.signal!.entry_zone.low,
    entryZoneHigh:    best.signal!.entry_zone.high,
    framework:        best.framework,
    bias:             signalBiasDir,
  } as TradeIntent & { takeProfitPrice2?: number }

  await executeIntent(intent, walletState, {
    userId, config, runId: coinAnalysisRunId, strategy: 'chartSignal',
    rationale: intent.rationale, confidence: adjustedConf,
  })

  console.log(
    `[AUTO_EXECUTE] ${symbol} ${signalBiasDir.toUpperCase()} — ${best.framework} ${adjustedConf}% conf` +
    ` | entry $${best.signal!.entry_zone.low}–$${best.signal!.entry_zone.high}` +
    ` | SL $${adjustedSL} | TP $${best.signal!.take_profit_levels[0]}` +
    ` | size $${finalTradeAmount.toFixed(0)} (risk $${maxRiskUsd.toFixed(0)})` +
    ` | user ${userId}`,
  )

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
  const running = await CoinAnalysisRunDoc.findOne({ userId, symbol: symbol.toUpperCase(), status: 'running' }).lean()
  if (running) {
    throw Object.assign(new Error(`Analysis for ${symbol} already in progress`), { statusCode: 409 })
  }

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
    console.log(`[CoinAnalysis] ${coinAnalysisRunId} [1/6] Ingesting news for ${symbol}…`)
    const { articles, articleIds } = await ingestAndFetchNews(userId, symbol)
    console.log(`[CoinAnalysis] ${coinAnalysisRunId} [1/6] News done — ${articles.length} articles`)

    // 2. Market primitives — ONE fetch shared by all 4 cards
    console.log(`[CoinAnalysis] ${coinAnalysisRunId} [2/6] Fetching market primitives for ${binanceSymbol}…`)
    const primitives = await buildMarketPrimitives(binanceSymbol)
    console.log(`[CoinAnalysis] ${coinAnalysisRunId} [2/6] Primitives done — trend=${primitives.structure?.trend_htf} ADX=${primitives.indicators?.adx?.toFixed(0)}`)

    // 3. RAG memory context
    console.log(`[CoinAnalysis] ${coinAnalysisRunId} [3/6] Retrieving memory context…`)
    const contextSummary = `Chart analysis for ${symbol.toUpperCase()} — ${new Date().toISOString()}`
    let memoryContext: string | undefined
    try {
      const memResult = await retrieve(userId, symbol.toUpperCase(), contextSummary)
      memoryContext = renderMemorySection(memResult) || undefined
    } catch { /* non-fatal */ }
    console.log(`[CoinAnalysis] ${coinAnalysisRunId} [3/6] Memory done — ${memoryContext ? 'context loaded' : 'no prior memory'}`)

    // 4. All 4 strategy cards in parallel
    console.log(`[CoinAnalysis] ${coinAnalysisRunId} [4/6] Running ${FRAMEWORKS.length} strategy frameworks in parallel…`)
    const cards = await Promise.all(
      FRAMEWORKS.map(fw =>
        runStrategyCard(fw, symbol.toUpperCase(), binanceSymbol, primitives, articles, memoryContext, config),
      ),
    )
    for (const card of cards) {
      const summary = card.signal
        ? `${card.signal.bias.toUpperCase()} ${card.signal.confidence}% — ${card.signal.setup_name}`
        : `skipped (${card.skippedReason ?? 'no signal'})`
      console.log(`[CoinAnalysis] ${coinAnalysisRunId} [4/6]   ${card.framework}: ${summary}`)
    }

    // 5. Build cards summary for policy engine + logging
    console.log(`[CoinAnalysis] ${coinAnalysisRunId} [5/6] Building cards summary…`)
    const cardsSummary = buildCardsSummary(cards, symbol.toUpperCase())

    // 6. Route: auto-execute or mark pending
    console.log(`[CoinAnalysis] ${coinAnalysisRunId} [6/6] Loading wallet & routing (autoMode=${autoMode})…`)
    const walletState = await loadWalletState(userId, config)
    let finalStatus: CoinAnalysisRunStatus
    if (autoMode) {
      finalStatus = await autoExecuteBest(
        userId, coinAnalysisRunId, symbol.toUpperCase(), cards, config, walletState, memoryContext, cardsSummary, primitives,
      )
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

  // ── Re-check signal age ───────────────────────────────────────────────────
  const run2 = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId, userId }).lean()
  if (run2?.startedAt) {
    const ageH = (Date.now() - new Date(run2.startedAt).getTime()) / 3_600_000
    if (ageH > 6) throw Object.assign(new Error(`Signal is ${ageH.toFixed(0)}h old — too stale to approve (max 6h)`), { statusCode: 400 })
  }

  // ── Re-enforce min R:R at approval time ──────────────────────────────────
  const apEntry  = card.signal.bias === 'long' ? card.signal.entry_zone.high : card.signal.entry_zone.low
  const apRisk   = apEntry > 0 && card.signal.stop_loss > 0 ? Math.abs(apEntry - card.signal.stop_loss) / apEntry : 0
  const apReward = apEntry > 0 && card.signal.take_profit_levels[0] ? Math.abs(card.signal.take_profit_levels[0] - apEntry) / apEntry : 0
  const apRawRr  = apRisk > 0 ? apReward / apRisk : 0
  if (apRawRr < 1.5) throw Object.assign(new Error(`R:R ${apRawRr.toFixed(2)} (worst-case fill) below minimum 1.5 — cannot approve`), { statusCode: 400 })

  // ── Re-check session risk — signal from 2pm cannot fire at 10:30pm dead zone ──
  const approvalSession = getSessionRisk()
  if (approvalSession.block) {
    throw Object.assign(new Error(`Session blocked at approval time [${approvalSession.session}]: ${approvalSession.reason}`), { statusCode: 400 })
  }

  const config      = await getOrCreateConfig(userId)
  const walletState = await loadWalletState(userId, config)

  // ── Live price zone validity — reject if price has already run past the entry zone ──
  try {
    const priceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${run.symbol}USDT`)
    if (priceRes.ok) {
      const priceData = await priceRes.json() as { price: string }
      const livePrice = parseFloat(priceData.price)
      const zoneLow  = card.signal.entry_zone.low
      const zoneHigh = card.signal.entry_zone.high
      const isLongSig = card.signal.bias === 'long'
      // Long: reject if price ran >5% above zone (chased) or >5% below zone (thesis dead)
      // Short: opposite
      const chased  = isLongSig  ? livePrice > zoneHigh * 1.05 : livePrice < zoneLow * 0.95
      const thesis  = isLongSig  ? livePrice < zoneLow  * 0.95 : livePrice > zoneHigh * 1.05
      if (chased) throw Object.assign(new Error(`Price $${livePrice.toFixed(4)} ran >5% past entry zone ($${zoneHigh.toFixed(4)}) — ${card.signal.bias} thesis is chasing`), { statusCode: 400 })
      if (thesis) throw Object.assign(new Error(`Price $${livePrice.toFixed(4)} broke >5% below entry zone ($${zoneLow.toFixed(4)}) — ${card.signal.bias} thesis invalidated`), { statusCode: 400 })
    }
  } catch (e: any) { if (e.statusCode) throw e /* rethrow our own errors; swallow fetch failures */ }

  // ── Re-check live portfolio state ─────────────────────────────────────────
  const livePositions = await PositionDoc.find({ userId, mode: config.mode, status: { $in: ['open', 'pending'] } }).lean()
  const liveOpen = livePositions.filter(p => p.status === 'open')
  const maxPositions = config.maxConcurrentPositions ?? 6
  if (livePositions.length >= maxPositions) {
    throw Object.assign(new Error(`Cannot approve: ${livePositions.length} open/pending positions at max ${maxPositions}`), { statusCode: 400 })
  }

  // Portfolio heat at approval time using live prices
  const openSymbols = [...new Set(liveOpen.map(p => p.tokenOut))]
  const livePricesMap: Record<string, number> = {}
  await Promise.all(openSymbols.map(async sym => {
    try {
      const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}USDT`)
      if (r.ok) { const d = await r.json() as { price: string }; livePricesMap[sym] = parseFloat(d.price) }
    } catch {}
  }))
  let liveHeatUsd = 0
  for (const pos of liveOpen) {
    if (!pos.entryPrice || !pos.stopLossPrice || !pos.entryAmountUsd) continue
    const lp = livePricesMap[pos.tokenOut] ?? pos.entryPrice
    liveHeatUsd += Math.max(0, Math.abs(lp - pos.stopLossPrice) * (pos.entryAmountUsd / pos.entryPrice))
  }
  const heatCapUsd = (walletState.totalValueUsd ?? 10_000) * ((config.maxPortfolioHeatPct ?? 5.0) / 100)
  if (liveHeatUsd >= heatCapUsd) {
    throw Object.assign(new Error(`Cannot approve: live portfolio heat $${liveHeatUsd.toFixed(0)} already at ${config.maxPortfolioHeatPct ?? 5}% cap ($${heatCapUsd.toFixed(0)})`), { statusCode: 400 })
  }

  const adjustedConf = card.signal.confidence + card.newsImpact.confidenceDelta

  // ── Portfolio-derived sizing with maxRiskPerTradeUsd cap ─────────────────
  const worstApEntry = card.signal.bias === 'long' ? card.signal.entry_zone.high : card.signal.entry_zone.low
  const slDistance   = worstApEntry > 0 && card.signal.stop_loss > 0 ? Math.abs(worstApEntry - card.signal.stop_loss) / worstApEntry : 0.02
  const apRiskPct    = (config.riskPerTradePct ?? 1.0) / 100
  const portfolioRisk = (walletState.totalValueUsd ?? 0) * apRiskPct
  const apMaxRiskUsd  = Math.min(portfolioRisk, config.maxRiskPerTradeUsd ?? 150)
  const riskBasedSize = slDistance > 0 ? apMaxRiskUsd / slDistance : config.maxTradeUsd
  const tradeAmount   = Math.min(riskBasedSize, config.maxTradeUsd)

  const recentClosed2 = await PositionDoc.find({
    userId, mode: config.mode, status: 'closed',
    $or: [{ tp1ScaledOut: { $ne: true } }, { tp1ScaledOut: { $exists: false } }],
  }).sort({ exitAt: -1 }).limit(5).lean()
  let lossStreak2 = 0
  for (const p of recentClosed2) { if ((p.realizedPnlUsd ?? 0) < 0) lossStreak2++; else break }
  const ddMult = lossStreak2 >= 3 ? 0.5 : lossStreak2 >= 2 ? 0.75 : 1.0
  const finalAmount = Math.max(20, tradeAmount * ddMult)  // enforce min trade size

  const intent: TradeIntent = {
    type:             'propose_trade',
    tokenIn:          'USDC',
    tokenOut:         run.symbol,
    amountUsd:        finalAmount,
    maxSlippageBps:   50,
    rationale:        card.signal.reasoning +
                      ` [manual approve · risk $${apMaxRiskUsd.toFixed(0)} / ${(slDistance * 100).toFixed(1)}% SL = $${finalAmount.toFixed(0)}]` +
                      (lossStreak2 >= 2 ? ` [⚠ ${lossStreak2}-loss streak → ${ddMult * 100}% size]` : ''),
    stopLossPrice:    card.signal.stop_loss,
    takeProfitPrice:  card.signal.take_profit_levels[0],
    takeProfitPrice2: card.signal.take_profit_levels[1],
    entryZoneLow:     card.signal.entry_zone.low,
    entryZoneHigh:    card.signal.entry_zone.high,
    framework:        card.framework,
    bias:             card.signal.bias as 'long' | 'short',
  } as TradeIntent & { takeProfitPrice2?: number }

  const gateway = await executeIntent(intent, walletState, {
    userId, config, runId: coinAnalysisRunId, strategy: 'chartSignal',
    rationale: card.signal.reasoning, confidence: adjustedConf,
  })

  await CoinAnalysisRunDoc.updateOne(
    { coinAnalysisRunId, 'strategyCards.framework': framework },
    { $set: { 'strategyCards.$.approvalStatus': 'approved' } },
  )

  // Mark run completed once all pending cards are resolved
  const updated = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId, userId }).lean()
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

  const updated = await CoinAnalysisRunDoc.findOne({ coinAnalysisRunId, userId }).lean()
  const allDone = updated?.strategyCards.every(c => c.approvalStatus !== 'pending') ?? false
  if (allDone) {
    await CoinAnalysisRunDoc.updateOne({ coinAnalysisRunId }, { $set: { status: 'completed', completedAt: new Date() } })
  }
}

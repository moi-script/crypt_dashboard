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

const CORRELATED_GROUPS: Set<string>[] = [
  new Set(['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'MATIC', 'ARB', 'OP', 'NEAR', 'APT', 'SUI', 'INJ']),
]

// ── Session / macro-event risk ────────────────────────────────────────────────

function getSessionRisk(): { session: string; block: boolean; reason?: string } {
  const now = new Date()
  const h   = now.getUTCHours()
  const m   = now.getUTCMinutes()
  const day = now.getUTCDay()

  if (h >= 21) {
    return { session: 'Dead Zone', block: true, reason: `Post-NY dead zone (${h}:${String(m).padStart(2, '0')} UTC) — skip new entries` }
  }
  if (day === 5 && h >= 12 && (h < 14 || (h === 14 && m < 30))) {
    return { session: 'NFP Window', block: true, reason: 'Friday 12:15–14:30 UTC NFP window — high slippage, skipping' }
  }
  if (day === 3 && h >= 18 && h < 20) {
    return { session: 'FOMC Window', block: false, reason: 'Wednesday FOMC window — confidence threshold raised +10' }
  }
  const sessionName = h < 8 ? 'Asian' : h < 16 ? 'London' : 'New York'
  return { session: sessionName, block: false }
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
): Promise<CoinAnalysisRunStatus> {
  // ── Session / macro-event gate ────────────────────────────────────────────
  const sessionRisk = getSessionRisk()
  if (sessionRisk.block) {
    for (const card of cards) {
      card.approvalStatus = 'skipped'
      if (card.signal) card.skippedReason = `Session blocked [${sessionRisk.session}]: ${sessionRisk.reason}`
    }
    return 'completed'
  }

  // ── De-duplication: don't stack positions in the same symbol ──────────────
  const allOpen = await PositionDoc.find({ userId, isOpen: true, mode: config.mode }).lean()

  const alreadyOpen = allOpen.filter(p => p.tokenOut === symbol.toUpperCase()).length
  if (alreadyOpen > 0) {
    for (const card of cards) {
      card.approvalStatus = 'skipped'
      if (card.signal) card.skippedReason = `Already in open ${symbol} position — skipping to avoid stacking`
    }
    return 'completed'
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

  // ── Confidence threshold — raise during FOMC window ──────────────────────
  const confidenceThreshold = config.minSignalConfidence + (sessionRisk.session === 'FOMC Window' ? 10 : 0)

  const qualifying = cards.filter(c =>
    c.signal !== null &&
    (c.signal.bias === 'long' || config.allowShorts) &&
    (c.signal.confidence + c.newsImpact.confidenceDelta) >= confidenceThreshold,
  )

  if (!qualifying.length) {
    for (const card of cards) {
      card.approvalStatus = 'skipped'
      if (card.signal && !card.skippedReason) {
        const adj = card.signal.confidence + card.newsImpact.confidenceDelta
        card.skippedReason = `Confidence ${adj} below threshold ${confidenceThreshold}${sessionRisk.session === 'FOMC Window' ? ' (+10 FOMC)' : ''}`
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

  // ── Confluence bonus: 2+ frameworks agree → increase position size ─────────
  const agreeingCount = qualifying.filter(c => c.signal?.bias === best.signal!.bias).length
  const confluenceMultiplier = Math.min(2, 1 + (agreeingCount - 1) * 0.25)

  // ── Portfolio-derived position sizing (risk-based) ─────────────────────────
  // Risk 1% of portfolio per trade, sized from SL distance. Cap at maxTradeUsd.
  const entryMid   = (best.signal!.entry_zone.low + best.signal!.entry_zone.high) / 2
  const slDistance = entryMid > 0 && best.signal!.stop_loss > 0
    ? Math.abs(entryMid - best.signal!.stop_loss) / entryMid
    : 0.02
  const portfolioRisk  = (walletState.totalValueUsd ?? 0) * 0.01
  const riskBasedSize  = slDistance > 0 ? portfolioRisk / slDistance : config.maxTradeUsd
  const tradeAmount    = Math.min(riskBasedSize * confluenceMultiplier, config.maxTradeUsd)

  // ── Volume check — flag low-liquidity setups in the rationale ─────────────
  const vol24h    = await fetch24hVolumeUsd(`${symbol}USDT`)
  const volumeTag = vol24h !== null
    ? ` [vol $${(vol24h / 1e6).toFixed(0)}M${vol24h < 30_000_000 ? ' ⚠ low-vol' : ''}]`
    : ''

  // ── Drawdown-based size reduction: cut size after consecutive losses ─────────
  const recentClosed = await PositionDoc.find({ userId, mode: config.mode, status: 'closed' })
    .sort({ exitAt: -1 }).limit(5).lean()
  let lossStreak = 0
  for (const p of recentClosed) { if ((p.realizedPnlUsd ?? 0) < 0) lossStreak++; else break }
  const drawdownSizeMultiplier = lossStreak >= 3 ? 0.5 : lossStreak >= 2 ? 0.75 : 1.0
  const finalTradeAmount = tradeAmount * drawdownSizeMultiplier
  const drawdownNote = lossStreak >= 2 ? ` [⚠ ${lossStreak}-loss streak → ${drawdownSizeMultiplier * 100}% size]` : ''

  const intent: TradeIntent = {
    type:             'propose_trade',
    tokenIn:          'USDC',
    tokenOut:         symbol,
    amountUsd:        finalTradeAmount,
    maxSlippageBps:   50,
    rationale:        best.signal!.reasoning +
                      (agreeingCount >= 2 ? ` [${agreeingCount} frameworks confluent → ${confluenceMultiplier.toFixed(2)}× size]` : '') +
                      ` [risk-sized: 1% of $${(walletState.totalValueUsd ?? 0).toFixed(0)} / ${(slDistance * 100).toFixed(1)}% SL = $${finalTradeAmount.toFixed(0)}]` +
                      volumeTag + drawdownNote,
    stopLossPrice:    best.signal!.stop_loss,
    takeProfitPrice:  best.signal!.take_profit_levels[0],
    takeProfitPrice2: best.signal!.take_profit_levels[1],
    entryZoneLow:     best.signal!.entry_zone.low,
    entryZoneHigh:    best.signal!.entry_zone.high,
    framework:        best.framework,
  } as TradeIntent & { takeProfitPrice2?: number }

  await executeIntent(intent, walletState, {
    userId, config, runId: coinAnalysisRunId, strategy: 'chartSignal',
    rationale: intent.rationale, confidence: adjustedConf,
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
        runStrategyCard(fw, symbol.toUpperCase(), binanceSymbol, primitives, articles, memoryContext, config),
      ),
    )

    // 5. Build cards summary for policy engine + logging
    const cardsSummary = buildCardsSummary(cards, symbol.toUpperCase())

    // 6. Route: auto-execute or mark pending
    const walletState = await loadWalletState(userId, config)
    let finalStatus: CoinAnalysisRunStatus
    if (autoMode) {
      finalStatus = await autoExecuteBest(
        userId, coinAnalysisRunId, symbol.toUpperCase(), cards, config, walletState, memoryContext, cardsSummary,
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

  const config      = await getOrCreateConfig(userId)
  const walletState = await loadWalletState(userId, config)
  const adjustedConf = card.signal.confidence + card.newsImpact.confidenceDelta

  // Portfolio-derived sizing (same logic as autoExecuteBest)
  const entryMid     = (card.signal.entry_zone.low + card.signal.entry_zone.high) / 2
  const slDistance   = entryMid > 0 && card.signal.stop_loss > 0 ? Math.abs(entryMid - card.signal.stop_loss) / entryMid : 0.02
  const riskBasedSize = slDistance > 0 ? ((walletState.totalValueUsd ?? 0) * 0.01) / slDistance : config.maxTradeUsd
  const tradeAmount  = Math.min(riskBasedSize, config.maxTradeUsd)

  const recentClosed2 = await PositionDoc.find({ userId, mode: config.mode, status: 'closed' })
    .sort({ exitAt: -1 }).limit(5).lean()
  let lossStreak2 = 0
  for (const p of recentClosed2) { if ((p.realizedPnlUsd ?? 0) < 0) lossStreak2++; else break }
  const ddMult = lossStreak2 >= 3 ? 0.5 : lossStreak2 >= 2 ? 0.75 : 1.0
  const finalAmount = tradeAmount * ddMult

  const intent: TradeIntent = {
    type:             'propose_trade',
    tokenIn:          'USDC',
    tokenOut:         run.symbol,
    amountUsd:        finalAmount,
    maxSlippageBps:   50,
    rationale:        card.signal.reasoning + ` [manual approve · risk-sized: 1% of $${(walletState.totalValueUsd ?? 0).toFixed(0)} / ${(slDistance * 100).toFixed(1)}% SL = $${finalAmount.toFixed(0)}]` + (lossStreak2 >= 2 ? ` [⚠ ${lossStreak2}-loss streak → ${ddMult * 100}% size]` : ''),
    stopLossPrice:    card.signal.stop_loss,
    takeProfitPrice:  card.signal.take_profit_levels[0],
    takeProfitPrice2: card.signal.take_profit_levels[1],
    entryZoneLow:     card.signal.entry_zone.low,
    entryZoneHigh:    card.signal.entry_zone.high,
    framework:        card.framework,
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

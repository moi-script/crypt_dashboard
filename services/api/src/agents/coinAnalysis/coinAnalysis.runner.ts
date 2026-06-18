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

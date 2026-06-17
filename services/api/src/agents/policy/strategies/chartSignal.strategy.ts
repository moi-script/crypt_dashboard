/**
 * chartSignal.strategy.ts
 *
 * Deterministically wires the four existing chart strategies (SmartMoney,
 * Wyckoff, Elliott, Harmonic) into the agent loop. Unlike every other
 * strategy, this one never asks the LLM whether to act — the chart
 * strategies already compute bias, entry, stop loss, take profit, and
 * confidence, so the decision is made entirely in code via
 * `metadata.deterministicDecision`.
 *
 * Only BTC and ETH are considered — they're the only crypto symbols on
 * the risk engine's ALLOWED_TOKENS list (risk.rules.ts), so any other
 * symbol's signal would be blocked downstream regardless.
 *
 * Short-biased signals are never acted on: the paper wallet is spot-only
 * and cannot simulate a short position.
 */

import type { Strategy, StrategyResult, ChartStrategyResult } from './strategy.types'
import type { LoopContext, Decision, TradeIntent, NoActionIntent } from '../../loop/loop.types'
import { buildMarketPrimitives } from '../../../services/chartAnalysis.service'
import { runSmartMoneyStrategy } from './smartMoney.strategy'
import { runWyckoffStrategy } from './wyckoff.strategy'
import { runElliottStrategy } from './elliott.strategy'
import { runHarmonicStrategy } from './harmonic.strategy'
import { PositionDoc } from '../../../models/position.model'
import type { AgentConfig } from '../../../config/agent.config'
import { ohlcvIngest }          from '../../../read/ingestion/ohlcv.ingest'
import { extractZigZagPivots }  from '../../skills/structure.skill'
import type { ChartSnapshot, ChartOverlay } from '../../loop/loop.types'
import type { MarketPrimitives } from '../../chartAnalysis.types'

async function buildChartSnapshot(
  symbol: string,
  binanceSymbol: string,
  primitives: MarketPrimitives,
  signal: import('./strategy.types').TradeSignal,
): Promise<ChartSnapshot> {
  // Fetch 4H candles (cache hit — buildMarketPrimitives already fetched them)
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
        p1: { time: h1.timestamp, price: h1.price },
        p2: { time: h2.timestamp, price: h2.price },
        direction: h2.price < h1.price ? 'down' : 'up',
      })
    }
    if (lows.length >= 2) {
      const l1 = lows[lows.length - 2]
      const l2 = lows[lows.length - 1]
      trendlines.push({
        p1: { time: l1.timestamp, price: l1.price },
        p2: { time: l2.timestamp, price: l2.price },
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

  // Framework-specific overlays
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
      xabcd:    { X: h.xabcd.X, A: h.xabcd.A, B: h.xabcd.B, C: h.xabcd.C, D: h.xabcd.D },
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

const TRADABLE_SYMBOLS: Array<{ symbol: string; binanceSymbol: string }> = [
  { symbol: 'BTC', binanceSymbol: 'BTCUSDT' },
  { symbol: 'ETH', binanceSymbol: 'ETHUSDT' },
]

function noActionDecision(rationale: string): Decision {
  const intent: NoActionIntent = { type: 'no_action', rationale }
  return { intent, confidence: 0, reasoning: rationale, toolCallTrace: [] }
}

export const chartSignalStrategy: Strategy = {
  name: 'chartSignal',
  description: 'Runs SmartMoney/Wyckoff/Elliott/Harmonic chart strategies against BTC/ETH and trades the best qualifying long signal',

  async buildContext(ctx: LoopContext): Promise<StrategyResult> {
    const config = ctx.config as AgentConfig

    // Skip symbols that already have a pending (limit order awaiting fill) or
    // open position — don't stack duplicate orders each tick.
    const openSymbols = new Set(
      await PositionDoc.find({
        userId: ctx.userId,
        mode: 'paper',
        status: { $in: ['pending', 'open'] },
      }).distinct('tokenOut'),
    )

    const lines: string[] = [`=== CHART SIGNAL — ${new Date().toISOString()} ===`]
    const candidates: Array<{ symbol: string; binanceSymbol: string; result: ChartStrategyResult; primitives: MarketPrimitives }> = []

    for (const { symbol, binanceSymbol } of TRADABLE_SYMBOLS) {
      if (openSymbols.has(symbol)) {
        lines.push(`${symbol}: skipped — position already open`)
        continue
      }

      let results: ChartStrategyResult[]
      let primitives: MarketPrimitives
      try {
        primitives = await buildMarketPrimitives(binanceSymbol)
        results = [
          runSmartMoneyStrategy(primitives),
          runWyckoffStrategy(primitives),
          runElliottStrategy(primitives),
          runHarmonicStrategy(primitives),
        ]
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        lines.push(`${symbol}: skipped — primitives fetch failed: ${message}`)
        continue
      }

      for (const result of results) {
        if (result.skipped || !result.signal) {
          lines.push(`${symbol}: skipped — ${result.skip_reason}`)
          continue
        }
        if (result.signal.bias !== 'long') {
          lines.push(`${symbol}: skipped — short bias not supported (${result.signal.framework})`)
          continue
        }
        lines.push(
          `${symbol}: ${result.signal.framework} signal — confidence ${result.signal.confidence}, ` +
          `SL ${result.signal.stop_loss}, TP ${result.signal.take_profit_levels[0]}`,
        )
        candidates.push({ symbol, binanceSymbol, result, primitives })
      }
    }

    const qualifying = candidates.filter(c =>
      (c.result.signal?.confidence ?? 0) >= config.minSignalConfidence,
    )
    const best = qualifying.sort((a, b) => (b.result.signal!.confidence) - (a.result.signal!.confidence))[0]

    let deterministicDecision: Decision
    if (!best) {
      const rationale = candidates.length > 0
        ? `${candidates.length} signal(s) found but none reached minSignalConfidence (${config.minSignalConfidence})`
        : 'No qualifying long signal from any chart strategy this tick'
      deterministicDecision = noActionDecision(rationale)
    } else {
      const signal = best.result.signal!
      const intent: TradeIntent = {
        type: 'propose_trade',
        tokenIn: 'USDC',
        tokenOut: best.symbol,
        amountUsd: config.maxTradeUsd,
        maxSlippageBps: 50,
        rationale: signal.reasoning,
        stopLossPrice: signal.stop_loss,
        takeProfitPrice: signal.take_profit_levels[0],
        entryZoneLow: signal.entry_zone.low,
        entryZoneHigh: signal.entry_zone.high,
        framework: signal.framework,
      }
      deterministicDecision = {
        intent,
        confidence: signal.confidence,
        reasoning: signal.reasoning,
        toolCallTrace: [`chartSignal:${signal.framework}`],
      }
      lines.push(`>>> ACTING on ${best.symbol} ${signal.framework} signal (confidence ${signal.confidence})`)

      // Build chart snapshot (best-effort; errors don't fail the tick)
      let chartSnapshot: ChartSnapshot | undefined
      try {
        chartSnapshot = await buildChartSnapshot(best.symbol, best.binanceSymbol ?? `${best.symbol}USDT`, best.primitives, signal)
      } catch { /* non-fatal */ }

      return {
        strategyName: 'chartSignal',
        contextSummary: lines.join('\n'),
        metadata: { candidatesConsidered: candidates.length, deterministicDecision, chartSnapshot },
        deterministicDecision,
      }
    }

    return {
      strategyName: 'chartSignal',
      contextSummary: lines.join('\n'),
      metadata: { candidatesConsidered: candidates.length, deterministicDecision },
      deterministicDecision,
    }
  },
}

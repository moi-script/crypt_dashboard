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

    const openSymbols = new Set(
      await PositionDoc.find({ userId: ctx.userId, isOpen: true, mode: 'paper' }).distinct('tokenOut'),
    )

    const lines: string[] = [`=== CHART SIGNAL — ${new Date().toISOString()} ===`]
    const candidates: Array<{ symbol: string; result: ChartStrategyResult }> = []

    for (const { symbol, binanceSymbol } of TRADABLE_SYMBOLS) {
      if (openSymbols.has(symbol)) {
        lines.push(`${symbol}: skipped — position already open`)
        continue
      }

      let results: ChartStrategyResult[]
      try {
        const primitives = await buildMarketPrimitives(binanceSymbol)
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
        candidates.push({ symbol, result })
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
        framework: signal.framework,
      }
      deterministicDecision = {
        intent,
        confidence: signal.confidence,
        reasoning: signal.reasoning,
        toolCallTrace: [`chartSignal:${signal.framework}`],
      }
      lines.push(`>>> ACTING on ${best.symbol} ${signal.framework} signal (confidence ${signal.confidence})`)
    }

    return {
      strategyName: 'chartSignal',
      contextSummary: lines.join('\n'),
      metadata: { candidatesConsidered: candidates.length, deterministicDecision },
      deterministicDecision,
    }
  },
}

// ============================================================
// strategy.types.ts
// Shared types for strategy output — used by all chart strategy files
// AND the agent loop (Strategy / StrategyResult).
// ============================================================

import type { LoopContext } from '../../loop/loop.types'

// ── Chart analysis strategy types ────────────────────────────────────────────

export interface TradeSignal {
  symbol:              string
  framework:           'SmartMoney' | 'Wyckoff' | 'ElliottWave' | 'Harmonic'
  bias:                'long' | 'short'
  setup_name:          string
  entry_zone:          { high: number; low: number }
  stop_loss:           number
  take_profit_levels:  number[]
  risk_reward:         number
  confidence:          number       // 0–100
  invalidation:        string
  reasoning:           string
  confluence_factors:  string[]
  generated_at:        string       // ISO timestamp
}

export interface ChartStrategyResult {
  signal:       TradeSignal | null
  skipped:      boolean
  skip_reason?: string
}

// ── Agent loop strategy types ─────────────────────────────────────────────────
// Used by: agent.loop.ts, yieldHunter.strategy.ts, rebalance.strategy.ts,
//          airdropWatch.strategy.ts

export interface StrategyResult {
  strategyName:   string
  contextSummary: string
  metadata:       Record<string, unknown>
}

export interface Strategy {
  name:        string
  description: string
  buildContext(ctx: LoopContext): Promise<StrategyResult>
}
/**
 * agent.config.ts
 *
 * Central configuration for the autonomous agent loop.
 * Mutate at runtime via PUT /api/agent-runs/config (admin only).
 * On restart the values reset to these defaults unless persisted elsewhere.
 *
 * Hard rule: default mode is ALWAYS 'paper'. Real execution requires
 * explicit opt-in + small caps.
 */

export type AgentMode = 'paper' | 'cex' | 'onchain'

export interface AgentConfig {
  /** Master kill switch — set false to halt the loop AND block all execution */
  enabled: boolean

  /** Execution mode — starts at paper, graduates to cex/onchain manually */
  mode: AgentMode

  /** Loop interval in milliseconds */
  loopIntervalMs: number

  /** Which strategies are active this run */
  strategies: {
    yieldHunter: boolean
    rebalance: boolean
    airdropWatch: boolean
    chartSignal: boolean
  }

  /** Minimum confidence (0-100) a chart-signal must have to be acted on */
  minSignalConfidence: number

  /** Coins/tokens the agent is allowed to reason about */
  watchlist: string[]

  /** Maximum $ value per simulated trade (paper or real) */
  maxTradeUsd: number

  /** If true, every proposed action pauses for manual approval via the API */
  requireManualApproval: boolean

  /** Coin pinned for on-demand analysis runs (e.g. "BTC"). watchlist[0] is used for scheduled runs. */
  selectedCoin?: string

  /** Allow short positions. Defaults false (spot/paper only goes long). Enable when margin/perp trading is available. */
  allowShorts?: boolean

  /** Risk per trade as % of portfolio (default 1.0). Range 0.25–3.0. */
  riskPerTradePct?: number

  /** Max total open-position risk as % of portfolio before blocking new entries (default 5.0). */
  maxPortfolioHeatPct?: number

  /** Hard cap on concurrent open positions regardless of correlation (default 6). */
  maxConcurrentPositions?: number

  /** Maximum dollar risk per trade regardless of portfolio %. Prevents giant positions on tiny SL distances (default $150). */
  maxRiskPerTradeUsd?: number
}

/** Seed values for a brand-new per-user agent config. */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: false,
  mode: 'paper',
  loopIntervalMs: 60_000,
  strategies: { yieldHunter: true, rebalance: false, airdropWatch: false, chartSignal: false },
  watchlist: ['bitcoin', 'ethereum', 'usd-coin', 'tether'],
  maxTradeUsd: 100,
  requireManualApproval: true,
  minSignalConfidence: 55,
  allowShorts: false,
  riskPerTradePct: 1.0,
  maxPortfolioHeatPct: 5.0,
  maxConcurrentPositions: 6,
  maxRiskPerTradeUsd: 150,
}

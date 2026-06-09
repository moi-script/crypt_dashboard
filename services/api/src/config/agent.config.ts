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
  }

  /** Coins/tokens the agent is allowed to reason about */
  watchlist: string[]

  /** Maximum $ value per simulated trade (paper or real) */
  maxTradeUsd: number

  /** If true, every proposed action pauses for manual approval via the API */
  requireManualApproval: boolean
}

/** Live config object — mutate this to change behaviour at runtime */
export const agentConfig: AgentConfig = {
  enabled: false,          // Start halted — operator must explicitly enable
  mode: 'paper',           // Paper mode only until Phase 2 is approved
  loopIntervalMs: 60_000,  // Every 60 seconds
  strategies: {
    yieldHunter:  true,
    rebalance:    false,   // Phase 1+
    airdropWatch: false,   // Phase 1+
  },
  watchlist: ['bitcoin', 'ethereum', 'usd-coin', 'tether'],
  maxTradeUsd: 100,
  requireManualApproval: true,
}

/** Patch config — called by the admin controller */
export function patchConfig(patch: Partial<AgentConfig>): void {
  // Safety: never allow upgrading mode via patch without also having requireManualApproval=true
  if (patch.mode && patch.mode !== 'paper' && patch.requireManualApproval === false) {
    throw new Error('Cannot disable manual approval while upgrading to live execution mode')
  }
  Object.assign(agentConfig, patch)
}

/**
 * airdropWatch.strategy.ts
 *
 * Read-only monitor for airdrop / points farming opportunities.
 * Does not propose trades — only sets alerts and produces context for the LLM.
 *
 * In Phase 0/1: monitor mode only (logs to OpportunityDoc, no execution).
 * Later: can propose small on-chain interactions to farm eligibility.
 */

import type { Strategy, StrategyResult } from './strategy.types'
import type { LoopContext } from '../../loop/loop.types'

// Known protocols worth monitoring for airdrops
// In production this would be a DB-backed configurable list
const WATCH_PROTOCOLS = [
  { name: 'Hyperliquid', chain: 'hyperliquid', category: 'perp_dex',    tvlMinUsd: 100_000_000 },
  { name: 'Berachain',   chain: 'berachain',   category: 'l1',          tvlMinUsd:  50_000_000 },
  { name: 'Monad',       chain: 'monad',       category: 'l1',          tvlMinUsd:           0 },
  { name: 'Scroll',      chain: 'scroll',      category: 'l2',          tvlMinUsd:  20_000_000 },
  { name: 'zkSync',      chain: 'zksync',      category: 'l2',          tvlMinUsd:  30_000_000 },
]

export const airdropWatchStrategy: Strategy = {
  name: 'airdropWatch',
  description: 'Monitors DeFi protocols for airdrop eligibility signals (read-only)',

  async buildContext(_ctx: LoopContext): Promise<StrategyResult> {
    // In phase 0 this is mostly static — no real eligibility detection yet.
    // Phase 3 would add wallet-interaction checks via on-chain RPC.
    const opportunities: { protocol: string; chain: string; signal: string; actionable: boolean }[] = []

    // Placeholder: in production, cross-reference wallet activity with each protocol's
    // on-chain data to determine eligibility status.
    for (const p of WATCH_PROTOCOLS) {
      opportunities.push({
        protocol:   p.name,
        chain:      p.chain,
        signal:     'monitoring — no wallet interaction detected yet',
        actionable: false,
      })
    }

    const lines = opportunities
      .map(o => `  ${o.protocol} (${o.chain}): ${o.signal}`)
      .join('\n')

    const contextSummary = [
      `=== AIRDROP WATCH — ${new Date().toISOString()} ===`,
      `Monitoring ${WATCH_PROTOCOLS.length} protocols for airdrop signals.`,
      '',
      'STATUS:',
      lines,
      '',
      'Note: On-chain eligibility detection requires Phase 3 (viem RPC integration).',
      'Currently in monitor-only mode.',
    ].join('\n')

    return {
      strategyName: 'airdropWatch',
      contextSummary,
      metadata: {
        watchedProtocols: WATCH_PROTOCOLS.length,
        opportunities,
      },
    }
  },
}

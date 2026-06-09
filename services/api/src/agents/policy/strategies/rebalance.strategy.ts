/**
 * rebalance.strategy.ts
 *
 * Monitors portfolio drift vs target weights and proposes rebalancing
 * when any position drifts more than DRIFT_THRESHOLD from its target.
 *
 * Phase 1+ strategy — disabled by default in agent.config.
 */

import type { Strategy, StrategyResult } from './strategy.types'
import type { LoopContext } from '../../loop/loop.types'

const DRIFT_THRESHOLD = 5  // % drift before rebalance is proposed

// Default target weights — should come from user config in production
const DEFAULT_TARGET_WEIGHTS: Record<string, number> = {
  USDC: 60,
  ETH:  30,
  BTC:  10,
}

export const rebalanceStrategy: Strategy = {
  name: 'rebalance',
  description: 'Monitors portfolio drift and proposes rebalancing when drift exceeds threshold',

  async buildContext(ctx: LoopContext): Promise<StrategyResult> {
    const { walletState } = ctx
    const totalValue      = walletState.totalValueUsd || 1

    // Compute current weights
    const currentWeights: Record<string, number> = {}
    for (const [token, valueUsd] of Object.entries(walletState.balances)) {
      currentWeights[token] = parseFloat(((valueUsd / totalValue) * 100).toFixed(1))
    }

    // Find drifting positions
    const drifts: { token: string; current: number; target: number; drift: number }[] = []
    for (const [token, target] of Object.entries(DEFAULT_TARGET_WEIGHTS)) {
      const current = currentWeights[token] ?? 0
      const drift   = Math.abs(current - target)
      if (drift >= DRIFT_THRESHOLD) {
        drifts.push({ token, current, target, drift })
      }
    }

    const driftLines = drifts.length > 0
      ? drifts
          .sort((a, b) => b.drift - a.drift)
          .map(d => `  ${d.token}: current ${d.current}% vs target ${d.target}% (drift ${d.drift.toFixed(1)}pt)`)
          .join('\n')
      : '  Portfolio is within target weights. No rebalance needed.'

    const weightLines = Object.entries(currentWeights)
      .map(([t, w]) => `  ${t}: ${w}%`)
      .join('\n')

    const contextSummary = [
      `=== REBALANCE CHECK — ${new Date().toISOString()} ===`,
      `Portfolio total: $${totalValue.toFixed(2)}`,
      `Daily PnL: $${walletState.dailyPnlUsd.toFixed(2)}`,
      '',
      'CURRENT WEIGHTS:',
      weightLines,
      '',
      `POSITIONS DRIFTING > ${DRIFT_THRESHOLD}%:`,
      driftLines,
    ].join('\n')

    return {
      strategyName: 'rebalance',
      contextSummary,
      metadata: {
        totalValueUsd:   totalValue,
        currentWeights,
        targetWeights:   DEFAULT_TARGET_WEIGHTS,
        driftingTokens:  drifts,
        rebalanceNeeded: drifts.length > 0,
      },
    }
  },
}

/**
 * yieldHunter.strategy.ts
 *
 * "Yield Anomaly Hunter" — the first strategy from the design brief.
 *
 * Logic:
 * 1. Pull APYs for USDC across top protocols from DefiLlama
 * 2. Filter TVL < $5M (scam guard)
 * 3. Compare each pool's current APY vs its 7-day rolling average (from baselines)
 * 4. Flag any pool where APY spiked > 5 percentage points vs the 7d avg
 * 5. Produce a context summary string the policy engine feeds to the LLM
 *
 * The LLM then decides:
 *   - If spike is real and conditions are right  → propose_trade
 *   - If uncertain or risky                      → set_alert
 *   - If nothing compelling                      → no_action
 */

import type { Strategy, StrategyResult } from './strategy.types'
import type { LoopContext } from '../../loop/loop.types'

const DEFILLAMA_BASE = 'https://yields.llama.fi'
const MIN_TVL_USD    = 5_000_000   // scam guard
const SPIKE_THRESHOLD_PCT = 5      // flag if APY spiked > 5pt vs 7d avg
const ASSETS_TO_WATCH = ['USDC', 'USDT', 'DAI', 'USDC.e', 'cUSDC']

interface PoolData {
  pool:       string
  protocol:   string
  chain:      string
  symbol:     string
  apyPct:     number
  tvlUsd:     number
  apyBase?:   number
  apyReward?: number
}

interface AnomalyPool extends PoolData {
  avg7dApyPct: number
  spikePct:    number
}

// ── Simple in-memory 7-day baseline store ─────────────────────────────────────
// In production this would live in Mongo via baselines.ts
const apyHistory = new Map<string, number[]>()  // poolId → last 7 samples

function updateBaseline(poolId: string, apy: number): void {
  const history = apyHistory.get(poolId) ?? []
  history.push(apy)
  if (history.length > 7) history.shift()
  apyHistory.set(poolId, history)
}

function getAvg7d(poolId: string): number | null {
  const history = apyHistory.get(poolId)
  if (!history || history.length < 2) return null
  return history.reduce((s, v) => s + v, 0) / history.length
}

async function fetchPools(): Promise<PoolData[]> {
  const res  = await fetch(`${DEFILLAMA_BASE}/pools`)
  if (!res.ok) throw new Error(`DefiLlama ${res.status}`)
  const data = await res.json() as { data: any[] }

  return data.data
    .filter((p: any) => {
      const sym = (p.symbol ?? '').toUpperCase()
      return (
        ASSETS_TO_WATCH.some(a => sym.includes(a)) &&
        (p.tvlUsd ?? 0) >= MIN_TVL_USD
      )
    })
    .map((p: any) => ({
      pool:       p.pool,
      protocol:   p.project,
      chain:      p.chain,
      symbol:     p.symbol,
      apyPct:     parseFloat((p.apy ?? 0).toFixed(2)),
      tvlUsd:     p.tvlUsd ?? 0,
      apyBase:    p.apyBase,
      apyReward:  p.apyReward,
    }))
}

export const yieldHunterStrategy: Strategy = {
  name: 'yieldHunter',
  description: 'Scans DeFi protocols for USDC/stablecoin yield anomalies (APY spikes > 5pt vs 7d avg)',

  async buildContext(_ctx: LoopContext): Promise<StrategyResult> {
    const pools = await fetchPools()

    // Update baselines and detect spikes
    const anomalies: AnomalyPool[] = []
    const topPools: PoolData[] = []

    for (const p of pools) {
      updateBaseline(p.pool, p.apyPct)
      const avg7d = getAvg7d(p.pool)
      if (avg7d !== null) {
        const spike = p.apyPct - avg7d
        if (spike >= SPIKE_THRESHOLD_PCT) {
          anomalies.push({ ...p, avg7dApyPct: parseFloat(avg7d.toFixed(2)), spikePct: parseFloat(spike.toFixed(2)) })
        }
      }
      topPools.push(p)
    }

    // Sort top pools by APY
    topPools.sort((a, b) => b.apyPct - a.apyPct)
    const top10 = topPools.slice(0, 10)

    // Build LLM-readable context summary
    const topPoolLines = top10
      .map(p => `  ${p.protocol}/${p.chain} (${p.symbol}): ${p.apyPct}% APY, TVL $${(p.tvlUsd / 1e6).toFixed(1)}M`)
      .join('\n')

    const anomalyLines = anomalies.length > 0
      ? anomalies
          .sort((a, b) => b.spikePct - a.spikePct)
          .slice(0, 5)
          .map(p =>
            `  ⚡ ${p.protocol}/${p.chain} (${p.symbol}): ${p.apyPct}% APY (↑${p.spikePct.toFixed(1)}pt vs ${p.avg7dApyPct}% 7d avg), TVL $${(p.tvlUsd / 1e6).toFixed(1)}M`
          )
          .join('\n')
      : '  None detected this cycle.'

    const contextSummary = [
      `=== YIELD HUNTER — ${new Date().toISOString()} ===`,
      `Scanned ${pools.length} USDC/stablecoin pools (TVL ≥ $5M)`,
      '',
      'TOP 10 POOLS BY APY:',
      topPoolLines,
      '',
      `ANOMALIES (APY spike > ${SPIKE_THRESHOLD_PCT}pt vs 7d avg):`,
      anomalyLines,
    ].join('\n')

    return {
      strategyName: 'yieldHunter',
      contextSummary,
      metadata: {
        totalPools:   pools.length,
        anomalies:    anomalies.length,
        topPools:     top10,
        spikedPools:  anomalies,
      },
    }
  },
}

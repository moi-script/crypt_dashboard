/**
 * yieldHunter.strategy.ts
 *
 * "Yield Anomaly Hunter" — the first strategy from the design brief.
 *
 * Logic:
 * 1. Pull APYs for USDC across top protocols from DefiLlama
 * 2. Filter TVL < $5M (scam guard)
 * 3. Compare each pool's current APY vs its 7-day rolling average (persisted in MongoDB)
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
import { ApyBaselineDoc, MAX_SAMPLES } from '../../../models/apyBaseline.model'

const DEFILLAMA_BASE      = 'https://yields.llama.fi'
const MIN_TVL_USD         = 5_000_000
const SPIKE_THRESHOLD_PCT = 5
const ASSETS_TO_WATCH     = ['USDC', 'USDT', 'DAI', 'USDC.e', 'cUSDC']

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
      pool:      p.pool,
      protocol:  p.project,
      chain:     p.chain,
      symbol:    p.symbol,
      apyPct:    parseFloat((p.apy ?? 0).toFixed(2)),
      tvlUsd:    p.tvlUsd ?? 0,
      apyBase:   p.apyBase,
      apyReward: p.apyReward,
    }))
}

// ── Persist baselines and detect spikes in one bulk pass ─────────────────────
//
// Loads all existing baseline docs for the current pool set in a single query,
// applies the new sample in memory, bulk-upserts the updated docs, then
// returns the anomaly list. This keeps the MongoDB round trips to two
// regardless of how many pools are scanned.

async function updateAndDetect(pools: PoolData[]): Promise<AnomalyPool[]> {
  const poolIds = pools.map(p => p.pool)

  // Load all existing baselines in one query
  const existing = await ApyBaselineDoc.find({ poolId: { $in: poolIds } }).lean()
  const baselineMap = new Map(existing.map(d => [d.poolId, d.samples]))

  const anomalies: AnomalyPool[] = []
  const bulkOps: any[] = []

  for (const pool of pools) {
    const prev    = baselineMap.get(pool.pool) ?? []
    const updated = [...prev, pool.apyPct].slice(-MAX_SAMPLES)

    // Need at least 2 samples to compute a meaningful average
    if (prev.length >= 1) {
      const avg7d   = prev.reduce((s, v) => s + v, 0) / prev.length
      const spikePct = pool.apyPct - avg7d
      if (spikePct >= SPIKE_THRESHOLD_PCT) {
        anomalies.push({
          ...pool,
          avg7dApyPct: parseFloat(avg7d.toFixed(2)),
          spikePct:    parseFloat(spikePct.toFixed(2)),
        })
      }
    }

    bulkOps.push({
      updateOne: {
        filter: { poolId: pool.pool },
        update: {
          $set: {
            poolId:    pool.pool,
            protocol:  pool.protocol,
            chain:     pool.chain,
            symbol:    pool.symbol,
            samples:   updated,
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    })
  }

  if (bulkOps.length > 0) {
    await ApyBaselineDoc.bulkWrite(bulkOps, { ordered: false })
  }

  return anomalies
}

export const yieldHunterStrategy: Strategy = {
  name: 'yieldHunter',
  description: 'Scans DeFi protocols for USDC/stablecoin yield anomalies (APY spikes > 5pt vs 7d avg)',

  async buildContext(_ctx: LoopContext): Promise<StrategyResult> {
    const pools = await fetchPools()

    const anomalies = await updateAndDetect(pools)

    // Sort top pools by APY for the LLM context summary
    const top10 = [...pools].sort((a, b) => b.apyPct - a.apyPct).slice(0, 10)

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
        totalPools:  pools.length,
        anomalies:   anomalies.length,
        topPools:    top10,
        spikedPools: anomalies,
      },
    }
  },
}

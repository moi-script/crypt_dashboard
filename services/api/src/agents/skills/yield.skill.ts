/**
 * yield.skill.ts
 *
 * Compares USDC/stablecoin APYs across DeFi protocols.
 * Integrates with the existing orchestrator skill pipeline.
 *
 * Returns a SkillResult compatible with the existing analysis pipeline
 * so it can be used in both the analysis flow AND the autonomous loop.
 */

import type { SkillResult } from '../../models/analysis.model'
import { getPoolsByAsset } from '@/read/ingestion/defillama.ingest'

interface YieldSkillInput {
  asset?:       string    // default 'USDC'
  minTvlUsd?:   number    // default 5M
  limit?:       number    // default 20
}

export async function runYieldSkill(input: YieldSkillInput = {}): Promise<SkillResult> {
  const asset     = input.asset     ?? 'USDC'
  const minTvlUsd = input.minTvlUsd ?? 5_000_000
  const limit     = input.limit     ?? 20

  try {
    const pools = await getPoolsByAsset(asset, minTvlUsd, limit)

    if (pools.length === 0) {
      return {
        name:    'yield',
        verdict: 'neutral',
        score:   0,
        summary: `No ${asset} pools found with TVL ≥ $${(minTvlUsd / 1e6).toFixed(0)}M.`,
        data:    { pools: [], asset },
      }
    }

    const maxApy    = Math.max(...pools.map(p => p.apyPct))
    const avgApy    = pools.reduce((s, p) => s + p.apyPct, 0) / pools.length
    const topPool   = pools[0]

    // Score: higher APY availability = more bullish for yield-seeking capital flows
    let score = 0
    if (maxApy > 15)     score += 40
    else if (maxApy > 8) score += 20
    else if (maxApy > 4) score += 10

    // High TVL = strong signal
    if (topPool.tvlUsd > 100_000_000) score += 20
    else if (topPool.tvlUsd > 10_000_000) score += 10

    score = Math.max(-100, Math.min(100, score))
    const verdict = score >= 20 ? 'bullish' : score <= -20 ? 'bearish' : 'neutral'

    const top3 = pools.slice(0, 3)
      .map(p => `${p.protocol}/${p.chain} ${p.apyPct}%`)
      .join(', ')

    const summary = `Top ${asset} yields (${pools.length} pools, TVL ≥ $${(minTvlUsd/1e6).toFixed(0)}M): ${top3}. ` +
      `Max APY: ${maxApy.toFixed(2)}%. Avg APY: ${avgApy.toFixed(2)}%.`

    return {
      name: 'yield',
      verdict,
      score: Math.round(score),
      summary,
      data: {
        asset,
        poolCount: pools.length,
        maxApy,
        avgApy: parseFloat(avgApy.toFixed(2)),
        topPools: top3,
        pools: pools.slice(0, 5),
      },
    }
  } catch (err: any) {
    return {
      name:    'yield',
      verdict: 'neutral',
      score:   0,
      summary: `Yield skill failed: ${err.message}`,
      data:    { error: err.message },
    }
  }
}

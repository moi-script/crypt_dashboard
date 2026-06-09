/**
 * defillama.ingest.ts
 *
 * Fetches yield / TVL data from DefiLlama's public API.
 * Results are cached through the existing redis helper.
 *
 * DefiLlama endpoints used:
 *   GET https://yields.llama.fi/pools    — all yield pools with APY + TVL
 *   GET https://api.llama.fi/protocols   — protocol TVL
 */

import { redis } from '../../config/redis'  // reuse existing redis helper

const BASE_YIELDS   = 'https://yields.llama.fi'
const BASE_PROTOCOL = 'https://api.llama.fi'

const TTL_POOLS     = 300  // 5 min — yields change slowly
const TTL_PROTOCOLS = 600  // 10 min

export interface DefiLlamaPool {
  pool:       string   // unique pool ID
  protocol:   string
  chain:      string
  symbol:     string
  tvlUsd:     number
  apyPct:     number
  apyBase?:   number
  apyReward?: number
  stablecoin: boolean
  updatedAt:  string
}

export interface DefiLlamaProtocol {
  id:       string
  name:     string
  tvl:      number
  chains:   string[]
  category: string
}

export async function fetchAllPools(): Promise<DefiLlamaPool[]> {
  const cacheKey = 'defillama:pools:all'
  const cached   = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached) as DefiLlamaPool[]

  const res  = await fetch(`${BASE_YIELDS}/pools`)
  if (!res.ok) throw new Error(`DefiLlama pools ${res.status}`)
  const data = (await res.json()) as { data: any[] }

  const pools: DefiLlamaPool[] = data.data.map((p: any) => ({
    pool:       p.pool,
    protocol:   p.project,
    chain:      p.chain,
    symbol:     p.symbol ?? '',
    tvlUsd:     p.tvlUsd ?? 0,
    apyPct:     parseFloat((p.apy ?? 0).toFixed(2)),
    apyBase:    p.apyBase,
    apyReward:  p.apyReward,
    stablecoin: !!p.stablecoin,
    updatedAt:  new Date().toISOString(),
  }))

  await redis.set(cacheKey, JSON.stringify(pools), { EX: TTL_POOLS })
  return pools
}

export async function fetchTopProtocols(limit = 50): Promise<DefiLlamaProtocol[]> {
  const cacheKey = `defillama:protocols:top${limit}`
  const cached   = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached) as DefiLlamaProtocol[]

  const res  = await fetch(`${BASE_PROTOCOL}/protocols`)
  if (!res.ok) throw new Error(`DefiLlama protocols ${res.status}`)
  const data = (await res.json()) as any[]

  const protocols: DefiLlamaProtocol[] = data
    .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
    .slice(0, limit)
    .map((p: any) => ({
      id:       p.slug ?? p.name,
      name:     p.name,
      tvl:      p.tvl ?? 0,
      chains:   p.chains ?? [],
      category: p.category ?? 'unknown',
    }))

  await redis.set(cacheKey, JSON.stringify(protocols), { EX: TTL_PROTOCOLS })
  return protocols
}

/** Filter pools by asset symbol, min TVL, and max count */
export async function getPoolsByAsset(
  assetSymbol: string,
  minTvlUsd    = 5_000_000,
  limit        = 50,
): Promise<DefiLlamaPool[]> {
  const all    = await fetchAllPools()
  const needle = assetSymbol.toUpperCase()

  return all
    .filter(p => p.symbol.toUpperCase().includes(needle) && p.tvlUsd >= minTvlUsd)
    .sort((a, b) => b.apyPct - a.apyPct)
    .slice(0, limit)
}

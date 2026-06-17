/**
 * read.tools.ts
 *
 * Tools the LLM may call freely — they only READ data, never mutate state.
 * The agent calls these in a loop (up to MAX_READ_ITERATIONS) to gather
 * context before deciding on an action.
 *
 * Each handler returns JSON-serializable data that gets appended back into
 * the conversation so the model can reason over it.
 */

import type { RegisteredTool, ToolContext } from './tool.types'
import { PositionDoc } from '../../models/position.model'
// ── get_price ─────────────────────────────────────────────────────────────────
interface CoinResponse {
  name: string
  volume24h?: number
  marketCap?: number
  price?: number
  high24h?: number
  low24h?: number
}


const getPriceTool: RegisteredTool = {
  category: 'read',
  def: {
    name: 'get_price',
    description: 'Get the current price and 24h change for one or more coins.',
    parameters: {
      type: 'object',
      properties: {
        coinIds: {
          type: 'array',
          description: 'CoinGecko coin IDs, e.g. ["bitcoin","ethereum"]',
          items: { type: 'string' },
        },
      },
      required: ['coinIds'],
    },
  },
  handler: async (args, _ctx: ToolContext) => {
    const coinIds = args.coinIds as string[]
    const BASE = process.env.API_BASE_URL ?? 'http://localhost:4000'
    try {
      const res = await fetch(
        `${BASE}/api/simple/price?ids=${coinIds.join(',')}&vs=usd`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as Record<string, { usd?: number; usd_24h_change?: number; usd_market_cap?: number }>
      return coinIds.map(id => ({
        coinId: id,
        priceUsd: data[id]?.usd ?? null,
        change24h: data[id]?.usd_24h_change ?? null,
        marketCap: data[id]?.usd_market_cap ?? null,
      }))
    } catch (err: any) {
      return { error: err.message, coinIds }
    }
  },
}

// ── get_yields ────────────────────────────────────────────────────────────────

const getYieldsTool: RegisteredTool = {
  category: 'read',
  def: {
    name: 'get_yields',
    description:
      'Get current APY / yield rates for a stablecoin or asset across DeFi protocols. ' +
      'Returns pools sorted by APY descending. Filtered by minTvlUsd to exclude scam pools.',
    parameters: {
      type: 'object',
      properties: {
        asset: {
          type: 'string',
          description: 'Token symbol, e.g. "USDC" or "ETH"',
        },
        minTvlUsd: {
          type: 'number',
          description: 'Minimum TVL in USD to include a pool. Default 5000000 (5M).',
        },
        limit: {
          type: 'number',
          description: 'Max number of pools to return. Default 20.',
        },
      },
      required: ['asset'],
    },
  },
  handler: async (args, _ctx: ToolContext) => {
    const asset = (args.asset as string).toUpperCase()
    const minTvl = (args.minTvlUsd as number) ?? 5_000_000
    const limit = (args.limit as number) ?? 20
    const BASE = process.env.DEFILLAMA_BASE_URL ?? 'https://yields.llama.fi'

    try {
      const res = await fetch(`${BASE}/pools`)
      if (!res.ok) throw new Error(`DefiLlama HTTP ${res.status}`)
      const data = (await res.json()) as { data: any[] }

      const pools = data.data
        .filter((p: any) => {
          const sym: string = (p.symbol ?? '').toUpperCase()
          return (
            (sym.includes(asset) || sym === asset) &&
            (p.tvlUsd ?? 0) >= minTvl
          )
        })
        .sort((a: any, b: any) => (b.apy ?? 0) - (a.apy ?? 0))
        .slice(0, limit)
        .map((p: any) => ({
          pool: p.pool,
          protocol: p.project,
          chain: p.chain,
          symbol: p.symbol,
          apyPct: parseFloat((p.apy ?? 0).toFixed(2)),
          tvlUsd: p.tvlUsd,
          apyBase: p.apyBase,
          apyReward: p.apyReward,
        }))

      return { asset, count: pools.length, pools }
    } catch (err: any) {
      return { error: err.message, asset }
    }
  },
}

// ── get_token_volume ──────────────────────────────────────────────────────────

const getTokenVolumeTool: RegisteredTool = {
  category: 'read',
  def: {
    name: 'get_token_volume',
    description:
      'Get the 24h trading volume and liquidity depth for a token. ' +
      'Useful for checking if a yield pool has enough liquidity to enter/exit safely.',
    parameters: {
      type: 'object',
      properties: {
        coinId: {
          type: 'string',
          description: 'CoinGecko coin ID, e.g. "usd-coin"',
        },
      },
      required: ['coinId'],
    },
  },
  handler: async (args, _ctx: ToolContext) => {
    const coinId = args.coinId as string
    const BASE = process.env.API_BASE_URL ?? 'http://localhost:4000'
    try {
      const res = await fetch(`${BASE}/api/coins/${coinId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const coin = await res.json() as CoinResponse
      return {
        coinId,
        name: coin.name,
        volume24hUsd: coin.volume24h ?? 0,
        marketCapUsd: coin.marketCap ?? 0,
        priceUsd: coin.price ?? 0,
        high24h: coin.high24h ?? 0,
        low24h: coin.low24h ?? 0,
      }
    } catch (err: any) {
      return { error: err.message, coinId }
    }
  },
}

// ── get_wallet_state ──────────────────────────────────────────────────────────

const getWalletStateTool: RegisteredTool = {
  category: 'read',
  def: {
    name: 'get_wallet_state',
    description:
      'Get the current wallet / portfolio state: balances, open positions, daily PnL. ' +
      'In paper mode returns the simulated portfolio; in live mode returns actual balances.',
    parameters: {
      type: 'object',
      properties: {
        includePositions: {
          type: 'boolean',
          description: 'If true, include open position details. Default false.',
        },
      },
    },
  },
  handler: async (args, ctx: ToolContext) => {
    const includePositions = (args.includePositions as boolean) ?? false

    // Query the simulated PositionDoc collection directly, scoped to the
    // calling account. (Previously this hit the HTTP API unauthenticated,
    // which both leaked cross-account data and breaks now that the
    // positions routes require a token.)
    try {
      const openPositions = includePositions && ctx.userId
        ? await PositionDoc.find({ userId: ctx.userId, isOpen: true, mode: 'paper' }).lean()
        : []

      let dailyPnlUsd = 0
      if (ctx.userId) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const closedToday = await PositionDoc
          .find({ userId: ctx.userId, isOpen: false, exitAt: { $gte: today } })
          .lean()
        dailyPnlUsd = closedToday.reduce((s, p) => s + (p.realizedPnlUsd ?? 0), 0)
      }

      return {
        mode: ctx.dryRun ? 'paper' : 'live',
        paperBalance: { USDC: 5000, ETH: 0 },   // initial paper wallet
        openPositions,
        dailyPnlUsd,
      }
    } catch (err: any) {
      return { error: err.message, mode: 'paper' }
    }
  },
}

// ── get_news_sentiment ────────────────────────────────────────────────────────

const getNewsSentimentTool: RegisteredTool = {
  category: 'read',
  def: {
    name: 'get_news_sentiment',
    description: 'Get aggregated news sentiment for a coin over the last 14 days.',
    parameters: {
      type: 'object',
      properties: {
        coinId: {
          type: 'string',
          description: 'CoinGecko coin ID',
        },
      },
      required: ['coinId'],
    },
  },
  handler: async (args, _ctx: ToolContext) => {
    const coinId = args.coinId as string
    const BASE = process.env.API_BASE_URL ?? 'http://localhost:4000'
    try {
      const res = await fetch(`${BASE}/api/news/coin/${coinId}?limit=20`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const articles = await res.json() as any[]

      if (!articles.length) return { coinId, sentiment: 0, articleCount: 0 }

      const avg = articles.reduce((s: number, a: any) => s + (a.sentiment ?? 0), 0) / articles.length
      const bullish = articles.filter((a: any) => (a.sentiment ?? 0) > 0.15).length
      const bearish = articles.filter((a: any) => (a.sentiment ?? 0) < -0.15).length

      return {
        coinId,
        articleCount: articles.length,
        avgSentiment: parseFloat(avg.toFixed(3)),
        bullishCount: bullish,
        bearishCount: bearish,
        neutralCount: articles.length - bullish - bearish,
        label: avg > 0.15 ? 'bullish' : avg < -0.15 ? 'bearish' : 'neutral',
      }
    } catch (err: any) {
      return { error: err.message, coinId }
    }
  },
}

// ── Export all read tools ─────────────────────────────────────────────────────

export const READ_TOOLS: RegisteredTool[] = [
  getPriceTool,
  getYieldsTool,
  getTokenVolumeTool,
  getWalletStateTool,
  getNewsSentimentTool,
]
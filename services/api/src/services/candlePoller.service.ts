/**
 * CoinGecko Candle Poller Service
 * Polls prices every 5 minutes and builds OHLCV candles
 */

import { Candle5mDoc, TickRawDoc, DataHealthDoc } from '../models/candle.model'

// ─────────────────────────────────────────────────────────────────────────────

const COIN_SYMBOL: Record<string, string> = {
  bitcoin:  'BTC',
  ethereum: 'ETH',
}

const POLL_INTERVAL_MS = 300_000 // 5 minutes
const CG_BASE_URL = 'https://api.coingecko.com/api/v3'

let pollerInterval: NodeJS.Timeout | null = null
let isRunning = false

// ─────────────────────────────────────────────────────────────────────────────

/** Floor a date to the nearest 5-minute boundary */
function floorTo5Min(date: Date): Date {
  const ms = date.getTime()
  return new Date(ms - (ms % (5 * 60 * 1000)))
}

/** Format a number with thousands separator */
function formatPrice(price: number): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Format HH:MM from a Date */
function formatBucketTime(date: Date): string {
  const h = String(date.getUTCHours()).padStart(2, '0')
  const m = String(date.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

// ─────────────────────────────────────────────────────────────────────────────

interface SimplePriceResponse {
  [coinId: string]: {
    usd?: number
    usd_24h_vol?: number
  }
}

/** Mark missed polls for a coin when fetch fails */
async function markMissedPoll(coingeckoId: string): Promise<void> {
  try {
    const now = new Date()
    const health = await DataHealthDoc.findOneAndUpdate(
      { coingeckoId },
      [
        {
          $set: {
            consecutiveMissedPolls: { $add: ['$consecutiveMissedPolls', 1] },
            staleSince: {
              $cond: {
                if: { $and: [{ $gte: [{ $add: ['$consecutiveMissedPolls', 1] }, 2] }, { $eq: ['$staleSince', null] }] },
                then: now,
                else: '$staleSince',
              },
            },
            lastPolledAt: now,
          },
        },
      ],
      { upsert: true, new: true },
    )

    if (health && health.consecutiveMissedPolls >= 2 && health.staleSince) {
      console.log(
        `[CandlePoller] STALE: ${coingeckoId} — ${health.consecutiveMissedPolls} consecutive missed polls since ${new Date(health.staleSince).toISOString()}`,
      )
    }
  } catch {
    // Non-fatal DB error
  }
}

/** Poll once and process results */
async function pollOnce(coingeckoIds: string[]): Promise<void> {
  const now = new Date()
  const url = new URL(`${CG_BASE_URL}/simple/price`)

  // Build query params
  url.searchParams.set('ids', coingeckoIds.join(','))
  url.searchParams.set('vs_currencies', 'usd')
  url.searchParams.set('include_24hr_vol', 'true')

  // Add API key header if available
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (process.env.COINGECKO_PRO_API_KEY) {
    headers['x-cg-pro-api-key'] = process.env.COINGECKO_PRO_API_KEY
  } else if (process.env.COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY
  }

  let data: SimplePriceResponse
  try {
    const res = await fetch(url.toString(), { headers })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    data = (await res.json()) as SimplePriceResponse
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`[CandlePoller] Poll failed: ${message}`)

    // Mark missed polls for each coin
    for (const coinId of coingeckoIds) {
      await markMissedPoll(coinId)
    }
    return
  }

  // Process each coin
  for (const coingeckoId of coingeckoIds) {
    const coinData = data[coingeckoId]
    if (!coinData) continue

    const price = coinData.usd
    const volume24h = coinData.usd_24h_vol ?? null

    if (price === undefined) continue

    // 2a. Persist raw tick
    await TickRawDoc.create({
      coingeckoId,
      price,
      volume24h,
      polledAt: now,
      source: 'coingecko',
    }).catch(() => {})

    // 2b. Query ticks in current bucket
    const bucketStart = floorTo5Min(now)
    const bucketEnd = new Date(bucketStart.getTime() + 5 * 60 * 1000)

    const ticks = await TickRawDoc.find({
      coingeckoId,
      polledAt: { $gte: bucketStart, $lt: bucketEnd },
    }).sort({ polledAt: 1 }).lean().catch(() => [])

    // Skip if no ticks (shouldn't happen, but handle gracefully)
    if (ticks.length === 0) continue

    // 2c. Compute OHLCV
    const tickPrices = ticks.map((t) => t.price)
    const open = tickPrices[0]
    const close = tickPrices[tickPrices.length - 1]
    const high = Math.max(...tickPrices)
    const low = Math.min(...tickPrices)

    // 2d. Upsert candle
    const symbol = COIN_SYMBOL[coingeckoId]
    await Candle5mDoc.findOneAndUpdate(
      { coingeckoId, timeframeStart: bucketStart },
      {
        symbol: symbol || coingeckoId.toUpperCase(),
        open,
        high,
        low,
        close,
        volume: volume24h,
        tickCount: ticks.length,
        source: 'coingecko',
      },
      { upsert: true },
    ).catch(() => {})

    // 2e. Upsert DataHealth
    await DataHealthDoc.findOneAndUpdate(
      { coingeckoId },
      {
        symbol: symbol || coingeckoId.toUpperCase(),
        lastTickAt: now,
        lastCandleClosedAt: bucketStart,
        consecutiveMissedPolls: 0,
        staleSince: null,
      },
      { upsert: true },
    ).catch(() => {})

    // Log success
    const bucketTime = formatBucketTime(bucketStart)
    console.log(
      `[CandlePoller] ${symbol} $${formatPrice(close)} | O:${open.toFixed(2)} H:${high.toFixed(2)} L:${low.toFixed(2)} C:${close.toFixed(2)} | ticks:${ticks.length} | bucket:${bucketTime}`,
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start the candle poller — polls every 5 minutes
 * Runs immediately on start, then at each interval
 */
export function startCandlePoller(coingeckoIds: string[]): void {
  if (isRunning) return

  isRunning = true

  console.log(
    `[CandlePoller] Starting — coins: [${coingeckoIds.join(', ')}] | interval: ${POLL_INTERVAL_MS / 1000}s`,
  )

  // Fire immediately
  pollOnce(coingeckoIds).catch(() => {})

  // Then set interval
  pollerInterval = setInterval(() => {
    pollOnce(coingeckoIds).catch(() => {})
  }, POLL_INTERVAL_MS)
}

/**
 * Stop the candle poller
 */
export function stopCandlePoller(): void {
  if (pollerInterval) {
    clearInterval(pollerInterval)
    pollerInterval = null
  }
  isRunning = false
}

/**
 * Check if the poller is running
 */
export function isCandlePollerRunning(): boolean {
  return isRunning
}

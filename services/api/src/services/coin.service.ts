import { CoinGeckoService } from './coingecko.service'
import { redis } from '../config/redis'
import { AppError } from '../middleware/errorHandler'

const CACHE_TTL = 30
const cg = new CoinGeckoService()

function isInvalidCoinId(coinId: string): boolean {
  return !coinId || coinId === 'undefined' || coinId === 'null' || coinId.trim() === ''
}

export class CoinService {

  async getAll() {
    const cacheKey = 'coins:all'
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const markets = await cg.getCoinsMarkets({
      vsCurrency: 'usd',
      perPage:    100,
      page:       1,
      sparkline:  true,
      priceChangePercentage: '1h,24h,7d',
    })

    const coins = markets.map((c, i) => ({
      id:        c.id,
      symbol:    c.symbol,
      name:      c.name,
      image:     c.image,
      rank:      c.market_cap_rank ?? i + 1,
      price:     c.current_price,
      change24h: c.price_change_percentage_24h ?? 0,
      change7d:  c.price_change_percentage_7d_in_currency ?? 0,
      volume24h: c.total_volume,
      marketCap: c.market_cap,
      sparkline: c.sparkline_in_7d?.price ?? [],
    }))

    await redis.set(cacheKey, JSON.stringify(coins), { EX: CACHE_TTL })
    return coins
  }

  async getOne(coinId: string) {
    if (isInvalidCoinId(coinId)) throw new AppError(400, 'Coin ID is required')

    const cacheKey = `coins:${coinId}`
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    try {
      const detail = await cg.getCoinDetail(coinId, {
        marketData:    true,
        communityData: true,
      })

      const coin = {
        id:        detail.id,
        symbol:    detail.symbol,
        name:      detail.name,
        image:     detail.image?.large,
        rank:      detail.market_cap_rank,
        price:     detail.market_data?.current_price?.usd ?? 0,
        change24h: detail.market_data?.price_change_percentage_24h ?? 0,
        change7d:  detail.market_data?.price_change_percentage_7d ?? 0,
        change30d: detail.market_data?.price_change_percentage_30d ?? 0,
        volume24h: detail.market_data?.total_volume?.usd ?? 0,
        marketCap: detail.market_data?.market_cap?.usd ?? 0,
        high24h:   detail.market_data?.high_24h?.usd ?? 0,
        low24h:    detail.market_data?.low_24h?.usd ?? 0,
        ath:       detail.market_data?.ath?.usd ?? 0,
        atl:       detail.market_data?.atl?.usd ?? 0,
        supply: {
          circulating: detail.market_data?.circulating_supply ?? 0,
          total:       detail.market_data?.total_supply ?? null,
          max:         detail.market_data?.max_supply ?? null,
        },
        links:       detail.links,
        description: detail.description?.en ?? '',
      }

      await redis.set(cacheKey, JSON.stringify(coin), { EX: CACHE_TTL })
      return coin
    } catch (err: any) {
      if (err?.status === 404 || err?.message?.includes('404')) {
        throw new AppError(404, `Coin '${coinId}' not found`)
      }
      throw err
    }
  }

  async getOHLCV(coinId: string, range: string) {
    if (isInvalidCoinId(coinId)) throw new AppError(400, 'Coin ID is required')

    const cacheKey = `coins:${coinId}:ohlcv:${range}`
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    // Map range to CoinGecko days param
    const daysMap: Record<string, number> = {
      '1D': 1,
      '1W': 7,
      '1M': 30,
      '1Y': 365,
    }
    const days = daysMap[range] ?? 1

    // Fetch OHLC from CoinGecko
    // Returns [timestamp_ms, open, high, low, close]
    const raw = await cg.getOHLC(coinId, 'usd', days as any)

    // Convert to OHLCVBar shape the frontend expects
    // CoinGecko OHLC has no volume — use market chart for volume
    const chartData = await cg.getMarketChart(coinId, 'usd', days)

    // Build a volume map keyed by approximate timestamp bucket
    const volumeMap = new Map<number, number>()
    for (const [ts, vol] of chartData.total_volumes) {
      volumeMap.set(Math.round(ts / 1000), vol)
    }

    const bars = raw.map(([ts, open, high, low, close]) => {
      const timeSec = Math.round(ts / 1000)
      // Find nearest volume entry within ±2 hours
      let volume = 0
      for (const [vts, vol] of volumeMap) {
        if (Math.abs(vts - timeSec) < 7200) { volume = vol; break }
      }
      return { time: timeSec, open, high, low, close, volume }
    })

    // Cache duration based on range
    const cacheTTL = days <= 1 ? 300 : days <= 7 ? 600 : 1800
    await redis.set(cacheKey, JSON.stringify(bars), { EX: cacheTTL })
    return bars
  }

  async getIndicators(coinId: string, limit = 100) {
    if (isInvalidCoinId(coinId)) throw new AppError(400, 'Coin ID is required')

    const cacheKey = `coins:${coinId}:indicators:${limit}`
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    // Fetch 30 days of daily prices to compute indicators
    const chartData = await cg.getMarketChart(coinId, 'usd', 30, 'daily')
    const prices = chartData.prices.map(([ts, price]) => ({
      time: Math.round(ts / 1000),
      price,
    }))

    if (prices.length < 20) {
      await redis.set(cacheKey, JSON.stringify([]), { EX: 60 })
      return []
    }

    // Compute indicators from price series
    const indicators = computeIndicators(prices, limit)

    await redis.set(cacheKey, JSON.stringify(indicators), { EX: 3600 })
    return indicators
  }
}

// ── Technical indicator math ───────────────────────────────────────────────

function computeIndicators(
  prices: { time: number; price: number }[],
  limit: number,
) {
  const closes = prices.map(p => p.price)
  const n = closes.length

  const sma = (arr: number[], period: number, i: number) => {
    if (i < period - 1) return null
    return arr.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  }

  const ema = (arr: number[], period: number): number[] => {
    const k = 2 / (period + 1)
    const result: number[] = []
    let prev = arr.slice(0, period).reduce((a, b) => a + b, 0) / period
    result.push(...Array(period - 1).fill(null))
    result.push(prev)
    for (let i = period; i < arr.length; i++) {
      prev = arr[i] * k + prev * (1 - k)
      result.push(prev)
    }
    return result
  }

  // RSI
  const rsi14 = (arr: number[], i: number): number => {
    if (i < 14) return 50
    let gains = 0, losses = 0
    for (let j = i - 13; j <= i; j++) {
      const diff = arr[j] - arr[j - 1]
      if (diff > 0) gains += diff
      else losses -= diff
    }
    const rs = losses === 0 ? 100 : gains / losses
    return 100 - 100 / (1 + rs)
  }

  const ema12 = ema(closes, 12)
  const ema26 = ema(closes, 26)
  const ema50arr = ema(closes, Math.min(50, n - 1))

  const results = []
  for (let i = 20; i < n; i++) {
    const sma20val = sma(closes, 20, i) ?? closes[i]
    const macd = (ema12[i] ?? closes[i]) - (ema26[i] ?? closes[i])

    // Bollinger Bands (20-period, 2 std dev)
    const slice = closes.slice(i - 19, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / 20
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / 20)

    results.push({
      time:     prices[i].time,
      rsi14:    parseFloat(rsi14(closes, i).toFixed(2)),
      macd:     parseFloat(macd.toFixed(4)),
      signal:   parseFloat((macd * 0.7).toFixed(4)), // simplified signal
      sma20:    parseFloat(sma20val.toFixed(4)),
      ema50:    parseFloat((ema50arr[i] ?? closes[i]).toFixed(4)),
      bbUpper:  parseFloat((mean + 2 * std).toFixed(4)),
      bbLower:  parseFloat((mean - 2 * std).toFixed(4)),
    })
  }

  return results.slice(-limit)
}
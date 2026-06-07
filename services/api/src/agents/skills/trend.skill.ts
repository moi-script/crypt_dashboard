import type { SkillResult } from '../../models/analysis.model'

interface PricePoint { time: number; price: number }

function ema(prices: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  let prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = 0; i < period - 1; i++) result.push(0)
  result.push(prev)
  for (let i = period; i < prices.length; i++) {
    prev = prices[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

function sma(prices: number[], period: number): number {
  const slice = prices.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

export function runTrendSkill(history: PricePoint[]): SkillResult {
  const prices = history.map(p => p.price)

  if (prices.length < 20) {
    return { name: 'trend', verdict: 'neutral', score: 0, summary: 'Not enough price history.', data: {} }
  }

  const sma20  = sma(prices, 20)
  const sma50  = sma(prices, Math.min(50, prices.length))
  const ema12  = ema(prices, 12)
  const ema26  = ema(prices, 26)
  const latest = prices[prices.length - 1]

  const ema12Last = ema12[ema12.length - 1]
  const ema26Last = ema26[ema26.length - 1]

  // Golden/death cross: EMA12 vs EMA26
  const emaCross = ema12Last - ema26Last
  // Price vs SMA20 and SMA50
  const aboveSma20 = latest > sma20
  const aboveSma50 = latest > sma50

  // 7-day slope (price change %)
  const week = prices.slice(-7)
  const slope = week.length > 1
    ? ((week[week.length - 1] - week[0]) / week[0]) * 100
    : 0

  let score = 0
  if (emaCross > 0) score += 30
  else score -= 30
  if (aboveSma20) score += 20
  else score -= 20
  if (aboveSma50) score += 20
  else score -= 20
  score += Math.max(-30, Math.min(30, slope * 3))

  score = Math.max(-100, Math.min(100, score))

  const verdict = score >= 20 ? 'bullish' : score <= -20 ? 'bearish' : 'neutral'

  const summary = `Price is ${aboveSma20 ? 'above' : 'below'} SMA-20 ($${sma20.toFixed(2)}) and ${aboveSma50 ? 'above' : 'below'} SMA-50 ($${sma50.toFixed(2)}). EMA-12 is ${emaCross > 0 ? 'above' : 'below'} EMA-26 — ${emaCross > 0 ? 'golden cross (bullish)' : 'death cross (bearish)'}. 7-day slope: ${slope.toFixed(1)}%.`

  return {
    name: 'trend',
    verdict,
    score: Math.round(score),
    summary,
    data: { sma20, sma50, ema12: ema12Last, ema26: ema26Last, emaCross, aboveSma20, aboveSma50, slope7d: slope },
  }
}
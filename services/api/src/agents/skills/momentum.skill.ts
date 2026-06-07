import type { SkillResult } from '../../models/analysis.model'

interface PricePoint { time: number; price: number }

function rsi(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }
  const rs = losses === 0 ? 100 : gains / losses
  return 100 - 100 / (1 + rs)
}

function emaArr(prices: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  let prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = 0; i < period - 1; i++) result.push(prev)
  result.push(prev)
  for (let i = period; i < prices.length; i++) {
    prev = prices[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

export function runMomentumSkill(history: PricePoint[]): SkillResult {
  const prices = history.map(p => p.price)

  if (prices.length < 26) {
    return { name: 'momentum', verdict: 'neutral', score: 0, summary: 'Not enough data for momentum analysis.', data: {} }
  }

  const rsi14 = rsi(prices, 14)
  const ema12 = emaArr(prices, 12)
  const ema26 = emaArr(prices, 26)

  const macdLine   = ema12[ema12.length - 1] - ema26[ema26.length - 1]
  const macdValues = ema12.map((v, i) => v - ema26[i]).slice(26)
  const signalLine = macdValues.slice(-9).reduce((a, b) => a + b, 0) / 9
  const histogram  = macdLine - signalLine

  // Rate of change (10-period)
  const roc10 = prices.length >= 11
    ? ((prices[prices.length - 1] - prices[prices.length - 11]) / prices[prices.length - 11]) * 100
    : 0

  let score = 0

  // RSI scoring
  if (rsi14 < 30)      { score += 40 }   // oversold = bullish opportunity
  else if (rsi14 > 70) { score -= 40 }   // overbought = bearish risk
  else if (rsi14 > 50) { score += 15 }
  else                 { score -= 15 }

  // MACD scoring
  if (macdLine > 0)      score += 25
  else                   score -= 25
  if (histogram > 0)     score += 15
  else                   score -= 15

  // ROC
  score += Math.max(-20, Math.min(20, roc10 * 2))

  score = Math.max(-100, Math.min(100, score))
  const verdict = score >= 20 ? 'bullish' : score <= -20 ? 'bearish' : 'neutral'

  const rsiLabel = rsi14 < 30 ? 'oversold' : rsi14 > 70 ? 'overbought' : 'neutral'
  const summary  = `RSI-14 at ${rsi14.toFixed(1)} (${rsiLabel}). MACD ${macdLine > 0 ? 'positive' : 'negative'} at ${macdLine.toFixed(4)} with histogram ${histogram > 0 ? 'above' : 'below'} zero. 10-period ROC: ${roc10.toFixed(2)}%.`

  return {
    name: 'momentum',
    verdict,
    score: Math.round(score),
    summary,
    data: { rsi14, macdLine, signalLine, histogram, roc10 },
  }
}
import type { SkillResult } from '../../models/analysis.model'

interface OHLCVBar { time: number; open: number; high: number; low: number; close: number; volume: number }

export function runVolatilitySkill(bars: OHLCVBar[]): SkillResult {
  if (bars.length < 14) {
    return { name: 'volatility', verdict: 'neutral', score: 0, summary: 'Not enough OHLCV data for volatility analysis.', data: {} }
  }

  const closes = bars.map(b => b.close)
  const latest = closes[closes.length - 1]

  // Bollinger Bands (20-period, 2σ)
  const bbPeriod = Math.min(20, closes.length)
  const bbSlice  = closes.slice(-bbPeriod)
  const bbMean   = bbSlice.reduce((a, b) => a + b, 0) / bbPeriod
  const bbStd    = Math.sqrt(bbSlice.reduce((a, b) => a + (b - bbMean) ** 2, 0) / bbPeriod)
  const bbUpper  = bbMean + 2 * bbStd
  const bbLower  = bbMean - 2 * bbStd
  const bbWidth  = ((bbUpper - bbLower) / bbMean) * 100   // % width
  const bbPct    = (latest - bbLower) / (bbUpper - bbLower) // 0=at lower, 1=at upper

  // ATR (14-period)
  const trueRanges = bars.slice(1).map((b, i) => {
    const prev = bars[i].close
    return Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev))
  })
  const atr = trueRanges.slice(-14).reduce((a, b) => a + b, 0) / 14
  const atrPct = (atr / latest) * 100   // ATR as % of price

  // Volume trend (last 5 vs previous 5)
  const volumes = bars.map(b => b.volume)
  const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5
  const prevVol   = volumes.slice(-10, -5).reduce((a, b) => a + b, 0) / 5
  const volRatio  = prevVol > 0 ? recentVol / prevVol : 1

  let score = 0

  // Near lower band = potential bounce (bullish)
  // Near upper band = potential reversal (bearish)
  if (bbPct < 0.2)      score += 30
  else if (bbPct > 0.8) score -= 30
  else if (bbPct < 0.5) score += 10
  else                  score -= 10

  // High ATR % = high risk/uncertainty (negative for risk management)
  if (atrPct > 5)      score -= 20
  else if (atrPct < 2) score += 10

  // Volume confirmation
  if (volRatio > 1.5) score += 20   // surging volume
  else if (volRatio < 0.7) score -= 10

  score = Math.max(-100, Math.min(100, score))
  const verdict = score >= 20 ? 'bullish' : score <= -20 ? 'bearish' : 'neutral'

  const bbPosition = bbPct < 0.2 ? 'near lower band' : bbPct > 0.8 ? 'near upper band' : 'mid-band'
  const summary = `Price is ${bbPosition} (BB%: ${(bbPct * 100).toFixed(0)}%). ATR is ${atrPct.toFixed(2)}% of price — ${atrPct > 4 ? 'high' : atrPct < 2 ? 'low' : 'moderate'} volatility. Volume ${volRatio > 1.2 ? 'surging' : volRatio < 0.8 ? 'declining' : 'stable'} (${volRatio.toFixed(1)}x recent vs prior).`

  return {
    name: 'volatility',
    verdict,
    score: Math.round(score),
    summary,
    data: { bbUpper, bbLower, bbMean, bbWidth, bbPct, atr, atrPct, volRatio },
  }
}
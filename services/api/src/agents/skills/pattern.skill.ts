import type { SkillResult } from '../../models/analysis.model'

interface OHLCVBar { time: number; open: number; high: number; low: number; close: number; volume: number }

function findSupportResistance(bars: OHLCVBar[]): { support: number; resistance: number } {
  const highs  = bars.map(b => b.high)
  const lows   = bars.map(b => b.low)
  const recent = bars.slice(-20)

  const resistance = Math.max(...recent.map(b => b.high))
  const support    = Math.min(...recent.map(b => b.low))

  return { support, resistance }
}

// Basic candlestick pattern detection on last 3 candles
function detectCandlePattern(bars: OHLCVBar[]): { name: string; bias: 'bullish' | 'bearish' | 'neutral' } | null {
  if (bars.length < 3) return null
  const [prev2, prev1, curr] = bars.slice(-3)

  const body    = (b: OHLCVBar) => Math.abs(b.close - b.open)
  const range   = (b: OHLCVBar) => b.high - b.low
  const isBull  = (b: OHLCVBar) => b.close > b.open
  const isBear  = (b: OHLCVBar) => b.close < b.open

  // Doji — body < 10% of range
  if (body(curr) < range(curr) * 0.1 && range(curr) > 0) {
    return { name: 'Doji', bias: 'neutral' }
  }

  // Hammer — lower shadow > 2x body, small upper shadow, bullish context
  const lowerShadow = Math.min(curr.open, curr.close) - curr.low
  const upperShadow = curr.high - Math.max(curr.open, curr.close)
  if (lowerShadow > body(curr) * 2 && upperShadow < body(curr) * 0.5 && isBear(prev1)) {
    return { name: 'Hammer', bias: 'bullish' }
  }

  // Shooting star — upper shadow > 2x body, at resistance
  if (upperShadow > body(curr) * 2 && lowerShadow < body(curr) * 0.5 && isBull(prev1)) {
    return { name: 'Shooting star', bias: 'bearish' }
  }

  // Bullish engulfing
  if (isBear(prev1) && isBull(curr) && curr.open < prev1.close && curr.close > prev1.open) {
    return { name: 'Bullish engulfing', bias: 'bullish' }
  }

  // Bearish engulfing
  if (isBull(prev1) && isBear(curr) && curr.open > prev1.close && curr.close < prev1.open) {
    return { name: 'Bearish engulfing', bias: 'bearish' }
  }

  // Three white soldiers
  if (isBull(prev2) && isBull(prev1) && isBull(curr) &&
      prev1.close > prev2.close && curr.close > prev1.close) {
    return { name: 'Three white soldiers', bias: 'bullish' }
  }

  // Three black crows
  if (isBear(prev2) && isBear(prev1) && isBear(curr) &&
      prev1.close < prev2.close && curr.close < prev1.close) {
    return { name: 'Three black crows', bias: 'bearish' }
  }

  return null
}

export function runPatternSkill(bars: OHLCVBar[]): SkillResult {
  if (bars.length < 10) {
    return { name: 'pattern', verdict: 'neutral', score: 0, summary: 'Not enough candle data for pattern analysis.', data: {} }
  }

  const latest = bars[bars.length - 1].close
  const { support, resistance } = findSupportResistance(bars)
  const pattern = detectCandlePattern(bars)

  // Distance from S/R as % of range
  const srRange      = resistance - support
  const distFromSup  = srRange > 0 ? ((latest - support) / srRange) * 100 : 50
  const distFromRes  = srRange > 0 ? ((resistance - latest) / srRange) * 100 : 50

  let score = 0

  // Position within S/R range
  if (distFromSup < 15)     score += 35   // near support = potential bounce
  else if (distFromRes < 15) score -= 35   // near resistance = potential rejection
  else if (distFromSup < 40) score += 15
  else if (distFromRes < 40) score -= 15

  // Candle pattern
  if (pattern) {
    if (pattern.bias === 'bullish') score += 30
    else if (pattern.bias === 'bearish') score -= 30
  }

  score = Math.max(-100, Math.min(100, score))
  const verdict = score >= 20 ? 'bullish' : score <= -20 ? 'bearish' : 'neutral'

  const positionLabel = distFromSup < 15
    ? 'near support level'
    : distFromRes < 15
    ? 'near resistance level'
    : 'mid-range'

  const patternText = pattern
    ? ` ${pattern.name} pattern detected (${pattern.bias}).`
    : ' No strong candle pattern detected.'

  const summary = `Support at $${support.toFixed(2)}, resistance at $${resistance.toFixed(2)}. Price is ${positionLabel} (${distFromSup.toFixed(0)}% from support).${patternText}`

  return {
    name: 'pattern',
    verdict,
    score: Math.round(score),
    summary,
    data: { support, resistance, distFromSup, distFromRes, pattern: pattern?.name ?? null, patternBias: pattern?.bias ?? null },
  }
}
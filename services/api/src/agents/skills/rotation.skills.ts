import type { SkillResult } from '../../models/analysis.model'

interface OHLCVBar { time: number; open: number; high: number; low: number; close: number; volume: number }

// ─── Shared math (mirrors trend.skill.ts & volatility.skill.ts) ───────────────

/** EMA array — same implementation as trend.skill.ts */
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

// ─── Sub-condition evaluators ─────────────────────────────────────────────────

/**
 * CONDITION 1 — TREND (from trend.skill.ts logic)
 * ETH/BTC EMA-12 must be above EMA-26 → uptrend in the ratio.
 * This confirms capital is actually flowing toward ETH relative to BTC,
 * not just a volatility spike on a downtrending ratio.
 */
function evalTrend(closes: number[]): {
  isUptrend: boolean
  ema12Last: number
  ema26Last: number
  emaCross: number
} {
  const ema12 = ema(closes, 12)
  const ema26 = ema(closes, 26)
  const ema12Last = ema12[ema12.length - 1]
  const ema26Last = ema26[ema26.length - 1]
  const emaCross  = ema12Last - ema26Last

  return {
    isUptrend: emaCross > 0,
    ema12Last,
    ema26Last,
    emaCross,
  }
}

/**
 * CONDITION 2 — VOLATILITY BREAKOUT (from volatility.skill.ts logic)
 * Latest ETH/BTC close must be above the Bollinger Band upper band (20-period, 2σ).
 * This confirms the ratio is making a statistically significant move, not just noise.
 */
function evalVolatilityBreakout(closes: number[]): {
  isBreakout: boolean
  bbUpper:    number
  bbMean:     number
  bbLower:    number
  bbPct:      number
  bbWidth:    number
} {
  const bbPeriod = Math.min(20, closes.length)
  const bbSlice  = closes.slice(-bbPeriod)
  const bbMean   = bbSlice.reduce((a, b) => a + b, 0) / bbPeriod
  const bbStd    = Math.sqrt(bbSlice.reduce((a, b) => a + (b - bbMean) ** 2, 0) / bbPeriod)
  const bbUpper  = bbMean + 2 * bbStd
  const bbLower  = bbMean - 2 * bbStd
  const bbWidth  = bbMean > 0 ? ((bbUpper - bbLower) / bbMean) * 100 : 0
  const latest   = closes[closes.length - 1]
  const bbPct    = (bbUpper - bbLower) > 0 ? (latest - bbLower) / (bbUpper - bbLower) : 0.5

  return {
    isBreakout: latest > bbUpper,
    bbUpper,
    bbMean,
    bbLower,
    bbPct,
    bbWidth,
  }
}

/**
 * CONDITION 3 — VOLUME SURGE (from volatility.skill.ts logic)
 * Recent 5-bar average volume must be > 1.5× the prior 5-bar average.
 * This confirms the breakout is backed by real capital movement, not thin air.
 */
function evalVolumeSurge(bars: OHLCVBar[]): {
  isVolumeSurging: boolean
  volRatio:        number
  recentVol:       number
  prevVol:         number
} {
  const volumes  = bars.map(b => b.volume)
  const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5
  const prevVol   = volumes.slice(-10, -5).reduce((a, b) => a + b, 0) / 5
  const volRatio  = prevVol > 0 ? recentVol / prevVol : 1

  return {
    isVolumeSurging: prevVol > 0 && volRatio > 1.5,
    volRatio,
    recentVol,
    prevVol,
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * `runRotationSkill`
 *
 * Detects macro market phase shifts between:
 *   - Phase 1 (Bitcoin Dominance) → agent restricts to BTC only
 *   - Phase 2 (Altcoin Season)    → agent opens altcoin scanning
 *
 * Input: OHLCV bars for the ETH/BTC trading pair (not USD pairs).
 * Requires minimum 26 bars to compute EMA-26 reliably.
 *
 * Design: Boolean AND gate — all three conditions must be true.
 * This prevents the "leaky logic" problem where high volatility + volume
 * during a crash (bearish trend) would still trigger a bullish verdict
 * in a weighted scoring system.
 *
 * Score is intentionally binary (0 or 100) because rotation is a
 * discrete state change, not a continuous measurement. Use the
 * individual weighted skills (momentum, trend, volatility) to rank
 * *which* altcoins to buy once this returns 'bullish'.
 */
export function runRotationSkill(ethBtcBars: OHLCVBar[]): SkillResult {
  // Guard: need at least 26 bars for EMA-26 + 10 bars for volume comparison
  if (ethBtcBars.length < 26) {
    return {
      name:    'rotation',
      verdict: 'neutral',
      score:   0,
      summary: 'Not enough ETH/BTC data for rotation analysis. Need at least 26 bars.',
      data:    {},
    }
  }

  const closes = ethBtcBars.map(b => b.close)

  // ── Evaluate all three conditions independently ──────────────────────────
  const trend     = evalTrend(closes)
  const breakout  = evalVolatilityBreakout(closes)
  const volume    = evalVolumeSurge(ethBtcBars)

  const { isUptrend, ema12Last, ema26Last } = trend
  const { isBreakout, bbUpper, bbPct }      = breakout
  const { isVolumeSurging, volRatio }        = volume

  // ── AND gate: all three must be true for Phase 2 ─────────────────────────
  const isRotating = isUptrend && isBreakout && isVolumeSurging

  // ── Build human-readable condition checklist ─────────────────────────────
  const conditionStatus = [
    `Trend (EMA12 > EMA26): ${isUptrend ? '✓' : '✗'} [${ema12Last.toFixed(5)} vs ${ema26Last.toFixed(5)}]`,
    `Volatility breakout (above upper BB): ${isBreakout ? '✓' : '✗'} [BB upper: ${bbUpper.toFixed(5)}, BB%: ${(bbPct * 100).toFixed(0)}%]`,
    `Volume surge (>1.5× prior 5 bars): ${isVolumeSurging ? '✓' : '✗'} [${volRatio.toFixed(2)}×]`,
  ].join(' | ')

  if (isRotating) {
    return {
      name:    'rotation',
      verdict: 'bullish',
      score:   100,
      summary: `⚡ Altcoin rotation triggered. ETH/BTC broke above Bollinger upper band ($${bbUpper.toFixed(5)}) with a confirmed EMA uptrend and ${volRatio.toFixed(1)}× volume surge. Phase 2 (Altcoin Season) active. ${conditionStatus}`,
      data: {
        marketPhase:     'Phase2',
        isUptrend,
        isBreakout,
        isVolumeSurging,
        ema12Last,
        ema26Last,
        emaCross:        trend.emaCross,
        bbUpper,
        bbMean:          breakout.bbMean,
        bbLower:         breakout.bbLower,
        bbPct,
        bbWidth:         breakout.bbWidth,
        volRatio,
        recentVol:       volume.recentVol,
        prevVol:         volume.prevVol,
      },
    }
  }

  // ── Build specific "what's blocking rotation" message ────────────────────
  const blockers: string[] = []
  if (!isUptrend)        blockers.push('EMA trend not aligned (death cross on ETH/BTC)')
  if (!isBreakout)       blockers.push(`no Bollinger breakout (price at ${(bbPct * 100).toFixed(0)}% of band)`)
  if (!isVolumeSurging)  blockers.push(`volume not surging (only ${volRatio.toFixed(2)}× vs prior)`)

  return {
    name:    'rotation',
    verdict: 'neutral',
    score:   0,
    summary: `Phase 1 (Bitcoin Dominance). Rotation blocked by: ${blockers.join('; ')}. ${conditionStatus}`,
    data: {
      marketPhase:     'Phase1',
      isUptrend,
      isBreakout,
      isVolumeSurging,
      ema12Last,
      ema26Last,
      emaCross:        trend.emaCross,
      bbUpper,
      bbMean:          breakout.bbMean,
      bbLower:         breakout.bbLower,
      bbPct,
      bbWidth:         breakout.bbWidth,
      volRatio,
      recentVol:       volume.recentVol,
      prevVol:         volume.prevVol,
    },
  }
}
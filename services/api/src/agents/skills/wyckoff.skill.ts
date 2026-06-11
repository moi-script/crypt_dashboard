
// ============================================================
// wyckoff.skill.ts
// Wyckoff Method: Phase detection (A/B/C/D/E), Spring, UTAD,
// LPS, SOS identification using range + volume analysis
// ============================================================

import { Candle, WyckoffContext, WyckoffPhase, WyckoffEvent, VolumeProfileLevel } from '../chartAnalysis.types';
import { buildVolumeProfile, extractZigZagPivots } from './structure.skill';

const WYCKOFF_RANGE_LOOKBACK = parseInt(process.env.WYCKOFF_RANGE_LOOKBACK || '60');
const VOLUME_SPIKE_MULTIPLIER = 2.0; // volume must be 2x average to qualify as climactic

// ─── Average volume ───────────────────────────────────────────
function avgVolume(candles: Candle[], period = 20): number {
  const recent = candles.slice(-period);
  return recent.reduce((s, c) => s + c.volume, 0) / recent.length;
}

// ─── ATR helper ───────────────────────────────────────────────
function atrValue(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs = candles.slice(-period).map((c, i, arr) => {
    if (i === 0) return c.high - c.low;
    return Math.max(c.high - c.low, Math.abs(c.high - arr[i-1].close), Math.abs(c.low - arr[i-1].close));
  });
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

// ─── Find Trading Range ───────────────────────────────────────
function findTradingRange(candles: Candle[]): { rangeHigh: number; rangeLow: number; rangeCandles: Candle[] } {
  const lookback = candles.slice(-WYCKOFF_RANGE_LOOKBACK);
  const rangeHigh = Math.max(...lookback.map(c => c.high));
  const rangeLow  = Math.min(...lookback.map(c => c.low));
  return { rangeHigh, rangeLow, rangeCandles: lookback };
}

// ─── Detect Volume Climax ─────────────────────────────────────
function isVolumeClimax(candle: Candle, avgVol: number): boolean {
  return candle.volume > avgVol * VOLUME_SPIKE_MULTIPLIER;
}

// ─── Detect Wyckoff Events ────────────────────────────────────
function detectWyckoffEvents(
  candles: Candle[],
  rangeHigh: number,
  rangeLow: number
): { events: WyckoffEvent[]; timestamps: number[] } {
  const events: WyckoffEvent[] = [];
  const timestamps: number[] = [];
  const avgVol = avgVolume(candles);
  const atr = atrValue(candles);
  const pivots = extractZigZagPivots(candles);

  for (let i = 5; i < candles.length; i++) {
    const c = candles[i];
    const prev5 = candles.slice(Math.max(0, i - 5), i);
    const isClimax = isVolumeClimax(c, avgVol);
    const isNearRangeLow  = Math.abs(c.low - rangeLow)  < atr * 1.5;
    const isNearRangeHigh = Math.abs(c.high - rangeHigh) < atr * 1.5;

    // Selling Climax (SC): huge bearish candle near range low on climactic volume
    if (isClimax && isNearRangeLow && c.close < c.open && (c.high - c.low) > atr * 2) {
      events.push('SC');
      timestamps.push(c.timestamp);
      continue;
    }

    // Buying Climax (BCLX): huge bullish candle near range high on climactic volume
    if (isClimax && isNearRangeHigh && c.close > c.open && (c.high - c.low) > atr * 2) {
      events.push('BCLX');
      timestamps.push(c.timestamp);
      continue;
    }

    // Spring: dip below range low followed by recovery (trap bears)
    if (i >= 1) {
      const prev = candles[i - 1];
      if (
        c.low < rangeLow &&
        c.close > rangeLow &&
        c.close > prev.close &&
        candles.slice(i + 1, i + 4).some(future => future && future.close > c.high)
      ) {
        events.push('Spring');
        timestamps.push(c.timestamp);
        continue;
      }
    }

    // UTAD: spike above range high followed by reversal
    if (
      c.high > rangeHigh &&
      c.close < rangeHigh &&
      isClimax
    ) {
      events.push('UTAD');
      timestamps.push(c.timestamp);
      continue;
    }

    // Sign of Strength (SOS): strong up move on increasing volume breaking above resistance
    if (
      c.close > c.open &&
      c.close > rangeHigh * 0.97 &&
      c.volume > avgVol * 1.5 &&
      (c.close - c.open) / (c.high - c.low) > 0.6
    ) {
      events.push('SOS');
      timestamps.push(c.timestamp);
      continue;
    }

    // Last Point of Support (LPS): small pullback on low volume after SOS
    if (
      c.close < c.open &&
      c.volume < avgVol * 0.7 &&
      isNearRangeLow &&
      events.some(e => e === 'SOS')
    ) {
      events.push('LPS');
      timestamps.push(c.timestamp);
      continue;
    }
  }

  return { events, timestamps };
}

// ─── Determine Phase from Events ─────────────────────────────
function determinePhase(
  events: WyckoffEvent[],
  currentPrice: number,
  rangeHigh: number,
  rangeLow: number
): { phase: WyckoffPhase; isAccumulation: boolean; isDistribution: boolean } {
  const hasSC   = events.includes('SC');
  const hasBCLX = events.includes('BCLX');
  const hasSpring = events.includes('Spring');
  const hasUTAD   = events.includes('UTAD');
  const hasSOS    = events.includes('SOS');
  const hasLPS    = events.includes('LPS');

  const rangeSize = rangeHigh - rangeLow;
  const positionInRange = (currentPrice - rangeLow) / rangeSize;

  // Accumulation phases
  if (hasSC && !hasSOS && !hasSpring && positionInRange < 0.5) {
    return { phase: 'B', isAccumulation: true, isDistribution: false };
  }
  if (hasSpring && !hasSOS) {
    return { phase: 'C', isAccumulation: true, isDistribution: false };
  }
  if (hasSOS && hasLPS && positionInRange > 0.7) {
    return { phase: 'D', isAccumulation: true, isDistribution: false };
  }
  if (hasSOS && positionInRange > 0.9) {
    return { phase: 'E', isAccumulation: true, isDistribution: false };
  }

  // Distribution phases
  if (hasBCLX && !hasUTAD && positionInRange > 0.7) {
    return { phase: 'B', isAccumulation: false, isDistribution: true };
  }
  if (hasUTAD) {
    return { phase: 'C', isAccumulation: false, isDistribution: true };
  }

  // Default: still in Phase A (initial stopping)
  return { phase: 'A', isAccumulation: hasSC, isDistribution: hasBCLX };
}

// ─── Volume Analysis ──────────────────────────────────────────
function analyzeVolumeTrend(
  candles: Candle[]
): 'accumulating' | 'distributing' | 'neutral' {
  const recent = candles.slice(-20);
  const first10 = recent.slice(0, 10);
  const last10  = recent.slice(10);

  const avgFirst = first10.reduce((s, c) => s + c.volume, 0) / 10;
  const avgLast  = last10.reduce((s, c) => s + c.volume, 0) / 10;

  // Count up vs down candles by volume
  const upVolFirst  = first10.filter(c => c.close > c.open).reduce((s, c) => s + c.volume, 0);
  const downVolFirst = first10.filter(c => c.close < c.open).reduce((s, c) => s + c.volume, 0);
  const upVolLast   = last10.filter(c => c.close > c.open).reduce((s, c) => s + c.volume, 0);
  const downVolLast  = last10.filter(c => c.close < c.open).reduce((s, c) => s + c.volume, 0);

  if (upVolLast > downVolLast * 1.3 && avgLast > avgFirst * 0.9) return 'accumulating';
  if (downVolLast > upVolLast * 1.3 && avgLast > avgFirst * 0.9) return 'distributing';
  return 'neutral';
}

// ─── Main Detection ───────────────────────────────────────────
export function detectWyckoffRange(
  candles: Candle[],
  volumeProfile?: VolumeProfileLevel[]
): WyckoffContext {
  const { rangeHigh, rangeLow, rangeCandles } = findTradingRange(candles);
  const { events, timestamps } = detectWyckoffEvents(rangeCandles, rangeHigh, rangeLow);
  const currentPrice = candles[candles.length - 1]?.close || 0;
  const { phase, isAccumulation, isDistribution } = determinePhase(events, currentPrice, rangeHigh, rangeLow);
  const lastEvent: WyckoffEvent = events.length > 0 ? events[events.length - 1] : 'unknown';
  const springConfirmed = events.includes('Spring') && events.some((e, i) => i > events.indexOf('Spring') && e === 'SOS');
  const utadRisk = isDistribution && phase === 'C';
  const volumeAnalysis = analyzeVolumeTrend(candles);

  // Generate human-readable summary
  let summary = '';
  if (isAccumulation) {
    summary = `Wyckoff Accumulation Phase ${phase}. `;
    if (springConfirmed) summary += 'Spring confirmed with SOS follow-through. ';
    else if (events.includes('Spring')) summary += 'Spring detected, awaiting SOS confirmation. ';
    else if (phase === 'B') summary += 'Range building after SC. Watch for Spring near ' + rangeLow.toFixed(2) + '. ';
    summary += `Range: ${rangeLow.toFixed(2)} - ${rangeHigh.toFixed(2)}.`;
  } else if (isDistribution) {
    summary = `Wyckoff Distribution Phase ${phase}. `;
    if (utadRisk) summary += 'UTAD risk at range high ' + rangeHigh.toFixed(2) + '. ';
    summary += `Range: ${rangeLow.toFixed(2)} - ${rangeHigh.toFixed(2)}.`;
  } else {
    summary = `Wyckoff Phase ${phase} — structure unclear. Range: ${rangeLow.toFixed(2)} - ${rangeHigh.toFixed(2)}.`;
  }

  return {
    phase,
    last_event: lastEvent,
    spring_confirmed: springConfirmed,
    utad_risk: utadRisk,
    range_high: rangeHigh,
    range_low: rangeLow,
    cause_count: rangeCandles.length,
    volume_analysis: volumeAnalysis,
    summary,
  };
}


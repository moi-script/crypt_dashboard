
// ============================================================
// fibonacci.skill.ts
// Fibonacci tools: Retracements, Extensions, Fan, Arcs, Time Zones
// ============================================================

import { Candle, FibonacciLevels, SwingPivot } from '../chartAnalysis.types';
import { extractZigZagPivots } from './structure.skill';

// ─── Standard Fibonacci ratios ────────────────────────────────
const RETRACEMENT_RATIOS = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
const EXTENSION_RATIOS   = [1.0, 1.272, 1.414, 1.618, 2.0, 2.618, 3.618];

// ─── Find swing from candles ──────────────────────────────────
function findRecentSwing(candles: Candle[]): { swingHigh: number; swingLow: number; highTs: number; lowTs: number; isBullish: boolean } {
  const pivots = extractZigZagPivots(candles);
  if (pivots.length < 2) {
    const prices = candles.map(c => c.close);
    return {
      swingHigh: Math.max(...prices),
      swingLow: Math.min(...prices),
      highTs: candles.find(c => c.close === Math.max(...prices))?.timestamp || 0,
      lowTs:  candles.find(c => c.close === Math.min(...prices))?.timestamp || 0,
      isBullish: candles[candles.length - 1].close > candles[0].close,
    };
  }

  // Find the most recent major swing (last significant high and low)
  const recentPivots = pivots.slice(-4);
  const highs = recentPivots.filter(p => p.type === 'high');
  const lows  = recentPivots.filter(p => p.type === 'low');

  const swingHigh = highs.length > 0 ? Math.max(...highs.map(p => p.price)) : candles[candles.length - 1].high;
  const swingLow  = lows.length  > 0 ? Math.min(...lows.map(p => p.price)) : candles[candles.length - 1].low;
  const highTs    = highs.find(p => p.price === swingHigh)?.timestamp || 0;
  const lowTs     = lows.find(p => p.price === swingLow)?.timestamp || 0;

  // Current direction
  const lastPivot = pivots[pivots.length - 1];
  const isBullish = lastPivot.type === 'low'; // last pivot was a low → trending up

  return { swingHigh, swingLow, highTs, lowTs, isBullish };
}

// ─── Fibonacci Retracements + Extensions ─────────────────────
export function calculateFibonacciLevels(candles: Candle[]): FibonacciLevels {
  const { swingHigh, swingLow, highTs, lowTs, isBullish } = findRecentSwing(candles);
  const move = swingHigh - swingLow;
  const currentPrice = candles[candles.length - 1].close;

  const retracementLevels: Record<string, number> = {};
  const extensionLevels: Record<string, number> = {};

  if (isBullish) {
    // Price moved up: retracements go down from high
    for (const r of RETRACEMENT_RATIOS) {
      retracementLevels[r.toString()] = swingHigh - move * r;
    }
    // Extensions go above the high
    for (const e of EXTENSION_RATIOS) {
      extensionLevels[e.toString()] = swingLow + move * e;
    }
  } else {
    // Price moved down: retracements go up from low
    for (const r of RETRACEMENT_RATIOS) {
      retracementLevels[r.toString()] = swingLow + move * r;
    }
    for (const e of EXTENSION_RATIOS) {
      extensionLevels[e.toString()] = swingHigh - move * e;
    }
  }

  // Find nearest fib level to current price
  let nearestLabel: string | undefined;
  let minDistance = Infinity;
  for (const [label, price] of Object.entries(retracementLevels)) {
    const dist = Math.abs(price - currentPrice);
    if (dist < minDistance) {
      minDistance = dist;
      nearestLabel = label;
    }
  }

  return {
    swing_high: swingHigh,
    swing_low: swingLow,
    swing_high_ts: highTs,
    swing_low_ts: lowTs,
    direction: isBullish ? 'bullish_retracement' : 'bearish_retracement',
    levels: retracementLevels,
    extensions: extensionLevels,
    current_price_near: nearestLabel,
  };
}

// ─── Fibonacci Fan Levels ─────────────────────────────────────
// Fan lines project Fib ratios from a swing point along time
export function calculateFibFan(
  swingHigh: number,
  swingLow: number,
  swingTs: number,
  currentTs: number
): Record<string, number> {
  const ratios = [0.382, 0.5, 0.618];
  const move = swingHigh - swingLow;
  const timeDelta = currentTs - swingTs;
  const fanLevels: Record<string, number> = {};

  for (const r of ratios) {
    // Simplified fan: price level at current time along fib trajectory
    fanLevels[r.toString()] = swingLow + move * r;
  }

  return fanLevels;
}

// ─── Fibonacci Time Zones ─────────────────────────────────────
// Projects Fibonacci number sequence forward in time bars
export function calculateFibTimeZones(
  startTimestamp: number,
  barDurationMs: number,
  count = 13
): number[] {
  const fibSequence = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
  return fibSequence.slice(0, count).map(n => startTimestamp + n * barDurationMs);
}

// ─── Check if price is near a key Fibonacci level ─────────────
export function isPriceNearFibLevel(
  price: number,
  fibLevels: FibonacciLevels,
  tolerancePct = 0.005
): { isNear: boolean; nearestLevel: string; distance_pct: number } {
  let nearestLevel = '';
  let minDistance = Infinity;

  for (const [label, fibPrice] of Object.entries(fibLevels.levels)) {
    const dist = Math.abs(price - fibPrice) / price;
    if (dist < minDistance) {
      minDistance = dist;
      nearestLevel = label;
    }
  }

  return {
    isNear: minDistance <= tolerancePct,
    nearestLevel,
    distance_pct: minDistance,
  };
}

// ─── Fib cluster finder (confluence with other levels) ────────
export function findFibClusters(
  fibLevels: FibonacciLevels,
  otherLevels: number[],
  tolerancePct = 0.01
): Array<{ price: number; fib_label: string; confluences: number[] }> {
  const clusters: Array<{ price: number; fib_label: string; confluences: number[] }> = [];

  for (const [label, fibPrice] of Object.entries(fibLevels.levels)) {
    const nearby = otherLevels.filter(l => Math.abs(l - fibPrice) / fibPrice <= tolerancePct);
    if (nearby.length > 0) {
      clusters.push({ price: fibPrice, fib_label: label, confluences: nearby });
    }
  }

  return clusters;
}



// ============================================================
// gann.skill.ts
// Gann angles and time cycle detection.
// Feature-flagged — only runs when ENABLE_GANN=true.
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { Candle, SwingPivot } from '../chartAnalysis.types';
import { extractZigZagPivots } from './structure.skill';

// ─── Feature flag guard ───────────────────────────────────────
function isEnabled(): boolean {
  return process.env.ENABLE_GANN === 'true';
}

// ─── Types ────────────────────────────────────────────────────
export interface GannAngle {
  ratio:       string;   // e.g. '1x1', '2x1', '1x2'
  degrees:     number;
  slope:       number;   // price per bar
  price_at_current_bar: number;
  direction:   'up' | 'down';
  origin_price: number;
  origin_bar:   number;
}

export interface GannCycle {
  type:        'time_square' | 'seasonal' | 'natural';
  bars_from_pivot: number;
  due_bar:     number;
  due_date_estimate?: string; // ISO, if bar duration known
  description: string;
}

// ─── Standard Gann angle ratios ──────────────────────────────
const GANN_ANGLES = [
  { ratio: '8x1', degrees: 82.5, multiplier: 8 },
  { ratio: '4x1', degrees: 75.0, multiplier: 4 },
  { ratio: '3x1', degrees: 71.25, multiplier: 3 },
  { ratio: '2x1', degrees: 63.75, multiplier: 2 },
  { ratio: '1x1', degrees: 45.0,  multiplier: 1 },   // Most important
  { ratio: '1x2', degrees: 26.25, multiplier: 0.5 },
  { ratio: '1x3', degrees: 18.75, multiplier: 0.333 },
  { ratio: '1x4', degrees: 15.0,  multiplier: 0.25 },
  { ratio: '1x8', degrees: 7.5,   multiplier: 0.125 },
];

// ─── Natural number squares (Gann square of nine key levels) ─
const NATURAL_SQUARES = [1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 144, 169, 196, 225, 256, 289, 324, 361];

// ─── Calculate Gann Angles from a pivot ──────────────────────
export function calculateGannAngles(
  candles: Candle[],
  pivots?: SwingPivot[]
): GannAngle[] {
  if (!isEnabled()) return [];

  const pivotList = pivots || extractZigZagPivots(candles);
  if (pivotList.length < 2) return [];

  const result: GannAngle[] = [];
  const currentBar = candles.length - 1;

  // Use the most recent significant swing low (for upward angles) and high (for downward)
  const lastLow  = [...pivotList].reverse().find(p => p.type === 'low');
  const lastHigh = [...pivotList].reverse().find(p => p.type === 'high');

  // Price unit = ATR as proxy for "1 unit"
  const atr = candles.slice(-14).reduce((s, c, i, arr) => {
    if (i === 0) return s + (c.high - c.low);
    return s + Math.max(c.high - c.low, Math.abs(c.high - arr[i-1].close), Math.abs(c.low - arr[i-1].close));
  }, 0) / 14;

  for (const pivot of [lastLow, lastHigh].filter(Boolean) as SwingPivot[]) {
    const originBar = candles.findIndex(c => c.timestamp === pivot.timestamp);
    if (originBar < 0) continue;

    const barsElapsed = currentBar - originBar;
    const direction: 'up' | 'down' = pivot.type === 'low' ? 'up' : 'down';

    for (const angle of GANN_ANGLES) {
      const slope = atr * angle.multiplier;
      const priceAtCurrentBar = direction === 'up'
        ? pivot.price + slope * barsElapsed
        : pivot.price - slope * barsElapsed;

      result.push({
        ratio:        angle.ratio,
        degrees:      angle.degrees,
        slope,
        price_at_current_bar: parseFloat(priceAtCurrentBar.toFixed(4)),
        direction,
        origin_price: pivot.price,
        origin_bar:   originBar,
      });
    }
  }

  return result;
}

// ─── Detect Gann Time Cycles ──────────────────────────────────
export function detectGannTimeCycles(
  candles: Candle[],
  barDurationMs = 14400000 // 4H default
): GannCycle[] {
  if (!isEnabled()) return [];

  const result: GannCycle[] = [];
  const currentBar = candles.length - 1;

  // Fibonacci-based cycles from current bar
  const fibCycles = [8, 13, 21, 34, 55, 89, 144, 233];
  for (const bars of fibCycles) {
    const dueBar = currentBar + bars;
    const dueTs  = candles[currentBar].timestamp + bars * barDurationMs;
    result.push({
      type:   'natural',
      bars_from_pivot: bars,
      due_bar: dueBar,
      due_date_estimate: new Date(dueTs).toISOString(),
      description: `Fibonacci ${bars}-bar cycle due`,
    });
  }

  // Square of 9 time cycles (90°, 180°, 270°, 360° multiples)
  const squareCycles = [90, 180, 270, 360, 450, 540, 630, 720];
  for (const days of squareCycles) {
    const bars = Math.round(days / (barDurationMs / 3600000));
    const dueBar = currentBar + bars;
    const dueTs  = candles[currentBar].timestamp + bars * barDurationMs;
    result.push({
      type:   'time_square',
      bars_from_pivot: bars,
      due_bar: dueBar,
      due_date_estimate: new Date(dueTs).toISOString(),
      description: `Gann ${days}° time cycle`,
    });
  }

  return result;
}

// ─── Check if current price is on a Gann angle ───────────────
export function isPriceOnAngle(
  currentPrice: number,
  angles: GannAngle[],
  tolerancePct = 0.005
): GannAngle[] {
  if (!isEnabled()) return [];
  return angles.filter(a =>
    Math.abs(a.price_at_current_bar - currentPrice) / currentPrice <= tolerancePct
  );
}

// ─── Generate Gann context block for LLM primitives ──────────
export function buildGannContext(
  candles: Candle[],
  pivots?: SwingPivot[]
): {
  angles_in_play: string[];
  price_on_angle: string;
  time_cycle_due: boolean;
  next_cycle_date?: string;
} | null {
  if (!isEnabled()) return null;

  const angles = calculateGannAngles(candles, pivots);
  const cycles = detectGannTimeCycles(candles);
  const currentPrice = candles[candles.length - 1].close;

  const onAngle = isPriceOnAngle(currentPrice, angles);
  const nextCycle = cycles.sort((a, b) => a.due_bar - b.due_bar)[0];
  const cycleDueSoon = nextCycle && (nextCycle.due_bar - (candles.length - 1)) <= 5;

  return {
    angles_in_play: angles
      .filter(a => Math.abs(a.price_at_current_bar - currentPrice) / currentPrice <= 0.02)
      .map(a => `${a.ratio} (${a.degrees}°) ${a.direction} from ${a.origin_price.toFixed(2)}`),
    price_on_angle: onAngle.length > 0
      ? `${onAngle[0].ratio} angle — ${onAngle[0].degrees}°`
      : 'none',
    time_cycle_due: cycleDueSoon,
    next_cycle_date: nextCycle?.due_date_estimate,
  };
}

// ============================================================
// pivots.skill.ts
// Pivot Points: Standard, Camarilla, Fibonacci variants
// Also detects psychological price levels
// ============================================================

import { Candle, PivotPoints } from '../chartAnalysis.types';

// ─── Standard Pivot Points (floor trader pivots) ──────────────
export function calculateStandardPivots(candles: Candle[]): PivotPoints {
  // Use previous session/day's HLC
  const prev = candles.length >= 2 ? candles[candles.length - 2] : candles[candles.length - 1];
  const H = prev.high;
  const L = prev.low;
  const C = prev.close;

  const pp = (H + L + C) / 3;
  const r1 = 2 * pp - L;
  const s1 = 2 * pp - H;
  const r2 = pp + (H - L);
  const s2 = pp - (H - L);
  const r3 = H + 2 * (pp - L);
  const s3 = L - 2 * (H - pp);

  return { method: 'standard', pp, r1, r2, r3, s1, s2, s3 };
}

// ─── Camarilla Pivot Points ───────────────────────────────────
// Camarilla is known for tighter resistance/support levels
export function calculateCamarillaPivots(candles: Candle[]): PivotPoints {
  const prev = candles.length >= 2 ? candles[candles.length - 2] : candles[candles.length - 1];
  const H = prev.high;
  const L = prev.low;
  const C = prev.close;
  const range = H - L;

  const pp = (H + L + C) / 3; // Same PP as standard
  const r1 = C + range * 1.0833;
  const r2 = C + range * 1.1666;
  const r3 = C + range * 1.2500;
  const s1 = C - range * 1.0833;
  const s2 = C - range * 1.1666;
  const s3 = C - range * 1.2500;

  return { method: 'camarilla', pp, r1, r2, r3, s1, s2, s3 };
}

// ─── Fibonacci Pivot Points ───────────────────────────────────
export function calculateFibonacciPivots(candles: Candle[]): PivotPoints {
  const prev = candles.length >= 2 ? candles[candles.length - 2] : candles[candles.length - 1];
  const H = prev.high;
  const L = prev.low;
  const C = prev.close;
  const range = H - L;

  const pp = (H + L + C) / 3;
  const r1 = pp + 0.382 * range;
  const r2 = pp + 0.618 * range;
  const r3 = pp + 1.000 * range;
  const s1 = pp - 0.382 * range;
  const s2 = pp - 0.618 * range;
  const s3 = pp - 1.000 * range;

  return { method: 'fibonacci', pp, r1, r2, r3, s1, s2, s3 };
}

// ─── Psychological Levels ─────────────────────────────────────
export function calculatePsychologicalLevels(currentPrice: number): number[] {
  const levels: number[] = [];

  // Determine step size based on price magnitude
  let step: number;
  if      (currentPrice > 50000) step = 5000;
  else if (currentPrice > 10000) step = 1000;
  else if (currentPrice > 1000)  step = 100;
  else if (currentPrice > 100)   step = 10;
  else if (currentPrice > 10)    step = 1;
  else if (currentPrice > 1)     step = 0.1;
  else                           step = 0.01;

  const halfStep = step / 2;
  const range = currentPrice * 0.25; // ±25% of current price

  // Round numbers (e.g. 40000, 41000, 42000)
  const startRound = Math.floor((currentPrice - range) / step) * step;
  const endRound   = Math.ceil((currentPrice + range) / step) * step;
  for (let p = startRound; p <= endRound; p += step) {
    levels.push(parseFloat(p.toFixed(8)));
  }

  // Half-round numbers (e.g. 40500, 41500)
  const startHalf = Math.floor((currentPrice - range) / halfStep) * halfStep;
  for (let p = startHalf; p <= endRound; p += halfStep) {
    if (!levels.includes(p)) levels.push(parseFloat(p.toFixed(8)));
  }

  return levels
    .filter(l => Math.abs(l - currentPrice) / currentPrice <= 0.25)
    .sort((a, b) => a - b);
}

// ─── Nearest pivot level to current price ────────────────────
export function nearestPivotLevel(
  price: number,
  pivots: PivotPoints
): { level: number; label: string; type: 'support' | 'resistance' | 'pivot' } {
  const levels = [
    { level: pivots.pp, label: 'PP', type: 'pivot' as const },
    { level: pivots.r1, label: 'R1', type: 'resistance' as const },
    { level: pivots.r2, label: 'R2', type: 'resistance' as const },
    { level: pivots.r3, label: 'R3', type: 'resistance' as const },
    { level: pivots.s1, label: 'S1', type: 'support' as const },
    { level: pivots.s2, label: 'S2', type: 'support' as const },
    { level: pivots.s3, label: 'S3', type: 'support' as const },
  ];

  return levels.reduce((nearest, curr) =>
    Math.abs(curr.level - price) < Math.abs(nearest.level - price) ? curr : nearest
  );
}

// ─── Check if price is within pivot zone ─────────────────────
export function isPriceAtPivot(price: number, pivots: PivotPoints, tolerancePct = 0.005): boolean {
  const nearest = nearestPivotLevel(price, pivots);
  return Math.abs(nearest.level - price) / price <= tolerancePct;
}


// ============================================================
// harmonics.skill.ts
// Harmonic pattern detection: Gartley, Bat, Butterfly, Crab, Cypher
// Uses Fibonacci ratio validation on XABCD pivot structures
// ============================================================

import { Candle, HarmonicPattern, SwingPivot } from '../chartAnalysis.types';
import { extractZigZagPivots } from './structure.skill';

// ─── Harmonic Pattern Ratios ──────────────────────────────────
// Each pattern defines valid Fibonacci ratio ranges for each leg
// Format: [min, max] for each ratio
interface PatternRatios {
  XAB: [number, number];  // B retracement of XA
  ABC: [number, number];  // C retracement of AB
  BCD: [number, number];  // D extension of BC
  XAD: [number, number];  // D retracement of XA (for PRZ validation)
}

const PATTERNS: Record<string, PatternRatios> = {
  Gartley: {
    XAB: [0.598, 0.638],   // B = 0.618 of XA
    ABC: [0.362, 0.886],   // C = 0.382-0.886 of AB
    BCD: [1.13,  1.618],   // D = 1.13-1.618 of BC
    XAD: [0.748, 0.808],   // D = 0.786 of XA (PRZ)
  },
  Bat: {
    XAB: [0.35,  0.5],     // B = 0.382-0.5 of XA
    ABC: [0.362, 0.886],
    BCD: [1.618, 2.618],
    XAD: [0.836, 0.916],   // D = 0.886 of XA (deep PRZ)
  },
  Butterfly: {
    XAB: [0.748, 0.808],   // B = 0.786 of XA
    ABC: [0.362, 0.886],
    BCD: [1.618, 2.618],
    XAD: [1.228, 1.308],   // D = 1.272 extension of XA
  },
  Crab: {
    XAB: [0.35,  0.618],
    ABC: [0.362, 0.886],
    BCD: [2.24,  3.618],
    XAD: [1.568, 1.668],   // D = 1.618 extension of XA
  },
  Cypher: {
    XAB: [0.362, 0.618],
    ABC: [1.13,  1.418],   // C extends beyond A
    BCD: [0.718, 0.808],   // D = 0.786 of XC
    XAD: [0.718, 0.808],
  },
};

const RATIO_TOLERANCE = 0.025; // ±2.5% tolerance

// ─── Helpers ─────────────────────────────────────────────────
function ratio(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.abs(a) / Math.abs(b);
}

function isInRange(val: number, min: number, max: number, tol = RATIO_TOLERANCE): boolean {
  return val >= min - tol && val <= max + tol;
}

// ─── Validate XABCD against a specific pattern ───────────────
function validatePattern(
  X: number, A: number, B: number, C: number, D: number,
  patternName: string,
  patios: PatternRatios
): { valid: boolean; completion: number; ratios: { XAB: number; ABC: number; BCD: number; XAD: number } } {
  const XA  = Math.abs(A - X);
  const AB  = Math.abs(B - A);
  const BC  = Math.abs(C - B);
  const CD  = Math.abs(D - C);
  const XAD_leg = Math.abs(D - X);

  const XAB = ratio(AB, XA);
  const ABC = ratio(BC, AB);
  const BCD = ratio(CD, BC);
  const XAD = ratio(XAD_leg, XA);

  const scores = [
    isInRange(XAB, patios.XAB[0], patios.XAB[1]) ? 1 : 0,
    isInRange(ABC, patios.ABC[0], patios.ABC[1]) ? 1 : 0,
    isInRange(BCD, patios.BCD[0], patios.BCD[1]) ? 1 : 0,
    isInRange(XAD, patios.XAD[0], patios.XAD[1]) ? 1 : 0,
  ];

  const completion = (scores.reduce((a, b) => a + b, 0) / scores.length) * 100;
  const valid = completion >= 75; // at least 3/4 ratios must validate

  return { valid, completion, ratios: { XAB, ABC, BCD, XAD } };
}

// ─── Calculate PRZ (Potential Reversal Zone) ──────────────────
function calculatePRZ(
  X: number, A: number, B: number, C: number,
  patternName: string
): { przHigh: number; przLow: number } {
  const pattern = PATTERNS[patternName];
  if (!pattern) return { przHigh: C, przLow: C };

  const XA = Math.abs(A - X);
  const BC = Math.abs(C - B);
  const isBullish = A < X; // X is higher, A is lower → bullish reversal at D

  // PRZ is a zone defined by multiple Fibonacci projections
  let przLevels: number[] = [];

  if (isBullish) {
    // Bullish: D is below C, PRZ is a buy zone
    przLevels = [
      A + XA * pattern.XAD[0],  // Lower bound of XAD target
      A + XA * pattern.XAD[1],  // Upper bound of XAD target
      C - BC * pattern.BCD[0],  // Lower bound of BCD projection
      C - BC * pattern.BCD[1],  // Upper bound of BCD projection
    ].map(l => A - (l - A)); // Mirror for bullish
  } else {
    // Bearish: D is above C
    przLevels = [
      X - XA * pattern.XAD[0],
      X - XA * pattern.XAD[1],
    ];
  }

  const validLevels = przLevels.filter(l => !isNaN(l) && isFinite(l));
  if (validLevels.length === 0) return { przHigh: C * 1.01, przLow: C * 0.99 };

  return {
    przHigh: Math.max(...validLevels),
    przLow:  Math.min(...validLevels),
  };
}

// ─── Main Harmonic Pattern Detector ──────────────────────────
export function detectHarmonicPatterns(
  pivots: SwingPivot[]
): HarmonicPattern[] {
  const patterns: HarmonicPattern[] = [];

  if (pivots.length < 5) return patterns;

  // Scan all 5-pivot combinations from the recent pivots
  const recentPivots = pivots.slice(-10); // last 10 pivots max

  for (let i = 0; i <= recentPivots.length - 5; i++) {
    const [pX, pA, pB, pC, pD] = recentPivots.slice(i, i + 5);

    // Alternating highs and lows check
    if (pX.type === pA.type) continue; // must alternate

    const X = pX.price;
    const A = pA.price;
    const B = pB.price;
    const C = pC.price;
    const D = pD.price;

    // Determine direction: bullish = XABCD where D is buy zone, bearish = sell zone
    const isBullish = X > A && B > A && C < B && D < C; // simplified: zig-zag down to D
    const isBearish = X < A && B < A && C > B && D > C; // zig-zag up to D

    if (!isBullish && !isBearish) continue;

    for (const [patternName, ratios] of Object.entries(PATTERNS)) {
      const result = validatePattern(X, A, B, C, D, patternName, ratios);

      if (result.valid || result.completion >= 75) {
        const { przHigh, przLow } = calculatePRZ(X, A, B, C, patternName);

        patterns.push({
          name: patternName as HarmonicPattern['name'],
          direction: isBullish ? 'bullish' : 'bearish',
          prz_high: przHigh,
          prz_low: przLow,
          xabcd: {
            X, A, B, C, D,
            X_ts: pX.timestamp,
            A_ts: pA.timestamp,
            B_ts: pB.timestamp,
            C_ts: pC.timestamp,
            D_ts: pD.timestamp,
          },
          completion_pct: result.completion,
          ratios: result.ratios,
        });
      }
    }
  }

  // Return best pattern (highest completion, must be > 75%)
  return patterns
    .filter(p => p.completion_pct >= 75)
    .sort((a, b) => b.completion_pct - a.completion_pct)
    .slice(0, 3);
}

// ─── Candle-based entry point ─────────────────────────────────
export function analyzeHarmonics(
  candles: Candle[],
  threshold = parseFloat(process.env.ZIGZAG_THRESHOLD || '0.03')
): HarmonicPattern | null {
  const pivots = extractZigZagPivots(candles, threshold);
  const patterns = detectHarmonicPatterns(pivots);
  return patterns.length > 0 ? patterns[0] : null;
}

// ─── Check if price is in PRZ ─────────────────────────────────
export function isPriceInPRZ(price: number, pattern: HarmonicPattern): boolean {
  return price >= pattern.prz_low && price <= pattern.prz_high;
}

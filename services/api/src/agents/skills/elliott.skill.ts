

// ============================================================
// elliott.skill.ts
// Elliott Wave analysis: ZigZag pivot extraction, wave counting,
// Fibonacci ratio validation, invalidation levels
// ============================================================

import { Candle, SwingPivot, ElliottWaveResult, ElliottWaveCount } from '../chartAnalysis.types';
import { extractZigZagPivots } from './structure.skill';

// ─── Fibonacci ratios for validation ─────────────────────────
const FIB = {
  0.236: 0.236,
  0.382: 0.382,
  0.5:   0.5,
  0.618: 0.618,
  0.786: 0.786,
  1.0:   1.0,
  1.272: 1.272,
  1.618: 1.618,
  2.618: 2.618,
};

const TOLERANCE = 0.05; // 5% tolerance on Fibonacci ratios

function isNear(ratio: number, target: number, tol = TOLERANCE): boolean {
  return Math.abs(ratio - target) <= tol;
}

function fibRetracement(start: number, end: number, retrace: number): number {
  const move = end - start;
  return end - move * retrace;
}

// ─── Wave Ratio Calculation ───────────────────────────────────
function waveLength(start: number, end: number): number {
  return Math.abs(end - start);
}

function retracement(wave1Start: number, wave1End: number, wave2End: number): number {
  const wave1 = waveLength(wave1Start, wave1End);
  const w2retr = Math.abs(wave2End - wave1End);
  return w2retr / wave1;
}

// ─── Elliott Rules Validation ─────────────────────────────────
// Returns array of rules passed/failed
function validateImpulseRules(
  p0: number, p1: number, p2: number, p3: number, p4: number, p5: number
): { passed: string[]; failed: string[]; valid: boolean } {
  const passed: string[] = [];
  const failed: string[] = [];

  const bullish = p1 > p0; // direction

  const w1 = waveLength(p0, p1);
  const w2 = waveLength(p1, p2);
  const w3 = waveLength(p2, p3);
  const w4 = waveLength(p3, p4);
  const w5 = waveLength(p4, p5);

  // Rule 1: Wave 2 cannot retrace more than 100% of Wave 1
  const w2Retr = w2 / w1;
  if (w2Retr < 1.0) {
    passed.push('Wave 2 retracement < 100% of Wave 1');
  } else {
    failed.push(`Wave 2 retracement ${(w2Retr * 100).toFixed(1)}% violates 100% rule`);
  }

  // Rule 2: Wave 3 cannot be the shortest impulse wave
  if (w3 > w1 && w3 > w5) {
    passed.push('Wave 3 is not the shortest');
  } else {
    failed.push('Wave 3 is the shortest impulse wave — invalid');
  }

  // Rule 3: Wave 4 cannot overlap with Wave 1 (in cash markets)
  if (bullish) {
    if (p4 > p1) {
      passed.push('Wave 4 does not overlap Wave 1 territory');
    } else {
      failed.push('Wave 4 overlaps Wave 1 — invalid impulse');
    }
  } else {
    if (p4 < p1) {
      passed.push('Wave 4 does not overlap Wave 1 territory');
    } else {
      failed.push('Wave 4 overlaps Wave 1 — invalid impulse');
    }
  }

  // Guideline: Wave 2 typically retraces 50-78.6% of Wave 1
  const w2Guide = retracement(p0, p1, p2);
  if (w2Guide >= 0.382 && w2Guide <= 0.886) {
    passed.push(`Wave 2 retracement ${(w2Guide * 100).toFixed(1)}% is in typical range`);
  }

  // Guideline: Wave 3 is often 1.618x Wave 1
  const w3ToW1 = w3 / w1;
  if (isNear(w3ToW1, 1.618) || isNear(w3ToW1, 2.618)) {
    passed.push(`Wave 3 = ${w3ToW1.toFixed(3)}x Wave 1 (Fibonacci)`);
  }

  // Guideline: Wave 4 typically retraces 38.2% of Wave 3
  const w4Guide = retracement(p2, p3, p4);
  if (isNear(w4Guide, 0.382) || isNear(w4Guide, 0.5)) {
    passed.push(`Wave 4 retracement ${(w4Guide * 100).toFixed(1)}% is typical`);
  }

  const valid = !failed.some(f => f.includes('invalid'));
  return { passed, failed, valid };
}

// ─── Wave Count from Pivots ───────────────────────────────────
export function validateElliottRules(pivots: SwingPivot[]): ElliottWaveResult {
  const defaultResult: ElliottWaveResult = {
    wave_count: 'unknown',
    pivots: pivots.map(p => p.price),
    pivot_timestamps: pivots.map(p => p.timestamp),
    confidence: 0,
    rules_passed: [],
    rules_failed: ['Insufficient pivot data'],
  };

  if (pivots.length < 6) return defaultResult;

  // Try to find 5-wave impulse in the most recent pivots
  const recentPivots = pivots.slice(-9); // look at last 9 pivots max

  // Try different starting points for 5-wave count
  for (let start = 0; start <= recentPivots.length - 6; start++) {
    const p = recentPivots.slice(start, start + 6);
    const prices = p.map(x => x.price);

    // Determine if this is a bullish or bearish impulse
    const isBullish = prices[1] > prices[0];

    // For bullish: p0 < p1 > p2 < p3 > p4 < p5 (with p1, p3, p5 progressively higher)
    const alternationOk = isBullish
      ? prices[1] > prices[0] && prices[2] < prices[1] && prices[3] > prices[2] && prices[4] < prices[3] && prices[5] > prices[4]
      : prices[1] < prices[0] && prices[2] > prices[1] && prices[3] < prices[2] && prices[4] > prices[3] && prices[5] < prices[4];

    if (!alternationOk) continue;

    const validation = validateImpulseRules(...prices as [number, number, number, number, number, number]);

    if (validation.valid) {
      // Determine current wave position
      const lastPivot = recentPivots[recentPivots.length - 1];
      let wave_count: ElliottWaveCount = 'unknown';

      if (lastPivot === p[5]) wave_count = 'wave_5_in_progress';
      else if (lastPivot === p[4]) wave_count = 'wave_4';
      else if (lastPivot === p[3]) wave_count = 'wave_3_in_progress';
      else if (lastPivot === p[2]) wave_count = 'wave_2';
      else if (lastPivot === p[1]) wave_count = 'wave_1';

      // Calculate targets
      const w1Length = Math.abs(prices[1] - prices[0]);
      const nextTarget = isBullish
        ? prices[4] + w1Length * 1.618  // Wave 5 = 1.618 x Wave 1
        : prices[4] - w1Length * 1.618;

      const confidence = Math.min(
        (validation.passed.length / (validation.passed.length + validation.failed.length)) * 100,
        95
      );

      return {
        wave_count,
        pivots: prices,
        pivot_timestamps: p.map(x => x.timestamp),
        confidence: confidence / 100,
        next_target: nextTarget,
        invalidation_level: isBullish ? prices[0] : prices[0],
        rules_passed: validation.passed,
        rules_failed: validation.failed,
      };
    }
  }

  // Try ABC correction
  if (pivots.length >= 4) {
    const recent = pivots.slice(-4);
    const prices = recent.map(p => p.price);
    const isBullishCorrection = prices[0] > prices[1]; // down, up, down = bearish ABC

    if (
      isBullishCorrection &&
      prices[1] < prices[0] &&
      prices[2] > prices[1] &&
      prices[3] < prices[2]
    ) {
      const wA = Math.abs(prices[1] - prices[0]);
      const wC = Math.abs(prices[3] - prices[2]);
      const isEqualWaves = isNear(wC / wA, 1.0, 0.1);

      return {
        wave_count: 'wave_c',
        pivots: prices,
        pivot_timestamps: recent.map(p => p.timestamp),
        confidence: isEqualWaves ? 0.65 : 0.45,
        rules_passed: isEqualWaves ? ['Wave C ≈ Wave A (equal legs)'] : [],
        rules_failed: [],
      };
    }
  }

  return {
    ...defaultResult,
    rules_failed: ['No valid wave pattern found in recent pivots'],
  };
}

// ─── Main entry point ─────────────────────────────────────────
export function analyzeElliottWave(
  candles: Candle[],
  threshold = parseFloat(process.env.ZIGZAG_THRESHOLD || '0.03')
): ElliottWaveResult {
  const pivots = extractZigZagPivots(candles, threshold);
  return validateElliottRules(pivots);
}

// ─── Fibonacci targets from wave structure ────────────────────
export function getElliottTargets(
  wave1Start: number,
  wave1End: number,
  wave2End: number
): { wave3Targets: number[]; wave5Target: number } {
  const w1 = Math.abs(wave1End - wave1Start);
  const isBullish = wave1End > wave1Start;
  const direction = isBullish ? 1 : -1;

  const wave3Targets = [
    wave2End + direction * w1 * 1.618,
    wave2End + direction * w1 * 2.0,
    wave2End + direction * w1 * 2.618,
  ];

  // Wave 5 approximation: often equal to Wave 1 or 0.618x Wave 3
  const wave5Target = wave2End + direction * w1 * 1.0;

  return { wave3Targets, wave5Target };
}




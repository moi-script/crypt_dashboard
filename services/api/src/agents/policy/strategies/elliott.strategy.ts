// ============================================================
// elliott.strategy.ts
// Elliott Wave strategy: Wave 3 in-progress and Wave 5 targets → TradeSignal
// Uses validated wave counts from elliott.skill output in primitives.
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { MarketPrimitives } from '../../chartAnalysis.types';
// import { getElliottTargets } from '../skills/elliott.skill';
import { getElliottTargets } from '@/agents/skills/elliott.skill';
// import { TradeSignal, ChartStrategyResult } from './chart.strategy.types';
import { TradeSignal, ChartStrategyResult } from './strategy.types';

const MIN_RR = 3.0;
const MIN_CONFIDENCE = 50;
const MIN_WAVE_CONFIDENCE = 0.60;

export function runElliottStrategy(primitives: MarketPrimitives): ChartStrategyResult {
  const { elliott, indicators, structure, fibonacci } = primitives;
  const symbol = primitives.meta.symbol;
  const atr    = indicators.atr_14;

  if (!elliott) {
    return { signal: null, skipped: true, skip_reason: 'No Elliott Wave data in primitives' };
  }

  if (elliott.confidence < MIN_WAVE_CONFIDENCE) {
    return {
      signal: null,
      skipped: true,
      skip_reason: `Elliott Wave confidence ${(elliott.confidence * 100).toFixed(0)}% below minimum ${MIN_WAVE_CONFIDENCE * 100}%`,
    };
  }

  const { wave_count, pivots, invalidation_level } = elliott;

  // ── Wave 3 in-progress ──────────────────────────────────────
  if (wave_count === 'wave_3_in_progress' && pivots.length >= 4) {
    const p0 = pivots[0];
    const p1 = pivots[1];
    const p2 = pivots[2];
    const isBullish = p1 > p0;
    const bias: 'long' | 'short' = isBullish ? 'long' : 'short';

    const entryLow  = isBullish ? p2 - atr * 0.5 : p2 + atr * 0.5;
    const entryHigh = isBullish ? p2 + atr * 0.5 : p2 - atr * 0.5;
    const stopLoss  = invalidation_level ?? (isBullish ? p0 - atr * 0.5 : p0 + atr * 0.5);

    const targets = getElliottTargets(p0, p1, p2);
    const tp1 = targets.wave3Targets[0];
    const tp2 = targets.wave3Targets[1];
    const tp3 = targets.wave3Targets[2] ?? (isBullish ? tp2 * 1.05 : tp2 * 0.95);

    const entryMid = (entryLow + entryHigh) / 2;
    const risk = Math.abs(entryMid - stopLoss);
    const rr = risk > 0 ? parseFloat((Math.abs(tp1 - entryMid) / risk).toFixed(2)) : 0;

    if (rr < MIN_RR) {
      return { signal: null, skipped: true, skip_reason: `Wave 3 R:R ${rr} below minimum ${MIN_RR}` };
    }

    const confluenceFactors: string[] = [
      'Elliott Wave 3 in progress — highest momentum wave',
      `Wave confidence: ${(elliott.confidence * 100).toFixed(0)}%`,
      `Wave 2 retracement completed at ${p2.toFixed(4)}`,
    ];

    if (elliott.rules_passed.length > 0) {
      confluenceFactors.push(`Rules passed: ${elliott.rules_passed.slice(0, 2).join(', ')}`);
    }

    let confidence = 50;
    confidence += Math.round(elliott.confidence * 30);
    if (structure.trend_htf === (isBullish ? 'bullish' : 'bearish')) {
      confluenceFactors.push('HTF trend aligned'); confidence += 10;
    }
    confidence = Math.min(90, confidence);

    if (confidence < MIN_CONFIDENCE) {
      return { signal: null, skipped: true, skip_reason: `Confidence ${confidence} too low` };
    }

    const signal: TradeSignal = {
      symbol,
      framework:    'ElliottWave',
      bias,
      setup_name:   `Elliott Wave 3 ${isBullish ? 'Long' : 'Short'}`,
      entry_zone:   { high: Math.max(entryLow, entryHigh), low: Math.min(entryLow, entryHigh) },
      stop_loss:    stopLoss,
      take_profit_levels: [tp1, tp2, tp3],
      risk_reward:  rr,
      confidence,
      invalidation: `Close ${isBullish ? 'below' : 'above'} Wave 1 start (${stopLoss.toFixed(4)}) — wave count invalid`,
      reasoning:    `Elliott Wave 3 impulse in progress. Wave 2 retracement completed at ${p2.toFixed(4)} ` +
                    `(${((1 - p2 / p1) * 100).toFixed(1)}% retracement of Wave 1). ` +
                    `Wave 3 targets ${tp1.toFixed(4)} (1.618×), ${tp2.toFixed(4)} (2.0×), ${tp3.toFixed(4)} (2.618×). ` +
                    `${elliott.rules_passed.length} Elliott rules confirmed.`,
      confluence_factors: confluenceFactors,
      generated_at: new Date().toISOString(),
    };

    return { signal, skipped: false };
  }

  // ── Wave 5 in-progress ──────────────────────────────────────
  if (wave_count === 'wave_5_in_progress' && pivots.length >= 6) {
    const p0 = pivots[0];
    const p4 = pivots[4];
    const isBullish = p4 > p0;
    const bias: 'long' | 'short' = isBullish ? 'long' : 'short';

    const w1 = Math.abs(pivots[1] - pivots[0]);
    const tp1 = isBullish ? p4 + w1 : p4 - w1;
    const tp2 = isBullish ? p4 + w1 * 0.618 : p4 - w1 * 0.618;
    const tp3 = tp1;

    const stopLoss  = invalidation_level ?? (isBullish ? pivots[3] - atr : pivots[3] + atr);
    const entryLow  = isBullish ? p4 - atr * 0.25 : p4 + atr * 0.25;
    const entryHigh = isBullish ? p4 + atr * 0.25 : p4 - atr * 0.25;
    const entryMid  = (entryLow + entryHigh) / 2;
    const risk = Math.abs(entryMid - stopLoss);
    const rr = risk > 0 ? parseFloat((Math.abs(tp1 - entryMid) / risk).toFixed(2)) : 0;

    if (rr < 2.0) {
      return { signal: null, skipped: true, skip_reason: `Wave 5 R:R ${rr} too low` };
    }

    const confluenceFactors = [
      'Elliott Wave 5 final push',
      `Wave confidence: ${(elliott.confidence * 100).toFixed(0)}%`,
      'Expect momentum divergence near TP1',
    ];

    const confidence = Math.min(75, 40 + Math.round(elliott.confidence * 25));

    const signal: TradeSignal = {
      symbol,
      framework:    'ElliottWave',
      bias,
      setup_name:   `Elliott Wave 5 ${isBullish ? 'Long' : 'Short'} (Final Push)`,
      entry_zone:   { high: Math.max(entryLow, entryHigh), low: Math.min(entryLow, entryHigh) },
      stop_loss:    stopLoss,
      take_profit_levels: [tp1, tp2, tp3],
      risk_reward:  rr,
      confidence,
      invalidation: `Close ${isBullish ? 'below' : 'above'} Wave 4 low/high (${stopLoss.toFixed(4)}) — wave count failed`,
      reasoning:    `Elliott Wave 5 in progress — final impulse wave. Target equals Wave 1 length (${tp1.toFixed(4)}). ` +
                    `Expect RSI divergence near TP1. Reduce size vs Wave 3 — wave 5 can truncate.`,
      confluence_factors: confluenceFactors,
      generated_at: new Date().toISOString(),
    };

    return { signal, skipped: false };
  }

  // ── Wave C (ABC correction) ────────────────────────────────
  if (wave_count === 'wave_c' && pivots.length >= 4) {
    const p0 = pivots[0];
    const p2 = pivots[2];
    const isBullishCorrection = p2 < p0;
    const bias: 'long' | 'short' = isBullishCorrection ? 'long' : 'short';

    const wA = Math.abs(pivots[1] - pivots[0]);
    const tp1 = isBullishCorrection ? p2 + wA * 0.618 : p2 - wA * 0.618;
    const tp2 = isBullishCorrection ? p2 + wA          : p2 - wA;
    const tp3 = isBullishCorrection ? p2 + wA * 1.618  : p2 - wA * 1.618;

    const stopLoss  = isBullishCorrection ? p2 - atr * 1.5 : p2 + atr * 1.5;
    const entryLow  = isBullishCorrection ? p2 - atr * 0.25 : p2 + atr * 0.5;
    const entryHigh = isBullishCorrection ? p2 + atr * 0.5  : p2 - atr * 0.25;
    const entryMid  = (entryLow + entryHigh) / 2;
    const risk = Math.abs(entryMid - stopLoss);
    const rr = risk > 0 ? parseFloat((Math.abs(tp1 - entryMid) / risk).toFixed(2)) : 0;

    if (rr < 2.0) {
      return { signal: null, skipped: true, skip_reason: `Wave C correction R:R ${rr} insufficient` };
    }

    const confidence = Math.min(70, 35 + Math.round(elliott.confidence * 25));

    const signal: TradeSignal = {
      symbol,
      framework:    'ElliottWave',
      bias,
      setup_name:   `Elliott ABC Correction — Wave C ${isBullishCorrection ? 'Reversal' : 'Short'}`,
      entry_zone:   { high: Math.max(entryLow, entryHigh), low: Math.min(entryLow, entryHigh) },
      stop_loss:    stopLoss,
      take_profit_levels: [tp1, tp2, tp3],
      risk_reward:  rr,
      confidence,
      invalidation: `Close ${isBullishCorrection ? 'below' : 'above'} Wave C extreme (${stopLoss.toFixed(4)})`,
      reasoning:    `ABC corrective structure with Wave C completing at ${p2.toFixed(4)}. ` +
                    `Reversal targets: 0.618 retrace of ABC (${tp1.toFixed(4)}), full retrace (${tp2.toFixed(4)}).`,
      confluence_factors: ['ABC corrective wave complete', 'Wave C ≈ Wave A (equal legs)'],
      generated_at: new Date().toISOString(),
    };

    return { signal, skipped: false };
  }

  return {
    signal: null,
    skipped: true,
    skip_reason: `Elliott wave count '${wave_count}' has no active strategy rule`,
  };
}
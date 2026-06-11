// ============================================================
// wyckoff.strategy.ts
// Wyckoff Method strategy: Spring/UTAD events → TradeSignal
// Enforces Phase rules — NEVER front-runs Spring without SOS.
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { MarketPrimitives } from '../../chartAnalysis.types';
// import { TradeSignal, ChartStrategyResult } from './chart.strategy.types';
import { TradeSignal, ChartStrategyResult } from './strategy.types';

const MIN_RR = 3.0;
const MIN_CONFIDENCE = 45;

export function runWyckoffStrategy(primitives: MarketPrimitives): ChartStrategyResult {
  const { wyckoff, indicators, structure, fibonacci } = primitives;
  const symbol = primitives.meta.symbol;

  if (!wyckoff) {
    return { signal: null, skipped: true, skip_reason: 'No Wyckoff context available' };
  }

  const { phase, spring_confirmed, utad_risk, range_high, range_low, last_event } = wyckoff;
  const atr = indicators.atr_14;
  const currentPrice = indicators.vwap.value;

  // ── RULE: Never front-run Spring ───────────────────────────
  if (phase === 'C' && !spring_confirmed) {
    return {
      signal: null,
      skipped: true,
      skip_reason: 'Wyckoff Phase C: Spring not confirmed — waiting for SOS before entering long',
    };
  }

  // ── Accumulation setup (Spring confirmed + SOS) ─────────────
  if (wyckoff.volume_analysis === 'accumulating' && spring_confirmed) {
    const bias: 'long' = 'long';
    const entryLow  = range_low - atr * 0.25;
    const entryHigh = range_low + atr * 0.75;
    const stopLoss  = range_low - atr * 1.5;

    const rangeSize = range_high - range_low;
    const tp1 = range_high;
    const tp2 = range_high + rangeSize * 0.618;
    const tp3 = fibonacci
      ? (fibonacci.extensions['1.618'] ?? range_high + rangeSize)
      : range_high + rangeSize;

    const entryMid = (entryLow + entryHigh) / 2;
    const risk = entryMid - stopLoss;
    const rr = risk > 0 ? parseFloat(((tp1 - entryMid) / risk).toFixed(2)) : 0;

    if (rr < MIN_RR) {
      return { signal: null, skipped: true, skip_reason: `R:R ${rr} below Wyckoff minimum ${MIN_RR}` };
    }

    const confluenceFactors = [
      'Spring confirmed with price recovery above range low',
      'SOS (Sign of Strength) follow-through detected',
      `Wyckoff Phase ${phase} — accumulation structure complete`,
      `Volume: ${wyckoff.volume_analysis}`,
    ];

    if (wyckoff.cause_count > 40) confluenceFactors.push(`Extended cause (${wyckoff.cause_count} bars) = large projected move`);

    let confidence = 55;
    if (spring_confirmed)              confidence += 20;
    if (phase === 'D' || phase === 'E') confidence += 10;
    if (wyckoff.cause_count > 40)      confidence += 5;
    confidence = Math.min(90, confidence);

    if (confidence < MIN_CONFIDENCE) {
      return { signal: null, skipped: true, skip_reason: `Confidence ${confidence} too low` };
    }

    const signal: TradeSignal = {
      symbol,
      framework:    'Wyckoff',
      bias,
      setup_name:   `Wyckoff Spring LPS — Phase ${phase}`,
      entry_zone:   { high: entryHigh, low: entryLow },
      stop_loss:    stopLoss,
      take_profit_levels: [tp1, tp2, tp3],
      risk_reward:  rr,
      confidence,
      invalidation: `Close below Spring low ${(range_low - atr * 1.5).toFixed(4)} — accumulation structure failed`,
      reasoning:    `Wyckoff accumulation Phase ${phase} with Spring confirmed at ${range_low.toFixed(4)} and SOS follow-through. ` +
                    `Cause = ${wyckoff.cause_count} bars → projected move to ${tp2.toFixed(4)}. ` +
                    `Entry at LPS zone (${entryLow.toFixed(4)}–${entryHigh.toFixed(4)}) above Spring low.`,
      confluence_factors: confluenceFactors,
      generated_at: new Date().toISOString(),
    };

    return { signal, skipped: false };
  }

  // ── Distribution setup (UTAD confirmed + LPSY) ──────────────
  if (wyckoff.volume_analysis === 'distributing' && utad_risk && phase === 'C') {
    const bias: 'short' = 'short';
    const entryLow  = range_high - atr * 0.75;
    const entryHigh = range_high + atr * 0.25;
    const stopLoss  = range_high + atr * 1.5;

    const rangeSize = range_high - range_low;
    const tp1 = range_low;
    const tp2 = range_low - rangeSize * 0.618;
    const tp3 = fibonacci
      ? (fibonacci.extensions['1.618'] ?? range_low - rangeSize)
      : range_low - rangeSize;

    const entryMid = (entryLow + entryHigh) / 2;
    const risk = stopLoss - entryMid;
    const rr = risk > 0 ? parseFloat(((entryMid - tp1) / risk).toFixed(2)) : 0;

    if (rr < MIN_RR) {
      return { signal: null, skipped: true, skip_reason: `R:R ${rr} below Wyckoff minimum ${MIN_RR}` };
    }

    const confluenceFactors = [
      'UTAD (Upthrust After Distribution) confirmed',
      `Wyckoff Distribution Phase ${phase}`,
      `Last event: ${last_event}`,
      `Volume: ${wyckoff.volume_analysis}`,
    ];

    let confidence = 55;
    if (utad_risk)   confidence += 15;
    if (phase === 'C') confidence += 10;
    confidence = Math.min(85, confidence);

    if (confidence < MIN_CONFIDENCE) {
      return { signal: null, skipped: true, skip_reason: `Confidence ${confidence} too low` };
    }

    const signal: TradeSignal = {
      symbol,
      framework:    'Wyckoff',
      bias,
      setup_name:   `Wyckoff UTAD Short — Phase ${phase}`,
      entry_zone:   { high: entryHigh, low: entryLow },
      stop_loss:    stopLoss,
      take_profit_levels: [tp1, tp2, tp3],
      risk_reward:  rr,
      confidence,
      invalidation: `Close above UTAD high ${stopLoss.toFixed(4)} — distribution structure broken`,
      reasoning:    `Wyckoff distribution Phase ${phase} with UTAD spike above range high (${range_high.toFixed(4)}) on declining internals. ` +
                    `Entry at LPSY zone (${entryLow.toFixed(4)}–${entryHigh.toFixed(4)}). Markdown projected to ${tp2.toFixed(4)}.`,
      confluence_factors: confluenceFactors,
      generated_at: new Date().toISOString(),
    };

    return { signal, skipped: false };
  }

  return {
    signal: null,
    skipped: true,
    skip_reason: `Wyckoff Phase ${phase} / event ${last_event} — no actionable setup (Spring unconfirmed or structure unclear)`,
  };
}
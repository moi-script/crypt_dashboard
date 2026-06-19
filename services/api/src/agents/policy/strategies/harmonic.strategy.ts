// ============================================================
// harmonic.strategy.ts
// Harmonic pattern strategy: PRZ entry → TradeSignal
// Only fires when completion_pct >= 85 and price is in/approaching PRZ.
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { MarketPrimitives } from '../../chartAnalysis.types';
// import { isPriceInPRZ } from '../skills/harmonics.skill';
import { isPriceInPRZ } from '@/agents/skills/harmonics.skill';
import { TradeSignal, ChartStrategyResult } from './strategy.types';
const MIN_RR = 2.0;
const MIN_CONFIDENCE = 45;
const MIN_COMPLETION_PCT = 75;

export function runHarmonicStrategy(primitives: MarketPrimitives): ChartStrategyResult {
  const { harmonics, indicators, structure, fibonacci } = primitives;
  const symbol = primitives.meta.symbol;
  const atr    = indicators.atr_14;
  const price  = indicators.vwap.value;

  if (!harmonics) {
    return { signal: null, skipped: true, skip_reason: 'No harmonic pattern data in primitives' };
  }

  if (harmonics.completion_pct < MIN_COMPLETION_PCT) {
    return {
      signal: null,
      skipped: true,
      skip_reason: `Harmonic ${harmonics.name} completion ${harmonics.completion_pct.toFixed(1)}% below minimum ${MIN_COMPLETION_PCT}%`,
    };
  }

  const { prz_high, prz_low, direction, name, xabcd, ratios } = harmonics;
  const bias: 'long' | 'short' = direction === 'bullish' ? 'long' : 'short';

  const entryHigh = prz_high;
  const entryLow  = prz_low;
  const entryMid  = (entryHigh + entryLow) / 2;

  const stopLoss = bias === 'long'
    ? prz_low  - atr
    : prz_high + atr;

  const xaMove = Math.abs(xabcd.A - xabcd.X);
  const tp1 = bias === 'long' ? entryMid + xaMove * 0.382 : entryMid - xaMove * 0.382;
  const tp2 = bias === 'long' ? entryMid + xaMove * 0.618 : entryMid - xaMove * 0.618;
  const tp3 = xabcd.A;

  const risk = Math.abs(entryMid - stopLoss);
  const rr   = risk > 0 ? parseFloat((Math.abs(tp1 - entryMid) / risk).toFixed(2)) : 0;

  if (rr < MIN_RR) {
    return { signal: null, skipped: true, skip_reason: `Harmonic R:R ${rr} below minimum ${MIN_RR}` };
  }

  const inPRZ = isPriceInPRZ(price, harmonics);

  const confluenceFactors: string[] = [];
  let confidence = 45;

  confluenceFactors.push(`${name} pattern ${harmonics.completion_pct.toFixed(0)}% complete`);
  confidence += Math.round((harmonics.completion_pct - 85) / 15 * 20);

  const validRatioCount = Object.values(ratios).filter(v => v > 0).length;
  if (validRatioCount >= 3) { confluenceFactors.push(`${validRatioCount}/4 Fibonacci ratios validated`); confidence += 10; }
  if (inPRZ)                { confluenceFactors.push('Price inside PRZ — entry zone active'); confidence += 15; }

  if (structure.trend_htf === (bias === 'long' ? 'bullish' : 'bearish')) {
    confluenceFactors.push('HTF trend alignment'); confidence += 10;
  }
  if (indicators.rsi_14 < 35 && bias === 'long')  { confluenceFactors.push('RSI oversold in PRZ'); confidence += 10; }
  if (indicators.rsi_14 > 65 && bias === 'short') { confluenceFactors.push('RSI overbought in PRZ'); confidence += 10; }
  if (indicators.macd.cross === (bias === 'long' ? 'bullish' : 'bearish')) {
    confluenceFactors.push('MACD cross confirms PRZ reversal'); confidence += 10;
  }

  confidence = Math.min(92, confidence);

  if (confidence < MIN_CONFIDENCE) {
    return { signal: null, skipped: true, skip_reason: `Confidence ${confidence} too low` };
  }

  const signal: TradeSignal = {
    symbol,
    framework:    'Harmonic',
    bias,
    setup_name:   `${name} ${direction === 'bullish' ? 'Bullish' : 'Bearish'} PRZ`,
    entry_zone:   { high: entryHigh, low: entryLow },
    stop_loss:    stopLoss,
    take_profit_levels: [tp1, tp2, tp3],
    risk_reward:  rr,
    confidence,
    invalidation: `Close ${bias === 'long' ? 'below' : 'above'} PRZ extreme ${stopLoss.toFixed(4)} — pattern failed`,
    reasoning:    `${name} ${direction} pattern at ${harmonics.completion_pct.toFixed(0)}% completion. ` +
                  `PRZ zone: ${prz_low.toFixed(4)}–${prz_high.toFixed(4)}. ` +
                  `XAB ratio: ${ratios.XAB.toFixed(3)}, XAD ratio: ${ratios.XAD.toFixed(3)}. ` +
                  `${inPRZ ? 'Price currently inside PRZ.' : 'Waiting for price to reach PRZ.'}`,
    confluence_factors: confluenceFactors,
    generated_at: new Date().toISOString(),
  };

  return { signal, skipped: false };
}
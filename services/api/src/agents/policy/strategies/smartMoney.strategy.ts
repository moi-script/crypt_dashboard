// ============================================================
// smartMoney.strategy.ts
// ICT / Smart Money strategy: OB + ChoCH/BOS → TradeSignal
// Converts skill output from smartMoney.skill into a concrete signal.
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { MarketPrimitives } from '../../chartAnalysis.types';
// import { TradeSignal, ChartStrategyResult } from './chart.strategy.types';
import { TradeSignal, ChartStrategyResult } from './strategy.types';

// ─── Config ───────────────────────────────────────────────────
const MIN_RR = 2.0;
const MIN_CONFIDENCE = 40;

// ─── Main Entry ───────────────────────────────────────────────

export function runSmartMoneyStrategy(primitives: MarketPrimitives): ChartStrategyResult {
  const { smart_money, structure, indicators, fibonacci } = primitives;
  const symbol = primitives.meta.symbol;

  // ── Prerequisite: BOS or ChoCH must be present ─────────────
  const bos   = smart_money.bos;
  const choch = smart_money.choch;

  if (!bos && !choch) {
    return { signal: null, skipped: true, skip_reason: 'No BOS or ChoCH detected — no structure break to trade' };
  }

  // ── Determine bias from BOS/ChoCH ──────────────────────────
  const structureBreak = bos ?? choch!;
  const bias: 'long' | 'short' = structureBreak.direction === 'bullish' ? 'long' : 'short';

  // ── Find a qualifying Order Block ──────────────────────────
  const targetObType = bias === 'long' ? 'bullish' : 'bearish';
  const activeOBs = smart_money.order_blocks
    .filter(ob => ob.type === targetObType && ob.status === 'unmitigated');

  if (activeOBs.length === 0) {
    return { signal: null, skipped: true, skip_reason: `No unmitigated ${targetObType} OB found to use as entry` };
  }

  // Use last candle close — VWAP is a session average and can be 2-3% off real price
  const currentPrice = primitives.meta.price_close;
  const entryOB = activeOBs.sort((a, b) =>
    Math.abs(((a.price_high + a.price_low) / 2) - currentPrice) -
    Math.abs(((b.price_high + b.price_low) / 2) - currentPrice)
  )[0];

  const entryHigh = entryOB.price_high;
  const entryLow  = entryOB.price_low;
  const entryMidForCalc = (entryLow + entryHigh) / 2;
  const atr       = indicators.atr_14;

  // ── Stop Loss ───────────────────────────────────────────────
  const stopLoss = bias === 'long'
    ? entryLow - atr * 0.5
    : entryHigh + atr * 0.5;

  const riskAmount = Math.abs(entryMidForCalc - stopLoss);

  // ── Take Profit — targeting market structure, not mechanical R-multiples ──
  // TP1: nearest strong key level beyond entry (liquidity pool / swing high)
  const tp1Level = bias === 'long'
    ? structure.key_levels
        .filter(kl => kl.type === 'resistance' && kl.price > entryHigh && kl.strength !== 'weak')
        .sort((a, b) => a.price - b.price)[0]?.price
    : structure.key_levels
        .filter(kl => kl.type === 'support' && kl.price < entryLow && kl.strength !== 'weak')
        .sort((a, b) => b.price - a.price)[0]?.price;

  // TP2: range extreme (VAH for longs, VAL for shorts) — where buy-side liquidity pools
  const tp2Level = bias === 'long' ? structure.vah : structure.val;

  const tp1 = tp1Level ?? (bias === 'long' ? entryMidForCalc + riskAmount * 2.0 : entryMidForCalc - riskAmount * 2.0);
  const tp2 = (tp2Level && (bias === 'long' ? tp2Level > tp1 : tp2Level < tp1))
    ? tp2Level
    : (bias === 'long' ? entryMidForCalc + riskAmount * 3.0 : entryMidForCalc - riskAmount * 3.0);
  const tp3 = fibonacci
    ? (bias === 'long'
        ? fibonacci.extensions['1.618'] ?? tp2 * 1.05
        : fibonacci.extensions['1.618'] ?? tp2 * 0.95)
    : tp2 * (bias === 'long' ? 1.05 : 0.95);

  const rr = parseFloat((riskAmount > 0 ? (Math.abs(tp1 - entryMidForCalc) / riskAmount) : 0).toFixed(2));

  if (rr < MIN_RR) {
    return { signal: null, skipped: true, skip_reason: `R:R ${rr} below SmartMoney minimum ${MIN_RR}` };
  }

  // ── Confidence ──────────────────────────────────────────────
  const confluenceFactors: string[] = [];
  let confidence = 40;

  if (bos) { confluenceFactors.push('Confirmed BOS'); confidence += 20; }
  else       { confluenceFactors.push('ChoCH only (unconfirmed)'); confidence += 5; }

  if (activeOBs.length > 0) { confluenceFactors.push('Unmitigated OB at entry zone'); confidence += 15; }
  if (smart_money.fvgs.length > 0 && smart_money.fvgs.some(f => !f.filled)) {
    confluenceFactors.push('Unfilled FVG nearby'); confidence += 10;
  }
  if (smart_money.liquidity_sweeps.length > 0) { confluenceFactors.push('Liquidity sweep confirmed'); confidence += 10; }
  if (structure.trend_htf === (bias === 'long' ? 'bullish' : 'bearish')) {
    confluenceFactors.push('HTF trend alignment'); confidence += 10;
  }
  if (indicators.rsi_14 < 40 && bias === 'long')  { confluenceFactors.push('RSI oversold at entry'); confidence += 5; }
  if (indicators.rsi_14 > 60 && bias === 'short') { confluenceFactors.push('RSI overbought at entry'); confidence += 5; }

  confidence = Math.min(95, confidence);

  if (confidence < MIN_CONFIDENCE) {
    return { signal: null, skipped: true, skip_reason: `Confidence ${confidence} too low` };
  }

  const setupName = bos
    ? `ICT ${bias === 'long' ? 'Bullish' : 'Bearish'} OB + BOS`
    : `ICT ${bias === 'long' ? 'Bullish' : 'Bearish'} OB + ChoCH`;

  const signal: TradeSignal = {
    symbol,
    framework:    'SmartMoney',
    bias,
    setup_name:   setupName,
    entry_zone:   { high: entryHigh, low: entryLow },
    stop_loss:    stopLoss,
    take_profit_levels: [tp1, tp2, tp3],
    risk_reward:  rr,
    confidence,
    invalidation: `Close ${bias === 'long' ? 'below' : 'above'} ${stopLoss.toFixed(4)} — OB invalidated`,
    reasoning:    `${structureBreak.type} ${structureBreak.direction} at ${structureBreak.level.toFixed(4)}. ` +
                  `Price returning to ${targetObType} OB (${entryLow.toFixed(4)}–${entryHigh.toFixed(4)}). ` +
                  `${smart_money.fvgs.filter(f => !f.filled).length} unfilled FVGs support the zone. ` +
                  `${confluenceFactors.length} confluence factors identified.`,
    confluence_factors: confluenceFactors,
    generated_at: new Date().toISOString(),
  };

  return { signal, skipped: false };
}
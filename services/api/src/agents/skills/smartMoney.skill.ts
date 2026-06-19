
// ============================================================
// smartMoney.skill.ts
// ICT / Smart Money Concepts: Order Blocks, Fair Value Gaps,
// Break of Structure, Change of Character, Liquidity Sweeps
// ============================================================

import {
  Candle,
  OrderBlock,
  FairValueGap,
  BreakOfStructure,
  LiquiditySweep,
  SwingPivot,
} from '../chartAnalysis.types';
// import { nanoid } from '../../utils/nanoid';
import { nanoid } from 'nanoid';

// ─── Configuration ────────────────────────────────────────────
const DEFAULT_LOOKBACK = 10;       // bars to look back for swing high/low
const DISPLACEMENT_BODY_RATIO = 0.6; // impulse candle must be 60%+ body/range
const LIQUIDITY_SWEEP_ATR_MULT = 0.5; // sweep must pierce level by > 0.5 ATR

// ─── Helpers ──────────────────────────────────────────────────
function atr(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs = candles.slice(-period).map((c, i, arr) => {
    if (i === 0) return c.high - c.low;
    const prev = arr[i - 1];
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  });
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

function isBullishCandle(c: Candle): boolean { return c.close > c.open; }
function isBearishCandle(c: Candle): boolean { return c.close < c.open; }

function bodyRatio(c: Candle): number {
  const range = c.high - c.low;
  if (range === 0) return 0;
  return Math.abs(c.close - c.open) / range;
}

function recentSwingHigh(candles: Candle[], endIndex: number, lookback = DEFAULT_LOOKBACK): number {
  const slice = candles.slice(Math.max(0, endIndex - lookback), endIndex);
  return Math.max(...slice.map(c => c.high));
}

function recentSwingLow(candles: Candle[], endIndex: number, lookback = DEFAULT_LOOKBACK): number {
  const slice = candles.slice(Math.max(0, endIndex - lookback), endIndex);
  return Math.min(...slice.map(c => c.low));
}

// ─── Order Block Detection ────────────────────────────────────
// Bullish OB: last bearish candle before a strong bullish impulse that breaks structure
export function detectBullishOrderBlocks(candles: Candle[], timeframe = '4H', maxBlocks = 5): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  const atrValue = atr(candles);

  for (let i = 2; i < candles.length - 2; i++) {
    const origin = candles[i];       // Last bearish candle (the OB)
    const impulse = candles[i + 1];  // Strong bullish displacement

    if (!isBearishCandle(origin)) continue;
    if (!isBullishCandle(impulse)) continue;
    if (bodyRatio(impulse) < DISPLACEMENT_BODY_RATIO) continue;

    // Liquidity sweep: origin low pierces below previous swing low
    const swingLow = recentSwingLow(candles, i);
    const isLiquiditySweep = origin.low < swingLow;

    // Break of Structure: impulse closes above recent swing high
    const swingHigh = recentSwingHigh(candles, i);
    const isBOS = impulse.close > swingHigh;

    // Minimum criteria: displacement + either sweep or BOS
    if (!(isBOS || isLiquiditySweep)) continue;
    if (impulse.close - origin.low < atrValue * 0.8) continue; // impulse must be meaningful

    // Fair Value Gap: gap between origin.high and candles[i+2].low
    let associated_fvg: FairValueGap | undefined;
    if (candles[i + 2] && origin.high < candles[i + 2].low) {
      associated_fvg = {
        high: candles[i + 2].low,
        low: origin.high,
        timestamp: candles[i + 2].timestamp,
        filled: false,
        type: 'bullish',
      };
    }

    // Check if this OB has been mitigated (price traded back into it)
    const futureCandles = candles.slice(i + 2);
    const mitigated = futureCandles.some(c => c.low <= origin.high && c.high >= origin.low);

    const strength = (isBOS ? 40 : 0) + (isLiquiditySweep ? 30 : 0) + (associated_fvg ? 20 : 0) + 10;

    blocks.push({
      id: nanoid(),
      type: 'bullish',
      high: origin.high,
      low: origin.low,
      origin_timestamp: origin.timestamp,
      timeframe,
      status: mitigated ? 'mitigated' : 'unmitigated',
      associated_fvg,
      strength,
    });

    if (blocks.filter(b => b.status === 'unmitigated').length >= maxBlocks) break;
  }

  // Return most recent unmitigated blocks first
  return blocks
    .filter(b => b.status === 'unmitigated')
    .slice(-maxBlocks)
    .reverse();
}

// Bearish OB: last bullish candle before a strong bearish impulse that breaks structure
export function detectBearishOrderBlocks(candles: Candle[], timeframe = '4H', maxBlocks = 5): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  const atrValue = atr(candles);

  for (let i = 2; i < candles.length - 2; i++) {
    const origin = candles[i];
    const impulse = candles[i + 1];

    if (!isBullishCandle(origin)) continue;
    if (!isBearishCandle(impulse)) continue;
    if (bodyRatio(impulse) < DISPLACEMENT_BODY_RATIO) continue;

    const swingHigh = recentSwingHigh(candles, i);
    const isLiquiditySweep = origin.high > swingHigh;

    const swingLow = recentSwingLow(candles, i);
    const isBOS = impulse.close < swingLow;

    if (!(isBOS || isLiquiditySweep)) continue;
    if (origin.high - impulse.close < atrValue * 0.8) continue;

    let associated_fvg: FairValueGap | undefined;
    if (candles[i + 2] && origin.low > candles[i + 2].high) {
      associated_fvg = {
        high: origin.low,
        low: candles[i + 2].high,
        timestamp: candles[i + 2].timestamp,
        filled: false,
        type: 'bearish',
      };
    }

    const futureCandles = candles.slice(i + 2);
    const mitigated = futureCandles.some(c => c.low <= origin.high && c.high >= origin.low);

    const strength = (isBOS ? 40 : 0) + (isLiquiditySweep ? 30 : 0) + (associated_fvg ? 20 : 0) + 10;

    blocks.push({
      id: nanoid(),
      type: 'bearish',
      high: origin.high,
      low: origin.low,
      origin_timestamp: origin.timestamp,
      timeframe,
      status: mitigated ? 'mitigated' : 'unmitigated',
      associated_fvg,
      strength,
    });

    if (blocks.filter(b => b.status === 'unmitigated').length >= maxBlocks) break;
  }

  return blocks
    .filter(b => b.status === 'unmitigated')
    .slice(-maxBlocks)
    .reverse();
}

// Combined detector
export function detectOrderBlocks(candles: Candle[], timeframe = '4H'): OrderBlock[] {
  const bullish = detectBullishOrderBlocks(candles, timeframe);
  const bearish = detectBearishOrderBlocks(candles, timeframe);
  return [...bullish, ...bearish].sort((a, b) => b.origin_timestamp - a.origin_timestamp);
}

// ─── Fair Value Gap Detection ─────────────────────────────────
export function detectFairValueGaps(candles: Candle[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];

    // Bullish FVG: prev.high < next.low (gap up)
    if (prev.high < next.low) {
      const filled = candles.slice(i + 2).some(c => c.low <= next.low);
      fvgs.push({
        high: next.low,
        low: prev.high,
        timestamp: curr.timestamp,
        filled,
        type: 'bullish',
      });
    }

    // Bearish FVG: prev.low > next.high (gap down)
    if (prev.low > next.high) {
      const filled = candles.slice(i + 2).some(c => c.high >= prev.low);
      fvgs.push({
        high: prev.low,
        low: next.high,
        timestamp: curr.timestamp,
        filled,
        type: 'bearish',
      });
    }
  }

  // Return only unfilled FVGs, most recent first
  return fvgs.filter(f => !f.filled).slice(-10).reverse();
}

// ─── Break of Structure ───────────────────────────────────────
export function detectBreakOfStructure(candles: Candle[], pivots: SwingPivot[]): BreakOfStructure[] {
  const breaks: BreakOfStructure[] = [];

  if (pivots.length < 3) return breaks;

  // Determine current trend from pivot sequence
  for (let i = 2; i < pivots.length; i++) {
    const prev2 = pivots[i - 2];
    const prev1 = pivots[i - 1];
    const curr  = pivots[i];

    // Uptrend: higher highs + higher lows
    if (prev2.type === 'low' && prev1.type === 'high' && curr.type === 'low') {
      // Bearish BOS: current low breaks below previous low (structure break to downside)
      if (curr.price < prev2.price) {
        breaks.push({
          direction: 'bearish',
          level: prev2.price,
          timestamp: curr.timestamp,
          type: 'BOS',
          confirmed: true,
        });
      }
    }

    // Downtrend: lower highs + lower lows
    if (prev2.type === 'high' && prev1.type === 'low' && curr.type === 'high') {
      // Bullish BOS: current high breaks above previous high
      if (curr.price > prev2.price) {
        breaks.push({
          direction: 'bullish',
          level: prev2.price,
          timestamp: curr.timestamp,
          type: 'BOS',
          confirmed: true,
        });
      }
    }
  }

  return breaks.slice(-5);
}

// Detect Change of Character (earlier, less confirmed signal)
export function detectChangeOfCharacter(candles: Candle[], pivots: SwingPivot[]): BreakOfStructure | null {
  if (pivots.length < 4) return null;

  // ChoCH: in a downtrend, a bullish candle closes above the most recent swing high
  // (before it's confirmed as a full BOS)
  const recentPivots = pivots.slice(-6);
  const lastHigh = recentPivots.filter(p => p.type === 'high').pop();
  const lastLow  = recentPivots.filter(p => p.type === 'low').pop();

  if (!lastHigh || !lastLow) return null;

  const lastCandle = candles[candles.length - 1];

  // Bullish ChoCH: downtrend, price aggressively breaks above last swing high
  const lowerHighSequence = recentPivots
    .filter(p => p.type === 'high')
    .every((p, i, arr) => i === 0 || p.price < arr[i - 1].price);

  if (lowerHighSequence && lastCandle.close > lastHigh.price) {
    return {
      direction: 'bullish',
      level: lastHigh.price,
      timestamp: lastCandle.timestamp,
      type: 'ChoCH',
      confirmed: false, // not yet confirmed — needs follow-through
    };
  }

  // Bearish ChoCH: uptrend, price aggressively breaks below last swing low
  const higherLowSequence = recentPivots
    .filter(p => p.type === 'low')
    .every((p, i, arr) => i === 0 || p.price > arr[i - 1].price);

  if (higherLowSequence && lastCandle.close < lastLow.price) {
    return {
      direction: 'bearish',
      level: lastLow.price,
      timestamp: lastCandle.timestamp,
      type: 'ChoCH',
      confirmed: false,
    };
  }

  return null;
}

// ─── Liquidity Sweep Detection ────────────────────────────────
export function detectLiquiditySweeps(candles: Candle[], pivots: SwingPivot[]): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = [];
  const atrValue = atr(candles);
  const last20 = candles.slice(-20);

  for (const pivot of pivots.slice(-8)) {
    for (let i = 0; i < last20.length; i++) {
      const c = last20[i];

      if (pivot.type === 'low') {
        // Buy-side liquidity sweep: price dips below swing low then recovers
        const piercedLevel = c.low < pivot.price;
        const recovered = i < last20.length - 1 && last20[i + 1].close > pivot.price;
        const piercedBy = pivot.price - c.low;

        if (piercedLevel && recovered && piercedBy > atrValue * LIQUIDITY_SWEEP_ATR_MULT) {
          sweeps.push({
            level: pivot.price,
            swept: true,
            timestamp: c.timestamp,
            candles_ago: last20.length - 1 - i,
            type: 'buy_side',
          });
        }
      } else {
        // Sell-side liquidity sweep: price spikes above swing high then reverses
        const piercedLevel = c.high > pivot.price;
        const recovered = i < last20.length - 1 && last20[i + 1].close < pivot.price;
        const piercedBy = c.high - pivot.price;

        if (piercedLevel && recovered && piercedBy > atrValue * LIQUIDITY_SWEEP_ATR_MULT) {
          sweeps.push({
            level: pivot.price,
            swept: true,
            timestamp: c.timestamp,
            candles_ago: last20.length - 1 - i,
            type: 'sell_side',
          });
        }
      }
    }
  }

  return sweeps.slice(-5);
}




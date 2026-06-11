
// ============================================================
// chartTransform.util.ts
// Candle transformations: Heikin-Ashi smoothing, Renko brick generation
// Used to reduce noise before passing candles to skill analysis
// ============================================================

import { Candle } from '../chartAnalysis.types';

// ─── Heikin-Ashi ──────────────────────────────────────────────
// Smoothed candles that better visualize trend direction
// Formula:
//   HA Close = (O + H + L + C) / 4
//   HA Open  = (prev HA Open + prev HA Close) / 2
//   HA High  = max(H, HA Open, HA Close)
//   HA Low   = min(L, HA Open, HA Close)

export function toHeikinAshi(candles: Candle[]): Candle[] {
  if (candles.length === 0) return [];

  const result: Candle[] = [];

  // Seed first bar
  const first = candles[0];
  let prevHAOpen  = (first.open + first.close) / 2;
  let prevHAClose = (first.open + first.high + first.low + first.close) / 4;

  result.push({
    timestamp: first.timestamp,
    open:   parseFloat(prevHAOpen.toFixed(8)),
    high:   Math.max(first.high, prevHAOpen, prevHAClose),
    low:    Math.min(first.low,  prevHAOpen, prevHAClose),
    close:  parseFloat(prevHAClose.toFixed(8)),
    volume: first.volume,
  });

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen  = (prevHAOpen + prevHAClose) / 2;
    const haHigh  = Math.max(c.high, haOpen, haClose);
    const haLow   = Math.min(c.low,  haOpen, haClose);

    result.push({
      timestamp: c.timestamp,
      open:   parseFloat(haOpen.toFixed(8)),
      high:   parseFloat(haHigh.toFixed(8)),
      low:    parseFloat(haLow.toFixed(8)),
      close:  parseFloat(haClose.toFixed(8)),
      volume: c.volume,
    });

    prevHAOpen  = haOpen;
    prevHAClose = haClose;
  }

  return result;
}

// ─── HA Trend Detection ────────────────────────────────────────
// Consecutive same-color HA candles = trend strength indicator
export function getHAConsecutiveCount(haCandles: Candle[]): {
  direction: 'bullish' | 'bearish' | 'neutral';
  count: number;
} {
  if (haCandles.length === 0) return { direction: 'neutral', count: 0 };

  const last = haCandles[haCandles.length - 1];
  const isBull = last.close > last.open;
  let count = 0;

  for (let i = haCandles.length - 1; i >= 0; i--) {
    const c = haCandles[i];
    const bull = c.close > c.open;
    if (bull !== isBull) break;
    count++;
  }

  return {
    direction: isBull ? 'bullish' : 'bearish',
    count,
  };
}

// ─── Renko Bricks ─────────────────────────────────────────────
// Filters out time; only plots when price moves by 'brickSize'
// Excellent for noise reduction in ranging markets
export interface RenkoBrick {
  open: number;
  close: number;
  high: number;
  low: number;
  direction: 'up' | 'down';
  timestamp: number; // timestamp of the candle that triggered this brick
}

export function toRenko(candles: Candle[], brickSize?: number): RenkoBrick[] {
  if (candles.length < 14) return [];

  // Auto-calculate brick size from ATR if not provided
  if (!brickSize) {
    const trs = candles.slice(-14).map((c, i, arr) => {
      if (i === 0) return c.high - c.low;
      return Math.max(c.high - c.low, Math.abs(c.high - arr[i-1].close), Math.abs(c.low - arr[i-1].close));
    });
    brickSize = trs.reduce((a, b) => a + b, 0) / trs.length;
  }

  const bricks: RenkoBrick[] = [];
  let currentLevel = candles[0].close;
  // Round to nearest brick boundary
  currentLevel = Math.floor(currentLevel / brickSize) * brickSize;

  for (const candle of candles) {
    const price = candle.close;

    // How many bricks worth of movement?
    const diff = price - currentLevel;
    const bricksUp   = Math.floor(diff / brickSize);
    const bricksDown = Math.ceil(diff / brickSize); // will be negative

    if (bricksUp >= 1) {
      for (let n = 0; n < bricksUp; n++) {
        const brickOpen  = currentLevel;
        const brickClose = currentLevel + brickSize;
        bricks.push({
          open:  brickOpen,
          close: brickClose,
          high:  brickClose,
          low:   brickOpen,
          direction: 'up',
          timestamp: candle.timestamp,
        });
        currentLevel = brickClose;
      }
    } else if (bricksDown <= -1) {
      for (let n = 0; n < Math.abs(bricksDown); n++) {
        const brickOpen  = currentLevel;
        const brickClose = currentLevel - brickSize;
        bricks.push({
          open:  brickOpen,
          close: brickClose,
          high:  brickOpen,
          low:   brickClose,
          direction: 'down',
          timestamp: candle.timestamp,
        });
        currentLevel = brickClose;
      }
    }
  }

  return bricks;
}

// ─── Renko Trend ─────────────────────────────────────────────
export function getRenkoTrend(bricks: RenkoBrick[]): {
  direction: 'bullish' | 'bearish' | 'neutral';
  consecutive: number;
  reversal: boolean;
} {
  if (bricks.length < 2) return { direction: 'neutral', consecutive: 0, reversal: false };

  const last = bricks[bricks.length - 1];
  const prev = bricks[bricks.length - 2];

  const reversal = last.direction !== prev.direction;
  let consecutive = 1;

  for (let i = bricks.length - 2; i >= 0; i--) {
    if (bricks[i].direction !== last.direction) break;
    consecutive++;
  }

  return {
    direction: last.direction === 'up' ? 'bullish' : 'bearish',
    consecutive,
    reversal,
  };
}

// ─── Smooth Candles with Simple Average ──────────────────────
// Useful for reducing HFT-driven wicks before OB detection
export function smoothCandles(candles: Candle[], windowSize = 3): Candle[] {
  if (candles.length < windowSize) return candles;
  const result: Candle[] = [];

  for (let i = windowSize - 1; i < candles.length; i++) {
    const window = candles.slice(i - windowSize + 1, i + 1);
    result.push({
      timestamp: candles[i].timestamp,
      open:   window.reduce((s, c) => s + c.open,   0) / windowSize,
      high:   Math.max(...window.map(c => c.high)),
      low:    Math.min(...window.map(c => c.low)),
      close:  window.reduce((s, c) => s + c.close,  0) / windowSize,
      volume: window.reduce((s, c) => s + c.volume, 0),
    });
  }

  return result;
}



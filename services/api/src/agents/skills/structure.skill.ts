
// ============================================================
// structure.skill.ts
// Market structure analysis: S/R Zones, Volume Profile (VPOC/VAH/VAL),
// ZigZag Pivot extraction
// ============================================================

import {
  Candle,
  SwingPivot,
  VolumeProfileLevel,
  SupportResistanceZone,
} from '../chartAnalysis.types';

// ─── Configuration ────────────────────────────────────────────
const DEFAULT_ZIGZAG_THRESHOLD = parseFloat(process.env.ZIGZAG_THRESHOLD || '0.03');
const DEFAULT_VP_BUCKETS = parseInt(process.env.VOLUME_PROFILE_BUCKETS || '24');
const VALUE_AREA_PCT = 0.70; // 70% of volume defines Value Area

// ─── ZigZag Pivot Extraction ──────────────────────────────────
// Finds significant swing highs and lows using a percentage threshold
export function extractZigZagPivots(
  candles: Candle[],
  threshold = DEFAULT_ZIGZAG_THRESHOLD
): SwingPivot[] {
  if (candles.length < 3) return [];

  const pivots: SwingPivot[] = [];
  let direction: 'up' | 'down' | null = null;
  let lastExtreme = candles[0];

  for (const candle of candles.slice(1)) {
    const changeFromLow  = (candle.high - lastExtreme.low) / lastExtreme.low;
    const changeFromHigh = (lastExtreme.high - candle.low) / lastExtreme.high;

    if (direction !== 'up' && changeFromLow > threshold) {
      if (direction === 'down') {
        pivots.push({
          type: 'low',
          price: lastExtreme.low,
          timestamp: lastExtreme.timestamp,
          change_pct: -changeFromHigh,
        });
      }
      direction = 'up';
      lastExtreme = candle;
    } else if (direction !== 'down' && changeFromHigh > threshold) {
      if (direction === 'up') {
        pivots.push({
          type: 'high',
          price: lastExtreme.high,
          timestamp: lastExtreme.timestamp,
          change_pct: changeFromLow,
        });
      }
      direction = 'down';
      lastExtreme = candle;
    }

    // Update lastExtreme in current direction
    if (direction === 'up' && candle.high > lastExtreme.high) lastExtreme = candle;
    if (direction === 'down' && candle.low < lastExtreme.low) lastExtreme = candle;
  }

  // Add final extreme
  if (direction === 'up') {
    pivots.push({
      type: 'high',
      price: lastExtreme.high,
      timestamp: lastExtreme.timestamp,
      change_pct: 0,
    });
  } else if (direction === 'down') {
    pivots.push({
      type: 'low',
      price: lastExtreme.low,
      timestamp: lastExtreme.timestamp,
      change_pct: 0,
    });
  }

  return pivots;
}

// ─── Volume Profile ───────────────────────────────────────────
// Distributes candle volume across price buckets to find VPOC/VAH/VAL
export function buildVolumeProfile(
  candles: Candle[],
  buckets = DEFAULT_VP_BUCKETS
): VolumeProfileLevel[] {
  if (candles.length === 0) return [];

  const priceMin = Math.min(...candles.map(c => c.low));
  const priceMax = Math.max(...candles.map(c => c.high));
  const bucketSize = (priceMax - priceMin) / buckets;

  if (bucketSize === 0) return [];

  // Initialize buckets
  const profile: VolumeProfileLevel[] = Array.from({ length: buckets }, (_, i) => ({
    price: priceMin + (i + 0.5) * bucketSize,
    volume: 0,
    is_poc: false,
    is_vah: false,
    is_val: false,
  }));

  // Distribute volume (use close price for bucket assignment)
  for (const candle of candles) {
    // Distribute volume proportionally across the candle's price range
    const candleRange = candle.high - candle.low;
    for (let i = 0; i < buckets; i++) {
      const bucketLow  = priceMin + i * bucketSize;
      const bucketHigh = bucketLow + bucketSize;
      // How much of the candle's range falls in this bucket?
      const overlap = Math.min(candle.high, bucketHigh) - Math.max(candle.low, bucketLow);
      if (overlap > 0 && candleRange > 0) {
        profile[i].volume += candle.volume * (overlap / candleRange);
      } else if (candleRange === 0) {
        // Doji: assign all volume to the single price bucket
        const idx = Math.min(Math.floor((candle.close - priceMin) / bucketSize), buckets - 1);
        if (i === idx) profile[i].volume += candle.volume;
      }
    }
  }

  // Mark POC (highest volume bucket)
  const pocIndex = profile.reduce(
    (maxI, b, i, arr) => (b.volume > arr[maxI].volume ? i : maxI),
    0
  );
  profile[pocIndex].is_poc = true;

  // Mark VAH/VAL: expand from POC until 70% of total volume is captured
  const totalVolume = profile.reduce((sum, b) => sum + b.volume, 0);
  const valueAreaTarget = totalVolume * VALUE_AREA_PCT;
  let accumulated = profile[pocIndex].volume;
  let lo = pocIndex;
  let hi = pocIndex;

  while (accumulated < valueAreaTarget && (lo > 0 || hi < buckets - 1)) {
    const extendDown = lo > 0 ? profile[lo - 1].volume : -Infinity;
    const extendUp   = hi < buckets - 1 ? profile[hi + 1].volume : -Infinity;

    if (extendDown >= extendUp && lo > 0) {
      lo--;
      accumulated += profile[lo].volume;
    } else if (hi < buckets - 1) {
      hi++;
      accumulated += profile[hi].volume;
    } else {
      break;
    }
  }

  profile[hi].is_vah = true;
  profile[lo].is_val = true;

  return profile;
}

// ─── Support / Resistance Zone Detection ─────────────────────
export function detectSupportResistance(
  candles: Candle[],
  pivots?: SwingPivot[]
): { support: SupportResistanceZone[]; resistance: SupportResistanceZone[] } {
  const pivotList = pivots || extractZigZagPivots(candles);
  const currentPrice = candles[candles.length - 1]?.close || 0;
  const tolerance = currentPrice * 0.005; // 0.5% cluster tolerance

  // Cluster nearby pivot levels
  const highs = pivotList.filter(p => p.type === 'high').map(p => p.price);
  const lows  = pivotList.filter(p => p.type === 'low').map(p => p.price);

  function clusterLevels(prices: number[]): Array<{ price: number; touches: number }> {
    const clusters: Array<{ price: number; touches: number }> = [];
    const used = new Set<number>();

    for (let i = 0; i < prices.length; i++) {
      if (used.has(i)) continue;
      const group = [prices[i]];
      used.add(i);

      for (let j = i + 1; j < prices.length; j++) {
        if (!used.has(j) && Math.abs(prices[j] - prices[i]) < tolerance * 2) {
          group.push(prices[j]);
          used.add(j);
        }
      }

      clusters.push({
        price: group.reduce((a, b) => a + b, 0) / group.length,
        touches: group.length,
      });
    }

    return clusters;
  }

  const resistanceClusters = clusterLevels(highs).filter(c => c.price > currentPrice);
  const supportClusters    = clusterLevels(lows).filter(c => c.price < currentPrice);

  function strengthLabel(touches: number): 'strong' | 'moderate' | 'weak' {
    if (touches >= 3) return 'strong';
    if (touches >= 2) return 'moderate';
    return 'weak';
  }

  const resistance: SupportResistanceZone[] = resistanceClusters
    .sort((a, b) => a.price - b.price)
    .slice(0, 5)
    .map(c => ({
      price: c.price,
      type: 'resistance',
      strength: strengthLabel(c.touches),
      source: 'previous_high',
      touches: c.touches,
    }));

  const support: SupportResistanceZone[] = supportClusters
    .sort((a, b) => b.price - a.price)
    .slice(0, 5)
    .map(c => ({
      price: c.price,
      type: 'support',
      strength: strengthLabel(c.touches),
      source: 'previous_low',
      touches: c.touches,
    }));

  return { support, resistance };
}

// ─── Psychological Levels ─────────────────────────────────────
export function detectPsychologicalLevels(candles: Candle[]): number[] {
  const currentPrice = candles[candles.length - 1]?.close || 0;
  const range = currentPrice * 0.3; // ±30% from current price

  const levels: number[] = [];

  // Determine round number granularity based on price
  let step: number;
  if (currentPrice > 10000) step = 1000;
  else if (currentPrice > 1000) step = 100;
  else if (currentPrice > 100) step = 10;
  else if (currentPrice > 10) step = 1;
  else step = 0.1;

  const startLevel = Math.floor((currentPrice - range) / step) * step;
  const endLevel   = Math.ceil((currentPrice + range) / step) * step;

  for (let level = startLevel; level <= endLevel; level += step) {
    levels.push(parseFloat(level.toFixed(8)));
  }

  return levels;
}

// ─── Current Trend (simple) ───────────────────────────────────
export function detectTrend(
  candles: Candle[],
  emaPeriod = 50
): 'bullish' | 'bearish' | 'consolidating' | 'neutral' {
  if (candles.length < emaPeriod) return 'neutral';

  // Simple EMA
  const closes = candles.map(c => c.close);
  let ema = closes.slice(0, emaPeriod).reduce((a, b) => a + b, 0) / emaPeriod;
  const k = 2 / (emaPeriod + 1);
  for (const close of closes.slice(emaPeriod)) {
    ema = close * k + ema * (1 - k);
  }

  const currentPrice = closes[closes.length - 1];
  const priceVsEma = (currentPrice - ema) / ema;

  const pivots = extractZigZagPivots(candles.slice(-30));
  const recentHighs = pivots.filter(p => p.type === 'high').map(p => p.price);
  const recentLows  = pivots.filter(p => p.type === 'low').map(p => p.price);

  const higherHighs = recentHighs.length >= 2 && recentHighs[recentHighs.length - 1] > recentHighs[recentHighs.length - 2];
  const higherLows  = recentLows.length  >= 2 && recentLows[recentLows.length - 1]   > recentLows[recentLows.length - 2];
  const lowerHighs  = recentHighs.length >= 2 && recentHighs[recentHighs.length - 1] < recentHighs[recentHighs.length - 2];
  const lowerLows   = recentLows.length  >= 2 && recentLows[recentLows.length - 1]   < recentLows[recentLows.length - 2];

  if (higherHighs && higherLows && priceVsEma > 0.01) return 'bullish';
  if (lowerHighs  && lowerLows  && priceVsEma < -0.01) return 'bearish';
  if (Math.abs(priceVsEma) < 0.02) return 'consolidating';
  return priceVsEma > 0 ? 'bullish' : 'bearish';
}

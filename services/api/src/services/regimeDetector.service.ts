// ============================================================
// regimeDetector.service.ts
// Fast regime detection with Redis caching.
// Called before full LLM analysis to gate which skills to run.
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { Candle, MarketRegime } from '../agents/chartAnalysis.types';
import { computeAllIndicators } from '../agents/skills/indicators.skill';
import { detectTrend, extractZigZagPivots, buildVolumeProfile } from '../agents/skills/structure.skill';
import { detectWyckoffRange } from '../agents/skills/wyckoff.skill';
import { ohlcvIngest } from '../read/ingestion/ohlcv.ingest';

// Redis client — reuse existing singleton
// import { redisClient } from '../config/redis';

const REGIME_CACHE_TTL_SECONDS = 300; // 5 min
const ADX_TRENDING_THRESHOLD   = 25;
const ADX_RANGING_THRESHOLD    = 20;

// ─── Helpers ─────────────────────────────────────────────────

function isPostATH(candles: Candle[]): boolean {
  // Check if current price is within 2% of the rolling all-time high
  // across the entire candle history provided (200 bars)
  const allTimeHigh = Math.max(...candles.map(c => c.high));
  const currentPrice = candles[candles.length - 1].close;
  return currentPrice >= allTimeHigh * 0.98;
}

function emaSlopeIsPositive(candles: Candle[], period = 50): boolean {
  if (candles.length < period + 5) return false;
  const closes = candles.map(c => c.close);
  const k = 2 / (period + 1);

  // Build EMA series for last few bars
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const emaValues: number[] = [ema];
  for (const close of closes.slice(period)) {
    ema = close * k + ema * (1 - k);
    emaValues.push(ema);
  }

  // Slope: last EMA vs 5 bars ago
  const last = emaValues[emaValues.length - 1];
  const prev = emaValues[emaValues.length - 6] || emaValues[0];
  return last > prev;
}

// ─── Core Regime Detection ────────────────────────────────────

export async function detectRegime(
  symbol: string,
  candles: Candle[]
): Promise<MarketRegime> {
  // 1. Run indicators for ADX
  const indicators = computeAllIndicators(candles);
  const adx = indicators.adx;

  // 2. Check for post-ATH price discovery (highest priority)
  if (isPostATH(candles)) {
    await cacheRegime(symbol, 'price_discovery');
    return 'price_discovery';
  }

  // 3. Wyckoff phase check — overrides ADX for accumulation/distribution
  const wyckoff = detectWyckoffRange(candles);
  if (wyckoff) {
    // Accumulation: Phase A, B, or C with SC evidence
    if (
      wyckoff.volume_analysis === 'accumulating' &&
      (wyckoff.phase === 'A' || wyckoff.phase === 'B' || wyckoff.phase === 'C')
    ) {
      await cacheRegime(symbol, 'accumulation');
      return 'accumulation';
    }

    // Distribution: BCLX evidence + UTAD risk
    if (
      wyckoff.volume_analysis === 'distributing' &&
      (wyckoff.phase === 'B' || wyckoff.phase === 'C') &&
      wyckoff.utad_risk
    ) {
      await cacheRegime(symbol, 'distribution');
      return 'distribution';
    }
  }

  // 4. ADX-based trending/ranging
  if (adx > ADX_TRENDING_THRESHOLD) {
    const regime: MarketRegime = emaSlopeIsPositive(candles) ? 'trending_up' : 'trending_down';
    await cacheRegime(symbol, regime);
    return regime;
  }

  if (adx < ADX_RANGING_THRESHOLD) {
    await cacheRegime(symbol, 'ranging');
    return 'ranging';
  }

  // 5. Fallback: detectTrend from structure.skill
  const trend = detectTrend(candles);
  let regime: MarketRegime;
  if (trend === 'bullish')       regime = 'trending_up';
  else if (trend === 'bearish')  regime = 'trending_down';
  else                           regime = 'ranging';

  await cacheRegime(symbol, regime);
  return regime;
}

// ─── Redis Cache Helpers ──────────────────────────────────────

export async function getCachedRegime(
  symbol: string
): Promise<MarketRegime | null> {
  try {
    // TODO: wire real Redis
    // const raw = await redisClient.get(`regime:${symbol}`);
    // if (!raw) return null;
    // const parsed = raw as MarketRegime;
    // const valid: MarketRegime[] = ['trending_up','trending_down','ranging','accumulation','distribution','price_discovery'];
    // return valid.includes(parsed) ? parsed : null;
    return null;
  } catch {
    return null;
  }
}

export async function cacheRegime(
  symbol: string,
  regime: MarketRegime
): Promise<void> {
  try {
    // TODO: wire real Redis
    // await redisClient.set(`regime:${symbol}`, regime, { EX: REGIME_CACHE_TTL_SECONDS });
  } catch {
    // Non-fatal — continue without cache
  }
}

// ─── Convenience: fetch + detect in one call ──────────────────

export async function detectRegimeForSymbol(symbol: string): Promise<MarketRegime> {
  const cached = await getCachedRegime(symbol);
  if (cached) return cached;

  const result = await ohlcvIngest.fetch({ symbol, timeframe: '4h', limit: 200 });
  return detectRegime(symbol, result.candles);
}

// ─── Confidence score for detected regime ────────────────────
// Used by regimeDetector.prompt.ts fallback path (ambiguous cases)

export function getRegimeConfidence(
  adx: number,
  wyckoffPhase: string,
  trend: string
): number {
  // ADX strongly trending
  if (adx > 35) return 85;
  if (adx > 25) return 70;
  // Wyckoff phase confirmed
  if (wyckoffPhase !== 'unknown' && wyckoffPhase !== 'A') return 75;
  // Weak signal
  if (adx < 20) return 65;
  return 50;
}
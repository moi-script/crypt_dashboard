// ============================================================
// chartAnalysis.tools.ts
// Anthropic tool definitions + handler functions for agentic
// chart analysis drill-down. LLM calls these for deeper data.
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { Tool } from '@anthropic-ai/sdk/resources/messages';
import { Candle } from '../chartAnalysis.types';
import {
  detectSupportResistance,
  extractZigZagPivots,
  buildVolumeProfile,
  detectTrend,
} from '../skills/structure.skill';
import {
  computeAllIndicators,
  calculateIchimoku,
  calculateVWAP,
} from '../skills/indicators.skill';
import { calculateFibonacciLevels, findFibClusters } from '../skills/fibonacci.skill';
import { calculateStandardPivots, calculateCamarillaPivots } from '../skills/pivots.skill';
import { detectHarmonicPatterns } from '../skills/harmonics.skill';
import { buildMultiTimeframeContext } from '../skills/multiTimeframe.skill';
import { ohlcvIngest, Timeframe } from '../../read/ingestion/ohlcv.ingest';

// ─── Tool Definitions (send to Anthropic API) ────────────────
export const CHART_ANALYSIS_TOOLS: Tool[] = [
  {
    name: 'analyze_market_structure',
    description:
      'Runs full market structure analysis on a symbol: S/R zones, volume profile (VPOC/VAH/VAL), trend direction. Returns key_levels, vpoc, vah, val, trend_htf, trend_ltf.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol:    { type: 'string', description: 'e.g. BTCUSDT' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d'], description: 'Candle timeframe' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_market_pivots',
    description:
      'Returns ZigZag swing pivots for the symbol. Useful for Elliott wave and harmonic counting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol:    { type: 'string' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d'] },
        threshold: { type: 'number', description: 'ZigZag threshold 0.01-0.1, default 0.03' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_htf_context',
    description:
      'Returns multi-timeframe bias analysis (1W/1D/4H/1H/15M). Use to check HTF/LTF confluence.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'detect_harmonic_setup',
    description:
      'Runs harmonic pattern detection (Gartley, Bat, Butterfly, Crab, Cypher). Returns patterns with PRZ zones.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol:    { type: 'string' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d'] },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_confluence_zones',
    description:
      'Finds price levels where multiple indicators overlap (S/R + OB + Fib + Pivot). Returns zones ranked by number of confluences.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol:        { type: 'string' },
        timeframe:     { type: 'string', enum: ['1h', '4h', '1d'] },
        tolerance_pct: { type: 'number', description: 'Clustering tolerance, default 0.01 (1%)' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_pivot_points',
    description:
      'Returns Standard and Camarilla pivot points (PP, R1-R3, S1-S3) for the symbol.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol:    { type: 'string' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d'] },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_ichimoku_detail',
    description:
      'Returns full Ichimoku Cloud reading: Tenkan, Kijun, Senkou A/B, Chikou, cloud color, TK cross, price vs cloud.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol:    { type: 'string' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d'] },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_vwap_bands',
    description:
      'Returns VWAP with 1σ and 2σ standard deviation bands. Identifies mean reversion zones.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol:    { type: 'string' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d'] },
      },
      required: ['symbol'],
    },
  },
];

// ─── Internal: Resolve candles from cache or fetch ────────────
async function resolveCandles(
  symbol: string,
  timeframe: string,
  candleCache: Map<string, Candle[]>
): Promise<Candle[]> {
  const cacheKey = `${symbol}:${timeframe}`;
  if (candleCache.has(cacheKey)) return candleCache.get(cacheKey)!;

  const tf = (timeframe || '4h') as Timeframe;
  const result = await ohlcvIngest.fetch({ symbol, timeframe: tf, limit: 200 });
  candleCache.set(cacheKey, result.candles);
  return result.candles;
}

// ─── Tool Handlers ────────────────────────────────────────────
// Each handler takes the tool input and returns a JSON-serializable result.
// Wire these into your agentic loop's tool_use block handler.

export async function handleChartAnalysisTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  candleCache: Map<string, Candle[]>
): Promise<unknown> {
  const symbol    = (toolInput.symbol    as string) || '';
  const timeframe = (toolInput.timeframe as string) || '4h';

  switch (toolName) {

    case 'analyze_market_structure': {
      const candles = await resolveCandles(symbol, timeframe, candleCache);
      const pivots = extractZigZagPivots(candles);
      const { support, resistance } = detectSupportResistance(candles, pivots);
      const vp  = buildVolumeProfile(candles);
      const poc = vp.find(b => b.is_poc);
      const vah = vp.find(b => b.is_vah);
      const val = vp.find(b => b.is_val);
      const trend_htf = detectTrend(candles, 50);
      const trend_ltf = detectTrend(candles, 20);
      return {
        symbol, timeframe,
        trend_htf, trend_ltf,
        key_levels: [...support, ...resistance].slice(0, 8),
        vpoc: poc?.price ?? 0,
        vah:  vah?.price ?? 0,
        val:  val?.price ?? 0,
        current_price: candles[candles.length - 1].close,
      };
    }

    case 'get_market_pivots': {
      const threshold = (toolInput.threshold as number) || 0.03;
      const candles = await resolveCandles(symbol, timeframe, candleCache);
      const pivots  = extractZigZagPivots(candles, threshold);
      return {
        symbol, timeframe, threshold,
        pivots: pivots.slice(-12).map(p => ({
          type:       p.type,
          price:      p.price,
          timestamp:  p.timestamp,
          change_pct: p.change_pct,
        })),
        total: pivots.length,
      };
    }

    case 'get_htf_context': {
      const tfMap: Partial<Record<Timeframe, Candle[]>> = {};
      for (const tf of ['1h', '4h', '1d', '1w'] as Timeframe[]) {
        try {
          const cacheKey = `${symbol}:${tf}`;
          if (candleCache.has(cacheKey)) {
            tfMap[tf] = candleCache.get(cacheKey)!;
          } else {
            const r = await ohlcvIngest.fetch({ symbol, timeframe: tf, limit: 200 });
            tfMap[tf] = r.candles;
            candleCache.set(cacheKey, r.candles);
          }
        } catch { /* skip unavailable timeframes */ }
      }
      const ctx = buildMultiTimeframeContext(tfMap);
      return { symbol, ...ctx };
    }

    case 'detect_harmonic_setup': {
      const candles  = await resolveCandles(symbol, timeframe, candleCache);
      const pivots   = extractZigZagPivots(candles);
      const patterns = detectHarmonicPatterns(pivots);
      return {
        symbol, timeframe,
        patterns_found: patterns.length,
        patterns: patterns.map(p => ({
          name:           p.name,
          direction:      p.direction,
          completion_pct: p.completion_pct,
          prz_high:       p.prz_high,
          prz_low:        p.prz_low,
          ratios:         p.ratios,
        })),
        current_price: candles[candles.length - 1].close,
      };
    }

    case 'get_confluence_zones': {
      const tolerancePct = (toolInput.tolerance_pct as number) || 0.01;
      const candles   = await resolveCandles(symbol, timeframe, candleCache);
      const fibLevels = calculateFibonacciLevels(candles);
      const stdPivots = calculateStandardPivots(candles);
      const camPivots = calculateCamarillaPivots(candles);
      const pivots    = extractZigZagPivots(candles);
      const { support, resistance } = detectSupportResistance(candles, pivots);
      const vwap = calculateVWAP(candles);

      const otherLevels: number[] = [
        stdPivots.pp, stdPivots.r1, stdPivots.r2, stdPivots.s1, stdPivots.s2,
        camPivots.r1, camPivots.r2, camPivots.s1, camPivots.s2,
        vwap.value, vwap.upper_band_1, vwap.lower_band_1,
        ...support.map(s => s.price),
        ...resistance.map(r => r.price),
      ].filter(Boolean);

      const clusters = findFibClusters(fibLevels, otherLevels, tolerancePct);

      return {
        symbol, timeframe, tolerance_pct: tolerancePct,
        confluence_zones: clusters
          .sort((a, b) => b.confluences.length - a.confluences.length)
          .slice(0, 6)
          .map(c => ({
            price:        c.price,
            fib_label:    c.fib_label,
            confluences:  c.confluences,
            factor_count: c.confluences.length,
          })),
        current_price: candles[candles.length - 1].close,
      };
    }

    case 'get_pivot_points': {
      const candles   = await resolveCandles(symbol, timeframe, candleCache);
      const standard  = calculateStandardPivots(candles);
      const camarilla = calculateCamarillaPivots(candles);
      const price     = candles[candles.length - 1].close;
      return { symbol, timeframe, current_price: price, standard, camarilla };
    }

    case 'get_ichimoku_detail': {
      const candles  = await resolveCandles(symbol, timeframe, candleCache);
      const ichimoku = calculateIchimoku(candles);
      const price    = candles[candles.length - 1].close;
      return {
        symbol, timeframe, current_price: price,
        ichimoku,
        interpretation: {
          cloud_signal:  ichimoku.price_vs_cloud === 'above' ? 'bullish' : ichimoku.price_vs_cloud === 'below' ? 'bearish' : 'neutral',
          tk_signal:     ichimoku.tk_cross === 'bullish' ? 'bullish cross' : ichimoku.tk_cross === 'bearish' ? 'bearish cross' : 'no cross',
          chikou_signal: ichimoku.chikou_clear ? 'bullish (chikou above price)' : 'not clear',
          cloud_type:    ichimoku.cloud_color === 'green' ? 'bullish cloud ahead' : 'bearish cloud ahead',
        },
      };
    }

    case 'get_vwap_bands': {
      const candles   = await resolveCandles(symbol, timeframe, candleCache);
      const vwap      = calculateVWAP(candles);
      const price     = candles[candles.length - 1].close;
      const deviation = Math.abs(price - vwap.value) / vwap.value * 100;
      return {
        symbol, timeframe, current_price: price,
        vwap,
        deviation_pct: parseFloat(deviation.toFixed(2)),
        interpretation: {
          position:     vwap.price_vs_vwap,
          above_1sigma: price > vwap.upper_band_1,
          below_1sigma: price < vwap.lower_band_1,
          above_2sigma: price > vwap.upper_band_2,
          below_2sigma: price < vwap.lower_band_2,
          mean_reversion_signal:
            price > vwap.upper_band_2 ? 'extended above — short mean reversion possible' :
            price < vwap.lower_band_2 ? 'extended below — long mean reversion possible' :
            'within normal bands',
        },
      };
    }

    default:
      throw new Error(`Unknown chart analysis tool: ${toolName}`);
  }
}
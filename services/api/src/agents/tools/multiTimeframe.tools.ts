// ============================================================
// multiTimeframe.tools.ts
// LLM-callable tools for multi-timeframe analysis.
// Exposes get_htf_context and get_confluence_zones as
// drill-down tools the LLM can call mid-reasoning.
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { Candle, MultiTimeframeContext } from '../chartAnalysis.types';
import {
  buildMTFContextForSymbol,
  checkAllTimeframesAligned,
  formatMTFForPrompt,
} from '../../read/multiTimeframe.builder';
import { ohlcvIngest, Timeframe } from '../../read/ingestion/ohlcv.ingest';
import {
  detectSupportResistance,
  extractZigZagPivots,
  buildVolumeProfile,
} from '../skills/structure.skill';
import { calculateFibonacciLevels } from '../skills/fibonacci.skill';
import { calculateStandardPivots, calculateCamarillaPivots } from '../skills/pivots.skill';

// ─── Tool type ────────────────────────────────────────────────
interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ─── Tool Definitions ─────────────────────────────────────────
export const MULTI_TIMEFRAME_TOOLS: Tool[] = [
  {
    name: 'get_full_htf_context',
    description:
      'Returns a complete multi-timeframe analysis for a symbol across 1W/1D/4H/1H/15M. ' +
      'Shows bias, key level, and whether price is at the level for each timeframe. ' +
      'Also returns overall_bias (bullish/bearish/neutral/conflicted) and whether HTF overrides LTF.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Binance symbol e.g. BTCUSDT, SOLUSDT',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'check_timeframe_alignment',
    description:
      'Checks whether 1D, 4H, and 1H timeframes all agree on direction. ' +
      'Returns aligned=true only when all three point the same way. ' +
      'Use this before entering a trade — misalignment is a reason to skip.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Binance symbol e.g. BTCUSDT',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_cross_timeframe_levels',
    description:
      'Finds key price levels that appear across multiple timeframes simultaneously. ' +
      'A level that shows up on both 1D and 4H is stronger than one that only appears on 1H. ' +
      'Returns levels sorted by timeframe confluence count.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Binance symbol e.g. BTCUSDT',
        },
        tolerance_pct: {
          type: 'number',
          description: 'How close two levels must be to count as the same level (default 0.005 = 0.5%)',
        },
      },
      required: ['symbol'],
    },
  },
];

// ─── Tool Handlers ────────────────────────────────────────────
export async function handleMultiTimeframeTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  const symbol = (toolInput.symbol as string) || '';

  switch (toolName) {

    case 'get_full_htf_context': {
      const ctx = await buildMTFContextForSymbol(symbol);
      return {
        symbol,
        overall_bias:       ctx.overall_bias,
        htf_overrides_ltf:  ctx.htf_overrides_ltf,
        confluence_note:    ctx.confluence_note,
        timeframes: {
          '1W': ctx['1W'] ?? null,
          '1D': ctx['1D'],
          '4H': ctx['4H'],
          '1H': ctx['1H'],
          '15M': ctx['15M'] ?? null,
        },
        summary: formatMTFForPrompt(ctx),
      };
    }

    case 'check_timeframe_alignment': {
      const { aligned, bias, ctx } = await checkAllTimeframesAligned(symbol);
      return {
        symbol,
        aligned,
        bias,
        verdict: aligned
          ? `All timeframes agree: ${bias.toUpperCase()}. Safe to enter in that direction.`
          : `Timeframes conflict — overall bias is ${bias}. Reduce size or wait for alignment.`,
        htf_overrides_ltf: ctx.htf_overrides_ltf,
        confluence_note:   ctx.confluence_note,
      };
    }

    case 'get_cross_timeframe_levels': {
      const tolerancePct = (toolInput.tolerance_pct as number) || 0.005;

      // Fetch candles for 3 timeframes
      const timeframes: Timeframe[] = ['1h', '4h', '1d'];
      const candleMap: Partial<Record<Timeframe, Candle[]>> = {};

      await Promise.allSettled(
        timeframes.map(async (tf) => {
          try {
            const r = await ohlcvIngest.fetch({ symbol, timeframe: tf, limit: 200 });
            candleMap[tf] = r.candles;
          } catch { /* skip */ }
        })
      );

      // Collect key levels from each timeframe
      const levelsByTf: Record<string, number[]> = {};
      for (const [tf, candles] of Object.entries(candleMap)) {
        if (!candles || candles.length < 20) continue;
        const pivots = extractZigZagPivots(candles);
        const { support, resistance } = detectSupportResistance(candles, pivots);
        const vp  = buildVolumeProfile(candles);
        const poc = vp.find(b => b.is_poc);
        const vah = vp.find(b => b.is_vah);
        const val = vp.find(b => b.is_val);

        const levels: number[] = [
          ...support.map(s => s.price),
          ...resistance.map(r => r.price),
        ];
        if (poc) levels.push(poc.price);
        if (vah) levels.push(vah.price);
        if (val) levels.push(val.price);

        levelsByTf[tf] = levels;
      }

      // Find levels that appear in multiple timeframes
      const allLevels = Object.values(levelsByTf).flat();
      const confluenceMap: Map<number, { price: number; timeframes: string[]; count: number }> = new Map();

      for (const [tf, levels] of Object.entries(levelsByTf)) {
        for (const level of levels) {
          // Find if this level clusters with an existing entry
          let found = false;
          for (const [key, entry] of confluenceMap.entries()) {
            if (Math.abs(entry.price - level) / entry.price <= tolerancePct) {
              if (!entry.timeframes.includes(tf)) {
                entry.timeframes.push(tf);
                entry.count = entry.timeframes.length;
              }
              found = true;
              break;
            }
          }
          if (!found) {
            confluenceMap.set(level, { price: level, timeframes: [tf], count: 1 });
          }
        }
      }

      const currentPrice = Object.values(candleMap)[0]?.slice(-1)[0]?.close ?? 0;

      const confluenceLevels = Array.from(confluenceMap.values())
        .filter(l => l.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(l => ({
          price:            parseFloat(l.price.toFixed(4)),
          timeframes:       l.timeframes,
          confluence_count: l.count,
          distance_pct:     parseFloat((Math.abs(l.price - currentPrice) / currentPrice * 100).toFixed(2)),
          side:             l.price > currentPrice ? 'resistance' : 'support',
        }));

      return {
        symbol,
        current_price: currentPrice,
        tolerance_pct: tolerancePct,
        confluence_levels: confluenceLevels,
        single_timeframe_levels_excluded: true,
        note: 'Only showing levels confirmed by 2+ timeframes',
      };
    }

    default:
      throw new Error(`Unknown multi-timeframe tool: ${toolName}`);
  }
}
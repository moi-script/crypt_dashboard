// ============================================================
// multiTimeframe.builder.ts
// Builds MTF context for use in context.builder.ts integration.
// Call from read/context.builder.ts — MODIFY, don't recreate.
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { Candle, MultiTimeframeContext } from '../agents/chartAnalysis.types';
import { buildMultiTimeframeContext, isAllTimeframesAligned, getHTFBias } from '../agents/skills/multiTimeframe.skill';
import { ohlcvIngest, Timeframe } from './ingestion/ohlcv.ingest';

// ─── Build full MTF context for a symbol ─────────────────────

export async function buildMTFContextForSymbol(
  symbol: string
): Promise<MultiTimeframeContext> {
  const timeframes: Timeframe[] = ['15m', '1h', '4h', '1d', '1w'];
  const candleMap: Partial<Record<Timeframe, Candle[]>> = {};

  await Promise.allSettled(
    timeframes.map(async (tf) => {
      try {
        const r = await ohlcvIngest.fetch({ symbol, timeframe: tf, limit: 200 });
        candleMap[tf] = r.candles;
      } catch {
        // Skip unavailable timeframes
      }
    })
  );

  return buildMultiTimeframeContext(candleMap);
}

// ─── Get quick HTF bias (used in context.builder.ts) ─────────

export async function getHTFBiasForSymbol(
  symbol: string
): Promise<'bullish' | 'bearish' | 'neutral'> {
  try {
    const r = await ohlcvIngest.fetch({ symbol, timeframe: '1d', limit: 200 });
    return getHTFBias(r.candles);
  } catch {
    return 'neutral';
  }
}

// ─── Check if all timeframes aligned (used before entry) ─────

export async function checkAllTimeframesAligned(
  symbol: string
): Promise<{ aligned: boolean; bias: string; ctx: MultiTimeframeContext }> {
  const ctx = await buildMTFContextForSymbol(symbol);
  return {
    aligned: isAllTimeframesAligned(ctx),
    bias:    ctx.overall_bias,
    ctx,
  };
}

// ─── Format MTF context for LLM injection ────────────────────

export function formatMTFForPrompt(ctx: MultiTimeframeContext): string {
  const lines: string[] = [
    `Overall bias: ${ctx.overall_bias.toUpperCase()}`,
    `HTF overrides LTF: ${ctx.htf_overrides_ltf}`,
    ctx.confluence_note,
  ];

  const tfs = [
    ['1W', ctx['1W']],
    ['1D', ctx['1D']],
    ['4H', ctx['4H']],
    ['1H', ctx['1H']],
    ['15M', ctx['15M']],
  ] as const;

  for (const [tf, data] of tfs) {
    if (!data) continue;
    lines.push(`  ${tf}: ${data.bias} | ${data.structure} | key: ${data.key_level?.toFixed(4) ?? 'N/A'} | at_level: ${data.at_level}`);
  }

  return lines.join('\n');
}

// ============================================================
// chartAnalysis.service.ts
// Orchestrates: OHLCV fetch → ALL Tier 1 skills → MarketPrimitives
// → Anthropic Claude API (Tier 2) → ChartAnalysisResult
// This is the core engine of the Two-Tier system.
// ============================================================

// import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {
  Candle,
  MarketPrimitives,
  ChartAnalysisResult,
  BtcContext,
  MarketRegime,
} from '../agents/chartAnalysis.types';
import { ohlcvIngest, Timeframe } from '../read/ingestion/ohlcv.ingest';

// ─── Tier 1 Skills ───────────────────────────────────────────
import { computeAllIndicators } from '../agents/skills/indicators.skill';
import { detectOrderBlocks, detectFairValueGaps, detectBreakOfStructure, detectChangeOfCharacter, detectLiquiditySweeps } from '../agents/skills/smartMoney.skill';
import { extractZigZagPivots, buildVolumeProfile, detectSupportResistance, detectTrend, detectPsychologicalLevels } from '../agents/skills/structure.skill';
import { calculateFibonacciLevels } from '../agents/skills/fibonacci.skill';
import { calculateStandardPivots, calculateCamarillaPivots } from '../agents/skills/pivots.skill';
import { analyzeElliottWave } from '../agents/skills/elliott.skill';
import { detectWyckoffRange } from '../agents/skills/wyckoff.skill';
import { analyzeHarmonics } from '../agents/skills/harmonics.skill';
import { buildMultiTimeframeContext } from '../agents/skills/multiTimeframe.skill';

// ─── Prompts ─────────────────────────────────────────────────
// import { CHART_ANALYST_SYSTEM_PROMPT } from '../agents/policy/prompts/chartAnalyst.prompt';
import { CHART_ANALYST_SYSTEM_PROMPT } from '../agents/policy/prompts/chartAnalyst.prompt';
// '@/agents/policy/prompts/chartAnalyst.prompt'
// ─── Zod for response validation ─────────────────────────────
import { z } from 'zod';
const ChartAnalysisResultSchema = z.object({
  regime: z.enum(['trending_up', 'trending_down', 'ranging', 'accumulation', 'distribution', 'price_discovery']),
  bias: z.enum(['long', 'short', 'neutral']),
  primary_framework: z.enum(['SmartMoney', 'Wyckoff', 'ElliottWave', 'Harmonic', 'Hybrid']),
  setup_name: z.string(),
  entry_zone: z.object({ high: z.number(), low: z.number() }),
  stop_loss: z.number(),
  take_profit_levels: z.array(z.number()),
  risk_reward: z.number(),
  confidence: z.number().gte(0).lte(100),
  invalidation: z.string(),
  reasoning: z.string(),
  framework_scores: z.record(z.string(), z.number()),
  confluence_score: z.number().gte(0).lte(9),
  confluence_factors: z.array(z.string()),
});
// ─── Configuration ────────────────────────────────────────────
const DEFAULT_TIMEFRAMES: Timeframe[] = ['1h', '4h', '1d'];
const MAX_TOOL_CALL_ITERATIONS = 5;
const TOKEN_BUDGET = 3000; // primitives JSON target

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey:  process.env.DEEPSEEK_API_KEY ?? '',
});

// ─── Token estimator (rough) ──────────────────────────────────
function estimateTokens(obj: unknown): number {
  return Math.ceil(JSON.stringify(obj).length / 4);
}

// ─── Compress primitives to fit token budget ──────────────────
function compressPrimitives(primitives: MarketPrimitives): MarketPrimitives {
  const compressed = { ...primitives };

  // Truncate key_levels to top 5
  if (compressed.structure.key_levels.length > 5) {
    compressed.structure.key_levels = compressed.structure.key_levels.slice(0, 5);
  }

  // Truncate smart_money arrays
  if (compressed.smart_money.order_blocks.length > 3) {
    compressed.smart_money.order_blocks = compressed.smart_money.order_blocks.slice(0, 3);
  }
  if (compressed.smart_money.fvgs.length > 3) {
    compressed.smart_money.fvgs = compressed.smart_money.fvgs.slice(0, 3);
  }
  if (compressed.smart_money.liquidity_sweeps.length > 3) {
    compressed.smart_money.liquidity_sweeps = compressed.smart_money.liquidity_sweeps.slice(0, 3);
  }

  // Truncate psychological levels to nearest 6
  if (compressed.structure.psychological_levels.length > 6) {
    const currentPrice = compressed.indicators.vwap.value;
    compressed.structure.psychological_levels = compressed.structure.psychological_levels
      .sort((a, b) => Math.abs(a - currentPrice) - Math.abs(b - currentPrice))
      .slice(0, 6)
      .sort((a, b) => a - b);
  }

  // Truncate fibonacci levels to key ratios only
  if (compressed.fibonacci) {
    const keyRatios = ['0.236', '0.382', '0.5', '0.618', '0.786'];
    const keyExtensions = ['1.272', '1.618', '2.618'];
    const filteredLevels: Record<string, number> = {};
    const filteredExtensions: Record<string, number> = {};
    for (const r of keyRatios) {
      if (compressed.fibonacci.levels[r]) filteredLevels[r] = compressed.fibonacci.levels[r];
    }
    for (const e of keyExtensions) {
      if (compressed.fibonacci.extensions[e]) filteredExtensions[e] = compressed.fibonacci.extensions[e];
    }
    compressed.fibonacci = { ...compressed.fibonacci, levels: filteredLevels, extensions: filteredExtensions };
  }

  compressed.meta.token_count_estimate = estimateTokens(compressed);
  return compressed;
}

// ─── Build Market Primitives (Tier 1) ────────────────────────
export async function buildMarketPrimitives(
  symbol: string,
  btcContext?: BtcContext
): Promise<MarketPrimitives> {
  // 1. Fetch multi-timeframe OHLCV
  const candleMap = await ohlcvIngest.fetchMultiTimeframe(symbol, DEFAULT_TIMEFRAMES, 200);
  const candles4H = candleMap['4h'] || [];
  const candles1D = candleMap['1d'] || [];
  const candles1H = candleMap['1h'] || [];

  // Primary analysis timeframe is 4H
  const primary = candles4H.length > 0 ? candles4H : candles1H;

  // 2. Run all Tier 1 skills
  const indicators = computeAllIndicators(primary);
  const pivots = extractZigZagPivots(primary);
  const { support, resistance } = detectSupportResistance(primary, pivots);
  const vpProfile = buildVolumeProfile(primary);
  const poc   = vpProfile.find(b => b.is_poc)?.price || 0;
  const vah   = vpProfile.find(b => b.is_vah)?.price || 0;
  const val   = vpProfile.find(b => b.is_val)?.price || 0;

  const orderBlocks = detectOrderBlocks(primary, '4H');
  const fvgs        = detectFairValueGaps(primary);
  const bos         = detectBreakOfStructure(primary, pivots);
  const choch       = detectChangeOfCharacter(primary, pivots);
  const sweeps      = detectLiquiditySweeps(primary, pivots);
  const fibonacci   = calculateFibonacciLevels(primary);
  const wyckoff     = detectWyckoffRange(primary);
  const elliott     = analyzeElliottWave(primary);
  const harmonics   = analyzeHarmonics(primary);
  const mtfa        = buildMultiTimeframeContext(candleMap as any);
  const stdPivots   = calculateStandardPivots(primary);
  const camPivots   = calculateCamarillaPivots(primary);
  const psychLevels = detectPsychologicalLevels(primary);

  const trend_htf = candles1D.length > 0 ? detectTrend(candles1D) : detectTrend(primary);
  const trend_ltf = detectTrend(candles1H.length > 0 ? candles1H : primary);

  // 3. Assemble primitives
  const primitives: MarketPrimitives = {
    meta: {
      symbol,
      timeframes_analyzed: DEFAULT_TIMEFRAMES,
      generated_at: new Date().toISOString(),
      token_count_estimate: 0,
    },
    indicators,
    structure: {
      trend_htf: trend_htf === 'consolidating' ? 'neutral' : trend_htf as any,
      trend_ltf,
      key_levels: [...support, ...resistance],
      vpoc: poc,
      vah,
      val,
      pivot_points: {
        standard: stdPivots,
        camarilla: camPivots,
      },
      psychological_levels: psychLevels,
    },
    smart_money: {
      order_blocks: orderBlocks.map(ob => ({
        price_high: ob.high,
        price_low: ob.low,
        type: ob.type,
        status: ob.status === 'mitigated' ? 'mitigated' : 'unmitigated',
        timeframe: ob.timeframe,
      })),
      fvgs,
      bos: bos.length > 0 ? bos[bos.length - 1] : null,
      choch,
      liquidity_sweeps: sweeps,
    },
    fibonacci: fibonacci || null,
    wyckoff: wyckoff || null,
    elliott: elliott || null,
    harmonics: harmonics || null,
    mtfa: mtfa || null,
    btc_context: btcContext,
  };

  // 4. Compress to token budget
  return compressPrimitives(primitives);
}

// ─── Run Tier 2 LLM Analysis ─────────────────────────────────
export async function runChartAnalysis(
  primitives: MarketPrimitives
): Promise<ChartAnalysisResult> {
  const userMessage = `
Analyze the following Market Primitives for ${primitives.meta.symbol} and return a structured trade plan.

<market_primitives>
${JSON.stringify(primitives, null, 2)}
</market_primitives>

Return ONLY valid JSON matching the ChartAnalysisResult schema. No markdown, no explanation outside the JSON.
`;

const response = await deepseek.chat.completions.create({
  model:       'deepseek-chat',
  max_tokens:  1500,
  temperature: 0.3,
  messages: [
    { role: 'system', content: CHART_ANALYST_SYSTEM_PROMPT },
    { role: 'user',   content: userMessage },
  ],
});

const text = response.choices?.[0]?.message?.content ?? '';

  // Strip any accidental markdown fences
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const parsed = JSON.parse(clean);
    return ChartAnalysisResultSchema.parse(parsed) as ChartAnalysisResult;
  } catch (err) {
    console.error('ChartAnalysis parse error:', err, '\nRaw:', clean);
    // Return a safe default on parse failure
    return {
      regime: 'ranging',
      bias: 'neutral',
      primary_framework: 'SmartMoney',
      setup_name: 'Parse Error — Manual Review Required',
      entry_zone: { high: 0, low: 0 },
      stop_loss: 0,
      take_profit_levels: [],
      risk_reward: 0,
      confidence: 0,
      invalidation: 'LLM output could not be parsed',
      reasoning: clean.slice(0, 500),
      framework_scores: {},
      confluence_score: 0,
      confluence_factors: [],
    };
  }
}

// ─── Full Pipeline: symbol → ChartAnalysisResult ─────────────
export async function analyzeSymbol(
  symbol: string,
  btcContext?: BtcContext
): Promise<{ primitives: MarketPrimitives; result: ChartAnalysisResult }> {
  const primitives = await buildMarketPrimitives(symbol, btcContext);
  const result = await runChartAnalysis(primitives);
  return { primitives, result };
}







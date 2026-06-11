
// ============================================================
// multiTimeframe.skill.ts
// Multi-timeframe analysis: builds HTF→LTF confluence,
// determines overall bias and key levels per timeframe
// ============================================================

import { Candle, MultiTimeframeContext, TimeframeBias, MarketRegime } from '../chartAnalysis.types';
import { detectTrend, extractZigZagPivots, detectSupportResistance } from './structure.skill';
import { Timeframe } from '../../read/ingestion/ohlcv.ingest';

// ─── Analyze a single timeframe ───────────────────────────────
function analyzeTimeframe(candles: Candle[]): TimeframeBias {
  if (!candles || candles.length < 20) {
    return { bias: 'neutral', structure: 'insufficient data', key_level: 0, at_level: false, regime: 'ranging' };
  }

  const trend = detectTrend(candles);
  const pivots = extractZigZagPivots(candles);
  const { support, resistance } = detectSupportResistance(candles, pivots);
  const currentPrice = candles[candles.length - 1].close;
  const atr = estimateAtr(candles);

  // Determine current regime
  let regime: MarketRegime;
  if (trend === 'bullish') regime = 'trending_up';
  else if (trend === 'bearish') regime = 'trending_down';
  else regime = 'ranging';

  // Find nearest key level
  const allLevels = [
    ...support.map(s => s.price),
    ...resistance.map(r => r.price),
  ].sort((a, b) => Math.abs(a - currentPrice) - Math.abs(b - currentPrice));

  const nearestLevel = allLevels[0] || currentPrice;
  const atLevel = Math.abs(currentPrice - nearestLevel) < atr * 0.5;

  // Structure description
  let structure = trend;
  if (atLevel) {
    const levelType = nearestLevel < currentPrice ? 'support' : 'resistance';
    structure += ` at ${levelType}`;
  }

  // Bias from trend
  const bias: TimeframeBias['bias'] =
    trend === 'bullish' ? 'bullish' :
    trend === 'bearish' ? 'bearish' : 'neutral';

  return { bias, structure, key_level: nearestLevel, at_level: atLevel, regime };
}

function estimateAtr(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return candles[candles.length - 1]?.close * 0.02 || 0;
  const trs = candles.slice(-period).map((c, i, arr) => {
    if (i === 0) return c.high - c.low;
    return Math.max(c.high - c.low, Math.abs(c.high - arr[i-1].close), Math.abs(c.low - arr[i-1].close));
  });
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

// ─── Build multi-timeframe context ───────────────────────────
export function buildMultiTimeframeContext(
  candleMap: Partial<Record<Timeframe, Candle[]>>
): MultiTimeframeContext {
  const tf1W  = candleMap['1w']  ? analyzeTimeframe(candleMap['1w'])  : undefined;
  const tf1D  = candleMap['1d']  ? analyzeTimeframe(candleMap['1d'])  : { bias: 'neutral' as const, structure: 'no data', key_level: 0, at_level: false, regime: 'ranging' as MarketRegime };
  const tf4H  = candleMap['4h']  ? analyzeTimeframe(candleMap['4h'])  : { bias: 'neutral' as const, structure: 'no data', key_level: 0, at_level: false, regime: 'ranging' as MarketRegime };
  const tf1H  = candleMap['1h']  ? analyzeTimeframe(candleMap['1h'])  : { bias: 'neutral' as const, structure: 'no data', key_level: 0, at_level: false, regime: 'ranging' as MarketRegime };
  const tf15M = candleMap['15m'] ? analyzeTimeframe(candleMap['15m']) : undefined;

  // Score bias: bullish = +1, neutral = 0, bearish = -1
  const biasScore = (b: 'bullish' | 'bearish' | 'neutral') =>
    b === 'bullish' ? 1 : b === 'bearish' ? -1 : 0;

  const frames = [tf1W, tf1D, tf4H, tf1H, tf15M].filter(Boolean) as TimeframeBias[];
  const totalScore = frames.reduce((s, f) => s + biasScore(f.bias), 0);
  const maxScore = frames.length;

  let overall_bias: MultiTimeframeContext['overall_bias'];
  if (totalScore >= maxScore * 0.6) overall_bias = 'bullish';
  else if (totalScore <= -maxScore * 0.6) overall_bias = 'bearish';
  else if (Math.abs(totalScore) <= maxScore * 0.2) overall_bias = 'neutral';
  else overall_bias = 'conflicted';

  // HTF overrides LTF: if 1D and 4H disagree with 1H
  const htfBias = tf1D.bias;
  const ltfBias = tf1H.bias;
  const htf_overrides_ltf = htfBias !== 'neutral' && htfBias !== ltfBias;

  // Confluence note
  let confluence_note = '';
  if (htf_overrides_ltf) {
    confluence_note = `HTF (1D) is ${htfBias} — overrides LTF (1H) ${ltfBias} signal. `;
  }
  if (overall_bias === 'conflicted') {
    confluence_note += 'Mixed signals across timeframes — reduce size or wait for alignment.';
  } else {
    confluence_note += `${frames.filter(f => f.bias === overall_bias).length}/${frames.length} timeframes aligned ${overall_bias}.`;
  }

  return {
    '1W': tf1W,
    '1D': tf1D,
    '4H': tf4H,
    '1H': tf1H,
    '15M': tf15M,
    overall_bias,
    htf_overrides_ltf,
    confluence_note,
  };
}

// ─── Quick HTF bias (for cross-asset LLM injection) ──────────
export function getHTFBias(candles: Candle[]): 'bullish' | 'bearish' | 'neutral' {
  return analyzeTimeframe(candles).bias;
}

// ─── Check if all timeframes agree ───────────────────────────
export function isAllTimeframesAligned(ctx: MultiTimeframeContext): boolean {
  const frames = [ctx['1D'], ctx['4H'], ctx['1H']];
  const biases = frames.map(f => f.bias);
  return biases.every(b => b === biases[0] && b !== 'neutral');
}




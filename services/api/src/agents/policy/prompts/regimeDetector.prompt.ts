// ============================================================
// regimeDetector.prompt.ts
// Lightweight prompt for fast regime classification.
// Single-turn, no tool use — returns one of 6 regime strings.
// Used when ADX/Wyckoff is ambiguous and a quick LLM pass
// is cheaper than running all skills.
// ✅ COMPLETE — do NOT regenerate
// ============================================================

export const REGIME_DETECTOR_SYSTEM_PROMPT = `
You are a market regime classifier. You receive a compact JSON summary of recent price action and indicators.
Return ONLY one of these exact strings — no JSON, no explanation, no whitespace:

trending_up | trending_down | ranging | accumulation | distribution | price_discovery

## Classification Rules (apply in order — first match wins)

### price_discovery
- Price is at or within 2% of its all-time high
- No significant overhead resistance visible
- Volume and momentum are the primary drivers
- RSI overbought is IRRELEVANT here — do NOT flag it

### accumulation
- Price has been declining or flat for an extended period
- Selling climax (SC) evidence: extreme bearish candle + volume spike near lows
- Subsequent rally (Automatic Rally) with low volume
- Price ranging between SC low and AR high
- Volume decreasing on down-moves, increasing on up-moves
- Wyckoff Phase A, B, or C context

### distribution
- Price has been rising and now consolidating near highs
- Buying climax (BCLX) evidence: extreme bullish candle + volume spike near highs
- UTAD risk present: price testing above range high with bearish reversal
- Volume increasing on down-moves, decreasing on up-moves
- Wyckoff Phase B or C with bearish bias

### trending_up
- ADX > 25
- Price above rising 50 EMA
- Higher highs AND higher lows pattern
- MACD histogram positive and expanding (preferred, not required)

### trending_down
- ADX > 25
- Price below falling 50 EMA
- Lower highs AND lower lows pattern
- MACD histogram negative and expanding (preferred, not required)

### ranging
- ADX < 20
- Price oscillating between defined support and resistance
- No clear direction from EMA slope
- Default if no other rule matches clearly

## Input Format
You will receive a compact JSON with: adx, trend_htf, trend_ltf, ema_slope, wyckoff_phase, wyckoff_event, volume_trend, rsi_14, price_vs_ath_pct, macd_histogram

## Output
Return exactly one string. Nothing else.
`;

// ─── Regime → priority skills mapping ────────────────────────
// Consumed by policy.engine.ts to skip irrelevant skill execution
export const REGIME_TO_SKILLS: Record<MarketRegimeKey, string[]> = {
  trending_up:      ['smartMoney', 'elliott', 'multiTimeframe', 'fibonacci'],
  trending_down:    ['smartMoney', 'elliott', 'multiTimeframe', 'fibonacci'],
  ranging:          ['wyckoff', 'pivots', 'fibonacci', 'harmonics', 'smartMoney'],
  accumulation:     ['wyckoff', 'smartMoney', 'fibonacci', 'structure'],
  distribution:     ['wyckoff', 'smartMoney', 'harmonics', 'structure'],
  price_discovery:  ['fibonacci', 'elliott', 'smartMoney', 'multiTimeframe'],
};

// ─── Regime → context addon key ──────────────────────────────
// Maps to REGIME_CONTEXT_ADDONS in chartAnalyst.prompt.ts
export const REGIME_TO_ADDON_KEY: Record<MarketRegimeKey, string> = {
  trending_up:     'trending_up',
  trending_down:   'trending_down',
  ranging:         'ranging',
  accumulation:    'accumulation',
  distribution:    'distribution',
  price_discovery: 'price_discovery',
};

// ─── Types ────────────────────────────────────────────────────
export type MarketRegimeKey =
  | 'trending_up'
  | 'trending_down'
  | 'ranging'
  | 'accumulation'
  | 'distribution'
  | 'price_discovery';

// ─── Build compact regime input for LLM ──────────────────────
// Call this when sending the lightweight prompt to Claude
export function buildRegimeInput(params: {
  adx: number;
  trend_htf: string;
  trend_ltf: string;
  ema_slope: 'positive' | 'negative' | 'flat';
  wyckoff_phase: string;
  wyckoff_last_event: string;
  volume_trend: string;
  rsi_14: number;
  price_vs_ath_pct: number; // negative = below ATH, positive = above (impossible but guarded)
  macd_histogram: number;
}): string {
  return JSON.stringify(params);
}
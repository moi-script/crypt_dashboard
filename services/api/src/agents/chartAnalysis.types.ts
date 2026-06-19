
// ============================================================
// chartAnalysis.types.ts
// All TypeScript interfaces for the Two-Tier Chart Analysis System
// ============================================================

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Market Regimes ─────────────────────────────────────────
export type MarketRegime =
  | 'trending_up'
  | 'trending_down'
  | 'ranging'
  | 'accumulation'    // Wyckoff Phase B/C
  | 'distribution'    // Wyckoff Phase D
  | 'price_discovery'; // Post-ATH breakout

// ─── Smart Money Concepts ────────────────────────────────────
export interface FairValueGap {
  high: number;
  low: number;
  timestamp: number;
  filled: boolean;
  type: 'bullish' | 'bearish';
}

export interface OrderBlock {
  id: string;
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  origin_timestamp: number;
  timeframe: string;
  status: 'unmitigated' | 'mitigated' | 'broken';
  associated_fvg?: FairValueGap;
  strength: number; // 0-100
}

export interface BreakOfStructure {
  direction: 'bullish' | 'bearish';
  level: number;
  timestamp: number;
  type: 'BOS' | 'ChoCH'; // Break of Structure vs Change of Character
  confirmed: boolean;
}

export interface LiquiditySweep {
  level: number;
  swept: boolean;
  timestamp: number;
  candles_ago: number;
  type: 'buy_side' | 'sell_side';
}

// ─── Structure ───────────────────────────────────────────────
export interface SwingPivot {
  type: 'high' | 'low';
  price: number;
  timestamp: number;
  change_pct: number;
}

export interface VolumeProfileLevel {
  price: number;
  volume: number;
  is_poc: boolean;  // Point of Control
  is_vah: boolean;  // Value Area High
  is_val: boolean;  // Value Area Low
}

export interface SupportResistanceZone {
  price: number;
  type: 'support' | 'resistance';
  strength: 'strong' | 'moderate' | 'weak';
  source: 'vpoc' | 'previous_high' | 'previous_low' | 'volume_node' | 'psychological';
  touches: number;
}

// ─── Harmonics ───────────────────────────────────────────────
export interface HarmonicPattern {
  name: 'Gartley' | 'Bat' | 'Butterfly' | 'Crab' | 'Cypher' | 'Shark';
  direction: 'bullish' | 'bearish';
  prz_high: number;  // Potential Reversal Zone
  prz_low: number;
  xabcd: {
    X: number;
    A: number;
    B: number;
    C: number;
    D: number;
    X_ts: number;
    A_ts: number;
    B_ts: number;
    C_ts: number;
    D_ts: number;
  };
  completion_pct: number; // 0-100
  ratios: {
    XAB: number;
    ABC: number;
    BCD: number;
    XAD: number;
  };
}

// ─── Elliott Wave ────────────────────────────────────────────
export type ElliottWaveCount =
  | 'wave_1'
  | 'wave_2'
  | 'wave_3_in_progress'
  | 'wave_4'
  | 'wave_5_in_progress'
  | 'wave_a'
  | 'wave_b'
  | 'wave_c'
  | 'unknown';

export interface ElliottWaveResult {
  wave_count: ElliottWaveCount;
  pivots: number[];
  pivot_timestamps: number[];
  confidence: number; // 0-1
  next_target?: number;
  invalidation_level?: number;
  rules_passed: string[];
  rules_failed: string[];
}

// ─── Wyckoff ─────────────────────────────────────────────────
export type WyckoffPhase = 'A' | 'B' | 'C' | 'D' | 'E' | 'unknown';
export type WyckoffEvent =
  | 'PS'   // Preliminary Support
  | 'SC'   // Selling Climax
  | 'AR'   // Automatic Rally
  | 'ST'   // Secondary Test
  | 'Spring'
  | 'LPS'  // Last Point of Support
  | 'SOS'  // Sign of Strength
  | 'PSY'  // Preliminary Supply
  | 'BCLX' // Buying Climax
  | 'UTAD' // Upthrust After Distribution
  | 'LPSY' // Last Point of Supply
  | 'SOW'  // Sign of Weakness
  | 'unknown';

export interface WyckoffContext {
  phase: WyckoffPhase;
  last_event: WyckoffEvent;
  spring_confirmed: boolean;
  utad_risk: boolean;
  range_high: number;
  range_low: number;
  cause_count: number; // number of bars in cause
  volume_analysis: 'accumulating' | 'distributing' | 'neutral';
  summary: string;
}

// ─── Multi-Timeframe ─────────────────────────────────────────
export interface TimeframeBias {
  bias: 'bullish' | 'bearish' | 'neutral';
  structure: string;
  key_level: number;
  at_level: boolean;
  regime: MarketRegime;
}

export interface MultiTimeframeContext {
  '1W'?: TimeframeBias;
  '1D': TimeframeBias;
  '4H': TimeframeBias;
  '1H': TimeframeBias;
  '15M'?: TimeframeBias;
  overall_bias: 'bullish' | 'bearish' | 'neutral' | 'conflicted';
  htf_overrides_ltf: boolean;
  confluence_note: string;
}

// ─── Indicators ──────────────────────────────────────────────
export interface IchimokuCloud {
  tenkan_sen: number;
  kijun_sen: number;
  senkou_a: number;
  senkou_b: number;
  chikou_span: number;
  price_vs_cloud: 'above' | 'below' | 'inside';
  tk_cross: 'bullish' | 'bearish' | 'none';
  cloud_color: 'green' | 'red';
  chikou_clear: boolean;
}

export interface VWAPData {
  value: number;
  upper_band_1: number;
  lower_band_1: number;
  upper_band_2: number;
  lower_band_2: number;
  price_vs_vwap: 'above' | 'below' | 'at';
}

// ─── Fibonacci ───────────────────────────────────────────────
export interface FibonacciLevels {
  swing_high: number;
  swing_low: number;
  swing_high_ts: number;
  swing_low_ts: number;
  direction: 'bullish_retracement' | 'bearish_retracement';
  levels: Record<string, number>; // '0.236', '0.382', '0.5', '0.618', '0.786'
  extensions: Record<string, number>; // '1.272', '1.618', '2.618'
  current_price_near?: string; // nearest fib level label
}

// ─── Pivot Points ────────────────────────────────────────────
export interface PivotPoints {
  method: 'standard' | 'camarilla' | 'fibonacci';
  pp: number;
  r1: number; r2: number; r3: number;
  s1: number; s2: number; s3: number;
}

// ─── Correlation / Dominance ─────────────────────────────────
export interface CorrelationData {
  coin: string;
  vs: string; // 'BTC'
  correlation_30d: number;  // -1 to 1
  beta_30d: number;         // how much it moves per BTC 1%
  lag_hours: number;        // avg hours it trails BTC
  is_leading: boolean;
  is_lagging: boolean;
}

export interface DominanceData {
  btc_dominance: number;
  eth_dominance: number;
  others_dominance: number;
  btc_d_trend: 'rising' | 'falling' | 'neutral';
  market_phase: 'btc_season' | 'eth_season' | 'alt_season' | 'mixed';
  sector_leaders: string[]; // top performing sectors right now
}

// ─── Market Primitives (Tier 1 output → Tier 2 input) ────────
export interface MarketPrimitives {
  meta: {
    symbol: string;
    timeframes_analyzed: string[];
    generated_at: string;
    token_count_estimate: number;
    price_close: number;  // last candle close — use for execution price, NOT VWAP
  };
  indicators: {
    rsi_14: number;
    macd: { value: number; signal: number; histogram: number; cross: 'bullish' | 'bearish' | 'none' };
    stoch: { k: number; d: number; state: string };
    adx: number;
    ichimoku: IchimokuCloud;
    vwap: VWAPData;
    obv_trend: 'rising' | 'falling' | 'flat';
    cmf: number;
    mfi: number;
    cci: number;
    atr_14: number;
    bb: { upper: number; mid: number; lower: number; squeeze: boolean; percent_b: number };
    williams_r: number;
  };
  structure: {
    trend_htf: 'bullish' | 'bearish' | 'neutral';
    trend_ltf: 'bullish' | 'bearish' | 'consolidating' | 'neutral';
    key_levels: SupportResistanceZone[];
    vpoc: number;
    vah: number;
    val: number;
    pivot_points: {
      standard: PivotPoints;
      camarilla: PivotPoints;
    };
    psychological_levels: number[];
  };
  smart_money: {
    order_blocks: Array<{
      price_high: number;
      price_low: number;
      type: 'bullish' | 'bearish';
      status: 'unmitigated' | 'mitigated';
      timeframe: string;
    }>;
    fvgs: FairValueGap[];
    bos: BreakOfStructure | null;
    choch: BreakOfStructure | null;
    liquidity_sweeps: LiquiditySweep[];
  };
  fibonacci: FibonacciLevels | null;
  wyckoff: WyckoffContext | null;
  elliott: ElliottWaveResult | null;
  harmonics: HarmonicPattern | null;
  mtfa: MultiTimeframeContext | null;
  gann?: {
    angles_in_play: string[];
    price_on_angle: string;
    time_cycle_due: boolean;
    next_cycle_date?: string;
  };
  // BTC context (injected for altcoin analysis)
  btc_context?: BtcContext;
}

// ─── LLM Output (Tier 2) ─────────────────────────────────────
export interface ChartAnalysisResult {
  regime: MarketRegime;
  bias: 'long' | 'short' | 'neutral';
  primary_framework: 'SmartMoney' | 'Wyckoff' | 'ElliottWave' | 'Harmonic' | 'Hybrid';
  setup_name: string;
  entry_zone: { high: number; low: number };
  stop_loss: number;
  take_profit_levels: number[];
  risk_reward: number;
  confidence: number; // 0-100
  invalidation: string;
  reasoning: string;
  framework_scores: Record<string, number>; // how strongly each framework signals
  confluence_score: number; // 0-9 (count of agreeing factors)
  confluence_factors: string[]; // list of what agrees
}

// ─── BTC Context (for cross-asset analysis) ──────────────────
export interface BtcContext {
  regime: MarketRegime;
  bias: 'long' | 'short' | 'neutral';
  signal_fired_at: string; // ISO timestamp
  signal_type: string;
  bos_direction?: 'bullish' | 'bearish';
  bos_level?: number;
  dominance: DominanceData;
  minutes_since_signal: number;
}

// ─── Cascade Map (cross-asset intelligence) ──────────────────
export type CascadeStatus =
  | 'window_open'    // BTC moved, this coin hasn't reacted yet
  | 'reacting_now'   // Currently in motion
  | 'reacted'        // Already moved, window closed
  | 'decorrelated'   // Doesn't follow BTC reliably
  | 'leading';       // This coin moved before BTC (leading indicator)

export interface CascadeEntry {
  coin: string;
  status: CascadeStatus;
  btc_signal_ts: string;
  coin_reaction_ts?: string;
  minutes_elapsed: number;
  expected_window_hours: number;
  window_remaining_minutes: number;
  expected_move_pct: number; // based on historical beta
  historical_follow_rate: number; // 0-1
}

// ─── Intelligence Card (full UI data per coin) ───────────────
export interface CoinIntelligenceCard {
  coin: string;
  symbol: string;
  current_price: number;
  price_change_24h: number;
  cascade: CascadeEntry;
  confluence_score: number;
  confluence_factors: string[];
  analysis: ChartAnalysisResult;
  correlation: CorrelationData;
  historical_setup_accuracy: number; // 0-1, for this specific confluence
  historical_sample_size: number;
  opportunity_score: number; // composite ranking score
  last_updated: string;
}

export interface IntelligenceScan {
  scan_id: string;
  generated_at: string;
  btc_context: BtcContext;
  dominance: DominanceData;
  market_phase: string;
  coins: CoinIntelligenceCard[];
  total_analyzed: number;
  windows_open: number;
  top_opportunities: CoinIntelligenceCard[];
}

// ─── Coin Universe ────────────────────────────────────────────
export interface CoinTier {
  symbol: string;
  tier: 1 | 2 | 3;
  sector?: string;
  binance_symbol: string; // e.g. 'BTCUSDT'
}


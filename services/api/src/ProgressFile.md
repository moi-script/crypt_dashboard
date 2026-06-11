=========================================
SESSION 01
=========================================




chartAnalysis.types.ts

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
  status: 'active' | 'mitigated' | 'broken';
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



coinUniverse.config.ts
// ============================================================
// coinUniverse.config.ts
// Defines the coin watchlist tiers, sector clusters, and dominance pairs
// ============================================================

import { CoinTier } from '../agents/chartAnalysis.types';

// ─── Tier Definitions ────────────────────────────────────────
// Tier 1: Always analyzed on every scheduler tick
// Tier 2: Analyzed when BTC fires a signal
// Tier 3: Scanned for laggard opportunities only

export const COIN_UNIVERSE_CONFIG: {
  tier1: CoinTier[];
  tier2: CoinTier[];
  tier3: CoinTier[];
  sectors: Record<string, string[]>;
  dominancePairs: string[];
} = {
  tier1: [
    { symbol: 'BTC', tier: 1, binance_symbol: 'BTCUSDT' },
    { symbol: 'ETH', tier: 1, binance_symbol: 'ETHUSDT' },
    { symbol: 'BNB', tier: 1, binance_symbol: 'BNBUSDT' },
    { symbol: 'SOL', tier: 1, binance_symbol: 'SOLUSDT' },
  ],

  tier2: [
    { symbol: 'AVAX', tier: 2, sector: 'l1', binance_symbol: 'AVAXUSDT' },
    { symbol: 'NEAR', tier: 2, sector: 'l1', binance_symbol: 'NEARUSDT' },
    { symbol: 'APT',  tier: 2, sector: 'l1', binance_symbol: 'APTUSDT' },
    { symbol: 'SUI',  tier: 2, sector: 'l1', binance_symbol: 'SUIUSDT' },
    { symbol: 'ARB',  tier: 2, sector: 'l2', binance_symbol: 'ARBUSDT' },
    { symbol: 'OP',   tier: 2, sector: 'l2', binance_symbol: 'OPUSDT' },
    { symbol: 'MATIC',tier: 2, sector: 'l2', binance_symbol: 'MATICUSDT' },
    { symbol: 'STRK', tier: 2, sector: 'l2', binance_symbol: 'STRKUSDT' },
    { symbol: 'AAVE', tier: 2, sector: 'defi', binance_symbol: 'AAVEUSDT' },
    { symbol: 'UNI',  tier: 2, sector: 'defi', binance_symbol: 'UNIUSDT' },
    { symbol: 'INJ',  tier: 2, sector: 'defi', binance_symbol: 'INJUSDT' },
  ],

  tier3: [
    { symbol: 'TIA',  tier: 3, sector: 'l1', binance_symbol: 'TIAUSDT' },
    { symbol: 'JUP',  tier: 3, sector: 'defi', binance_symbol: 'JUPUSDT' },
    { symbol: 'WIF',  tier: 3, sector: 'meme', binance_symbol: 'WIFUSDT' },
    { symbol: 'FET',  tier: 3, sector: 'ai', binance_symbol: 'FETUSDT' },
    { symbol: 'RNDR', tier: 3, sector: 'ai', binance_symbol: 'RNDRUSDT' },
    { symbol: 'WLD',  tier: 3, sector: 'ai', binance_symbol: 'WLDUSDT' },
    { symbol: 'TAO',  tier: 3, sector: 'ai', binance_symbol: 'TAOUSDT' },
    { symbol: 'IMX',  tier: 3, sector: 'gaming', binance_symbol: 'IMXUSDT' },
    { symbol: 'MAGIC',tier: 3, sector: 'gaming', binance_symbol: 'MAGICUSDT' },
    { symbol: 'ONDO', tier: 3, sector: 'rwa', binance_symbol: 'ONDOUSDT' },
    { symbol: 'CRV',  tier: 3, sector: 'defi', binance_symbol: 'CRVUSDT' },
    { symbol: 'MKR',  tier: 3, sector: 'defi', binance_symbol: 'MKRUSDT' },
  ],

  sectors: {
    ai:      ['FET', 'RNDR', 'WLD', 'TAO'],
    gaming:  ['IMX', 'MAGIC', 'BEAM'],
    rwa:     ['ONDO', 'POLYX', 'CFG'],
    l2:      ['ARB', 'OP', 'STRK', 'MATIC'],
    defi:    ['AAVE', 'UNI', 'CRV', 'MKR', 'INJ', 'JUP'],
    l1:      ['AVAX', 'NEAR', 'APT', 'SUI', 'TIA'],
    meme:    ['WIF'],
  },

  dominancePairs: ['BTC.D', 'ETH.D', 'OTHERS.D'],
};

// ─── Opportunity Scoring Weights ─────────────────────────────
// These weights determine how coins are ranked in the intelligence scan
export const OPPORTUNITY_SCORE_WEIGHTS = {
  correlation_score: 0.15,       // how tightly correlated to BTC
  btc_signal_alignment: 0.25,    // does it follow BTC's current signal direction
  at_key_level_bonus: 0.20,      // is it sitting at a key TA level right now
  laggard_timing_bonus: 0.25,    // is the cascade window still open
  sector_momentum_bonus: 0.10,   // is its sector showing momentum
  confluence_score: 0.05,        // how many TA frameworks agree
};

// ─── Analysis Throttle ───────────────────────────────────────
// Max coins to run full LLM analysis on per scheduler tick
export const MAX_FULL_ANALYSIS_PER_TICK = 8;

// Minimum opportunity score to proceed to full LLM analysis
export const MIN_OPPORTUNITY_SCORE_THRESHOLD = 0.45;

// ─── Beta Lookup (approximate, updated via correlation.skill.ts) ─
// Default beta values before live calculation is available
export const DEFAULT_BETA: Record<string, number> = {
  ETH: 1.1,
  BNB: 0.9,
  SOL: 1.8,
  AVAX: 2.2,
  NEAR: 2.5,
  APT: 2.8,
  SUI: 3.0,
  ARB: 2.0,
  OP: 2.1,
  MATIC: 1.9,
  AAVE: 1.7,
  UNI: 1.6,
  INJ: 2.4,
  FET: 3.2,
  RNDR: 3.1,
};

// ─── Historical Lag (hours, approximate) ─────────────────────
export const DEFAULT_LAG_HOURS: Record<string, number> = {
  ETH: 0.5,
  BNB: 0.5,
  SOL: 1.0,
  AVAX: 1.5,
  NEAR: 2.0,
  APT: 2.0,
  SUI: 2.5,
  ARB: 2.0,
  OP: 2.0,
  MATIC: 1.5,
  AAVE: 3.0,
  UNI: 3.0,
  INJ: 2.5,
  FET: 4.0,
  RNDR: 4.0,
};




ohlcv.ingest.ts


// ============================================================
// ohlcv.ingest.ts
// Fetches multi-timeframe OHLCV data from Binance REST API
// with Redis caching (configurable TTL per timeframe)
// ============================================================

import { createClient } from 'redis';
import { Candle } from '../../agents/chartAnalysis.types';

// ─── Types ───────────────────────────────────────────────────
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export interface OHLCVRequest {
  symbol: string;       // e.g. 'BTCUSDT'
  timeframe: Timeframe;
  limit?: number;       // default 200
  forceRefresh?: boolean;
}

export interface OHLCVResult {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  cached: boolean;
  fetched_at: string;
}

// ─── TTL config per timeframe (seconds) ──────────────────────
const TTL_BY_TIMEFRAME: Record<Timeframe, number> = {
  '1m':  60,
  '5m':  300,
  '15m': 900,
  '1h':  3600,
  '4h':  14400,
  '1d':  86400,
  '1w':  604800,
};

// ─── Binance kline interval map ──────────────────────────────
const BINANCE_INTERVAL: Record<Timeframe, string> = {
  '1m':  '1m',
  '5m':  '5m',
  '15m': '15m',
  '1h':  '1h',
  '4h':  '4h',
  '1d':  '1d',
  '1w':  '1w',
};

// ─── Parse raw Binance kline array ───────────────────────────
function parseBinanceKline(raw: any[]): Candle {
  return {
    timestamp: raw[0] as number,
    open:      parseFloat(raw[1]),
    high:      parseFloat(raw[2]),
    low:       parseFloat(raw[3]),
    close:     parseFloat(raw[4]),
    volume:    parseFloat(raw[5]),
  };
}

// ─── Redis cache key ─────────────────────────────────────────
function cacheKey(symbol: string, timeframe: Timeframe): string {
  return `ohlcv:${symbol}:${timeframe}`;
}

// ─── Main Fetcher ────────────────────────────────────────────
export class OHLCVIngest {
  private redisClient: any;
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.BINANCE_BASE_URL || 'https://api.binance.com';
    this.apiKey  = process.env.BINANCE_API_KEY || '';
  }

  async init(): Promise<void> {
    this.redisClient = createClient({ url: process.env.REDIS_URL });
    await this.redisClient.connect();
  }

  // ─── Fetch single timeframe ────────────────────────────────
  async fetch(req: OHLCVRequest): Promise<OHLCVResult> {
    const { symbol, timeframe, limit = 200, forceRefresh = false } = req;
    const key = cacheKey(symbol, timeframe);

    // 1. Try cache first (unless forced refresh)
    if (!forceRefresh && this.redisClient) {
      try {
        const cached = await this.redisClient.get(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          return { ...parsed, cached: true };
        }
      } catch (_) {
        // Redis miss or error — fall through to API
      }
    }

    // 2. Fetch from Binance
    const url = `${this.baseUrl}/api/v3/klines?symbol=${symbol}&interval=${BINANCE_INTERVAL[timeframe]}&limit=${limit}`;
    const headers: Record<string, string> = {};
    if (this.apiKey) headers['X-MBX-APIKEY'] = this.apiKey;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Binance OHLCV fetch failed: ${response.status} ${response.statusText} for ${symbol} ${timeframe}`);
    }

    const raw: any[][] = await response.json();
    const candles: Candle[] = raw.map(parseBinanceKline);

    const result: OHLCVResult = {
      symbol,
      timeframe,
      candles,
      cached: false,
      fetched_at: new Date().toISOString(),
    };

    // 3. Cache result
    if (this.redisClient) {
      const ttl = parseInt(process.env.CHART_ANALYSIS_CACHE_TTL || '0') || TTL_BY_TIMEFRAME[timeframe];
      try {
        await this.redisClient.set(key, JSON.stringify(result), { EX: ttl });
      } catch (_) {
        // Cache write failure is non-fatal
      }
    }

    return result;
  }

  // ─── Fetch multiple timeframes in parallel ─────────────────
  async fetchMultiTimeframe(
    symbol: string,
    timeframes: Timeframe[],
    limit = 200
  ): Promise<Record<Timeframe, Candle[]>> {
    const results = await Promise.all(
      timeframes.map(tf => this.fetch({ symbol, timeframe: tf, limit }))
    );

    const map: Partial<Record<Timeframe, Candle[]>> = {};
    for (const r of results) {
      map[r.timeframe] = r.candles;
    }
    return map as Record<Timeframe, Candle[]>;
  }

  // ─── Fetch order book depth ───────────────────────────────
  async fetchOrderBook(symbol: string, limit = 100): Promise<{ bids: number[][]; asks: number[][] }> {
    const url = `${this.baseUrl}/api/v3/depth?symbol=${symbol}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Order book fetch failed: ${response.status}`);
    return response.json();
  }

  // ─── Fetch funding rate (futures) ─────────────────────────
  async fetchFundingRate(symbol: string): Promise<{ fundingRate: number; fundingTime: number } | null> {
    try {
      const url = `${this.baseUrl}/fapi/v1/fundingRate?symbol=${symbol}&limit=1`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      return data[0] ? { fundingRate: parseFloat(data[0].fundingRate), fundingTime: data[0].fundingTime } : null;
    } catch (_) {
      return null;
    }
  }

  // ─── Fetch open interest ──────────────────────────────────
  async fetchOpenInterest(symbol: string): Promise<{ openInterest: number } | null> {
    try {
      const url = `${this.baseUrl}/fapi/v1/openInterest?symbol=${symbol}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      return { openInterest: parseFloat(data.openInterest) };
    } catch (_) {
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.redisClient) await this.redisClient.disconnect();
  }
}

// ─── Singleton export ─────────────────────────────────────────
export const ohlcvIngest = new OHLCVIngest();



smartMoney.skill.ts


// ============================================================
// smartMoney.skill.ts
// ICT / Smart Money Concepts: Order Blocks, Fair Value Gaps,
// Break of Structure, Change of Character, Liquidity Sweeps
// ============================================================

import {
  Candle,
  OrderBlock,
  FairValueGap,
  BreakOfStructure,
  LiquiditySweep,
  SwingPivot,
} from '../chartAnalysis.types';
import { nanoid } from '../../utils/nanoid';

// ─── Configuration ────────────────────────────────────────────
const DEFAULT_LOOKBACK = 10;       // bars to look back for swing high/low
const DISPLACEMENT_BODY_RATIO = 0.6; // impulse candle must be 60%+ body/range
const LIQUIDITY_SWEEP_ATR_MULT = 0.5; // sweep must pierce level by > 0.5 ATR

// ─── Helpers ──────────────────────────────────────────────────
function atr(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs = candles.slice(-period).map((c, i, arr) => {
    if (i === 0) return c.high - c.low;
    const prev = arr[i - 1];
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  });
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

function isBullishCandle(c: Candle): boolean { return c.close > c.open; }
function isBearishCandle(c: Candle): boolean { return c.close < c.open; }

function bodyRatio(c: Candle): number {
  const range = c.high - c.low;
  if (range === 0) return 0;
  return Math.abs(c.close - c.open) / range;
}

function recentSwingHigh(candles: Candle[], endIndex: number, lookback = DEFAULT_LOOKBACK): number {
  const slice = candles.slice(Math.max(0, endIndex - lookback), endIndex);
  return Math.max(...slice.map(c => c.high));
}

function recentSwingLow(candles: Candle[], endIndex: number, lookback = DEFAULT_LOOKBACK): number {
  const slice = candles.slice(Math.max(0, endIndex - lookback), endIndex);
  return Math.min(...slice.map(c => c.low));
}

// ─── Order Block Detection ────────────────────────────────────
// Bullish OB: last bearish candle before a strong bullish impulse that breaks structure
export function detectBullishOrderBlocks(candles: Candle[], timeframe = '4H', maxBlocks = 5): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  const atrValue = atr(candles);

  for (let i = 2; i < candles.length - 2; i++) {
    const origin = candles[i];       // Last bearish candle (the OB)
    const impulse = candles[i + 1];  // Strong bullish displacement

    if (!isBearishCandle(origin)) continue;
    if (!isBullishCandle(impulse)) continue;
    if (bodyRatio(impulse) < DISPLACEMENT_BODY_RATIO) continue;

    // Liquidity sweep: origin low pierces below previous swing low
    const swingLow = recentSwingLow(candles, i);
    const isLiquiditySweep = origin.low < swingLow;

    // Break of Structure: impulse closes above recent swing high
    const swingHigh = recentSwingHigh(candles, i);
    const isBOS = impulse.close > swingHigh;

    // Minimum criteria: displacement + either sweep or BOS
    if (!(isBOS || isLiquiditySweep)) continue;
    if (impulse.close - origin.low < atrValue * 0.8) continue; // impulse must be meaningful

    // Fair Value Gap: gap between origin.high and candles[i+2].low
    let associated_fvg: FairValueGap | undefined;
    if (candles[i + 2] && origin.high < candles[i + 2].low) {
      associated_fvg = {
        high: candles[i + 2].low,
        low: origin.high,
        timestamp: candles[i + 2].timestamp,
        filled: false,
        type: 'bullish',
      };
    }

    // Check if this OB has been mitigated (price traded back into it)
    const futureCandles = candles.slice(i + 2);
    const mitigated = futureCandles.some(c => c.low <= origin.high && c.high >= origin.low);

    const strength = (isBOS ? 40 : 0) + (isLiquiditySweep ? 30 : 0) + (associated_fvg ? 20 : 0) + 10;

    blocks.push({
      id: nanoid(),
      type: 'bullish',
      high: origin.high,
      low: origin.low,
      origin_timestamp: origin.timestamp,
      timeframe,
      status: mitigated ? 'mitigated' : 'active',
      associated_fvg,
      strength,
    });

    if (blocks.filter(b => b.status === 'active').length >= maxBlocks) break;
  }

  // Return most recent unmitigated blocks first
  return blocks
    .filter(b => b.status === 'active')
    .slice(-maxBlocks)
    .reverse();
}

// Bearish OB: last bullish candle before a strong bearish impulse that breaks structure
export function detectBearishOrderBlocks(candles: Candle[], timeframe = '4H', maxBlocks = 5): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  const atrValue = atr(candles);

  for (let i = 2; i < candles.length - 2; i++) {
    const origin = candles[i];
    const impulse = candles[i + 1];

    if (!isBullishCandle(origin)) continue;
    if (!isBearishCandle(impulse)) continue;
    if (bodyRatio(impulse) < DISPLACEMENT_BODY_RATIO) continue;

    const swingHigh = recentSwingHigh(candles, i);
    const isLiquiditySweep = origin.high > swingHigh;

    const swingLow = recentSwingLow(candles, i);
    const isBOS = impulse.close < swingLow;

    if (!(isBOS || isLiquiditySweep)) continue;
    if (origin.high - impulse.close < atrValue * 0.8) continue;

    let associated_fvg: FairValueGap | undefined;
    if (candles[i + 2] && origin.low > candles[i + 2].high) {
      associated_fvg = {
        high: origin.low,
        low: candles[i + 2].high,
        timestamp: candles[i + 2].timestamp,
        filled: false,
        type: 'bearish',
      };
    }

    const futureCandles = candles.slice(i + 2);
    const mitigated = futureCandles.some(c => c.low <= origin.high && c.high >= origin.low);

    const strength = (isBOS ? 40 : 0) + (isLiquiditySweep ? 30 : 0) + (associated_fvg ? 20 : 0) + 10;

    blocks.push({
      id: nanoid(),
      type: 'bearish',
      high: origin.high,
      low: origin.low,
      origin_timestamp: origin.timestamp,
      timeframe,
      status: mitigated ? 'mitigated' : 'active',
      associated_fvg,
      strength,
    });

    if (blocks.filter(b => b.status === 'active').length >= maxBlocks) break;
  }

  return blocks
    .filter(b => b.status === 'active')
    .slice(-maxBlocks)
    .reverse();
}

// Combined detector
export function detectOrderBlocks(candles: Candle[], timeframe = '4H'): OrderBlock[] {
  const bullish = detectBullishOrderBlocks(candles, timeframe);
  const bearish = detectBearishOrderBlocks(candles, timeframe);
  return [...bullish, ...bearish].sort((a, b) => b.origin_timestamp - a.origin_timestamp);
}

// ─── Fair Value Gap Detection ─────────────────────────────────
export function detectFairValueGaps(candles: Candle[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];

    // Bullish FVG: prev.high < next.low (gap up)
    if (prev.high < next.low) {
      const filled = candles.slice(i + 2).some(c => c.low <= next.low);
      fvgs.push({
        high: next.low,
        low: prev.high,
        timestamp: curr.timestamp,
        filled,
        type: 'bullish',
      });
    }

    // Bearish FVG: prev.low > next.high (gap down)
    if (prev.low > next.high) {
      const filled = candles.slice(i + 2).some(c => c.high >= prev.low);
      fvgs.push({
        high: prev.low,
        low: next.high,
        timestamp: curr.timestamp,
        filled,
        type: 'bearish',
      });
    }
  }

  // Return only unfilled FVGs, most recent first
  return fvgs.filter(f => !f.filled).slice(-10).reverse();
}

// ─── Break of Structure ───────────────────────────────────────
export function detectBreakOfStructure(candles: Candle[], pivots: SwingPivot[]): BreakOfStructure[] {
  const breaks: BreakOfStructure[] = [];

  if (pivots.length < 3) return breaks;

  // Determine current trend from pivot sequence
  for (let i = 2; i < pivots.length; i++) {
    const prev2 = pivots[i - 2];
    const prev1 = pivots[i - 1];
    const curr  = pivots[i];

    // Uptrend: higher highs + higher lows
    if (prev2.type === 'low' && prev1.type === 'high' && curr.type === 'low') {
      // Bearish BOS: current low breaks below previous low (structure break to downside)
      if (curr.price < prev2.price) {
        breaks.push({
          direction: 'bearish',
          level: prev2.price,
          timestamp: curr.timestamp,
          type: 'BOS',
          confirmed: true,
        });
      }
    }

    // Downtrend: lower highs + lower lows
    if (prev2.type === 'high' && prev1.type === 'low' && curr.type === 'high') {
      // Bullish BOS: current high breaks above previous high
      if (curr.price > prev2.price) {
        breaks.push({
          direction: 'bullish',
          level: prev2.price,
          timestamp: curr.timestamp,
          type: 'BOS',
          confirmed: true,
        });
      }
    }
  }

  return breaks.slice(-5);
}

// Detect Change of Character (earlier, less confirmed signal)
export function detectChangeOfCharacter(candles: Candle[], pivots: SwingPivot[]): BreakOfStructure | null {
  if (pivots.length < 4) return null;

  // ChoCH: in a downtrend, a bullish candle closes above the most recent swing high
  // (before it's confirmed as a full BOS)
  const recentPivots = pivots.slice(-6);
  const lastHigh = recentPivots.filter(p => p.type === 'high').pop();
  const lastLow  = recentPivots.filter(p => p.type === 'low').pop();

  if (!lastHigh || !lastLow) return null;

  const lastCandle = candles[candles.length - 1];

  // Bullish ChoCH: downtrend, price aggressively breaks above last swing high
  const lowerHighSequence = recentPivots
    .filter(p => p.type === 'high')
    .every((p, i, arr) => i === 0 || p.price < arr[i - 1].price);

  if (lowerHighSequence && lastCandle.close > lastHigh.price) {
    return {
      direction: 'bullish',
      level: lastHigh.price,
      timestamp: lastCandle.timestamp,
      type: 'ChoCH',
      confirmed: false, // not yet confirmed — needs follow-through
    };
  }

  // Bearish ChoCH: uptrend, price aggressively breaks below last swing low
  const higherLowSequence = recentPivots
    .filter(p => p.type === 'low')
    .every((p, i, arr) => i === 0 || p.price > arr[i - 1].price);

  if (higherLowSequence && lastCandle.close < lastLow.price) {
    return {
      direction: 'bearish',
      level: lastLow.price,
      timestamp: lastCandle.timestamp,
      type: 'ChoCH',
      confirmed: false,
    };
  }

  return null;
}

// ─── Liquidity Sweep Detection ────────────────────────────────
export function detectLiquiditySweeps(candles: Candle[], pivots: SwingPivot[]): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = [];
  const atrValue = atr(candles);
  const last20 = candles.slice(-20);

  for (const pivot of pivots.slice(-8)) {
    for (let i = 0; i < last20.length; i++) {
      const c = last20[i];

      if (pivot.type === 'low') {
        // Buy-side liquidity sweep: price dips below swing low then recovers
        const piercedLevel = c.low < pivot.price;
        const recovered = i < last20.length - 1 && last20[i + 1].close > pivot.price;
        const piercedBy = pivot.price - c.low;

        if (piercedLevel && recovered && piercedBy > atrValue * LIQUIDITY_SWEEP_ATR_MULT) {
          sweeps.push({
            level: pivot.price,
            swept: true,
            timestamp: c.timestamp,
            candles_ago: last20.length - 1 - i,
            type: 'buy_side',
          });
        }
      } else {
        // Sell-side liquidity sweep: price spikes above swing high then reverses
        const piercedLevel = c.high > pivot.price;
        const recovered = i < last20.length - 1 && last20[i + 1].close < pivot.price;
        const piercedBy = c.high - pivot.price;

        if (piercedLevel && recovered && piercedBy > atrValue * LIQUIDITY_SWEEP_ATR_MULT) {
          sweeps.push({
            level: pivot.price,
            swept: true,
            timestamp: c.timestamp,
            candles_ago: last20.length - 1 - i,
            type: 'sell_side',
          });
        }
      }
    }
  }

  return sweeps.slice(-5);
}





structure.skill.ts


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


elliott.skill.ts



// ============================================================
// elliott.skill.ts
// Elliott Wave analysis: ZigZag pivot extraction, wave counting,
// Fibonacci ratio validation, invalidation levels
// ============================================================

import { Candle, SwingPivot, ElliottWaveResult, ElliottWaveCount } from '../chartAnalysis.types';
import { extractZigZagPivots } from './structure.skill';

// ─── Fibonacci ratios for validation ─────────────────────────
const FIB = {
  0.236: 0.236,
  0.382: 0.382,
  0.5:   0.5,
  0.618: 0.618,
  0.786: 0.786,
  1.0:   1.0,
  1.272: 1.272,
  1.618: 1.618,
  2.618: 2.618,
};

const TOLERANCE = 0.05; // 5% tolerance on Fibonacci ratios

function isNear(ratio: number, target: number, tol = TOLERANCE): boolean {
  return Math.abs(ratio - target) <= tol;
}

function fibRetracement(start: number, end: number, retrace: number): number {
  const move = end - start;
  return end - move * retrace;
}

// ─── Wave Ratio Calculation ───────────────────────────────────
function waveLength(start: number, end: number): number {
  return Math.abs(end - start);
}

function retracement(wave1Start: number, wave1End: number, wave2End: number): number {
  const wave1 = waveLength(wave1Start, wave1End);
  const w2retr = Math.abs(wave2End - wave1End);
  return wave2retr / wave1;
}

// ─── Elliott Rules Validation ─────────────────────────────────
// Returns array of rules passed/failed
function validateImpulseRules(
  p0: number, p1: number, p2: number, p3: number, p4: number, p5: number
): { passed: string[]; failed: string[]; valid: boolean } {
  const passed: string[] = [];
  const failed: string[] = [];

  const bullish = p1 > p0; // direction

  const w1 = waveLength(p0, p1);
  const w2 = waveLength(p1, p2);
  const w3 = waveLength(p2, p3);
  const w4 = waveLength(p3, p4);
  const w5 = waveLength(p4, p5);

  // Rule 1: Wave 2 cannot retrace more than 100% of Wave 1
  const w2Retr = w2 / w1;
  if (w2Retr < 1.0) {
    passed.push('Wave 2 retracement < 100% of Wave 1');
  } else {
    failed.push(`Wave 2 retracement ${(w2Retr * 100).toFixed(1)}% violates 100% rule`);
  }

  // Rule 2: Wave 3 cannot be the shortest impulse wave
  if (w3 > w1 && w3 > w5) {
    passed.push('Wave 3 is not the shortest');
  } else {
    failed.push('Wave 3 is the shortest impulse wave — invalid');
  }

  // Rule 3: Wave 4 cannot overlap with Wave 1 (in cash markets)
  if (bullish) {
    if (p4 > p1) {
      passed.push('Wave 4 does not overlap Wave 1 territory');
    } else {
      failed.push('Wave 4 overlaps Wave 1 — invalid impulse');
    }
  } else {
    if (p4 < p1) {
      passed.push('Wave 4 does not overlap Wave 1 territory');
    } else {
      failed.push('Wave 4 overlaps Wave 1 — invalid impulse');
    }
  }

  // Guideline: Wave 2 typically retraces 50-78.6% of Wave 1
  const w2Guide = retracement(p0, p1, p2);
  if (w2Guide >= 0.382 && w2Guide <= 0.886) {
    passed.push(`Wave 2 retracement ${(w2Guide * 100).toFixed(1)}% is in typical range`);
  }

  // Guideline: Wave 3 is often 1.618x Wave 1
  const w3ToW1 = w3 / w1;
  if (isNear(w3ToW1, 1.618) || isNear(w3ToW1, 2.618)) {
    passed.push(`Wave 3 = ${w3ToW1.toFixed(3)}x Wave 1 (Fibonacci)`);
  }

  // Guideline: Wave 4 typically retraces 38.2% of Wave 3
  const w4Guide = retracement(p2, p3, p4);
  if (isNear(w4Guide, 0.382) || isNear(w4Guide, 0.5)) {
    passed.push(`Wave 4 retracement ${(w4Guide * 100).toFixed(1)}% is typical`);
  }

  const valid = !failed.some(f => f.includes('invalid'));
  return { passed, failed, valid };
}

// ─── Wave Count from Pivots ───────────────────────────────────
export function validateElliottRules(pivots: SwingPivot[]): ElliottWaveResult {
  const defaultResult: ElliottWaveResult = {
    wave_count: 'unknown',
    pivots: pivots.map(p => p.price),
    pivot_timestamps: pivots.map(p => p.timestamp),
    confidence: 0,
    rules_passed: [],
    rules_failed: ['Insufficient pivot data'],
  };

  if (pivots.length < 6) return defaultResult;

  // Try to find 5-wave impulse in the most recent pivots
  const recentPivots = pivots.slice(-9); // look at last 9 pivots max

  // Try different starting points for 5-wave count
  for (let start = 0; start <= recentPivots.length - 6; start++) {
    const p = recentPivots.slice(start, start + 6);
    const prices = p.map(x => x.price);

    // Determine if this is a bullish or bearish impulse
    const isBullish = prices[1] > prices[0];

    // For bullish: p0 < p1 > p2 < p3 > p4 < p5 (with p1, p3, p5 progressively higher)
    const alternationOk = isBullish
      ? prices[1] > prices[0] && prices[2] < prices[1] && prices[3] > prices[2] && prices[4] < prices[3] && prices[5] > prices[4]
      : prices[1] < prices[0] && prices[2] > prices[1] && prices[3] < prices[2] && prices[4] > prices[3] && prices[5] < prices[4];

    if (!alternationOk) continue;

    const validation = validateImpulseRules(...prices as [number, number, number, number, number, number]);

    if (validation.valid) {
      // Determine current wave position
      const lastPivot = recentPivots[recentPivots.length - 1];
      let wave_count: ElliottWaveCount = 'unknown';

      if (lastPivot === p[5]) wave_count = 'wave_5_in_progress';
      else if (lastPivot === p[4]) wave_count = 'wave_4';
      else if (lastPivot === p[3]) wave_count = 'wave_3_in_progress';
      else if (lastPivot === p[2]) wave_count = 'wave_2';
      else if (lastPivot === p[1]) wave_count = 'wave_1';

      // Calculate targets
      const w1Length = Math.abs(prices[1] - prices[0]);
      const nextTarget = isBullish
        ? prices[4] + w1Length * 1.618  // Wave 5 = 1.618 x Wave 1
        : prices[4] - w1Length * 1.618;

      const confidence = Math.min(
        (validation.passed.length / (validation.passed.length + validation.failed.length)) * 100,
        95
      );

      return {
        wave_count,
        pivots: prices,
        pivot_timestamps: p.map(x => x.timestamp),
        confidence: confidence / 100,
        next_target: nextTarget,
        invalidation_level: isBullish ? prices[0] : prices[0],
        rules_passed: validation.passed,
        rules_failed: validation.failed,
      };
    }
  }

  // Try ABC correction
  if (pivots.length >= 4) {
    const recent = pivots.slice(-4);
    const prices = recent.map(p => p.price);
    const isBullishCorrection = prices[0] > prices[1]; // down, up, down = bearish ABC

    if (
      isBullishCorrection &&
      prices[1] < prices[0] &&
      prices[2] > prices[1] &&
      prices[3] < prices[2]
    ) {
      const wA = Math.abs(prices[1] - prices[0]);
      const wC = Math.abs(prices[3] - prices[2]);
      const isEqualWaves = isNear(wC / wA, 1.0, 0.1);

      return {
        wave_count: 'wave_c',
        pivots: prices,
        pivot_timestamps: recent.map(p => p.timestamp),
        confidence: isEqualWaves ? 0.65 : 0.45,
        rules_passed: isEqualWaves ? ['Wave C ≈ Wave A (equal legs)'] : [],
        rules_failed: [],
      };
    }
  }

  return {
    ...defaultResult,
    rules_failed: ['No valid wave pattern found in recent pivots'],
  };
}

// ─── Main entry point ─────────────────────────────────────────
export function analyzeElliottWave(
  candles: Candle[],
  threshold = parseFloat(process.env.ZIGZAG_THRESHOLD || '0.03')
): ElliottWaveResult {
  const pivots = extractZigZagPivots(candles, threshold);
  return validateElliottRules(pivots);
}

// ─── Fibonacci targets from wave structure ────────────────────
export function getElliottTargets(
  wave1Start: number,
  wave1End: number,
  wave2End: number
): { wave3Targets: number[]; wave5Target: number } {
  const w1 = Math.abs(wave1End - wave1Start);
  const isBullish = wave1End > wave1Start;
  const direction = isBullish ? 1 : -1;

  const wave3Targets = [
    wave2End + direction * w1 * 1.618,
    wave2End + direction * w1 * 2.0,
    wave2End + direction * w1 * 2.618,
  ];

  // Wave 5 approximation: often equal to Wave 1 or 0.618x Wave 3
  const wave5Target = wave2End + direction * w1 * 1.0;

  return { wave3Targets, wave5Target };
}




wyckoff.skill.ts


// ============================================================
// wyckoff.skill.ts
// Wyckoff Method: Phase detection (A/B/C/D/E), Spring, UTAD,
// LPS, SOS identification using range + volume analysis
// ============================================================

import { Candle, WyckoffContext, WyckoffPhase, WyckoffEvent, VolumeProfileLevel } from '../chartAnalysis.types';
import { buildVolumeProfile, extractZigZagPivots } from './structure.skill';

const WYCKOFF_RANGE_LOOKBACK = parseInt(process.env.WYCKOFF_RANGE_LOOKBACK || '60');
const VOLUME_SPIKE_MULTIPLIER = 2.0; // volume must be 2x average to qualify as climactic

// ─── Average volume ───────────────────────────────────────────
function avgVolume(candles: Candle[], period = 20): number {
  const recent = candles.slice(-period);
  return recent.reduce((s, c) => s + c.volume, 0) / recent.length;
}

// ─── ATR helper ───────────────────────────────────────────────
function atrValue(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs = candles.slice(-period).map((c, i, arr) => {
    if (i === 0) return c.high - c.low;
    return Math.max(c.high - c.low, Math.abs(c.high - arr[i-1].close), Math.abs(c.low - arr[i-1].close));
  });
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

// ─── Find Trading Range ───────────────────────────────────────
function findTradingRange(candles: Candle[]): { rangeHigh: number; rangeLow: number; rangeCandles: Candle[] } {
  const lookback = candles.slice(-WYCKOFF_RANGE_LOOKBACK);
  const rangeHigh = Math.max(...lookback.map(c => c.high));
  const rangeLow  = Math.min(...lookback.map(c => c.low));
  return { rangeHigh, rangeLow, rangeCandles: lookback };
}

// ─── Detect Volume Climax ─────────────────────────────────────
function isVolumeClimax(candle: Candle, avgVol: number): boolean {
  return candle.volume > avgVol * VOLUME_SPIKE_MULTIPLIER;
}

// ─── Detect Wyckoff Events ────────────────────────────────────
function detectWyckoffEvents(
  candles: Candle[],
  rangeHigh: number,
  rangeLow: number
): { events: WyckoffEvent[]; timestamps: number[] } {
  const events: WyckoffEvent[] = [];
  const timestamps: number[] = [];
  const avgVol = avgVolume(candles);
  const atr = atrValue(candles);
  const pivots = extractZigZagPivots(candles);

  for (let i = 5; i < candles.length; i++) {
    const c = candles[i];
    const prev5 = candles.slice(Math.max(0, i - 5), i);
    const isClimax = isVolumeClimax(c, avgVol);
    const isNearRangeLow  = Math.abs(c.low - rangeLow)  < atr * 1.5;
    const isNearRangeHigh = Math.abs(c.high - rangeHigh) < atr * 1.5;

    // Selling Climax (SC): huge bearish candle near range low on climactic volume
    if (isClimax && isNearRangeLow && c.close < c.open && (c.high - c.low) > atr * 2) {
      events.push('SC');
      timestamps.push(c.timestamp);
      continue;
    }

    // Buying Climax (BCLX): huge bullish candle near range high on climactic volume
    if (isClimax && isNearRangeHigh && c.close > c.open && (c.high - c.low) > atr * 2) {
      events.push('BCLX');
      timestamps.push(c.timestamp);
      continue;
    }

    // Spring: dip below range low followed by recovery (trap bears)
    if (i >= 1) {
      const prev = candles[i - 1];
      if (
        c.low < rangeLow &&
        c.close > rangeLow &&
        c.close > prev.close &&
        candles.slice(i + 1, i + 4).some(future => future && future.close > c.high)
      ) {
        events.push('Spring');
        timestamps.push(c.timestamp);
        continue;
      }
    }

    // UTAD: spike above range high followed by reversal
    if (
      c.high > rangeHigh &&
      c.close < rangeHigh &&
      isClimax
    ) {
      events.push('UTAD');
      timestamps.push(c.timestamp);
      continue;
    }

    // Sign of Strength (SOS): strong up move on increasing volume breaking above resistance
    if (
      c.close > c.open &&
      c.close > rangeHigh * 0.97 &&
      c.volume > avgVol * 1.5 &&
      (c.close - c.open) / (c.high - c.low) > 0.6
    ) {
      events.push('SOS');
      timestamps.push(c.timestamp);
      continue;
    }

    // Last Point of Support (LPS): small pullback on low volume after SOS
    if (
      c.close < c.open &&
      c.volume < avgVol * 0.7 &&
      isNearRangeLow &&
      events.some(e => e === 'SOS')
    ) {
      events.push('LPS');
      timestamps.push(c.timestamp);
      continue;
    }
  }

  return { events, timestamps };
}

// ─── Determine Phase from Events ─────────────────────────────
function determinePhase(
  events: WyckoffEvent[],
  currentPrice: number,
  rangeHigh: number,
  rangeLow: number
): { phase: WyckoffPhase; isAccumulation: boolean; isDistribution: boolean } {
  const hasSC   = events.includes('SC');
  const hasBCLX = events.includes('BCLX');
  const hasSpring = events.includes('Spring');
  const hasUTAD   = events.includes('UTAD');
  const hasSOS    = events.includes('SOS');
  const hasLPS    = events.includes('LPS');

  const rangeSize = rangeHigh - rangeLow;
  const positionInRange = (currentPrice - rangeLow) / rangeSize;

  // Accumulation phases
  if (hasSC && !hasSOS && !hasSpring && positionInRange < 0.5) {
    return { phase: 'B', isAccumulation: true, isDistribution: false };
  }
  if (hasSpring && !hasSOS) {
    return { phase: 'C', isAccumulation: true, isDistribution: false };
  }
  if (hasSOS && hasLPS && positionInRange > 0.7) {
    return { phase: 'D', isAccumulation: true, isDistribution: false };
  }
  if (hasSOS && positionInRange > 0.9) {
    return { phase: 'E', isAccumulation: true, isDistribution: false };
  }

  // Distribution phases
  if (hasBCLX && !hasUTAD && positionInRange > 0.7) {
    return { phase: 'B', isAccumulation: false, isDistribution: true };
  }
  if (hasUTAD) {
    return { phase: 'C', isAccumulation: false, isDistribution: true };
  }

  // Default: still in Phase A (initial stopping)
  return { phase: 'A', isAccumulation: hasSC, isDistribution: hasBCLX };
}

// ─── Volume Analysis ──────────────────────────────────────────
function analyzeVolumeTrend(
  candles: Candle[]
): 'accumulating' | 'distributing' | 'neutral' {
  const recent = candles.slice(-20);
  const first10 = recent.slice(0, 10);
  const last10  = recent.slice(10);

  const avgFirst = first10.reduce((s, c) => s + c.volume, 0) / 10;
  const avgLast  = last10.reduce((s, c) => s + c.volume, 0) / 10;

  // Count up vs down candles by volume
  const upVolFirst  = first10.filter(c => c.close > c.open).reduce((s, c) => s + c.volume, 0);
  const downVolFirst = first10.filter(c => c.close < c.open).reduce((s, c) => s + c.volume, 0);
  const upVolLast   = last10.filter(c => c.close > c.open).reduce((s, c) => s + c.volume, 0);
  const downVolLast  = last10.filter(c => c.close < c.open).reduce((s, c) => s + c.volume, 0);

  if (upVolLast > downVolLast * 1.3 && avgLast > avgFirst * 0.9) return 'accumulating';
  if (downVolLast > upVolLast * 1.3 && avgLast > avgFirst * 0.9) return 'distributing';
  return 'neutral';
}

// ─── Main Detection ───────────────────────────────────────────
export function detectWyckoffRange(
  candles: Candle[],
  volumeProfile?: VolumeProfileLevel[]
): WyckoffContext {
  const { rangeHigh, rangeLow, rangeCandles } = findTradingRange(candles);
  const { events, timestamps } = detectWyckoffEvents(rangeCandles, rangeHigh, rangeLow);
  const currentPrice = candles[candles.length - 1]?.close || 0;
  const { phase, isAccumulation, isDistribution } = determinePhase(events, currentPrice, rangeHigh, rangeLow);
  const lastEvent: WyckoffEvent = events.length > 0 ? events[events.length - 1] : 'unknown';
  const springConfirmed = events.includes('Spring') && events.some((e, i) => i > events.indexOf('Spring') && e === 'SOS');
  const utadRisk = isDistribution && phase === 'C';
  const volumeAnalysis = analyzeVolumeTrend(candles);

  // Generate human-readable summary
  let summary = '';
  if (isAccumulation) {
    summary = `Wyckoff Accumulation Phase ${phase}. `;
    if (springConfirmed) summary += 'Spring confirmed with SOS follow-through. ';
    else if (events.includes('Spring')) summary += 'Spring detected, awaiting SOS confirmation. ';
    else if (phase === 'B') summary += 'Range building after SC. Watch for Spring near ' + rangeLow.toFixed(2) + '. ';
    summary += `Range: ${rangeLow.toFixed(2)} - ${rangeHigh.toFixed(2)}.`;
  } else if (isDistribution) {
    summary = `Wyckoff Distribution Phase ${phase}. `;
    if (utadRisk) summary += 'UTAD risk at range high ' + rangeHigh.toFixed(2) + '. ';
    summary += `Range: ${rangeLow.toFixed(2)} - ${rangeHigh.toFixed(2)}.`;
  } else {
    summary = `Wyckoff Phase ${phase} — structure unclear. Range: ${rangeLow.toFixed(2)} - ${rangeHigh.toFixed(2)}.`;
  }

  return {
    phase,
    last_event: lastEvent,
    spring_confirmed: springConfirmed,
    utad_risk: utadRisk,
    range_high: rangeHigh,
    range_low: rangeLow,
    cause_count: rangeCandles.length,
    volume_analysis: volumeAnalysis,
    summary,
  };
}



harmonics.skill.ts



// ============================================================
// harmonics.skill.ts
// Harmonic pattern detection: Gartley, Bat, Butterfly, Crab, Cypher
// Uses Fibonacci ratio validation on XABCD pivot structures
// ============================================================

import { Candle, HarmonicPattern, SwingPivot } from '../chartAnalysis.types';
import { extractZigZagPivots } from './structure.skill';

// ─── Harmonic Pattern Ratios ──────────────────────────────────
// Each pattern defines valid Fibonacci ratio ranges for each leg
// Format: [min, max] for each ratio
interface PatternRatios {
  XAB: [number, number];  // B retracement of XA
  ABC: [number, number];  // C retracement of AB
  BCD: [number, number];  // D extension of BC
  XAD: [number, number];  // D retracement of XA (for PRZ validation)
}

const PATTERNS: Record<string, PatternRatios> = {
  Gartley: {
    XAB: [0.598, 0.638],   // B = 0.618 of XA
    ABC: [0.362, 0.886],   // C = 0.382-0.886 of AB
    BCD: [1.13,  1.618],   // D = 1.13-1.618 of BC
    XAD: [0.748, 0.808],   // D = 0.786 of XA (PRZ)
  },
  Bat: {
    XAB: [0.35,  0.5],     // B = 0.382-0.5 of XA
    ABC: [0.362, 0.886],
    BCD: [1.618, 2.618],
    XAD: [0.836, 0.916],   // D = 0.886 of XA (deep PRZ)
  },
  Butterfly: {
    XAB: [0.748, 0.808],   // B = 0.786 of XA
    ABC: [0.362, 0.886],
    BCD: [1.618, 2.618],
    XAD: [1.228, 1.308],   // D = 1.272 extension of XA
  },
  Crab: {
    XAB: [0.35,  0.618],
    ABC: [0.362, 0.886],
    BCD: [2.24,  3.618],
    XAD: [1.568, 1.668],   // D = 1.618 extension of XA
  },
  Cypher: {
    XAB: [0.362, 0.618],
    ABC: [1.13,  1.418],   // C extends beyond A
    BCD: [0.718, 0.808],   // D = 0.786 of XC
    XAD: [0.718, 0.808],
  },
};

const RATIO_TOLERANCE = 0.025; // ±2.5% tolerance

// ─── Helpers ─────────────────────────────────────────────────
function ratio(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.abs(a) / Math.abs(b);
}

function isInRange(val: number, min: number, max: number, tol = RATIO_TOLERANCE): boolean {
  return val >= min - tol && val <= max + tol;
}

// ─── Validate XABCD against a specific pattern ───────────────
function validatePattern(
  X: number, A: number, B: number, C: number, D: number,
  patternName: string,
  patios: PatternRatios
): { valid: boolean; completion: number; ratios: { XAB: number; ABC: number; BCD: number; XAD: number } } {
  const XA  = Math.abs(A - X);
  const AB  = Math.abs(B - A);
  const BC  = Math.abs(C - B);
  const CD  = Math.abs(D - C);
  const XAD_leg = Math.abs(D - X);

  const XAB = ratio(AB, XA);
  const ABC = ratio(BC, AB);
  const BCD = ratio(CD, BC);
  const XAD = ratio(XAD_leg, XA);

  const scores = [
    isInRange(XAB, patios.XAB[0], patios.XAB[1]) ? 1 : 0,
    isInRange(ABC, patios.ABC[0], patios.ABC[1]) ? 1 : 0,
    isInRange(BCD, patios.BCD[0], patios.BCD[1]) ? 1 : 0,
    isInRange(XAD, patios.XAD[0], patios.XAD[1]) ? 1 : 0,
  ];

  const completion = (scores.reduce((a, b) => a + b, 0) / scores.length) * 100;
  const valid = completion >= 75; // at least 3/4 ratios must validate

  return { valid, completion, ratios: { XAB, ABC, BCD, XAD } };
}

// ─── Calculate PRZ (Potential Reversal Zone) ──────────────────
function calculatePRZ(
  X: number, A: number, B: number, C: number,
  patternName: string
): { przHigh: number; przLow: number } {
  const pattern = PATTERNS[patternName];
  if (!pattern) return { przHigh: C, przLow: C };

  const XA = Math.abs(A - X);
  const BC = Math.abs(C - B);
  const isBullish = A < X; // X is higher, A is lower → bullish reversal at D

  // PRZ is a zone defined by multiple Fibonacci projections
  let przLevels: number[] = [];

  if (isBullish) {
    // Bullish: D is below C, PRZ is a buy zone
    przLevels = [
      A + XA * pattern.XAD[0],  // Lower bound of XAD target
      A + XA * pattern.XAD[1],  // Upper bound of XAD target
      C - BC * pattern.BCD[0],  // Lower bound of BCD projection
      C - BC * pattern.BCD[1],  // Upper bound of BCD projection
    ].map(l => A - (l - A)); // Mirror for bullish
  } else {
    // Bearish: D is above C
    przLevels = [
      X - XA * pattern.XAD[0],
      X - XA * pattern.XAD[1],
    ];
  }

  const validLevels = przLevels.filter(l => !isNaN(l) && isFinite(l));
  if (validLevels.length === 0) return { przHigh: C * 1.01, przLow: C * 0.99 };

  return {
    przHigh: Math.max(...validLevels),
    przLow:  Math.min(...validLevels),
  };
}

// ─── Main Harmonic Pattern Detector ──────────────────────────
export function detectHarmonicPatterns(
  pivots: SwingPivot[]
): HarmonicPattern[] {
  const patterns: HarmonicPattern[] = [];

  if (pivots.length < 5) return patterns;

  // Scan all 5-pivot combinations from the recent pivots
  const recentPivots = pivots.slice(-10); // last 10 pivots max

  for (let i = 0; i <= recentPivots.length - 5; i++) {
    const [pX, pA, pB, pC, pD] = recentPivots.slice(i, i + 5);

    // Alternating highs and lows check
    if (pX.type === pA.type) continue; // must alternate

    const X = pX.price;
    const A = pA.price;
    const B = pB.price;
    const C = pC.price;
    const D = pD.price;

    // Determine direction: bullish = XABCD where D is buy zone, bearish = sell zone
    const isBullish = X > A && B > A && C < B && D < C; // simplified: zig-zag down to D
    const isBearish = X < A && B < A && C > B && D > C; // zig-zag up to D

    if (!isBullish && !isBearish) continue;

    for (const [patternName, ratios] of Object.entries(PATTERNS)) {
      const result = validatePattern(X, A, B, C, D, patternName, ratios);

      if (result.valid || result.completion >= 75) {
        const { przHigh, przLow } = calculatePRZ(X, A, B, C, patternName);

        patterns.push({
          name: patternName as HarmonicPattern['name'],
          direction: isBullish ? 'bullish' : 'bearish',
          prz_high: przHigh,
          prz_low: przLow,
          xabcd: {
            X, A, B, C, D,
            X_ts: pX.timestamp,
            A_ts: pA.timestamp,
            B_ts: pB.timestamp,
            C_ts: pC.timestamp,
            D_ts: pD.timestamp,
          },
          completion_pct: result.completion,
          ratios: result.ratios,
        });
      }
    }
  }

  // Return best pattern (highest completion, must be > 75%)
  return patterns
    .filter(p => p.completion_pct >= 75)
    .sort((a, b) => b.completion_pct - a.completion_pct)
    .slice(0, 3);
}

// ─── Candle-based entry point ─────────────────────────────────
export function analyzeHarmonics(
  candles: Candle[],
  threshold = parseFloat(process.env.ZIGZAG_THRESHOLD || '0.03')
): HarmonicPattern | null {
  const pivots = extractZigZagPivots(candles, threshold);
  const patterns = detectHarmonicPatterns(pivots);
  return patterns.length > 0 ? patterns[0] : null;
}

// ─── Check if price is in PRZ ─────────────────────────────────
export function isPriceInPRZ(price: number, pattern: HarmonicPattern): boolean {
  return price >= pattern.prz_low && price <= pattern.prz_high;
}


multiTimeframe.skill.ts


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




fibonacci.skill.ts



// ============================================================
// fibonacci.skill.ts
// Fibonacci tools: Retracements, Extensions, Fan, Arcs, Time Zones
// ============================================================

import { Candle, FibonacciLevels, SwingPivot } from '../chartAnalysis.types';
import { extractZigZagPivots } from './structure.skill';

// ─── Standard Fibonacci ratios ────────────────────────────────
const RETRACEMENT_RATIOS = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
const EXTENSION_RATIOS   = [1.0, 1.272, 1.414, 1.618, 2.0, 2.618, 3.618];

// ─── Find swing from candles ──────────────────────────────────
function findRecentSwing(candles: Candle[]): { swingHigh: number; swingLow: number; highTs: number; lowTs: number; isBullish: boolean } {
  const pivots = extractZigZagPivots(candles);
  if (pivots.length < 2) {
    const prices = candles.map(c => c.close);
    return {
      swingHigh: Math.max(...prices),
      swingLow: Math.min(...prices),
      highTs: candles.find(c => c.close === Math.max(...prices))?.timestamp || 0,
      lowTs:  candles.find(c => c.close === Math.min(...prices))?.timestamp || 0,
      isBullish: candles[candles.length - 1].close > candles[0].close,
    };
  }

  // Find the most recent major swing (last significant high and low)
  const recentPivots = pivots.slice(-4);
  const highs = recentPivots.filter(p => p.type === 'high');
  const lows  = recentPivots.filter(p => p.type === 'low');

  const swingHigh = highs.length > 0 ? Math.max(...highs.map(p => p.price)) : candles[candles.length - 1].high;
  const swingLow  = lows.length  > 0 ? Math.min(...lows.map(p => p.price)) : candles[candles.length - 1].low;
  const highTs    = highs.find(p => p.price === swingHigh)?.timestamp || 0;
  const lowTs     = lows.find(p => p.price === swingLow)?.timestamp || 0;

  // Current direction
  const lastPivot = pivots[pivots.length - 1];
  const isBullish = lastPivot.type === 'low'; // last pivot was a low → trending up

  return { swingHigh, swingLow, highTs, lowTs, isBullish };
}

// ─── Fibonacci Retracements + Extensions ─────────────────────
export function calculateFibonacciLevels(candles: Candle[]): FibonacciLevels {
  const { swingHigh, swingLow, highTs, lowTs, isBullish } = findRecentSwing(candles);
  const move = swingHigh - swingLow;
  const currentPrice = candles[candles.length - 1].close;

  const retracementLevels: Record<string, number> = {};
  const extensionLevels: Record<string, number> = {};

  if (isBullish) {
    // Price moved up: retracements go down from high
    for (const r of RETRACEMENT_RATIOS) {
      retracementLevels[r.toString()] = swingHigh - move * r;
    }
    // Extensions go above the high
    for (const e of EXTENSION_RATIOS) {
      extensionLevels[e.toString()] = swingLow + move * e;
    }
  } else {
    // Price moved down: retracements go up from low
    for (const r of RETRACEMENT_RATIOS) {
      retracementLevels[r.toString()] = swingLow + move * r;
    }
    for (const e of EXTENSION_RATIOS) {
      extensionLevels[e.toString()] = swingHigh - move * e;
    }
  }

  // Find nearest fib level to current price
  let nearestLabel: string | undefined;
  let minDistance = Infinity;
  for (const [label, price] of Object.entries(retracementLevels)) {
    const dist = Math.abs(price - currentPrice);
    if (dist < minDistance) {
      minDistance = dist;
      nearestLabel = label;
    }
  }

  return {
    swing_high: swingHigh,
    swing_low: swingLow,
    swing_high_ts: highTs,
    swing_low_ts: lowTs,
    direction: isBullish ? 'bullish_retracement' : 'bearish_retracement',
    levels: retracementLevels,
    extensions: extensionLevels,
    current_price_near: nearestLabel,
  };
}

// ─── Fibonacci Fan Levels ─────────────────────────────────────
// Fan lines project Fib ratios from a swing point along time
export function calculateFibFan(
  swingHigh: number,
  swingLow: number,
  swingTs: number,
  currentTs: number
): Record<string, number> {
  const ratios = [0.382, 0.5, 0.618];
  const move = swingHigh - swingLow;
  const timeDelta = currentTs - swingTs;
  const fanLevels: Record<string, number> = {};

  for (const r of ratios) {
    // Simplified fan: price level at current time along fib trajectory
    fanLevels[r.toString()] = swingLow + move * r;
  }

  return fanLevels;
}

// ─── Fibonacci Time Zones ─────────────────────────────────────
// Projects Fibonacci number sequence forward in time bars
export function calculateFibTimeZones(
  startTimestamp: number,
  barDurationMs: number,
  count = 13
): number[] {
  const fibSequence = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
  return fibSequence.slice(0, count).map(n => startTimestamp + n * barDurationMs);
}

// ─── Check if price is near a key Fibonacci level ─────────────
export function isPriceNearFibLevel(
  price: number,
  fibLevels: FibonacciLevels,
  tolerancePct = 0.005
): { isNear: boolean; nearestLevel: string; distance_pct: number } {
  let nearestLevel = '';
  let minDistance = Infinity;

  for (const [label, fibPrice] of Object.entries(fibLevels.levels)) {
    const dist = Math.abs(price - fibPrice) / price;
    if (dist < minDistance) {
      minDistance = dist;
      nearestLevel = label;
    }
  }

  return {
    isNear: minDistance <= tolerancePct,
    nearestLevel,
    distance_pct: minDistance,
  };
}

// ─── Fib cluster finder (confluence with other levels) ────────
export function findFibClusters(
  fibLevels: FibonacciLevels,
  otherLevels: number[],
  tolerancePct = 0.01
): Array<{ price: number; fib_label: string; confluences: number[] }> {
  const clusters: Array<{ price: number; fib_label: string; confluences: number[] }> = [];

  for (const [label, fibPrice] of Object.entries(fibLevels.levels)) {
    const nearby = otherLevels.filter(l => Math.abs(l - fibPrice) / fibPrice <= tolerancePct);
    if (nearby.length > 0) {
      clusters.push({ price: fibPrice, fib_label: label, confluences: nearby });
    }
  }

  return clusters;
}




pivots.skill.ts

// ============================================================
// pivots.skill.ts
// Pivot Points: Standard, Camarilla, Fibonacci variants
// Also detects psychological price levels
// ============================================================

import { Candle, PivotPoints } from '../chartAnalysis.types';

// ─── Standard Pivot Points (floor trader pivots) ──────────────
export function calculateStandardPivots(candles: Candle[]): PivotPoints {
  // Use previous session/day's HLC
  const prev = candles.length >= 2 ? candles[candles.length - 2] : candles[candles.length - 1];
  const H = prev.high;
  const L = prev.low;
  const C = prev.close;

  const pp = (H + L + C) / 3;
  const r1 = 2 * pp - L;
  const s1 = 2 * pp - H;
  const r2 = pp + (H - L);
  const s2 = pp - (H - L);
  const r3 = H + 2 * (pp - L);
  const s3 = L - 2 * (H - pp);

  return { method: 'standard', pp, r1, r2, r3, s1, s2, s3 };
}

// ─── Camarilla Pivot Points ───────────────────────────────────
// Camarilla is known for tighter resistance/support levels
export function calculateCamarillaPivots(candles: Candle[]): PivotPoints {
  const prev = candles.length >= 2 ? candles[candles.length - 2] : candles[candles.length - 1];
  const H = prev.high;
  const L = prev.low;
  const C = prev.close;
  const range = H - L;

  const pp = (H + L + C) / 3; // Same PP as standard
  const r1 = C + range * 1.0833;
  const r2 = C + range * 1.1666;
  const r3 = C + range * 1.2500;
  const s1 = C - range * 1.0833;
  const s2 = C - range * 1.1666;
  const s3 = C - range * 1.2500;

  return { method: 'camarilla', pp, r1, r2, r3, s1, s2, s3 };
}

// ─── Fibonacci Pivot Points ───────────────────────────────────
export function calculateFibonacciPivots(candles: Candle[]): PivotPoints {
  const prev = candles.length >= 2 ? candles[candles.length - 2] : candles[candles.length - 1];
  const H = prev.high;
  const L = prev.low;
  const C = prev.close;
  const range = H - L;

  const pp = (H + L + C) / 3;
  const r1 = pp + 0.382 * range;
  const r2 = pp + 0.618 * range;
  const r3 = pp + 1.000 * range;
  const s1 = pp - 0.382 * range;
  const s2 = pp - 0.618 * range;
  const s3 = pp - 1.000 * range;

  return { method: 'fibonacci', pp, r1, r2, r3, s1, s2, s3 };
}

// ─── Psychological Levels ─────────────────────────────────────
export function calculatePsychologicalLevels(currentPrice: number): number[] {
  const levels: number[] = [];

  // Determine step size based on price magnitude
  let step: number;
  if      (currentPrice > 50000) step = 5000;
  else if (currentPrice > 10000) step = 1000;
  else if (currentPrice > 1000)  step = 100;
  else if (currentPrice > 100)   step = 10;
  else if (currentPrice > 10)    step = 1;
  else if (currentPrice > 1)     step = 0.1;
  else                           step = 0.01;

  const halfStep = step / 2;
  const range = currentPrice * 0.25; // ±25% of current price

  // Round numbers (e.g. 40000, 41000, 42000)
  const startRound = Math.floor((currentPrice - range) / step) * step;
  const endRound   = Math.ceil((currentPrice + range) / step) * step;
  for (let p = startRound; p <= endRound; p += step) {
    levels.push(parseFloat(p.toFixed(8)));
  }

  // Half-round numbers (e.g. 40500, 41500)
  const startHalf = Math.floor((currentPrice - range) / halfStep) * halfStep;
  for (let p = startHalf; p <= endRound; p += halfStep) {
    if (!levels.includes(p)) levels.push(parseFloat(p.toFixed(8)));
  }

  return levels
    .filter(l => Math.abs(l - currentPrice) / currentPrice <= 0.25)
    .sort((a, b) => a - b);
}

// ─── Nearest pivot level to current price ────────────────────
export function nearestPivotLevel(
  price: number,
  pivots: PivotPoints
): { level: number; label: string; type: 'support' | 'resistance' | 'pivot' } {
  const levels = [
    { level: pivots.pp, label: 'PP', type: 'pivot' as const },
    { level: pivots.r1, label: 'R1', type: 'resistance' as const },
    { level: pivots.r2, label: 'R2', type: 'resistance' as const },
    { level: pivots.r3, label: 'R3', type: 'resistance' as const },
    { level: pivots.s1, label: 'S1', type: 'support' as const },
    { level: pivots.s2, label: 'S2', type: 'support' as const },
    { level: pivots.s3, label: 'S3', type: 'support' as const },
  ];

  return levels.reduce((nearest, curr) =>
    Math.abs(curr.level - price) < Math.abs(nearest.level - price) ? curr : nearest
  );
}

// ─── Check if price is within pivot zone ─────────────────────
export function isPriceAtPivot(price: number, pivots: PivotPoints, tolerancePct = 0.005): boolean {
  const nearest = nearestPivotLevel(price, pivots);
  return Math.abs(nearest.level - price) / price <= tolerancePct;
}



correlation.skill.ts

// ============================================================
// correlation.skill.ts
// Calculates rolling correlation and beta of coins vs BTC
// Used by the cascade map and opportunity scoring system
// ============================================================

import { Candle, CorrelationData } from '../chartAnalysis.types';
import { DEFAULT_BETA, DEFAULT_LAG_HOURS } from '../../config/coinUniverse.config';

// ─── Calculate returns array from candles ─────────────────────
function returns(candles: Candle[]): number[] {
  const result: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i - 1].close === 0) { result.push(0); continue; }
    result.push((candles[i].close - candles[i - 1].close) / candles[i - 1].close);
  }
  return result;
}

// ─── Mean of array ────────────────────────────────────────────
function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ─── Standard deviation ───────────────────────────────────────
function stdDev(arr: number[]): number {
  const m = mean(arr);
  const variance = arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

// ─── Pearson Correlation ──────────────────────────────────────
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 5) return 0;

  const xTrim = x.slice(-n);
  const yTrim = y.slice(-n);
  const mx = mean(xTrim);
  const my = mean(yTrim);

  let numerator = 0;
  let xSS = 0;
  let ySS = 0;

  for (let i = 0; i < n; i++) {
    const dx = xTrim[i] - mx;
    const dy = yTrim[i] - my;
    numerator += dx * dy;
    xSS += dx * dx;
    ySS += dy * dy;
  }

  const denominator = Math.sqrt(xSS * ySS);
  return denominator === 0 ? 0 : numerator / denominator;
}

// ─── Beta calculation ─────────────────────────────────────────
// Beta = Cov(coin, BTC) / Var(BTC)
function calculateBeta(coinReturns: number[], btcReturns: number[]): number {
  const n = Math.min(coinReturns.length, btcReturns.length);
  if (n < 5) return 1.0;

  const x = btcReturns.slice(-n);
  const y = coinReturns.slice(-n);
  const mx = mean(x);
  const my = mean(y);

  let covariance = 0;
  let btcVariance = 0;

  for (let i = 0; i < n; i++) {
    covariance += (x[i] - mx) * (y[i] - my);
    btcVariance += Math.pow(x[i] - mx, 2);
  }

  if (btcVariance === 0) return 1.0;
  return covariance / btcVariance;
}

// ─── Lag Detection ────────────────────────────────────────────
// Finds best lag (in candles) that maximizes correlation
function detectLag(
  coinReturns: number[],
  btcReturns: number[],
  maxLagBars = 24
): { lagBars: number; lagCorrelation: number } {
  let bestLag = 0;
  let bestCorr = Math.abs(pearsonCorrelation(coinReturns, btcReturns));

  for (let lag = 1; lag <= maxLagBars; lag++) {
    const btcLagged = btcReturns.slice(0, -lag);
    const coinAligned = coinReturns.slice(lag);
    const corr = Math.abs(pearsonCorrelation(coinAligned, btcLagged));
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  return { lagBars: bestLag, lagCorrelation: bestCorr };
}

// ─── Main Correlation Calculator ─────────────────────────────
export function calculateCorrelation(
  coinSymbol: string,
  coinCandles: Candle[],
  btcCandles: Candle[],
  timeframeHours = 4  // 4H candles → 1 bar = 4 hours
): CorrelationData {
  // Align lengths (use last N bars where both have data)
  const n = Math.min(coinCandles.length, btcCandles.length, 200);
  const coinRet = returns(coinCandles.slice(-n));
  const btcRet  = returns(btcCandles.slice(-n));

  const correlation = pearsonCorrelation(coinRet, btcRet);
  const beta = calculateBeta(coinRet, btcRet);
  const { lagBars } = detectLag(coinRet, btcRet);
  const lagHours = lagBars * timeframeHours;

  // Use defaults if calculation fails (small sample)
  const finalCorrelation = isNaN(correlation) ? 0.7 : correlation;
  const finalBeta = isNaN(beta) || beta < 0.1 ? (DEFAULT_BETA[coinSymbol] || 1.5) : beta;
  const finalLagHours = lagBars === 0 ? (DEFAULT_LAG_HOURS[coinSymbol] || 2) : lagHours;

  return {
    coin: coinSymbol,
    vs: 'BTC',
    correlation_30d: parseFloat(finalCorrelation.toFixed(4)),
    beta_30d: parseFloat(finalBeta.toFixed(3)),
    lag_hours: finalLagHours,
    is_leading: lagHours < 0,
    is_lagging: lagHours > 0,
  };
}

// ─── Sector correlation summary ───────────────────────────────
export function calculateSectorCorrelation(
  sectorCandles: Map<string, Candle[]>,
  btcCandles: Candle[]
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const [symbol, candles] of sectorCandles.entries()) {
    if (candles.length < 30 || btcCandles.length < 30) {
      result[symbol] = 0.7; // default
      continue;
    }

    const n = Math.min(candles.length, btcCandles.length, 200);
    const coinRet = returns(candles.slice(-n));
    const btcRet  = returns(btcCandles.slice(-n));
    result[symbol] = pearsonCorrelation(coinRet, btcRet);
  }

  return result;
}

// ─── Expected move for a coin given BTC move ─────────────────
export function expectedMove(
  btcMovePct: number,
  correlation: CorrelationData
): { expectedPct: number; confidence: 'high' | 'medium' | 'low' } {
  const expectedPct = btcMovePct * correlation.beta_30d;

  const confidence: 'high' | 'medium' | 'low' =
    Math.abs(correlation.correlation_30d) > 0.8 ? 'high' :
    Math.abs(correlation.correlation_30d) > 0.5 ? 'medium' : 'low';

  return { expectedPct, confidence };
}




indicators.skill.ts




// ============================================================
// indicators.skill.ts
// Technical indicators: Ichimoku Cloud, VWAP (+bands), OBV,
// CMF, MFI, CCI, Williams %R, ADX, RSI, MACD, Stochastic,
// Bollinger Bands — all computed from raw OHLCV candles
// ============================================================

import {
  Candle,
  IchimokuCloud,
  VWAPData,
} from '../chartAnalysis.types';

// ─── Simple helpers ───────────────────────────────────────────
function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}
function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : sum(arr) / arr.length;
}
function highest(candles: Candle[], period: number, key: 'high' | 'low' | 'close'): number {
  return Math.max(...candles.slice(-period).map(c => c[key]));
}
function lowest(candles: Candle[], period: number, key: 'high' | 'low' | 'close'): number {
  return Math.min(...candles.slice(-period).map(c => c[key]));
}

// ─── EMA ─────────────────────────────────────────────────────
export function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  let prev = avg(values.slice(0, period));
  result.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

export function emaLast(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] || 0;
  const arr = ema(values, period);
  return arr[arr.length - 1];
}

// ─── SMA ─────────────────────────────────────────────────────
export function smaLast(values: number[], period: number): number {
  return avg(values.slice(-period));
}

// ─── RSI ─────────────────────────────────────────────────────
export function calculateRSI(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 50;
  const closes = candles.map(c => c.close);
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const recent = changes.slice(-period * 2);

  let avgGain = avg(recent.filter(c => c > 0).concat(Array(period).fill(0)).slice(0, period));
  let avgLoss = avg(recent.filter(c => c < 0).map(c => Math.abs(c)).concat(Array(period).fill(0)).slice(0, period));

  for (const change of recent.slice(period)) {
    const gain = Math.max(change, 0);
    const loss = Math.abs(Math.min(change, 0));
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

// ─── MACD ─────────────────────────────────────────────────────
export function calculateMACD(
  candles: Candle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { value: number; signal: number; histogram: number; cross: 'bullish' | 'bearish' | 'none' } {
  if (candles.length < slowPeriod + signalPeriod) {
    return { value: 0, signal: 0, histogram: 0, cross: 'none' };
  }
  const closes = candles.map(c => c.close);
  const fastEMA = ema(closes, fastPeriod);
  const slowEMA = ema(closes, slowPeriod);

  // Align lengths — slowEMA is shorter
  const offset = fastEMA.length - slowEMA.length;
  const macdLine = slowEMA.map((s, i) => fastEMA[i + offset] - s);
  const signalLine = ema(macdLine, signalPeriod);
  const macdOffset = macdLine.length - signalLine.length;

  const macdVal = macdLine[macdLine.length - 1];
  const signalVal = signalLine[signalLine.length - 1];
  const prevMacd = macdLine[macdLine.length - 2] || 0;
  const prevSignal = signalLine[signalLine.length - 2] || 0;

  let cross: 'bullish' | 'bearish' | 'none' = 'none';
  if (prevMacd < prevSignal && macdVal > signalVal) cross = 'bullish';
  else if (prevMacd > prevSignal && macdVal < signalVal) cross = 'bearish';

  return {
    value: parseFloat(macdVal.toFixed(4)),
    signal: parseFloat(signalVal.toFixed(4)),
    histogram: parseFloat((macdVal - signalVal).toFixed(4)),
    cross,
  };
}

// ─── Stochastic Oscillator ────────────────────────────────────
export function calculateStochastic(
  candles: Candle[],
  kPeriod = 14,
  dPeriod = 3
): { k: number; d: number; state: string } {
  if (candles.length < kPeriod) return { k: 50, d: 50, state: 'neutral' };

  const kValues: number[] = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    const close = candles[i].close;
    const k = high === low ? 50 : ((close - low) / (high - low)) * 100;
    kValues.push(k);
  }

  const k = kValues[kValues.length - 1];
  const d = avg(kValues.slice(-dPeriod));

  let state = 'neutral';
  if (k > 80 && d > 80) state = 'overbought';
  else if (k < 20 && d < 20) state = 'oversold';
  else if (k > 80) state = 'overbought_approaching';
  else if (k < 20) state = 'oversold_approaching';
  else if (k > d && k < 50) state = 'bullish_recovery';
  else if (k < d && k > 50) state = 'bearish_pullback';

  return { k: parseFloat(k.toFixed(2)), d: parseFloat(d.toFixed(2)), state };
}

// ─── Bollinger Bands ──────────────────────────────────────────
export function calculateBollingerBands(
  candles: Candle[],
  period = 20,
  stdDevMult = 2
): { upper: number; mid: number; lower: number; squeeze: boolean; percent_b: number } {
  if (candles.length < period) {
    const c = candles[candles.length - 1]?.close || 0;
    return { upper: c, mid: c, lower: c, squeeze: false, percent_b: 0.5 };
  }

  const closes = candles.slice(-period).map(c => c.close);
  const mid = avg(closes);
  const variance = closes.reduce((s, c) => s + Math.pow(c - mid, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = mid + stdDevMult * stdDev;
  const lower = mid - stdDevMult * stdDev;

  const currentClose = candles[candles.length - 1].close;
  const bandWidth = upper - lower;
  const percent_b = bandWidth === 0 ? 0.5 : (currentClose - lower) / bandWidth;

  // Squeeze: BB width < 2% of price (extremely tight bands)
  const squeeze = bandWidth / mid < 0.02;

  return {
    upper: parseFloat(upper.toFixed(4)),
    mid: parseFloat(mid.toFixed(4)),
    lower: parseFloat(lower.toFixed(4)),
    squeeze,
    percent_b: parseFloat(percent_b.toFixed(4)),
  };
}

// ─── ATR ─────────────────────────────────────────────────────
export function calculateATR(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs = candles.slice(-period).map((c, i, arr) => {
    if (i === 0) return c.high - c.low;
    const prev = arr[i - 1];
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  });
  return parseFloat((sum(trs) / trs.length).toFixed(4));
}

// ─── ADX (Average Directional Index) ─────────────────────────
export function calculateADX(candles: Candle[], period = 14): number {
  if (candles.length < period * 2) return 20;

  const slice = candles.slice(-(period * 2 + 1));
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const trList: number[] = [];

  for (let i = 1; i < slice.length; i++) {
    const curr = slice[i];
    const prev = slice[i - 1];
    const upMove = curr.high - prev.high;
    const downMove = prev.low - curr.low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    trList.push(Math.max(curr.high - curr.low, Math.abs(curr.high - prev.close), Math.abs(curr.low - prev.close)));
  }

  const smoothTR   = sum(trList.slice(0, period));
  const smoothPlus = sum(plusDM.slice(0, period));
  const smoothMinus = sum(minusDM.slice(0, period));

  const diPlus  = (smoothPlus / smoothTR) * 100;
  const diMinus = (smoothMinus / smoothTR) * 100;
  const dx = Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;

  // Simple approximation: return smoothed DX
  return parseFloat(dx.toFixed(2));
}

// ─── CCI (Commodity Channel Index) ───────────────────────────
export function calculateCCI(candles: Candle[], period = 20): number {
  if (candles.length < period) return 0;
  const slice = candles.slice(-period);
  const typicalPrices = slice.map(c => (c.high + c.low + c.close) / 3);
  const meanTP = avg(typicalPrices);
  const meanDeviation = avg(typicalPrices.map(tp => Math.abs(tp - meanTP)));
  if (meanDeviation === 0) return 0;
  const lastTP = typicalPrices[typicalPrices.length - 1];
  return parseFloat(((lastTP - meanTP) / (0.015 * meanDeviation)).toFixed(2));
}

// ─── Williams %R ─────────────────────────────────────────────
export function calculateWilliamsR(candles: Candle[], period = 14): number {
  if (candles.length < period) return -50;
  const slice = candles.slice(-period);
  const high = Math.max(...slice.map(c => c.high));
  const low = Math.min(...slice.map(c => c.low));
  const close = candles[candles.length - 1].close;
  if (high === low) return -50;
  return parseFloat((((high - close) / (high - low)) * -100).toFixed(2));
}

// ─── OBV (On-Balance Volume) ──────────────────────────────────
export function calculateOBVTrend(candles: Candle[]): 'rising' | 'falling' | 'flat' {
  if (candles.length < 20) return 'flat';

  let obv = 0;
  const obvSeries: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) obv += candles[i].volume;
    else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume;
    obvSeries.push(obv);
  }

  const recent = obvSeries.slice(-10);
  const earlyAvg = avg(recent.slice(0, 5));
  const lateAvg = avg(recent.slice(5));
  const changePct = earlyAvg !== 0 ? (lateAvg - earlyAvg) / Math.abs(earlyAvg) : 0;

  if (changePct > 0.02) return 'rising';
  if (changePct < -0.02) return 'falling';
  return 'flat';
}

// ─── CMF (Chaikin Money Flow) ─────────────────────────────────
export function calculateCMF(candles: Candle[], period = 20): number {
  if (candles.length < period) return 0;
  const slice = candles.slice(-period);

  let sumMFV = 0;
  let sumVol = 0;

  for (const c of slice) {
    const range = c.high - c.low;
    if (range === 0) continue;
    const mfMultiplier = ((c.close - c.low) - (c.high - c.close)) / range;
    sumMFV += mfMultiplier * c.volume;
    sumVol += c.volume;
  }

  return sumVol === 0 ? 0 : parseFloat((sumMFV / sumVol).toFixed(4));
}

// ─── MFI (Money Flow Index) ───────────────────────────────────
export function calculateMFI(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 50;
  const slice = candles.slice(-(period + 1));

  let posFlow = 0;
  let negFlow = 0;

  for (let i = 1; i < slice.length; i++) {
    const curr = slice[i];
    const prev = slice[i - 1];
    const tp = (curr.high + curr.low + curr.close) / 3;
    const prevTp = (prev.high + prev.low + prev.close) / 3;
    const rawMF = tp * curr.volume;

    if (tp > prevTp) posFlow += rawMF;
    else if (tp < prevTp) negFlow += rawMF;
  }

  if (negFlow === 0) return 100;
  const mfRatio = posFlow / negFlow;
  return parseFloat((100 - 100 / (1 + mfRatio)).toFixed(2));
}

// ─── Ichimoku Cloud ───────────────────────────────────────────
export function calculateIchimoku(candles: Candle[]): IchimokuCloud {
  // Standard settings: 9, 26, 52, 26
  const tenkanPeriod = 9;
  const kijunPeriod = 26;
  const senkouBPeriod = 52;
  const displacement = 26;

  const midpoint = (hi: number, lo: number) => (hi + lo) / 2;

  // Tenkan-sen (Conversion Line): (9-period high + 9-period low) / 2
  const tenkan_sen = candles.length >= tenkanPeriod
    ? midpoint(highest(candles, tenkanPeriod, 'high'), lowest(candles, tenkanPeriod, 'low'))
    : candles[candles.length - 1]?.close || 0;

  // Kijun-sen (Base Line): (26-period high + 26-period low) / 2
  const kijun_sen = candles.length >= kijunPeriod
    ? midpoint(highest(candles, kijunPeriod, 'high'), lowest(candles, kijunPeriod, 'low'))
    : tenkan_sen;

  // Senkou Span A: (Tenkan + Kijun) / 2, displaced forward 26 bars
  const senkou_a = (tenkan_sen + kijun_sen) / 2;

  // Senkou Span B: (52-period high + low) / 2, displaced forward 26 bars
  const senkou_b = candles.length >= senkouBPeriod
    ? midpoint(highest(candles, senkouBPeriod, 'high'), lowest(candles, senkouBPeriod, 'low'))
    : senkou_a;

  // Chikou Span: current close, displaced back 26 bars (we report current close)
  const chikou_span = candles[candles.length - 1]?.close || 0;

  const currentPrice = candles[candles.length - 1]?.close || 0;
  const cloudTop = Math.max(senkou_a, senkou_b);
  const cloudBot = Math.min(senkou_a, senkou_b);

  let price_vs_cloud: 'above' | 'below' | 'inside';
  if (currentPrice > cloudTop) price_vs_cloud = 'above';
  else if (currentPrice < cloudBot) price_vs_cloud = 'below';
  else price_vs_cloud = 'inside';

  // TK Cross: Tenkan crossing Kijun
  let tk_cross: 'bullish' | 'bearish' | 'none' = 'none';
  if (candles.length >= tenkanPeriod + 1) {
    const prevCandles = candles.slice(0, -1);
    const prevTenkan = prevCandles.length >= tenkanPeriod
      ? midpoint(highest(prevCandles, tenkanPeriod, 'high'), lowest(prevCandles, tenkanPeriod, 'low'))
      : tenkan_sen;
    const prevKijun = prevCandles.length >= kijunPeriod
      ? midpoint(highest(prevCandles, kijunPeriod, 'high'), lowest(prevCandles, kijunPeriod, 'low'))
      : kijun_sen;

    if (prevTenkan < prevKijun && tenkan_sen > kijun_sen) tk_cross = 'bullish';
    else if (prevTenkan > prevKijun && tenkan_sen < kijun_sen) tk_cross = 'bearish';
  }

  // Cloud color: Span A above Span B = green (bullish cloud)
  const cloud_color: 'green' | 'red' = senkou_a >= senkou_b ? 'green' : 'red';

  // Chikou clear: chikou above the candle body from displacement periods ago
  const displacedCandle = candles.length > displacement ? candles[candles.length - 1 - displacement] : null;
  const chikou_clear = displacedCandle
    ? chikou_span > Math.max(displacedCandle.open, displacedCandle.close)
    : false;

  return {
    tenkan_sen: parseFloat(tenkan_sen.toFixed(4)),
    kijun_sen: parseFloat(kijun_sen.toFixed(4)),
    senkou_a: parseFloat(senkou_a.toFixed(4)),
    senkou_b: parseFloat(senkou_b.toFixed(4)),
    chikou_span: parseFloat(chikou_span.toFixed(4)),
    price_vs_cloud,
    tk_cross,
    cloud_color,
    chikou_clear,
  };
}

// ─── VWAP with Standard Deviation Bands ──────────────────────
export function calculateVWAP(candles: Candle[]): VWAPData {
  if (candles.length === 0) {
    return {
      value: 0,
      upper_band_1: 0, lower_band_1: 0,
      upper_band_2: 0, lower_band_2: 0,
      price_vs_vwap: 'at',
    };
  }

  // Use today's session (or last 390 candles as proxy for intraday)
  const sessionCandles = candles.slice(-Math.min(candles.length, 390));

  let cumTPV = 0; // cumulative typical price × volume
  let cumVol = 0; // cumulative volume

  for (const c of sessionCandles) {
    const tp = (c.high + c.low + c.close) / 3;
    cumTPV += tp * c.volume;
    cumVol += c.volume;
  }

  const vwap = cumVol === 0 ? sessionCandles[sessionCandles.length - 1].close : cumTPV / cumVol;

  // Standard deviation bands
  let sumSqDeviation = 0;
  for (const c of sessionCandles) {
    const tp = (c.high + c.low + c.close) / 3;
    sumSqDeviation += c.volume * Math.pow(tp - vwap, 2);
  }
  const stdDev = cumVol === 0 ? 0 : Math.sqrt(sumSqDeviation / cumVol);

  const currentClose = candles[candles.length - 1].close;
  const tolerance = stdDev * 0.1;
  let price_vs_vwap: 'above' | 'below' | 'at';
  if (currentClose > vwap + tolerance) price_vs_vwap = 'above';
  else if (currentClose < vwap - tolerance) price_vs_vwap = 'below';
  else price_vs_vwap = 'at';

  return {
    value: parseFloat(vwap.toFixed(4)),
    upper_band_1: parseFloat((vwap + stdDev).toFixed(4)),
    lower_band_1: parseFloat((vwap - stdDev).toFixed(4)),
    upper_band_2: parseFloat((vwap + 2 * stdDev).toFixed(4)),
    lower_band_2: parseFloat((vwap - 2 * stdDev).toFixed(4)),
    price_vs_vwap,
  };
}

// ─── Master Indicator Bundle ──────────────────────────────────
// Computes all indicators in one pass — used by chartAnalysis.service.ts
export function computeAllIndicators(candles: Candle[]): {
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
} {
  return {
    rsi_14:    calculateRSI(candles, 14),
    macd:      calculateMACD(candles),
    stoch:     calculateStochastic(candles),
    adx:       calculateADX(candles),
    ichimoku:  calculateIchimoku(candles),
    vwap:      calculateVWAP(candles),
    obv_trend: calculateOBVTrend(candles),
    cmf:       calculateCMF(candles),
    mfi:       calculateMFI(candles),
    cci:       calculateCCI(candles),
    atr_14:    calculateATR(candles, 14),
    bb:        calculateBollingerBands(candles),
    williams_r: calculateWilliamsR(candles),
  };
}




dominance.skill.ts



// ============================================================
// dominance.skill.ts
// BTC / ETH / ALT dominance reads and market phase detection
// Determines whether we are in BTC season, ETH season, or alt season
// Feeds into coinUniverse.service.ts opportunity scoring
// ============================================================

import { DominanceData } from '../chartAnalysis.types';

// ─── Thresholds for phase detection ──────────────────────────
const BTC_SEASON_THRESHOLD  = 55;  // BTC.D > 55% → BTC season
const ETH_SEASON_THRESHOLD  = 18;  // ETH.D > 18% AND BTC.D falling → ETH season
const ALT_SEASON_THRESHOLD  = 40;  // BTC.D < 40% → alt season territory
const BTC_D_RISING_THRESHOLD = 0.5; // > 0.5% change in BTC.D = "rising"

// ─── Snapshot input structure ─────────────────────────────────
// You pass this in from your dominance data source
// (fetched via Binance BTC.D futures or a dominance API)
export interface DominanceSnapshot {
  btc_d_current: number;   // e.g. 54.2
  btc_d_prev_24h: number;  // 24h ago value
  eth_d_current: number;
  eth_d_prev_24h: number;
  others_d_current: number;
  sector_performance?: Record<string, number>; // sector → 24h % change
}

// ─── Core Dominance Analyzer ─────────────────────────────────
export function analyzeDominance(snapshot: DominanceSnapshot): DominanceData {
  const btcDChange = snapshot.btc_d_current - snapshot.btc_d_prev_24h;
  const ethDChange = snapshot.eth_d_current - snapshot.eth_d_prev_24h;

  let btc_d_trend: 'rising' | 'falling' | 'neutral';
  if (btcDChange > BTC_D_RISING_THRESHOLD) btc_d_trend = 'rising';
  else if (btcDChange < -BTC_D_RISING_THRESHOLD) btc_d_trend = 'falling';
  else btc_d_trend = 'neutral';

  // Market phase logic:
  // btc_season → BTC dominance high and rising (capital flows INTO BTC)
  // eth_season → BTC.D falling, ETH.D rising (rotation from BTC to ETH)
  // alt_season → BTC.D low and falling (rotation into alts)
  // mixed      → unclear signals
  let market_phase: 'btc_season' | 'eth_season' | 'alt_season' | 'mixed';

  if (snapshot.btc_d_current > BTC_SEASON_THRESHOLD && btc_d_trend === 'rising') {
    market_phase = 'btc_season';
  } else if (
    snapshot.btc_d_current < 50 &&
    btc_d_trend === 'falling' &&
    snapshot.eth_d_current > ETH_SEASON_THRESHOLD &&
    ethDChange > 0
  ) {
    market_phase = 'eth_season';
  } else if (snapshot.btc_d_current < ALT_SEASON_THRESHOLD && btc_d_trend === 'falling') {
    market_phase = 'alt_season';
  } else {
    market_phase = 'mixed';
  }

  // Sector leaders — top performers from snapshot (or defaults if not provided)
  const sectorPerf = snapshot.sector_performance || {};
  const sector_leaders = Object.entries(sectorPerf)
    .filter(([, pct]) => pct > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([sector]) => sector);

  return {
    btc_dominance: parseFloat(snapshot.btc_d_current.toFixed(2)),
    eth_dominance: parseFloat(snapshot.eth_d_current.toFixed(2)),
    others_dominance: parseFloat(snapshot.others_d_current.toFixed(2)),
    btc_d_trend,
    market_phase,
    sector_leaders,
  };
}

// ─── Rotation Signal ──────────────────────────────────────────
// Returns a human-readable signal string for LLM context injection
export function getDominanceSummary(dominance: DominanceData): string {
  const trend = dominance.btc_d_trend === 'rising'
    ? '↑ rising (capital flowing INTO BTC)'
    : dominance.btc_d_trend === 'falling'
    ? '↓ falling (capital rotating OUT of BTC)'
    : '→ neutral';

  const phase = {
    btc_season:  'BTC SEASON — focus on BTC and high-BTC-beta large caps',
    eth_season:  'ETH SEASON — L1/L2 tokens likely to outperform',
    alt_season:  'ALT SEASON — high-beta alts and sector rotation active',
    mixed:       'MIXED — no clear rotation signal, trade setups only',
  }[dominance.market_phase];

  const leaders = dominance.sector_leaders.length > 0
    ? `Leading sectors: ${dominance.sector_leaders.join(', ')}.`
    : '';

  return `BTC Dominance: ${dominance.btc_dominance}% ${trend}. ${phase}. ${leaders}`;
}

// ─── Opportunity Multiplier ───────────────────────────────────
// Adjusts opportunity score based on market phase + coin tier
export function getDominanceMultiplier(
  dominance: DominanceData,
  coinSector: string,
  coinTier: 1 | 2 | 3
): number {
  if (dominance.market_phase === 'btc_season') {
    // BTC season: favor tier 1, penalize tier 3
    if (coinTier === 1) return 1.3;
    if (coinTier === 2) return 0.9;
    return 0.6;
  }

  if (dominance.market_phase === 'eth_season') {
    // ETH season: favor L1/L2 sectors
    if (coinSector === 'l1' || coinSector === 'l2') return 1.4;
    if (coinTier === 1) return 1.1;
    return 0.85;
  }

  if (dominance.market_phase === 'alt_season') {
    // Alt season: favor sector leaders and tier 3 high-beta
    if (dominance.sector_leaders.includes(coinSector)) return 1.5;
    if (coinTier === 3) return 1.2;
    if (coinTier === 2) return 1.1;
    return 0.9;
  }

  return 1.0; // mixed → no adjustment
}

// ─── Fallback / Default Dominance ────────────────────────────
// Used when dominance API is unavailable
export function getDefaultDominance(): DominanceData {
  return {
    btc_dominance: 52.0,
    eth_dominance: 16.0,
    others_dominance: 32.0,
    btc_d_trend: 'neutral',
    market_phase: 'mixed',
    sector_leaders: [],
  };
}

chartTransform.util.ts




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




chartAnalysis.service.ts

// ============================================================
// chartAnalysis.service.ts
// Orchestrates: OHLCV fetch → ALL Tier 1 skills → MarketPrimitives
// → Anthropic Claude API (Tier 2) → ChartAnalysisResult
// This is the core engine of the Two-Tier system.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
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
import { CHART_ANALYST_SYSTEM_PROMPT } from '../agents/policy/prompts/chartAnalyst.prompt';

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
  confidence: z.number().min(0).max(100),
  invalidation: z.string(),
  reasoning: z.string(),
  framework_scores: z.record(z.number()),
  confluence_score: z.number().min(0).max(9),
  confluence_factors: z.array(z.string()),
});

// ─── Configuration ────────────────────────────────────────────
const DEFAULT_TIMEFRAMES: Timeframe[] = ['1h', '4h', '1d'];
const MAX_TOOL_CALL_ITERATIONS = 5;
const TOKEN_BUDGET = 3000; // primitives JSON target

const client = new Anthropic();

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

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1500,
    system: CHART_ANALYST_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  // Extract text from response
  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => (block as any).text)
    .join('');

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







chartAnalyst.prompt.ts



// ============================================================
// chartAnalyst.prompt.ts
// System prompt for the Tier 2 LLM Pattern Synthesizer
// Defines reasoning framework, output schema, and decision rules
// ============================================================

export const CHART_ANALYST_SYSTEM_PROMPT = `
You are a Chartered Market Technician (CMT) with 20 years of institutional crypto trading experience.

You receive a JSON payload called "Market Primitives" — pre-calculated structural data extracted by a quantitative backend. Your job is to interpret these primitives, decide which trading framework applies, and output a precise, structured trade plan.

## Decision Framework (Apply in Priority Order)

1. **SMART MONEY / ICT** — Apply when:
   - Unmitigated Order Blocks are present at the current price area
   - Fair Value Gaps remain unfilled near key levels
   - A confirmed Break of Structure (BOS) or Change of Character (ChoCH) has occurred
   - Liquidity sweeps have cleared stops before the expected move

2. **WYCKOFF** — Apply when:
   - The WyckoffContext shows Phase A/B/C (Spring or UTAD confirmed)
   - Volume analysis confirms accumulation or distribution
   - Price is at range extremes with climactic volume signatures

3. **ELLIOTT WAVE** — Apply when:
   - A clean 5-wave impulse or 3-wave correction is visible in the pivot array
   - Fibonacci ratios validate wave relationships
   - Confidence is above 0.65

4. **HARMONICS** — Apply when:
   - A harmonic pattern (Gartley, Bat, Butterfly, Crab, Cypher) has completion_pct >= 85
   - Price is approaching or inside the PRZ (Potential Reversal Zone)
   - At least 3/4 Fibonacci ratio rules are validated

5. **HYBRID** — Apply when:
   - 2 or more frameworks independently point to the same price level
   - This is the HIGHEST conviction scenario
   - Explicitly name which frameworks converge

## Context Rules (NEVER Violate)

- **HTF overrides LTF**: If 1D is bearish, do NOT take a long on 1H. Flag the conflict.
- **Price Discovery** (new ATH): Ignore RSI overbought. Focus on momentum and extension targets.
- **Ranging Market**: Prefer S/R bounces and OB fills. Avoid breakout entries.
- **Accumulation Phase**: NEVER front-run the Spring. Wait for SOS confirmation.
- **BTC Context**: If btc_context is provided and shows a conflicting bias, reduce confidence by 20 points minimum and note the conflict.
- **Confluence Scoring**: Count ONLY independent factors pointing at the same level. Do not double-count.

## Output Schema (ALWAYS return valid JSON — NO markdown, NO explanation outside the JSON)

{
  "regime": "trending_up | trending_down | ranging | accumulation | distribution | price_discovery",
  "bias": "long | short | neutral",
  "primary_framework": "SmartMoney | Wyckoff | ElliottWave | Harmonic | Hybrid",
  "setup_name": "descriptive name, e.g. 'Bat PRZ + Bullish OB Confluence'",
  "entry_zone": { "high": 0.0, "low": 0.0 },
  "stop_loss": 0.0,
  "take_profit_levels": [0.0, 0.0, 0.0],
  "risk_reward": 0.0,
  "confidence": 0,
  "invalidation": "specific price level and condition that voids the trade thesis",
  "reasoning": "3-5 sentences explaining the dominant framework, key levels, and why this setup has edge",
  "framework_scores": {
    "SmartMoney": 0,
    "Wyckoff": 0,
    "ElliottWave": 0,
    "Harmonic": 0
  },
  "confluence_score": 0,
  "confluence_factors": ["list each factor that contributed to confluence score"]
}

## Confidence Calibration

- 80-100: All frameworks agree, price at key level, BTC context aligned
- 60-79: 2-3 frameworks agree, clear setup, minor conflicts
- 40-59: Single framework, uncertain structure, or conflicting timeframes
- 20-39: Weak signal, wait for confirmation
- 0-19: No edge — output neutral bias

## R:R Minimum Standards

- SmartMoney setups: minimum 2:1 R:R
- Wyckoff Spring: minimum 3:1 R:R
- Elliott Wave 3: minimum 3:1 R:R
- Harmonic PRZ: minimum 2:1 R:R
- If minimum R:R cannot be achieved from the primitives data, output neutral bias.

## Stop Loss Placement

- SmartMoney: below the Order Block low (for longs), above the OB high (for shorts)
- Wyckoff: below the Spring low or above the UTAD high
- Elliott: Wave invalidation level (Wave 4 cannot overlap Wave 1)
- Harmonic: beyond the extreme of the PRZ + 1 ATR

## Take Profit Levels (always 3 targets)

- TP1: nearest resistance / previous structure high (conservative, 50% position)
- TP2: Fibonacci extension 1.272 or 1.618 of the measured move
- TP3: Full measured move target or HTF resistance
`;

// ─── Regime-specific prompt addons ───────────────────────────
export const REGIME_CONTEXT_ADDONS: Record<string, string> = {
  trending_up: `
Price is in a confirmed uptrend. Bias for long setups. 
Prefer: Wave 3 in progress, Bullish OBs as pullback entries, BOS retests.
Avoid: Counter-trend shorts unless at major HTF resistance with extreme bearish confluence.`,

  trending_down: `
Price is in a confirmed downtrend. Bias for short setups.
Prefer: Bearish OBs as rally shorts, distribution tops, bearish harmonic completions.
Avoid: Long entries unless at major HTF support with Spring confirmation.`,

  ranging: `
Price is ranging between defined boundaries. Fade the extremes.
Prefer: OB fills at range edges, harmonic PRZ bounces, S/R reversals.
Avoid: Breakout entries — wait for range expansion confirmation.`,

  accumulation: `
Wyckoff accumulation in progress. Be patient.
DO NOT enter long until Spring is confirmed AND Sign of Strength (SOS) follows.
Watch for Last Point of Supply (LPS) as the final long entry before markup.`,

  distribution: `
Wyckoff distribution in progress. Be cautious with longs.
Watch for UTAD (Upthrust After Distribution) as the final short entry.
LPSY (Last Point of Supply) signals the start of markdown.`,

  price_discovery: `
Price is in post-ATH price discovery. No historical resistance.
Extend Fibonacci projections (1.618, 2.618) as the only targets.
Momentum and volume are the primary signals. RSI overbought is MEANINGLESS here.`,
};




intelligence.service.ts

// ============================================================
// intelligence.service.ts
// The master intelligence loop:
// 1. Analyze BTC first → establish btcContext
// 2. Get dominance data → determine market phase
// 3. Score all coins in universe → rank by opportunity
// 4. Run full analysis on top N coins with BTC context injected
// 5. Return IntelligenceScan with cascade map populated
// ============================================================

import {
  BtcContext,
  CoinIntelligenceCard,
  IntelligenceScan,
  CascadeEntry,
  CascadeStatus,
  DominanceData,
  CorrelationData,
  ChartAnalysisResult,
} from '../agents/chartAnalysis.types';
import { analyzeSymbol } from './chartAnalysis.service';
import { calculateCorrelation, expectedMove } from '../agents/skills/correlation.skill';
import { analyzeDominance, getDominanceSummary, getDominanceMultiplier, getDefaultDominance } from '../agents/skills/dominance.skill';
import { ohlcvIngest } from '../read/ingestion/ohlcv.ingest';
import {
  COIN_UNIVERSE_CONFIG,
  OPPORTUNITY_SCORE_WEIGHTS,
  MAX_FULL_ANALYSIS_PER_TICK,
  MIN_OPPORTUNITY_SCORE_THRESHOLD,
  DEFAULT_BETA,
  DEFAULT_LAG_HOURS,
} from '../config/coinUniverse.config';
import { nanoid } from '../utils/nanoid';

// ─── Types ───────────────────────────────────────────────────
interface CoinScore {
  symbol: string;
  binance_symbol: string;
  tier: 1 | 2 | 3;
  sector: string;
  opportunity_score: number;
  cascade_status: CascadeStatus;
  window_remaining_minutes: number;
}

// ─── BTC Context Builder ──────────────────────────────────────
async function buildBtcContext(btcResult: ChartAnalysisResult): Promise<BtcContext> {
  const dominance = await fetchDominanceData();
  return {
    regime: btcResult.regime,
    bias: btcResult.bias,
    signal_fired_at: new Date().toISOString(),
    signal_type: btcResult.setup_name,
    bos_direction: btcResult.bias === 'long' ? 'bullish' : btcResult.bias === 'short' ? 'bearish' : undefined,
    bos_level: btcResult.entry_zone.high,
    dominance,
    minutes_since_signal: 0,
  };
}

// ─── Fetch Dominance Data ─────────────────────────────────────
// In production: fetch from CoinGecko Global or a dedicated dominance API
// For now: uses defaults with a simple HTTP fetch pattern
async function fetchDominanceData(): Promise<DominanceData> {
  try {
    // TODO: Replace with actual dominance API call
    // const resp = await fetch('https://api.coingecko.com/api/v3/global');
    // const data = await resp.json();
    // return analyzeDominance({ ... });
    return getDefaultDominance();
  } catch {
    return getDefaultDominance();
  }
}

// ─── Cascade Status Calculator ────────────────────────────────
function calculateCascadeStatus(
  symbol: string,
  btcContext: BtcContext,
  correlation: CorrelationData,
  currentPriceChangeHours: number // hours since BTC signal
): CascadeEntry {
  const lagHours = correlation.lag_hours || DEFAULT_LAG_HOURS[symbol] || 2;
  const expectedWindowHours = lagHours * 2; // window = 2× typical lag
  const minutesElapsed = btcContext.minutes_since_signal;
  const windowRemainingMinutes = Math.max(0, (expectedWindowHours * 60) - minutesElapsed);

  // Determine cascade status
  let status: CascadeStatus;

  if (correlation.correlation_30d < 0.4) {
    status = 'decorrelated';
  } else if (correlation.is_leading) {
    status = 'leading';
  } else if (minutesElapsed === 0) {
    status = 'window_open'; // BTC just fired
  } else if (minutesElapsed < lagHours * 30) {
    // Within first 50% of expected lag window
    status = 'window_open';
  } else if (minutesElapsed < lagHours * 60) {
    // In the window, may be reacting
    status = currentPriceChangeHours > 0.5 ? 'reacting_now' : 'window_open';
  } else {
    // Past the expected window
    status = currentPriceChangeHours > 1.0 ? 'reacted' : 'window_open';
  }

  const btcExpectedMove = btcContext.bias === 'neutral' ? 0 : 3.0; // assumed 3% BTC move
  const expectedMovePct = Math.abs(btcExpectedMove * (correlation.beta_30d || DEFAULT_BETA[symbol] || 1.5));

  return {
    coin: symbol,
    status,
    btc_signal_ts: btcContext.signal_fired_at,
    coin_reaction_ts: status === 'reacted' ? new Date().toISOString() : undefined,
    minutes_elapsed: minutesElapsed,
    expected_window_hours: expectedWindowHours,
    window_remaining_minutes: windowRemainingMinutes,
    expected_move_pct: parseFloat(expectedMovePct.toFixed(2)),
    historical_follow_rate: Math.min(0.95, Math.max(0.3, correlation.correlation_30d)),
  };
}

// ─── Opportunity Scorer ───────────────────────────────────────
function scoreOpportunity(
  symbol: string,
  tier: 1 | 2 | 3,
  sector: string,
  cascade: CascadeEntry,
  correlation: CorrelationData,
  dominance: DominanceData,
  btcContext: BtcContext,
  isAtKeyLevel: boolean
): number {
  const w = OPPORTUNITY_SCORE_WEIGHTS;

  // Correlation score: how tightly correlated to BTC
  const correlationScore = Math.abs(correlation.correlation_30d) * w.correlation_score;

  // BTC signal alignment: does this coin's expected direction match BTC?
  const btcAligned = btcContext.bias !== 'neutral' ? 1.0 : 0.5;
  const btcAlignmentScore = btcAligned * w.btc_signal_alignment;

  // At key level bonus
  const atLevelScore = isAtKeyLevel ? w.at_key_level_bonus : 0;

  // Laggard timing: window_open = full score, reacting_now = half, reacted = zero
  const laggardScore =
    cascade.status === 'window_open' ? w.laggard_timing_bonus :
    cascade.status === 'reacting_now' ? w.laggard_timing_bonus * 0.5 :
    0;

  // Sector momentum: sector leaders get bonus
  const sectorScore = dominance.sector_leaders.includes(sector) ? w.sector_momentum_bonus : 0;

  // Dominance multiplier
  const multiplier = getDominanceMultiplier(dominance, sector, tier);

  const raw = correlationScore + btcAlignmentScore + atLevelScore + laggardScore + sectorScore;
  return parseFloat(Math.min(1.0, raw * multiplier).toFixed(4));
}

// ─── Main Intelligence Scan ───────────────────────────────────
export async function runIntelligenceScan(): Promise<IntelligenceScan> {
  const scanId = nanoid();
  console.log(`[IntelligenceScan ${scanId}] Starting...`);

  // ── Step 1: Analyze BTC first ──────────────────────────────
  console.log('[IntelligenceScan] Step 1: Analyzing BTC...');
  const { result: btcResult } = await analyzeSymbol('BTCUSDT');
  const btcContext = await buildBtcContext(btcResult);
  const dominance = btcContext.dominance;

  console.log(`[IntelligenceScan] BTC bias: ${btcResult.bias}, regime: ${btcResult.regime}`);

  // ── Step 2: Fetch BTC candles for correlation ──────────────
  const btcCandles = await ohlcvIngest.fetch({ symbol: 'BTCUSDT', timeframe: '4h', limit: 200 });

  // ── Step 3: Score all coins in universe ───────────────────
  const allCoins = [
    ...COIN_UNIVERSE_CONFIG.tier2,
    ...COIN_UNIVERSE_CONFIG.tier3,
  ];

  const coinScores: CoinScore[] = [];

  for (const coin of allCoins) {
    try {
      const coinCandles = await ohlcvIngest.fetch({
        symbol: coin.binance_symbol,
        timeframe: '4h',
        limit: 200,
      });

      const correlation = calculateCorrelation(
        coin.symbol,
        coinCandles.candles,
        btcCandles.candles
      );

      // Estimate if coin is at a key level (simplified — full analysis does deep check)
      const recentClose = coinCandles.candles[coinCandles.candles.length - 1]?.close || 0;
      const priceChange1h = coinCandles.candles.length > 1
        ? (recentClose - coinCandles.candles[coinCandles.candles.length - 4]?.close || recentClose) / recentClose
        : 0;

      const cascade = calculateCascadeStatus(
        coin.symbol,
        btcContext,
        correlation,
        Math.abs(priceChange1h)
      );

      const score = scoreOpportunity(
        coin.symbol,
        coin.tier,
        coin.sector || 'unknown',
        cascade,
        correlation,
        dominance,
        btcContext,
        false // isAtKeyLevel — false until full analysis
      );

      coinScores.push({
        symbol: coin.symbol,
        binance_symbol: coin.binance_symbol,
        tier: coin.tier,
        sector: coin.sector || 'unknown',
        opportunity_score: score,
        cascade_status: cascade.status,
        window_remaining_minutes: cascade.window_remaining_minutes,
      });
    } catch (err) {
      console.warn(`[IntelligenceScan] Failed to score ${coin.symbol}:`, err);
    }
  }

  // ── Step 4: Filter and rank ────────────────────────────────
  const qualifiedCoins = coinScores
    .filter(c => c.opportunity_score >= MIN_OPPORTUNITY_SCORE_THRESHOLD)
    .sort((a, b) => b.opportunity_score - a.opportunity_score)
    .slice(0, MAX_FULL_ANALYSIS_PER_TICK);

  console.log(`[IntelligenceScan] ${qualifiedCoins.length} coins qualified for full analysis`);

  // ── Step 5: Full parallel analysis on qualified coins ──────
  const intelligenceCards: CoinIntelligenceCard[] = [];
  const windowsOpen = coinScores.filter(c => c.cascade_status === 'window_open').length;

  const analysisPromises = qualifiedCoins.map(async (coinScore) => {
    try {
      const coinCandles = await ohlcvIngest.fetch({
        symbol: coinScore.binance_symbol,
        timeframe: '4h',
        limit: 200,
      });

      const correlation = calculateCorrelation(
        coinScore.symbol,
        coinCandles.candles,
        btcCandles.candles
      );

      const { primitives, result } = await analyzeSymbol(coinScore.binance_symbol, btcContext);

      const cascade = calculateCascadeStatus(
        coinScore.symbol,
        btcContext,
        correlation,
        0
      );

      const currentPrice = coinCandles.candles[coinCandles.candles.length - 1]?.close || 0;
      const prevPrice = coinCandles.candles[coinCandles.candles.length - 25]?.close || currentPrice;
      const priceChange24h = prevPrice !== 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;

      const card: CoinIntelligenceCard = {
        coin: coinScore.symbol,
        symbol: coinScore.binance_symbol,
        current_price: currentPrice,
        price_change_24h: parseFloat(priceChange24h.toFixed(2)),
        cascade,
        confluence_score: result.confluence_score,
        confluence_factors: result.confluence_factors,
        analysis: result,
        correlation,
        historical_setup_accuracy: 0.65, // placeholder — real value from MongoDB
        historical_sample_size: 0,       // placeholder
        opportunity_score: coinScore.opportunity_score,
        last_updated: new Date().toISOString(),
      };

      intelligenceCards.push(card);
    } catch (err) {
      console.warn(`[IntelligenceScan] Full analysis failed for ${coinScore.symbol}:`, err);
    }
  });

  await Promise.allSettled(analysisPromises);

  // ── Step 6: Sort and return scan ──────────────────────────
  const sorted = intelligenceCards
    .sort((a, b) => b.opportunity_score - a.opportunity_score);

  const scan: IntelligenceScan = {
    scan_id: scanId,
    generated_at: new Date().toISOString(),
    btc_context: btcContext,
    dominance,
    market_phase: dominance.market_phase,
    coins: sorted,
    total_analyzed: allCoins.length,
    windows_open: windowsOpen,
    top_opportunities: sorted.slice(0, 5),
  };

  console.log(`[IntelligenceScan ${scanId}] Complete. ${sorted.length} cards generated. ${windowsOpen} windows open.`);
  return scan;
}

// ─── Get single coin card (for real-time updates) ─────────────
export async function getCoinCard(
  symbol: string,
  btcContext?: BtcContext
): Promise<CoinIntelligenceCard | null> {
  try {
    const binanceSymbol = symbol.toUpperCase() + 'USDT';
    const coinCandles = await ohlcvIngest.fetch({ symbol: binanceSymbol, timeframe: '4h', limit: 200 });
    const btcCandles  = await ohlcvIngest.fetch({ symbol: 'BTCUSDT',     timeframe: '4h', limit: 200 });

    const correlation = calculateCorrelation(symbol, coinCandles.candles, btcCandles.candles);
    const { result }  = await analyzeSymbol(binanceSymbol, btcContext);

    const currentPrice   = coinCandles.candles[coinCandles.candles.length - 1]?.close || 0;
    const prevPrice      = coinCandles.candles[coinCandles.candles.length - 25]?.close || currentPrice;
    const priceChange24h = prevPrice !== 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;

    const ctx = btcContext || {
      regime: 'ranging' as const,
      bias: 'neutral' as const,
      signal_fired_at: new Date().toISOString(),
      signal_type: 'unknown',
      dominance: getDefaultDominance(),
      minutes_since_signal: 0,
    };

    const cascade = calculateCascadeStatus(symbol, ctx, correlation, 0);

    return {
      coin: symbol,
      symbol: binanceSymbol,
      current_price: currentPrice,
      price_change_24h: parseFloat(priceChange24h.toFixed(2)),
      cascade,
      confluence_score: result.confluence_score,
      confluence_factors: result.confluence_factors,
      analysis: result,
      correlation,
      historical_setup_accuracy: 0.65,
      historical_sample_size: 0,
      opportunity_score: 0,
      last_updated: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[getCoinCard] Failed for ${symbol}:`, err);
    return null;
  }
}




coinUniverse.service.ts




// ============================================================
// coinUniverse.service.ts
// Manages the coin watchlist: scoring, filtering, and opportunity ranking
// Called by intelligence.service.ts before full analysis runs
// ============================================================

import {
  BtcContext,
  CorrelationData,
  DominanceData,
  CascadeStatus,
} from '../agents/chartAnalysis.types';
import { calculateCorrelation } from '../agents/skills/correlation.skill';
import { getDominanceMultiplier } from '../agents/skills/dominance.skill';
import {
  COIN_UNIVERSE_CONFIG,
  CoinTier,
  OPPORTUNITY_SCORE_WEIGHTS,
  MIN_OPPORTUNITY_SCORE_THRESHOLD,
  DEFAULT_BETA,
  DEFAULT_LAG_HOURS,
} from '../config/coinUniverse.config';
import { ohlcvIngest } from '../read/ingestion/ohlcv.ingest';
import { Candle } from '../agents/chartAnalysis.types';

// ─── Scored Coin Entry ────────────────────────────────────────
export interface ScoredCoin {
  coin: CoinTier;
  opportunity_score: number;
  cascade_status: CascadeStatus;
  window_remaining_minutes: number;
  correlation: CorrelationData;
  estimated_move_pct: number;
}

// ─── Pre-screen all coins vs BTC ─────────────────────────────
// This is the FAST pass before full LLM analysis
// Uses cached 4H candles for correlation math only
export async function prescreenUniverse(
  btcCandles: Candle[],
  btcContext: BtcContext,
  dominance: DominanceData
): Promise<ScoredCoin[]> {
  const allCoins = [...COIN_UNIVERSE_CONFIG.tier1.filter(c => c.symbol !== 'BTC'), ...COIN_UNIVERSE_CONFIG.tier2, ...COIN_UNIVERSE_CONFIG.tier3];

  const scoredCoins: ScoredCoin[] = [];

  await Promise.allSettled(
    allCoins.map(async (coin) => {
      try {
        const candles = await ohlcvIngest.fetch({
          symbol: coin.binance_symbol,
          timeframe: '4h',
          limit: 200,
        });

        const correlation = calculateCorrelation(coin.symbol, candles.candles, btcCandles);

        const lagHours = correlation.lag_hours || DEFAULT_LAG_HOURS[coin.symbol] || 2;
        const expectedWindowHours = lagHours * 2;
        const minutesElapsed = btcContext.minutes_since_signal;
        const windowRemainingMinutes = Math.max(0, (expectedWindowHours * 60) - minutesElapsed);

        // Simple cascade status from timing
        let cascade_status: CascadeStatus;
        if (correlation.correlation_30d < 0.4) {
          cascade_status = 'decorrelated';
        } else if (correlation.is_leading) {
          cascade_status = 'leading';
        } else if (windowRemainingMinutes > 0) {
          cascade_status = minutesElapsed < lagHours * 30 ? 'window_open' : 'reacting_now';
        } else {
          cascade_status = 'reacted';
        }

        // Score components
        const correlationScore    = Math.abs(correlation.correlation_30d) * OPPORTUNITY_SCORE_WEIGHTS.correlation_score;
        const btcAlignScore       = (btcContext.bias !== 'neutral' ? 1.0 : 0.5) * OPPORTUNITY_SCORE_WEIGHTS.btc_signal_alignment;
        const laggardScore        =
          cascade_status === 'window_open'   ? OPPORTUNITY_SCORE_WEIGHTS.laggard_timing_bonus :
          cascade_status === 'reacting_now'  ? OPPORTUNITY_SCORE_WEIGHTS.laggard_timing_bonus * 0.5 : 0;
        const sectorScore         = dominance.sector_leaders.includes(coin.sector || '') ? OPPORTUNITY_SCORE_WEIGHTS.sector_momentum_bonus : 0;

        const multiplier = getDominanceMultiplier(dominance, coin.sector || 'unknown', coin.tier);
        const opportunity_score = Math.min(1.0,
          (correlationScore + btcAlignScore + laggardScore + sectorScore) * multiplier
        );

        const btcMovePct = 3.0; // assumed BTC signal move
        const estimated_move_pct = Math.abs(btcMovePct * (correlation.beta_30d || DEFAULT_BETA[coin.symbol] || 1.5));

        scoredCoins.push({
          coin,
          opportunity_score: parseFloat(opportunity_score.toFixed(4)),
          cascade_status,
          window_remaining_minutes: windowRemainingMinutes,
          correlation,
          estimated_move_pct: parseFloat(estimated_move_pct.toFixed(2)),
        });
      } catch {
        // Coin unavailable — skip silently
      }
    })
  );

  return scoredCoins
    .filter(c => c.opportunity_score >= MIN_OPPORTUNITY_SCORE_THRESHOLD)
    .sort((a, b) => b.opportunity_score - a.opportunity_score);
}

// ─── Get top coins by cascade window ─────────────────────────
export function getWindowOpenCoins(scored: ScoredCoin[], maxCount = 10): ScoredCoin[] {
  return scored
    .filter(c => c.cascade_status === 'window_open' || c.cascade_status === 'reacting_now')
    .sort((a, b) => b.opportunity_score - a.opportunity_score)
    .slice(0, maxCount);
}

// ─── Get sector leaders ───────────────────────────────────────
export function getSectorLeaderCoins(scored: ScoredCoin[], sector: string): ScoredCoin[] {
  return scored
    .filter(c => c.coin.sector === sector)
    .sort((a, b) => b.opportunity_score - a.opportunity_score);
}

// ─── Get coins by tier ────────────────────────────────────────
export function getCoinsByTier(scored: ScoredCoin[], tier: 1 | 2 | 3): ScoredCoin[] {
  return scored.filter(c => c.coin.tier === tier);
}

// ─── Summary text for logging ─────────────────────────────────
export function getScanSummary(scored: ScoredCoin[]): string {
  const windowOpen = scored.filter(c => c.cascade_status === 'window_open').length;
  const reacting   = scored.filter(c => c.cascade_status === 'reacting_now').length;
  const top3       = scored.slice(0, 3).map(c => `${c.coin.symbol}(${c.opportunity_score.toFixed(2)})`).join(', ');
  return `Universe: ${scored.length} qualified | Window open: ${windowOpen} | Reacting: ${reacting} | Top 3: ${top3}`;
}






crossAsset.prompt.ts

// ============================================================
// crossAsset.prompt.ts
// Injects BTC context into altcoin LLM analysis calls
// This is what makes altcoin analysis context-aware, not isolated
// ============================================================

import { BtcContext, DominanceData } from '../chartAnalysis.types';

// ─── Generate BTC Context Block for LLM ──────────────────────
export function buildBtcContextBlock(btcContext: BtcContext): string {
  const minutesLabel =
    btcContext.minutes_since_signal === 0 ? 'just now' :
    btcContext.minutes_since_signal < 60  ? `${btcContext.minutes_since_signal} minutes ago` :
    `${Math.floor(btcContext.minutes_since_signal / 60)} hours ago`;

  const dominanceSummary = buildDominanceSummary(btcContext.dominance);

  return `
<btc_context>
BTC Signal: ${btcContext.signal_type} | Fired: ${minutesLabel}
BTC Regime: ${btcContext.regime} | BTC Bias: ${btcContext.bias.toUpperCase()}
${btcContext.bos_direction ? `BTC BOS: ${btcContext.bos_direction} at ${btcContext.bos_level}` : ''}
${dominanceSummary}
</btc_context>
`;
}

// ─── Dominance summary ────────────────────────────────────────
function buildDominanceSummary(dominance: DominanceData): string {
  const phaseDescriptions = {
    btc_season:  'BTC SEASON active — alts underperforming, reduce altcoin position sizes',
    eth_season:  'ETH SEASON forming — L1/L2 tokens favored for outperformance',
    alt_season:  'ALT SEASON active — high-beta alts accelerating, expand universe',
    mixed:       'Mixed dominance — no clear sector rotation signal',
  };

  const trendArrow =
    dominance.btc_d_trend === 'rising'  ? '↑' :
    dominance.btc_d_trend === 'falling' ? '↓' : '→';

  return [
    `BTC Dominance: ${dominance.btc_dominance}% ${trendArrow}`,
    phaseDescriptions[dominance.market_phase],
    dominance.sector_leaders.length > 0
      ? `Leading sectors right now: ${dominance.sector_leaders.join(', ')}`
      : '',
  ].filter(Boolean).join(' | ');
}

// ─── Cross-Asset System Prompt Addon ─────────────────────────
// Prepended to the chart analyst prompt when analyzing altcoins
export const CROSS_ASSET_PROMPT_ADDON = `
## Cross-Asset Context Rules

You are analyzing an ALTCOIN. BTC context has been provided. Apply these rules:

1. **BTC Alignment Check**: Before confirming any bias, check if it aligns with BTC's current bias.
   - If they AGREE → confidence bonus: +10 points
   - If they CONFLICT → confidence penalty: -20 points minimum; flag the conflict explicitly in reasoning
   - If BTC is neutral → no adjustment

2. **Cascade Window**: If btc_context shows a signal fired recently:
   - Window open (< lag hours elapsed) → the altcoin SHOULD be reacting if correlated
   - No reaction yet despite window open → either setup is forming OR coin is decorrelating
   - Note this explicitly in reasoning

3. **Market Phase Adjustment**:
   - BTC Season: Only high-conviction, large-cap setups. Reduce confidence on small caps by 15.
   - Alt Season: Standard confidence. Sector leaders get +10 confidence if they're in the leading sector.
   - ETH Season: L1/L2 tokens get +10. DeFi is secondary. Others standard.

4. **Position Sizing Hint** (include in reasoning):
   - Correlated assets in same direction = 1 position risk, not 2
   - If BTC and altcoin both long → count as one correlated trade for portfolio risk purposes

5. **Override Rule**: If BTC regime is 'distribution' or 'trending_down' AND this altcoin shows a long setup:
   - Maximum confidence = 55 (never high conviction against HTF BTC trend)
   - Require minimum 3:1 R:R
   - Explicitly state: "Counter-trend to BTC — reduced confidence"
`;

// ─── Build full system prompt with cross-asset addon ─────────
export function buildCrossAssetSystemPrompt(basePrompt: string): string {
  return basePrompt + '\n\n' + CROSS_ASSET_PROMPT_ADDON;
}

// ─── Inject BTC context into user message ────────────────────
export function injectBtcContextIntoMessage(
  originalMessage: string,
  btcContext: BtcContext
): string {
  const contextBlock = buildBtcContextBlock(btcContext);
  return contextBlock + '\n' + originalMessage;
}




chartAnalysis.risk.ts



// ============================================================
// chartAnalysis.risk.ts
// Risk rules specific to structure-based trading setups
// Applied AFTER LLM synthesis, BEFORE execution.gateway.ts
// ============================================================

import {
  ChartAnalysisResult,
  MarketPrimitives,
  BtcContext,
} from '../agents/chartAnalysis.types';

// ─── Risk Rule Result ─────────────────────────────────────────
export interface RiskCheckResult {
  approved: boolean;
  rejection_reason?: string;
  warnings: string[];
  adjusted_confidence: number;
  adjusted_stop_loss?: number;
  adjusted_size_multiplier: number; // 0.25 | 0.5 | 0.75 | 1.0
}

// ─── Minimum R:R by framework ─────────────────────────────────
const MIN_RR: Record<string, number> = {
  SmartMoney:   2.0,
  Wyckoff:      3.0,
  ElliottWave:  3.0,
  Harmonic:     2.0,
  Hybrid:       2.5,
};

// ─── Minimum confidence to execute ───────────────────────────
const MIN_CONFIDENCE_TO_EXECUTE = 40;
const MIN_CONFIDENCE_FULL_SIZE  = 70;

// ─── Core Risk Check ─────────────────────────────────────────
export function validateChartAnalysisTrade(
  result: ChartAnalysisResult,
  primitives: MarketPrimitives,
  btcContext?: BtcContext
): RiskCheckResult {
  const warnings: string[] = [];
  let adjustedConfidence = result.confidence;
  let adjustedSizeMultiplier = 1.0;
  let rejectionReason: string | undefined;

  // ── Rule 1: Minimum confidence ─────────────────────────────
  if (result.confidence < MIN_CONFIDENCE_TO_EXECUTE) {
    rejectionReason = `Confidence ${result.confidence} below minimum ${MIN_CONFIDENCE_TO_EXECUTE}`;
    return {
      approved: false,
      rejection_reason: rejectionReason,
      warnings,
      adjusted_confidence: adjustedConfidence,
      adjusted_size_multiplier: 0,
    };
  }

  // ── Rule 2: Minimum R:R by framework ──────────────────────
  const minRR = MIN_RR[result.primary_framework] || 2.0;
  if (result.risk_reward < minRR) {
    rejectionReason = `R:R ${result.risk_reward.toFixed(2)} below minimum ${minRR} for ${result.primary_framework}`;
    return {
      approved: false,
      rejection_reason: rejectionReason,
      warnings,
      adjusted_confidence: adjustedConfidence,
      adjusted_size_multiplier: 0,
    };
  }

  // ── Rule 3: Never enter into unmitigated opposing OB ──────
  const opposingOBs = primitives.smart_money.order_blocks.filter(ob => {
    if (result.bias === 'long'  && ob.type === 'bearish' && ob.status === 'unmitigated') return true;
    if (result.bias === 'short' && ob.type === 'bullish' && ob.status === 'unmitigated') return true;
    return false;
  });

  if (opposingOBs.length > 0) {
    const obPrices = opposingOBs.map(ob => `${ob.price_low}-${ob.price_high}`).join(', ');
    warnings.push(`Unmitigated opposing OBs overhead: ${obPrices} — watch for rejection`);
    adjustedConfidence = Math.max(adjustedConfidence - 10, 0);
    adjustedSizeMultiplier *= 0.75;
  }

  // ── Rule 4: HTF contradiction check ───────────────────────
  if (primitives.mtfa) {
    const htfBias   = primitives.mtfa['1D']?.bias;
    const tradeBias = result.bias;

    if (htfBias && htfBias !== 'neutral' && tradeBias !== 'neutral' && htfBias !== tradeBias) {
      warnings.push(`HTF (1D) is ${htfBias} but trade is ${tradeBias} — counter-trend setup`);
      adjustedConfidence = Math.max(adjustedConfidence - 20, 0);
      adjustedSizeMultiplier *= 0.5;

      if (result.risk_reward < minRR + 1.0) {
        rejectionReason = `Counter-trend trade requires R:R > ${minRR + 1.0}, got ${result.risk_reward.toFixed(2)}`;
        return {
          approved: false,
          rejection_reason: rejectionReason,
          warnings,
          adjusted_confidence: adjustedConfidence,
          adjusted_size_multiplier: 0,
        };
      }
    }
  }

  // ── Rule 5: BTC context conflict ─────────────────────────
  if (btcContext && btcContext.bias !== 'neutral' && result.bias !== 'neutral') {
    const btcBiasAsDirection = btcContext.bias === 'long' ? 'long' : 'short';
    if (btcBiasAsDirection !== result.bias) {
      warnings.push(`BTC context is ${btcContext.bias} — this trade is counter-BTC direction`);
      adjustedConfidence = Math.max(adjustedConfidence - 15, 0);
      adjustedSizeMultiplier *= 0.75;
    }
  }

  // ── Rule 6: Wyckoff — never front-run Spring ──────────────
  if (primitives.wyckoff && primitives.wyckoff.phase === 'C' && !primitives.wyckoff.spring_confirmed) {
    if (result.bias === 'long') {
      rejectionReason = 'Wyckoff Phase C: Spring not confirmed — cannot enter long before Spring';
      return {
        approved: false,
        rejection_reason: rejectionReason,
        warnings,
        adjusted_confidence: adjustedConfidence,
        adjusted_size_multiplier: 0,
      };
    }
  }

  // ── Rule 7: Distribution with long signal ─────────────────
  if (primitives.wyckoff?.utad_risk && result.bias === 'long') {
    warnings.push('UTAD risk detected — distribution may be in progress, long setup is high risk');
    adjustedConfidence = Math.max(adjustedConfidence - 25, 0);
    adjustedSizeMultiplier *= 0.25;
  }

  // ── Rule 8: Neutral bias always rejected ─────────────────
  if (result.bias === 'neutral') {
    return {
      approved: false,
      rejection_reason: 'LLM returned neutral bias — no trade',
      warnings,
      adjusted_confidence: adjustedConfidence,
      adjusted_size_multiplier: 0,
    };
  }

  // ── Rule 9: Stop loss cannot be zero ─────────────────────
  if (!result.stop_loss || result.stop_loss === 0) {
    rejectionReason = 'Stop loss is zero — invalid trade parameters';
    return {
      approved: false,
      rejection_reason: rejectionReason,
      warnings,
      adjusted_confidence: adjustedConfidence,
      adjusted_size_multiplier: 0,
    };
  }

  // ── Rule 10: Size scaling by confidence ──────────────────
  if (adjustedConfidence < MIN_CONFIDENCE_FULL_SIZE) {
    const scaleFactor = adjustedConfidence / MIN_CONFIDENCE_FULL_SIZE;
    adjustedSizeMultiplier = Math.min(adjustedSizeMultiplier, Math.max(0.25, scaleFactor));
    warnings.push(`Reduced size to ${(adjustedSizeMultiplier * 100).toFixed(0)}% due to confidence ${adjustedConfidence}`);
  }

  // ── Rule 11: ChoCH vs BOS size scaling ───────────────────
  // BOS = confirmed structure break (full size), ChoCH = early signal (reduced size)
  if (primitives.smart_money.choch && !primitives.smart_money.bos) {
    warnings.push('ChoCH detected but no BOS confirmation — reduced size');
    adjustedSizeMultiplier = Math.min(adjustedSizeMultiplier, 0.5);
  }

  // ── Final check: re-confirm confidence after adjustments ──
  if (adjustedConfidence < MIN_CONFIDENCE_TO_EXECUTE) {
    rejectionReason = `Adjusted confidence ${adjustedConfidence} fell below minimum after risk adjustments`;
    return {
      approved: false,
      rejection_reason: rejectionReason,
      warnings,
      adjusted_confidence: adjustedConfidence,
      adjusted_size_multiplier: 0,
    };
  }

  return {
    approved: true,
    warnings,
    adjusted_confidence: adjustedConfidence,
    adjusted_size_multiplier: parseFloat(adjustedSizeMultiplier.toFixed(2)),
  };
}

// ─── Quick confidence-only check (for pre-filtering) ─────────
export function meetsMinimumThreshold(result: ChartAnalysisResult): boolean {
  return result.confidence >= MIN_CONFIDENCE_TO_EXECUTE
    && result.bias !== 'neutral'
    && result.risk_reward >= 1.5;
}





intelligence.controller.ts


// ============================================================
// intelligence.controller.ts
// REST handlers for the Intelligence Scanner endpoints
// ============================================================

import { Request, Response } from 'express';
import { runIntelligenceScan, getCoinCard } from '../services/intelligence.service';
import { IntelligenceScan } from '../agents/chartAnalysis.types';

// In-memory cache for the latest scan (Redis in production)
let cachedScan: IntelligenceScan | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ─── GET /api/intelligence/scan ───────────────────────────────
// Returns the latest full intelligence scan
export async function getLatestScan(req: Request, res: Response): Promise<void> {
  try {
    const now = Date.now();
    const forceRefresh = req.query.refresh === 'true';

    // Serve from cache if fresh
    if (!forceRefresh && cachedScan && (now - cacheTimestamp) < CACHE_TTL_MS) {
      res.json({ success: true, data: cachedScan, cached: true });
      return;
    }

    // Run fresh scan
    const scan = await runIntelligenceScan();
    cachedScan = scan;
    cacheTimestamp = now;

    res.json({ success: true, data: scan, cached: false });
  } catch (err) {
    console.error('[IntelligenceController] getLatestScan error:', err);
    res.status(500).json({ success: false, error: 'Intelligence scan failed' });
  }
}

// ─── GET /api/intelligence/coin/:symbol ──────────────────────
// Returns single coin intelligence card (with latest BTC context)
export async function getCoinIntelligence(req: Request, res: Response): Promise<void> {
  try {
    const { symbol } = req.params;
    if (!symbol) {
      res.status(400).json({ success: false, error: 'Symbol required' });
      return;
    }

    const btcContext = cachedScan?.btc_context;
    const card = await getCoinCard(symbol.toUpperCase(), btcContext);

    if (!card) {
      res.status(404).json({ success: false, error: `No data for ${symbol}` });
      return;
    }

    res.json({ success: true, data: card });
  } catch (err) {
    console.error('[IntelligenceController] getCoinIntelligence error:', err);
    res.status(500).json({ success: false, error: 'Coin analysis failed' });
  }
}

// ─── GET /api/intelligence/cascade ───────────────────────────
// Returns only the cascade map (lightweight endpoint for real-time updates)
export async function getCascadeMap(req: Request, res: Response): Promise<void> {
  try {
    if (!cachedScan) {
      res.status(404).json({ success: false, error: 'No scan available yet. Call /scan first.' });
      return;
    }

    const cascadeData = {
      scan_id: cachedScan.scan_id,
      generated_at: cachedScan.generated_at,
      btc_signal: {
        type: cachedScan.btc_context.signal_type,
        fired_at: cachedScan.btc_context.signal_fired_at,
        bias: cachedScan.btc_context.bias,
      },
      windows_open: cachedScan.windows_open,
      coins: cachedScan.coins.map(c => ({
        symbol: c.coin,
        cascade_status: c.cascade.status,
        window_remaining_minutes: c.cascade.window_remaining_minutes,
        expected_move_pct: c.cascade.expected_move_pct,
        historical_follow_rate: c.cascade.historical_follow_rate,
        opportunity_score: c.opportunity_score,
        current_price: c.current_price,
        price_change_24h: c.price_change_24h,
      })),
    };

    res.json({ success: true, data: cascadeData });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Cascade map retrieval failed' });
  }
}

// ─── GET /api/intelligence/top ───────────────────────────────
// Returns top N opportunities
export async function getTopOpportunities(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 5;

    if (!cachedScan) {
      const scan = await runIntelligenceScan();
      cachedScan = scan;
      cacheTimestamp = Date.now();
    }

    const top = cachedScan.top_opportunities.slice(0, limit);
    res.json({ success: true, data: top, total_windows_open: cachedScan.windows_open });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get top opportunities' });
  }
}

// ─── POST /api/intelligence/trigger ──────────────────────────
// Manually trigger a new scan (for testing / on-demand)
export async function triggerScan(req: Request, res: Response): Promise<void> {
  try {
    const scan = await runIntelligenceScan();
    cachedScan = scan;
    cacheTimestamp = Date.now();
    res.json({
      success: true,
      message: 'Scan complete',
      scan_id: scan.scan_id,
      coins_analyzed: scan.total_analyzed,
      windows_open: scan.windows_open,
      top_coins: scan.top_opportunities.slice(0, 3).map(c => c.coin),
    });
  } catch (err) {
    console.error('[IntelligenceController] triggerScan error:', err);
    res.status(500).json({ success: false, error: 'Scan trigger failed' });
  }
}

intelligence.routes.ts

// ============================================================
// intelligence.routes.ts
// Express router for the Intelligence Scanner API
// Mount in routes/index.ts: app.use('/api/intelligence', intelligenceRouter)
// ============================================================

import { Router } from 'express';
import {
  getLatestScan,
  getCoinIntelligence,
  getCascadeMap,
  getTopOpportunities,
  triggerScan,
} from '../controllers/intelligence.controller';
import { auth } from '../middleware/auth'; // existing auth middleware

const router = Router();

// All intelligence routes require authentication
router.use(auth);

// ─── Scan Endpoints ───────────────────────────────────────────
router.get('/scan',       getLatestScan);         // GET  /api/intelligence/scan?refresh=true
router.post('/trigger',   triggerScan);            // POST /api/intelligence/trigger
router.get('/top',        getTopOpportunities);    // GET  /api/intelligence/top?limit=5
router.get('/cascade',    getCascadeMap);          // GET  /api/intelligence/cascade

// ─── Coin Endpoints ───────────────────────────────────────────
router.get('/coin/:symbol', getCoinIntelligence);  // GET  /api/intelligence/coin/SOL

export default router;
































===========================================================
SESSION 02
===========================================================


regimeDetector.service.ts
// ============================================================
// regimeDetector.service.ts
// Fast regime detection with Redis caching
// Called before full LLM analysis to gate which skills to run
// ⬜ TODO: implement function bodies
// ============================================================

import { Candle, MarketRegime } from '../agents/chartAnalysis.types';
import { computeAllIndicators } from '../agents/skills/indicators.skill';
import { detectTrend, extractZigZagPivots, buildVolumeProfile } from '../agents/skills/structure.skill';
import { detectWyckoffRange } from '../agents/skills/wyckoff.skill';
import { ohlcvIngest } from '../read/ingestion/ohlcv.ingest';

// Redis client — reuse from your existing redis.ts singleton
// import { redisClient } from '../config/redis';

const REGIME_CACHE_TTL_SECONDS = 300; // 5 min
const ADX_TRENDING_THRESHOLD = 25;
const ADX_RANGING_THRESHOLD  = 20;

// ─── Key logic guide ─────────────────────────────────────────
// ADX > 25  → trending_up or trending_down (check EMA slope)
// ADX < 20  → ranging
// Wyckoff Phase A/B/C (accumulation) → 'accumulation'
// Wyckoff Phase B/C (distribution/BCLX) → 'distribution'
// Price > all-time high area (no resistance overhead) → 'price_discovery'
// Fallback: use detectTrend() from structure.skill

export async function detectRegime(
  symbol: string,
  candles: Candle[]
): Promise<MarketRegime> {
  // TODO: implement
  // 1. computeAllIndicators(candles) → check adx
  // 2. detectWyckoffRange(candles) → check phase
  // 3. detectTrend(candles) → fallback
  // 4. map to MarketRegime
  // 5. cacheRegime(symbol, regime) before returning
  throw new Error('detectRegime not yet implemented');
}

export async function getCachedRegime(
  symbol: string
): Promise<MarketRegime | null> {
  // TODO: redisClient.get(`regime:${symbol}`) → parse → return MarketRegime | null
  return null;
}

export async function cacheRegime(
  symbol: string,
  regime: MarketRegime
): Promise<void> {
  // TODO: redisClient.set(`regime:${symbol}`, regime, { EX: REGIME_CACHE_TTL_SECONDS })
}

// Convenience: fetch candles + detect regime in one call
export async function detectRegimeForSymbol(symbol: string): Promise<MarketRegime> {
  const cached = await getCachedRegime(symbol);
  if (cached) return cached;

  const result = await ohlcvIngest.fetch({ symbol, timeframe: '4h', limit: 100 });
  return detectRegime(symbol, result.candles);
}

============================

regimeDetector.prompt.ts


// ============================================================
// regimeDetector.prompt.ts
// Lightweight prompt for fast regime classification
// No tool use — single-turn, returns one of 6 regime strings
// ⬜ TODO: write the actual prompt content
// ============================================================

// Used in regimeDetector.service.ts when ADX/Wyckoff is ambiguous
// and a quick LLM pass is cheaper than running all skills
export const REGIME_DETECTOR_SYSTEM_PROMPT = `
You are a market regime classifier. You receive a summary of recent price action and indicators.
Return ONLY one of these exact strings (no JSON, no explanation):
trending_up | trending_down | ranging | accumulation | distribution | price_discovery

Rules:
- trending_up: price above rising EMAs, higher highs + higher lows, ADX > 25
- trending_down: price below falling EMAs, lower highs + lower lows, ADX > 25
- ranging: price oscillating between defined S/R, ADX < 20, no clear direction
- accumulation: Wyckoff Phase B/C with selling climax evidence and low volume pullbacks
- distribution: Wyckoff with buying climax and UTAD risk signals, high volume at highs
- price_discovery: price at or above all-time high, no overhead resistance, momentum driven

// TODO: expand with more detailed regime indicators and examples
`;

// Regime → which skills are highest priority
// Used by policy.engine.ts REGIME_TO_SKILLS mapping
export const REGIME_TO_SKILLS: Record<string, string[]> = {
  trending_up:      ['smartMoney', 'elliott', 'multiTimeframe'],
  trending_down:    ['smartMoney', 'elliott', 'multiTimeframe'],
  ranging:          ['wyckoff', 'pivots', 'fibonacci', 'harmonics'],
  accumulation:     ['wyckoff', 'smartMoney', 'fibonacci'],
  distribution:     ['wyckoff', 'smartMoney', 'harmonics'],
  price_discovery:  ['fibonacci', 'elliott', 'smartMoney'],
};


===========================================
orderBlock.service.ts


// ============================================================
// orderBlock.service.ts
// OB lifecycle management: active → mitigated tracking across ticks
// Persists to MongoDB. Diffs against DB on each scanner tick.
// ⬜ TODO: implement function bodies
// ============================================================

import { Candle, OrderBlock } from '../agents/chartAnalysis.types';
import {
  detectOrderBlocks,
  detectBullishOrderBlocks,
  detectBearishOrderBlocks,
} from '../agents/skills/smartMoney.skill';
import { ohlcvIngest } from '../read/ingestion/ohlcv.ingest';
// import { OrderBlockModel } from '../models/orderBlock.model';  ← uncomment when model exists

const PRICE_TOLERANCE_PCT = 0.005; // 0.5% — OB is "near" if within this range

// ─── Sync OBs for a symbol (called each tick) ────────────────
// 1. Fetch fresh candles
// 2. Re-run detectOrderBlocks
// 3. Diff against DB: new OBs → insert, mitigated OBs → update status
// Returns the current active OBs
export async function syncOrderBlocks(
  symbol: string,
  candles?: Candle[]
): Promise<OrderBlock[]> {
  // TODO: implement
  // const freshCandles = candles ?? (await ohlcvIngest.fetch({ symbol, timeframe: '4h', limit: 200 })).candles;
  // const detected = detectOrderBlocks(freshCandles, '4H');
  // const existing = await OrderBlockModel.find({ symbol, status: 'active' });
  // diff + upsert
  throw new Error('syncOrderBlocks not yet implemented');
}

// ─── Get active OBs from DB ───────────────────────────────────
export async function getActiveOrderBlocks(symbol: string): Promise<OrderBlock[]> {
  // TODO: return OrderBlockModel.find({ symbol, status: 'active' }).sort({ origin_timestamp: -1 })
  return [];
}

// ─── Mark an OB as mitigated ─────────────────────────────────
export async function markMitigated(id: string): Promise<void> {
  // TODO: OrderBlockModel.findOneAndUpdate({ id }, { status: 'mitigated', mitigated_at: new Date() })
}

// ─── Find OBs near a given price ─────────────────────────────
export async function getOrderBlocksNearPrice(
  symbol: string,
  price: number,
  tolerancePct = PRICE_TOLERANCE_PCT
): Promise<OrderBlock[]> {
  // TODO: get all active OBs for symbol, filter where:
  // price >= ob.low * (1 - tolerancePct) && price <= ob.high * (1 + tolerancePct)
  return [];
}

// ─── Get the nearest unmitigated OB above/below price ────────
export async function getNearestOrderBlock(
  symbol: string,
  price: number,
  direction: 'above' | 'below'
): Promise<OrderBlock | null> {
  const active = await getActiveOrderBlocks(symbol);
  if (direction === 'above') {
    const above = active.filter(ob => ob.low > price).sort((a, b) => a.low - b.low);
    return above[0] ?? null;
  }
  const below = active.filter(ob => ob.high < price).sort((a, b) => b.high - a.high);
  return below[0] ?? null;
}





























chartAnalysis.tools.ts

// ============================================================
// chartAnalysis.tools.ts
// Anthropic tool definitions for agentic chart analysis drill-down
// The LLM can call these tools to get more granular data
// ⬜ TODO: implement tool handler functions (tool definitions are complete)
// ============================================================

import { Tool } from '@anthropic-ai/sdk/resources/messages';
import { Candle } from '../chartAnalysis.types';
import { detectSupportResistance, extractZigZagPivots, buildVolumeProfile } from '../skills/structure.skill';
import { computeAllIndicators } from '../skills/indicators.skill';
import { calculateFibonacciLevels, findFibClusters } from '../skills/fibonacci.skill';
import { calculateStandardPivots, calculateCamarillaPivots } from '../skills/pivots.skill';
import { detectHarmonicPatterns } from '../skills/harmonics.skill';
import { buildMultiTimeframeContext } from '../skills/multiTimeframe.skill';
import { calculateIchimoku, calculateVWAP } from '../skills/indicators.skill';

// ─── Tool Definitions (send to Anthropic API) ────────────────
export const CHART_ANALYSIS_TOOLS: Tool[] = [
  {
    name: 'analyze_market_structure',
    description: 'Runs full market structure analysis on a symbol: S/R zones, volume profile, trend. Returns key_levels, vpoc, vah, val, trend.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'e.g. BTCUSDT' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d'], description: 'Candle timeframe' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_market_pivots',
    description: 'Returns ZigZag swing pivots for the symbol. Useful for Elliott wave and harmonic counting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d'] },
        threshold: { type: 'number', description: 'ZigZag threshold 0.01-0.1, default 0.03' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_htf_context',
    description: 'Returns multi-timeframe bias analysis (1W/1D/4H/1H/15M). Use to check HTF/LTF confluence.',
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
    description: 'Runs harmonic pattern detection (Gartley, Bat, Butterfly, Crab, Cypher). Returns patterns with PRZ zones.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d'] },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_confluence_zones',
    description: 'Finds price levels where multiple indicators overlap (S/R + OB + Fib + Pivot). Returns zones ranked by number of confluences.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d'] },
        tolerance_pct: { type: 'number', description: 'Clustering tolerance, default 0.01 (1%)' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_pivot_points',
    description: 'Returns Standard and Camarilla pivot points (PP, R1-R3, S1-S3) for the symbol.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d'] },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_ichimoku_detail',
    description: 'Returns full Ichimoku Cloud reading: Tenkan, Kijun, Senkou A/B, Chikou, cloud color, TK cross, price vs cloud.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d'] },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_vwap_bands',
    description: 'Returns VWAP with 1σ and 2σ standard deviation bands. Identifies mean reversion zones.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d'] },
      },
      required: ['symbol'],
    },
  },
];

// ─── Tool Handlers ────────────────────────────────────────────
// Each handler takes the tool input and returns a JSON-serializable result.
// Wire these into your agentic loop's tool_use block handler.

export async function handleChartAnalysisTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  candleCache: Map<string, Candle[]>  // pass in your fetched candles to avoid re-fetching
): Promise<unknown> {
  // TODO: implement each case
  // switch (toolName) {
  //   case 'analyze_market_structure': { ... }
  //   case 'get_market_pivots': { ... }
  //   case 'get_htf_context': { ... }
  //   case 'detect_harmonic_setup': { ... }
  //   case 'get_confluence_zones': { ... }
  //   case 'get_pivot_points': { ... }
  //   case 'get_ichimoku_detail': { ... }
  //   case 'get_vwap_bands': { ... }
  // }
  throw new Error(`Tool handler not implemented: ${toolName}`);
}


==============================
regimeDetector.service.ts

// ============================================================
// orderBlock.schema.ts
// Mongoose schema for Order Block zones
// ✅ COMPLETE — do NOT regenerate
// Imported by: orderBlock.model.ts
// ============================================================

import { Schema } from 'mongoose';

const FairValueGapSubSchema = new Schema({
  high:      { type: Number, required: true },
  low:       { type: Number, required: true },
  timestamp: { type: Number, required: true },
  filled:    { type: Boolean, default: false },
  type:      { type: String, enum: ['bullish', 'bearish'], required: true },
}, { _id: false });

export const OrderBlockSchema = new Schema(
  {
    id:               { type: String, required: true, unique: true, index: true },
    symbol:           { type: String, required: true, index: true },
    type:             { type: String, enum: ['bullish', 'bearish'], required: true },
    high:             { type: Number, required: true },
    low:              { type: Number, required: true },
    origin_timestamp: { type: Number, required: true },
    timeframe:        { type: String, required: true, default: '4H' },
    status:           { type: String, enum: ['active', 'mitigated', 'broken'], default: 'active', index: true },
    strength:         { type: Number, min: 0, max: 100, default: 50 },
    associated_fvg:   { type: FairValueGapSubSchema, default: null },
    mitigated_at:     { type: Date, default: null },
  },
  {
    timestamps: true,   // adds createdAt, updatedAt
    collection: 'orderblocks',
  }
);

// Compound index: most common query pattern
OrderBlockSchema.index({ symbol: 1, status: 1, origin_timestamp: -1 });
OrderBlockSchema.index({ symbol: 1, low: 1, high: 1 }); // for price range queries



=============================================
orderBlock.service.ts

// ============================================================
// orderBlock.service.ts
// OB lifecycle management: active → mitigated tracking across ticks.
// Persists to MongoDB. Diffs against DB on each scheduler tick.
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { Candle, OrderBlock } from '../agents/chartAnalysis.types';
import {
  detectOrderBlocks,
  detectBullishOrderBlocks,
  detectBearishOrderBlocks,
} from '../agents/skills/smartMoney.skill';
import { ohlcvIngest } from '../read/ingestion/ohlcv.ingest';
// Uncomment when model is created (Session B models):
// import OrderBlockModel from '../models/orderBlock.model';

const PRICE_TOLERANCE_PCT = 0.005; // 0.5% — OB is "near" if within this range

// ─── Sync OBs for a symbol (called each scheduler tick) ──────
// 1. Detect fresh OBs from candles
// 2. Diff vs DB active OBs — insert new, mark mitigated where price traded through
// Returns current active OBs
export async function syncOrderBlocks(
  symbol: string,
  candles?: Candle[]
): Promise<OrderBlock[]> {
  const freshCandles = candles
    ?? (await ohlcvIngest.fetch({ symbol, timeframe: '4h', limit: 200 })).candles;

  const detected = detectOrderBlocks(freshCandles, '4H');

  // TODO: uncomment and replace in-memory logic with DB when OrderBlockModel exists
  // const existing = await OrderBlockModel.find({ symbol, status: 'active' }).lean();
  // const existingIds = new Set(existing.map((ob: any) => ob.id));
  // const newOBs = detected.filter(ob => !existingIds.has(ob.id));
  // if (newOBs.length > 0) {
  //   await OrderBlockModel.insertMany(newOBs.map(ob => ({ ...ob, symbol })));
  // }
  // // Check for mitigations: current price traded through any active OB
  // const currentPrice = freshCandles[freshCandles.length - 1].close;
  // for (const ob of existing) {
  //   if (currentPrice >= ob.low && currentPrice <= ob.high) {
  //     await OrderBlockModel.findOneAndUpdate({ id: ob.id }, { status: 'mitigated', mitigated_at: new Date() });
  //   }
  // }
  // return (await OrderBlockModel.find({ symbol, status: 'active' }).lean()) as OrderBlock[];

  return detected;
}

// ─── Get active OBs from DB ───────────────────────────────────
export async function getActiveOrderBlocks(symbol: string): Promise<OrderBlock[]> {
  // TODO: return OrderBlockModel.find({ symbol, status: 'active' }).sort({ origin_timestamp: -1 }).lean();
  const result = await ohlcvIngest.fetch({ symbol, timeframe: '4h', limit: 200 });
  return detectOrderBlocks(result.candles, '4H');
}

// ─── Mark an OB as mitigated ─────────────────────────────────
export async function markMitigated(id: string): Promise<void> {
  // TODO: await OrderBlockModel.findOneAndUpdate({ id }, { status: 'mitigated', mitigated_at: new Date() });
  console.log(`[OrderBlockService] markMitigated called for id: ${id} (DB not yet wired)`);
}

// ─── Find OBs near a given price ─────────────────────────────
export async function getOrderBlocksNearPrice(
  symbol: string,
  price: number,
  tolerancePct = PRICE_TOLERANCE_PCT
): Promise<OrderBlock[]> {
  const active = await getActiveOrderBlocks(symbol);
  return active.filter(ob =>
    price >= ob.low  * (1 - tolerancePct) &&
    price <= ob.high * (1 + tolerancePct)
  );
}

// ─── Get nearest unmitigated OB above/below price ────────────
export async function getNearestOrderBlock(
  symbol: string,
  price: number,
  direction: 'above' | 'below'
): Promise<OrderBlock | null> {
  const active = await getActiveOrderBlocks(symbol);
  if (direction === 'above') {
    const above = active.filter(ob => ob.low > price).sort((a, b) => a.low - b.low);
    return above[0] ?? null;
  }
  const below = active.filter(ob => ob.high < price).sort((a, b) => b.high - a.high);
  return below[0] ?? null;


}


======================================

orderBlock.schema.ts

// ============================================================
// orderBlock.schema.ts
// Mongoose schema for Order Block zones
// ✅ COMPLETE — do NOT regenerate
// Imported by: orderBlock.model.ts
// ============================================================

import { Schema } from 'mongoose';

const FairValueGapSubSchema = new Schema({
  high:      { type: Number, required: true },
  low:       { type: Number, required: true },
  timestamp: { type: Number, required: true },
  filled:    { type: Boolean, default: false },
  type:      { type: String, enum: ['bullish', 'bearish'], required: true },
}, { _id: false });

export const OrderBlockSchema = new Schema(
  {
    id:               { type: String, required: true, unique: true, index: true },
    symbol:           { type: String, required: true, index: true },
    type:             { type: String, enum: ['bullish', 'bearish'], required: true },
    high:             { type: Number, required: true },
    low:              { type: Number, required: true },
    origin_timestamp: { type: Number, required: true },
    timeframe:        { type: String, required: true, default: '4H' },
    status:           { type: String, enum: ['active', 'mitigated', 'broken'], default: 'active', index: true },
    strength:         { type: Number, min: 0, max: 100, default: 50 },
    associated_fvg:   { type: FairValueGapSubSchema, default: null },
    mitigated_at:     { type: Date, default: null },
  },
  {
    timestamps: true,   // adds createdAt, updatedAt
    collection: 'orderblocks',
  }
);

// Compound index: most common query pattern
OrderBlockSchema.index({ symbol: 1, status: 1, origin_timestamp: -1 });
OrderBlockSchema.index({ symbol: 1, low: 1, high: 1 }); // for price range queries



==========================================

marketRegime.schema.ts


// ============================================================
// marketRegime.schema.ts
// Mongoose schema for Market Regime snapshots
// ✅ COMPLETE — do NOT regenerate
// Imported by: marketRegime.model.ts
// ============================================================

import { Schema } from 'mongoose';

export const MarketRegimeSchema = new Schema(
  {
    symbol:        { type: String, required: true, index: true },
    regime: {
      type: String,
      enum: ['trending_up', 'trending_down', 'ranging', 'accumulation', 'distribution', 'price_discovery'],
      required: true,
    },
    detected_at:   { type: Date, required: true, default: Date.now },
    confidence:    { type: Number, min: 0, max: 100, default: 70 },
    adx:           { type: Number, default: 0 },
    wyckoff_phase: { type: String, default: 'unknown' },
    timeframe:     { type: String, default: '4h' },
  },
  {
    timestamps: true,
    collection: 'marketregimes',
  }
);

// Get latest regime per symbol quickly
MarketRegimeSchema.index({ symbol: 1, detected_at: -1 });
// TTL index: auto-expire old regime snapshots after 24h
MarketRegimeSchema.index({ detected_at: 1 }, { expireAfterSeconds: 86400 });




this is the current progress, and a full plan,  now you will generate a file structure base on what is already existed, and you will generate some files that are chained and important to a plan as progress, to prevent dependency error or undefined imports, note, file structure, aligned files, and provide materials to make it ready more to integrate to promps from claude next session easily without remembering it  | additionally create a summary of whats created and next session to create also make a hints of how it will be linked to hte previous one so next session will be easy
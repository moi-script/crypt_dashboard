import { apiClient } from "./api.client";

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id:    string;
  email: string;
}

export interface AuthTokens {
  user:         AuthUser;
  accessToken:  string;
  refreshToken: string;
}

export const authService = {
  register: (email: string, password: string) =>
    apiClient.post<AuthTokens>("/auth/register", { email, password }),

  login: (email: string, password: string) =>
    apiClient.post<AuthTokens>("/auth/login", { email, password }),

  refresh: (refreshToken: string) =>
    apiClient.post<{ accessToken: string; refreshToken: string }>("/auth/refresh", { refreshToken }),

  me: () =>
    apiClient.get<AuthUser & { createdAt: string }>("/auth/me"),

  logout: (refreshToken: string) =>
    apiClient.post<{ ok: boolean }>("/auth/logout", { refreshToken }),
};

// ── Chart Analysis ────────────────────────────────────────────────────────────

export type MarketRegime =
  | "trending_up"
  | "trending_down"
  | "ranging"
  | "accumulation"
  | "distribution"
  | "price_discovery";

export type Bias = "long" | "short" | "neutral";

export interface ChartAnalysis {
  regime:            MarketRegime;
  bias:              Bias;
  primary_framework: string;
  setup_name:        string;
  entry_zone:        { high: number; low: number };
  stop_loss:         number;
  take_profit_levels: number[];
  risk_reward:       number;
  confidence:        number;
  invalidation:      string;
  reasoning:         string;
  framework_scores:  Record<string, number>;
  confluence_score:  number;
  confluence_factors: string[];
}

export interface RiskResult {
  approved:            boolean;
  adjusted_confidence: number;
  adjusted_size_mult:  number;
  warnings:            string[];
  rejection_reason?:   string;
}

export interface AnalyzeResponse {
  success: boolean;
  data: {
    primitives_meta: {
      symbol:               string;
      timeframes_analyzed:  string[];
      generated_at:         string;
      token_count_estimate: number;
    };
    analysis: ChartAnalysis;
    risk:     RiskResult;
  };
}

export interface HistoryRecord extends ChartAnalysis {
  _id:                 string;
  symbol:              string;
  risk_approved:       boolean;
  adjusted_confidence: number;
  adjusted_size_mult:  number;
  risk_warnings:       string[];
  risk_rejection:      string | null;
  analyzed_at:         string;
  timeframes_used:     string[];
  btc_bias_at_time:    Bias | null;
  createdAt:           string;
}

export interface PrimitivesResponse {
  success: boolean;
  data: {
    meta: {
      symbol:               string;
      timeframes_analyzed:  string[];
      generated_at:         string;
      token_count_estimate: number;
    };
    indicators: {
      rsi_14:    number;
      macd:      { value: number; signal: number; histogram: number; cross: string };
      stoch:     { k: number; d: number; state: string };
      adx:       number;
      ichimoku:  Record<string, unknown>;
      vwap:      { value: number; upper_band_1: number; lower_band_1: number; price_vs_vwap: string };
      obv_trend: string;
      cmf:       number;
      mfi:       number;
      cci:       number;
      atr_14:    number;
      bb:        { upper: number; mid: number; lower: number; squeeze: boolean; percent_b: number };
      williams_r: number;
    };
    structure: {
      trend_htf:  string;
      trend_ltf:  string;
      key_levels: { price: number; type: string; strength: string; touches: number }[];
      vpoc:       number;
      vah:        number;
      val:        number;
    };
    smart_money: {
      order_blocks:      { price_high: number; price_low: number; type: string; status: string; timeframe: string }[];
      fvgs:              { high: number; low: number; timestamp: number; filled: boolean; type: string }[];
      bos:               { direction: string; level: number; timestamp: number; type: string; confirmed: boolean } | null;
      choch:             unknown | null;
      liquidity_sweeps:  { level: number; swept: boolean; timestamp: number; candles_ago: number; type: string }[];
    };
    fibonacci:  unknown | null;
    wyckoff:    { phase: string; last_event: string; spring_confirmed: boolean; utad_risk: boolean; range_high: number; range_low: number; summary: string } | null;
    elliott:    { wave_count: string; confidence: number; rules_failed: string[] } | null;
    harmonics:  unknown | null;
    mtfa: {
      "1D":         { bias: string; structure: string; key_level: number; at_level: boolean; regime: string };
      "4H":         { bias: string; structure: string; key_level: number; at_level: boolean; regime: string };
      "1H":         { bias: string; structure: string; key_level: number; at_level: boolean; regime: string };
      overall_bias: string;
      htf_overrides_ltf: boolean;
      confluence_note:   string;
    } | null;
  };
}

export const chartService = {
  analyze: (symbol: string) =>
    apiClient.post<AnalyzeResponse>(`/chart/analyze/${symbol}`, {}),

  history: (symbol: string, limit = 10) =>
    apiClient.get<{ success: boolean; data: HistoryRecord[]; count: number }>(
      `/chart/history/${symbol}?limit=${limit}`,
    ),

  primitives: (symbol: string) =>
    apiClient.get<PrimitivesResponse>(`/chart/primitives/${symbol}`),
};

// ── Order Blocks ──────────────────────────────────────────────────────────────

export interface OrderBlock {
  _id:              string;
  id:               string;
  symbol:           string;
  type:             "bullish" | "bearish";
  high:             number;
  low:              number;
  origin_timestamp: number;
  timeframe:        string;
  status:           "active" | "mitigated" | "broken";
  strength:         number;
  associated_fvg:   { high: number; low: number; timestamp: number; filled: boolean; type: string } | null;
  mitigated_at:     string | null;
  createdAt:        string;
}

export const orderBlockService = {
  active: (symbol: string) =>
    apiClient.get<{ success: boolean; data: OrderBlock[]; count: number }>(
      `/orderblocks/active/${symbol}`,
    ),

  near: (symbol: string, price: number, tolerance = 0.005) =>
    apiClient.get<{ success: boolean; data: OrderBlock[]; count: number }>(
      `/orderblocks/near/${symbol}/${price}?tolerance=${tolerance}`,
    ),

  nearest: (symbol: string, price: number, direction: "above" | "below") =>
    apiClient.get<{ success: boolean; data: OrderBlock | null }>(
      `/orderblocks/nearest/${symbol}/${price}/${direction}`,
    ),

  sync: (symbol: string) =>
    apiClient.post<{ success: boolean; data: OrderBlock[]; count: number; synced_at: string }>(
      `/orderblocks/sync/${symbol}`, {},
    ),

  mitigate: (id: string) =>
    apiClient.patch<{ success: boolean; message: string }>(
      `/orderblocks/mitigate/${id}`, {},
    ),
};

// ── Intelligence Scanner ──────────────────────────────────────────────────────

export type CascadeStatus =
  | "window_open"
  | "reacting_now"
  | "reacted"
  | "decorrelated"
  | "leading";

export interface CascadeEntry {
  coin:                    string;
  status:                  CascadeStatus;
  btc_signal_ts:           string;
  coin_reaction_ts?:       string;
  minutes_elapsed:         number;
  expected_window_hours:   number;
  window_remaining_minutes: number;
  expected_move_pct:       number;
  historical_follow_rate:  number;
}

export interface CoinIntelligenceCard {
  coin:                      string;
  symbol:                    string;
  current_price:             number;
  price_change_24h:          number;
  cascade:                   CascadeEntry;
  confluence_score:          number;
  confluence_factors:        string[];
  analysis:                  ChartAnalysis;
  correlation: {
    coin:             string;
    vs:               string;
    correlation_30d:  number;
    beta_30d:         number;
    lag_hours:        number;
    is_leading:       boolean;
    is_lagging:       boolean;
  };
  historical_setup_accuracy: number;
  historical_sample_size:    number;
  opportunity_score:         number;
  last_updated:              string;
}

export interface IntelligenceScan {
  scan_id:          string;
  generated_at:     string;
  btc_context: {
    regime:             MarketRegime;
    bias:               Bias;
    signal_fired_at:    string;
    signal_type:        string;
    bos_direction?:     string;
    bos_level?:         number;
    dominance: {
      btc_dominance:   number;
      eth_dominance:   number;
      others_dominance: number;
      btc_d_trend:     string;
      market_phase:    string;
      sector_leaders:  string[];
    };
    minutes_since_signal: number;
  };
  dominance:        IntelligenceScan["btc_context"]["dominance"];
  market_phase:     string;
  coins:            CoinIntelligenceCard[];
  total_analyzed:   number;
  windows_open:     number;
  top_opportunities: CoinIntelligenceCard[];
}

export interface CascadeMap {
  scan_id:      string;
  generated_at: string;
  btc_signal: {
    type:     string;
    fired_at: string;
    bias:     Bias;
  };
  windows_open: number;
  coins: {
    symbol:                  string;
    cascade_status:          CascadeStatus;
    window_remaining_minutes: number;
    expected_move_pct:       number;
    historical_follow_rate:  number;
    opportunity_score:       number;
    current_price:           number;
    price_change_24h:        number;
  }[];
}

// Lightweight metadata for a persisted scan (GET /intelligence/history)
export interface ScanHistoryEntry {
  scan_id:        string;
  generated_at:   string;
  market_phase:   string;
  total_analyzed: number;
  windows_open:   number;
  coin_count:     number;
  btc_regime:     string | null;
  btc_bias:       Bias | null;
}

export const intelligenceService = {
  scan: (refresh = false) =>
    apiClient.get<{ success: boolean; data: IntelligenceScan; cached: boolean }>(
      `/intelligence/scan${refresh ? "?refresh=true" : ""}`,
    ),

  history: (limit = 20) =>
    apiClient.get<{ success: boolean; data: ScanHistoryEntry[]; count: number }>(
      `/intelligence/history?limit=${limit}`,
    ),

  getScan: (scanId: string) =>
    apiClient.get<{ success: boolean; data: IntelligenceScan }>(
      `/intelligence/scan/${scanId}`,
    ),

  trigger: () =>
    apiClient.post<{ success: boolean; message: string; scan_id: string; coins_analyzed: number; windows_open: number }>(
      "/intelligence/trigger", {},
    ),

  top: (limit = 5) =>
    apiClient.get<{ success: boolean; data: CoinIntelligenceCard[]; total_windows_open: number }>(
      `/intelligence/top?limit=${limit}`,
    ),

  cascade: () =>
    apiClient.get<{ success: boolean; data: CascadeMap }>("/intelligence/cascade"),

  coin: (symbol: string) =>
    apiClient.get<{ success: boolean; data: CoinIntelligenceCard }>(`/intelligence/coin/${symbol}`),
};
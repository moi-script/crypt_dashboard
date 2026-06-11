// ============================================================
// strategy.types.ts
// Shared types for strategy output — used by all chart strategy files.
// Separate from the existing strategy.types.ts in the root strategies/
// folder which defines the Strategy/StrategyResult for the agent loop.
// ✅ COMPLETE — do NOT regenerate
// ============================================================

export interface TradeSignal {
  symbol:              string;
  framework:           'SmartMoney' | 'Wyckoff' | 'ElliottWave' | 'Harmonic';
  bias:                'long' | 'short';
  setup_name:          string;
  entry_zone:          { high: number; low: number };
  stop_loss:           number;
  take_profit_levels:  number[];
  risk_reward:         number;
  confidence:          number;       // 0–100
  invalidation:        string;
  reasoning:           string;
  confluence_factors:  string[];
  generated_at:        string;       // ISO timestamp
}

export interface ChartStrategyResult {
  signal:       TradeSignal | null;
  skipped:      boolean;
  skip_reason?: string;
}
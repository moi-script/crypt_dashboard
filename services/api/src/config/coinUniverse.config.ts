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




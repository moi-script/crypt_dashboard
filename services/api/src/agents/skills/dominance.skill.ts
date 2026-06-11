
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

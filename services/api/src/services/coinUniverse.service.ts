
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
  OPPORTUNITY_SCORE_WEIGHTS,
  MIN_OPPORTUNITY_SCORE_THRESHOLD,
  DEFAULT_BETA,
  DEFAULT_LAG_HOURS,
} from '../config/coinUniverse.config';
import { CoinTier } from '../agents/chartAnalysis.types';
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





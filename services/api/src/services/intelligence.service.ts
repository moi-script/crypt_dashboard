
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
import { nanoid } from 'nanoid';
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



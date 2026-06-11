
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



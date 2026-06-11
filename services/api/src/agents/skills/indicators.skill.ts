
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



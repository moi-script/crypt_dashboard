export interface Coin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  rank?: number;
  image?: string;
  /** short price history for inline sparklines (most recent last) */
  sparkline?: number[];
}

export interface OHLCVBar {
  time: number; // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type OHLCVRange = "1D" | "1W" | "1M" | "1Y";

/** Computed technical indicators for one coin at one timestamp. */
export interface Indicator {
  time: number;
  rsi14: number;
  macd: number;
  signal: number;
  sma20: number;
  ema50: number;
  bbUpper: number;
  bbLower: number;
}

export type SignalVerdict = "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";

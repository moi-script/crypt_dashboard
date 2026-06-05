import type { Indicator, SignalVerdict } from "@/models/coin.model";

export interface SignalResult {
  verdict: SignalVerdict;
  score: number; // −100 … +100
  reasons: { label: string; bias: "bull" | "bear" | "flat" }[];
}

export const VERDICT_META: Record<
  SignalVerdict,
  { label: string; tone: "up" | "down" | "warn" }
> = {
  strong_buy: { label: "STRONG BUY", tone: "up" },
  buy: { label: "BUY", tone: "up" },
  neutral: { label: "NEUTRAL", tone: "warn" },
  sell: { label: "SELL", tone: "down" },
  strong_sell: { label: "STRONG SELL", tone: "down" },
};

/** Rule-based score from the latest indicator snapshot + current price. */
export function computeSignal(ind: Indicator | undefined, price?: number): SignalResult {
  if (!ind) return { verdict: "neutral", score: 0, reasons: [] };

  let score = 0;
  const reasons: SignalResult["reasons"] = [];

  // RSI
  if (ind.rsi14 < 30) {
    score += 30;
    reasons.push({ label: `RSI ${ind.rsi14.toFixed(0)} · oversold`, bias: "bull" });
  } else if (ind.rsi14 > 70) {
    score -= 30;
    reasons.push({ label: `RSI ${ind.rsi14.toFixed(0)} · overbought`, bias: "bear" });
  } else {
    reasons.push({ label: `RSI ${ind.rsi14.toFixed(0)} · neutral`, bias: "flat" });
  }

  // MACD vs signal
  if (ind.macd > ind.signal) {
    score += 25;
    reasons.push({ label: "MACD above signal", bias: "bull" });
  } else {
    score -= 25;
    reasons.push({ label: "MACD below signal", bias: "bear" });
  }

  // price vs moving averages
  const ref = price ?? ind.sma20;
  if (ref > ind.ema50) {
    score += 20;
    reasons.push({ label: "Price above EMA-50", bias: "bull" });
  } else {
    score -= 20;
    reasons.push({ label: "Price below EMA-50", bias: "bear" });
  }
  if (ref > ind.sma20) {
    score += 10;
  } else {
    score -= 10;
  }

  // Bollinger position
  if (ref <= ind.bbLower) {
    score += 15;
    reasons.push({ label: "At lower Bollinger band", bias: "bull" });
  } else if (ref >= ind.bbUpper) {
    score -= 15;
    reasons.push({ label: "At upper Bollinger band", bias: "bear" });
  }

  score = Math.max(-100, Math.min(100, score));

  const verdict: SignalVerdict =
    score >= 55 ? "strong_buy"
    : score >= 20 ? "buy"
    : score <= -55 ? "strong_sell"
    : score <= -20 ? "sell"
    : "neutral";

  return { verdict, score, reasons };
}

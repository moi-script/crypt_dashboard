export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string; // ISO timestamp
  summary: string;
  /** −1 (max bearish) … +1 (max bullish) */
  sentiment: number;
  coins: string[]; // coinIds mentioned
  imageUrl?: string;
}

export type SentimentBand = "bullish" | "neutral" | "bearish";

export function sentimentBand(score: number): SentimentBand {
  if (score > 0.15) return "bullish";
  if (score < -0.15) return "bearish";
  return "neutral";
}

import type { TradeSignal } from '@/agents/policy/strategies/strategy.types'
import type { NewsImpact } from '@/agents/coinAnalysis/coinAnalysis.types'

export interface NewsArticleInput {
  title:     string
  summary:   string
  sentiment: number   // stored value; 0 means "not yet scored"
}

const BULLISH_KEYWORDS: string[] = [
  'bullish', 'breakout', 'rally', 'adoption', 'etf', 'ath', 'all-time high',
  'accumulation', 'buy the dip', 'golden cross', 'oversold', 'support held',
  'bounce', 'reversal', 'uptrend', 'higher high', 'higher low', 'momentum',
  'inflow', 'institutional buying', 'spot etf', 'halving', 'approval',
  'listing', 'partnership', 'upgrade', 'mainnet', 'launch', 'record high',
  'price target', 'outperform', 'squeeze', 'short squeeze',
  'cup and handle', 'ascending', 'breakout confirmed', 'demand zone', 'liquidity grab',
]

const BEARISH_KEYWORDS: string[] = [
  'crash', 'ban', 'hack', 'sec', 'lawsuit', 'dump', 'sell-off', 'bearish',
  'breakdown', 'death cross', 'overbought', 'resistance', 'rejection',
  'downtrend', 'lower low', 'lower high', 'outflow', 'capitulation',
  'liquidation', 'regulation', 'crackdown', 'fine', 'exploit', 'rug pull',
  'exit scam', 'bankruptcy', 'insolvency', 'delisting', 'flash crash',
  'panic sell', 'distribution', 'supply zone', 'descending',
  'head and shoulders', 'double top', 'divergence', 'fud', 'fear',
  'whale dump', 'massive sell', 'warning',
]

const SCALE = Math.max(BULLISH_KEYWORDS.length, BEARISH_KEYWORDS.length) / 10

function keywordScore(title: string, summary: string): number {
  const text = `${title} ${summary}`.toLowerCase()
  let score = 0
  for (const kw of BULLISH_KEYWORDS) if (text.includes(kw)) score += 1
  for (const kw of BEARISH_KEYWORDS) if (text.includes(kw)) score -= 1
  return Math.max(-1, Math.min(1, score / SCALE))
}

export function scoreNewsImpact(
  articles: NewsArticleInput[],
  signal:   Pick<TradeSignal, 'bias'> | null,
): NewsImpact {
  if (!articles.length || !signal) {
    return { verdict: 'neutral', confidenceDelta: 0, headlines: [] }
  }

  const top3 = articles.slice(0, 3)
  const headlines = top3.map(a => ({
    title:     a.title,
    sentiment: a.sentiment !== 0 ? a.sentiment : keywordScore(a.title, a.summary),
  }))

  const avg    = headlines.reduce((s, h) => s + h.sentiment, 0) / headlines.length
  const isLong = signal.bias === 'long'

  let verdict:         'supports' | 'contradicts' | 'neutral'
  let confidenceDelta: number

  if (avg > 0.5 && isLong) {
    // Extremely bullish news + long signal = "buy the rumor, sell the news" risk.
    // News may already be priced in — fade the hype, apply a small penalty.
    verdict         = 'contradicts'
    confidenceDelta = -5
  } else if (avg > 0.2) {
    // Moderately bullish — supports long, slight headwind for short
    verdict         = isLong ? 'supports' : 'contradicts'
    // Cap the upside news boost at +8 so it never single-handedly cross a threshold
    confidenceDelta = isLong ? 8 : -8
  } else if (avg < -0.2) {
    // Bearish news — headwind for long, tailwind for short
    verdict         = isLong ? 'contradicts' : 'supports'
    confidenceDelta = isLong ? -10 : 8
  } else {
    verdict         = 'neutral'
    confidenceDelta = 0
  }

  // News reinforces structure — never alone decides a trade.
  // Hard cap: chart signal confidence must be the dominant factor.
  confidenceDelta = Math.max(-10, Math.min(8, confidenceDelta))

  return { verdict, confidenceDelta, headlines }
}

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

  if (avg > 0.2) {
    verdict         = isLong ? 'supports' : 'contradicts'
    confidenceDelta = isLong ? 5 : -10
  } else if (avg < -0.2) {
    verdict         = isLong ? 'contradicts' : 'supports'
    confidenceDelta = isLong ? -10 : 5
  } else {
    verdict         = 'neutral'
    confidenceDelta = 0
  }

  return { verdict, confidenceDelta, headlines }
}

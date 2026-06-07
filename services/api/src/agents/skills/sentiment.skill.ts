import type { SkillResult } from '../../models/analysis.model'

interface NewsArticle {
  title:       string
  sentiment:   number
  publishedAt: string
  coins:       string[]
}

export function runSentimentSkill(
  coinId:   string,
  articles: NewsArticle[],
): SkillResult {
  if (articles.length === 0) {
    return { name: 'sentiment', verdict: 'neutral', score: 0, summary: 'No recent news found for this coin.', data: { articleCount: 0 } }
  }

  // Weight recent articles more heavily (decay over 7 days)
  const now = Date.now()
  let weightedSum = 0
  let totalWeight = 0

  for (const a of articles) {
    const ageMs    = now - new Date(a.publishedAt).getTime()
    const ageDays  = ageMs / (1000 * 60 * 60 * 24)
    const weight   = Math.exp(-ageDays / 7)  // exponential decay
    weightedSum   += a.sentiment * weight
    totalWeight   += weight
  }

  const avgSentiment = totalWeight > 0 ? weightedSum / totalWeight : 0

  // Count positive / negative articles
  const bullishCount = articles.filter(a => a.sentiment > 0.15).length
  const bearishCount = articles.filter(a => a.sentiment < -0.15).length
  const neutralCount = articles.length - bullishCount - bearishCount

  // Score: map -1..+1 sentiment to -100..+100
  let score = avgSentiment * 100

  // Volume of coverage bonus/penalty
  if (articles.length >= 10) score *= 1.1   // lots of coverage amplifies signal
  if (articles.length <= 2)  score *= 0.7   // very thin coverage = low confidence

  score = Math.max(-100, Math.min(100, score))
  const verdict = score >= 15 ? 'bullish' : score <= -15 ? 'bearish' : 'neutral'

  const sentiment  = avgSentiment >= 0.15 ? 'bullish' : avgSentiment <= -0.15 ? 'bearish' : 'neutral'
  const summary = `${articles.length} recent articles — ${bullishCount} bullish, ${bearishCount} bearish, ${neutralCount} neutral. Weighted sentiment: ${sentiment} (${avgSentiment.toFixed(2)}). Coverage volume is ${articles.length >= 10 ? 'high' : articles.length >= 5 ? 'moderate' : 'low'}.`

  return {
    name: 'sentiment',
    verdict,
    score: Math.round(score),
    summary,
    data: { articleCount: articles.length, avgSentiment, bullishCount, bearishCount, neutralCount },
  }
}
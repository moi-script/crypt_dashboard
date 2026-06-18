import { NewsService }      from '@/services/news.service'
import { embed }            from '@/agents/memory/memory.embedder'
import { saveMemory }       from '@/agents/memory/memory.store'
import { AgentMemoryDoc }   from '@/models/agentMemory.model'
import type { NewsArticleInput } from './news.impact'

export interface IngestResult {
  articles:    NewsArticleInput[]
  articleIds:  string[]
}

const SYMBOL_TO_COIN_ID: Record<string, string> = {
  BTC:   'bitcoin',
  ETH:   'ethereum',
  SOL:   'solana',
  BNB:   'binancecoin',
  ADA:   'cardano',
  DOT:   'polkadot',
  MATIC: 'matic-network',
  AVAX:  'avalanche-2',
  LINK:  'chainlink',
  UNI:   'uniswap',
  DOGE:  'dogecoin',
  XRP:   'ripple',
  LTC:   'litecoin',
  ATOM:  'cosmos',
  FIL:   'filecoin',
}

function symbolToCoinId(symbol: string): string {
  return SYMBOL_TO_COIN_ID[symbol.toUpperCase()] ?? symbol.toLowerCase()
}

const newsService = new NewsService()

export async function ingestAndFetchNews(userId: string, symbol: string): Promise<IngestResult> {
  const coinId = symbolToCoinId(symbol)
  const raw    = await newsService.getForCoin(coinId, 10)

  for (const article of raw) {
    const exists = await AgentMemoryDoc.exists({ type: 'news', articleId: article.id })
    if (exists) continue

    const text      = `${article.title}. ${article.summary}`.slice(0, 8000)
    const embedding = await embed(text)

    await saveMemory({
      agentId:     userId,
      runId:       `news-${article.id}`,
      timestamp:   new Date(article.publishedAt),
      coin:        symbol.toUpperCase(),
      type:        'news',
      summary:     article.title,
      fullContext: { url: article.url, source: article.source },
      embedding,
      marketRegime: 'unknown',
      signals:     [],
      tools:       [],
      articleId:   article.id,
      headline:    article.title,
      publishedAt: new Date(article.publishedAt),
    } as any)
  }

  return {
    articles:   raw.map(a => ({ title: a.title, summary: a.summary ?? '', sentiment: a.sentiment })),
    articleIds: raw.map(a => a.id),
  }
}

import RSSParser from 'rss-parser'
import { redis } from '../config/redis'
import { ArticleDoc } from '../models/news.model'

const parser = new RSSParser()

const RSS_FEEDS = [
  'https://cointelegraph.com/rss',
  'https://coindesk.com/arc/outboundfeeds/rss/',
  'https://decrypt.co/feed',
  'https://bitcoinmagazine.com/.rss/full/',
]

// Articles expire from MongoDB after 30 days
const ARTICLE_TTL_DAYS = 30

interface NewsArticle {
  id:          string
  title:       string
  url:         string
  source:      string
  publishedAt: string
  summary:     string
  sentiment:   number
  coins:       string[]
  imageUrl?:   string
}

function docToArticle(doc: any): NewsArticle {
  return {
    id:          doc._id?.toString() ?? doc.url,
    title:       doc.title,
    url:         doc.url,
    source:      doc.source,
    publishedAt: doc.publishedAt instanceof Date
                   ? doc.publishedAt.toISOString()
                   : doc.publishedAt,
    summary:     doc.summary ?? '',
    sentiment:   doc.sentiment ?? 0,
    coins:       doc.coins ?? [],
    imageUrl:    doc.imageUrl,
  }
}

async function fetchAndPersist(): Promise<NewsArticle[]> {
  // 1. Fetch all RSS feeds in parallel
  const results = await Promise.allSettled(
    RSS_FEEDS.map(url => parser.parseURL(url))
  )

  const fresh: NewsArticle[] = results
    .filter((r): r is PromiseFulfilledResult<RSSParser.Output<{}>> =>
      r.status === 'fulfilled'
    )
    .flatMap(r =>
      r.value.items.map(item => {
        const url = item.link ?? ''
        return {
          id:          url || `rss-${Date.now()}-${Math.random()}`,
          title:       item.title       ?? 'Untitled',
          url,
          source:      r.value.title    ?? 'Unknown',
          publishedAt: item.pubDate
                         ? new Date(item.pubDate).toISOString()
                         : new Date().toISOString(),
          summary:     item.contentSnippet ?? item.content ?? '',
          sentiment:   0,
          coins:       [],
          imageUrl:    (item as any).enclosure?.url ?? undefined,
        }
      })
    )
    .filter(a => a.url) // drop articles with no URL
    .sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )

  // 2. Upsert into MongoDB — skip existing URLs, set expiry date
  if (fresh.length > 0) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + ARTICLE_TTL_DAYS)

    // bulkWrite with updateOne + upsert so we never duplicate
    const ops = fresh.map(a => ({
      updateOne: {
        filter: { url: a.url },
        update: {
          $setOnInsert: {
            title:       a.title,
            url:         a.url,
            source:      a.source,
            publishedAt: new Date(a.publishedAt),
            summary:     a.summary,
            sentiment:   a.sentiment,
            coins:       a.coins,
            imageUrl:    a.imageUrl,
            expiresAt,           // ← TTL field
          },
        },
        upsert: true,
      },
    }))

    try {
      await ArticleDoc.bulkWrite(ops, { ordered: false })
    } catch (err) {
      // bulkWrite can partially fail on duplicate key errors — that's fine
      console.warn('[NewsService] bulkWrite partial error (expected on dupes):', (err as any)?.message)
    }
  }

  return fresh
}

function matchesCoin(article: NewsArticle, coinId: string): boolean {
  const needle = coinId.toLowerCase()
  return (
    article.title.toLowerCase().includes(needle) ||
    article.summary.toLowerCase().includes(needle)
  )
}

export class NewsService {
  async getLatest(limit = 20): Promise<NewsArticle[]> {
    const cacheKey = `news:all:${limit}`
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    // Try MongoDB first — serves articles from previous fetches too
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - ARTICLE_TTL_DAYS)

    const dbArticles = await ArticleDoc
      .find({ publishedAt: { $gte: cutoff } })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean()

    if (dbArticles.length >= limit) {
      // DB has enough — return from DB and refresh RSS in the background
      const articles = dbArticles.map(docToArticle)
      await redis.set(cacheKey, JSON.stringify(articles), { EX: 120 })
      // Fire-and-forget background refresh so DB stays fresh
      fetchAndPersist().catch(err =>
        console.warn('[NewsService] background refresh failed:', err?.message)
      )
      return articles
    }

    // DB doesn't have enough — fetch RSS now, persist, return fresh data
    const freshArticles = await fetchAndPersist()
    const articles = freshArticles.slice(0, limit)
    await redis.set(cacheKey, JSON.stringify(articles), { EX: 120 })
    return articles
  }

  async getForCoin(coinId: string, limit = 10): Promise<NewsArticle[]> {
    const cacheKey = `news:${coinId}:${limit}`
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - ARTICLE_TTL_DAYS)

    // Search MongoDB by coin mention in title
    const dbArticles = await ArticleDoc
      .find({
        publishedAt: { $gte: cutoff },
        $or: [
          { title:   { $regex: coinId, $options: 'i' } },
          { summary: { $regex: coinId, $options: 'i' } },
          { coins:   coinId },
        ],
      })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean()

    if (dbArticles.length > 0) {
      const articles = dbArticles.map(docToArticle)
      await redis.set(cacheKey, JSON.stringify(articles), { EX: 120 })
      return articles
    }

    // Nothing in DB yet — fetch fresh and filter
    const all      = await fetchAndPersist()
    const filtered = all.filter(a => matchesCoin(a, coinId)).slice(0, limit)
    await redis.set(cacheKey, JSON.stringify(filtered), { EX: 120 })
    return filtered
  }
}
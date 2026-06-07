/**
 * article.scraper.ts
 *
 * Step 1 — scrape all article URLs in parallel
 * Step 2 — feed ALL content in one single Claude API call
 * Step 3 — parse the batch response back into per-article results
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// ── Site-specific selectors ────────────────────────────────────────────────

const SITE_SELECTORS: Record<string, string> = {
  'cointelegraph.com':  '.post-content p, .article__content p',
  'coindesk.com':       '.article-body p, .at-content-section p',
  'decrypt.co':         '.article-content p, .post-content p',
  'bitcoinmagazine.com':'article p, .entry-content p',
  'theblock.co':        '.article__content p',
  'thedefiant.io':      '.article-content p, .post-content p',
  'reuters.com':        '[data-testid="paragraph"] p, .article-body p',
  'bloomberg.com':      '.body-content p, .article-body p',
}

function getSelectorForUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    return SITE_SELECTORS[hostname] ?? 'article p, .content p, .post-content p, main p'
  } catch {
    return 'article p, .content p, main p'
  }
}

// ── Scrape one article ────────────────────────────────────────────────────

async function scrapeOne(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      timeout: 12_000,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      maxRedirects: 5,
    })

    const $ = cheerio.load(response.data)

    // Strip noise
    $('script,style,nav,header,footer,aside,.ads,.advertisement,.related,.newsletter,.social-share,[class*="cookie"],[class*="popup"],[class*="banner"]').remove()

    const selector = getSelectorForUrl(url)
    const paragraphs: string[] = []

    $(selector).each((_, el) => {
      const text = $(el).text().trim()
      if (text.length > 40) paragraphs.push(text)
    })

    // Generic fallback
    if (paragraphs.length === 0) {
      $('p').each((_, el) => {
        const text = $(el).text().trim()
        if (text.length > 40) paragraphs.push(text)
      })
    }

    if (paragraphs.length === 0) return null

    // Cap each article at ~1500 chars — enough context, keeps batch prompt manageable
    const full = paragraphs.join('\n\n')
    return full.length > 1500 ? full.substring(0, 1500) + '...' : full

  } catch (err: any) {
    // Silently skip — paywalls, 403s, timeouts are expected
    return null
  }
}

// ── Scrape ALL urls in parallel ───────────────────────────────────────────

export interface ScrapeResult {
  url:     string
  title:   string
  content: string | null  // null = scrape failed (paywall / 403 / timeout)
}

export async function scrapeAll(
  articles: { url: string; title: string }[],
  concurrency = 10,
): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = []

  // Process in chunks of `concurrency` to avoid hammering sites
  for (let i = 0; i < articles.length; i += concurrency) {
    const chunk = articles.slice(i, i + concurrency)
    const scraped = await Promise.allSettled(
      chunk.map(a => scrapeOne(a.url))
    )
    scraped.forEach((r, idx) => {
      results.push({
        url:     chunk[idx].url,
        title:   chunk[idx].title,
        content: r.status === 'fulfilled' ? r.value : null,
      })
    })
  }

  return results
}

// ── Single batched Claude call for ALL articles ───────────────────────────

export interface ArticleAnalysis {
  url:       string
  summary:   string  // 2-3 sentence summary
  sentiment: number  // -1.0 (bearish) to +1.0 (bullish)
  coins:     string[] // CoinGecko coin IDs e.g. ["bitcoin", "ethereum"]
}

export async function analyseAll(
  scraped: ScrapeResult[],
): Promise<ArticleAnalysis[]> {
  // Only analyse articles where scraping succeeded
  const analysable = scraped.filter(s => s.content)

  if (analysable.length === 0) {
    // Return neutral defaults for everything
    return scraped.map(s => ({
      url:       s.url,
      summary:   s.title,
      sentiment: 0,
      coins:     [],
    }))
  }

  // Build one big prompt with all articles numbered
  const articlesBlock = analysable.map((s, i) =>
    `--- ARTICLE ${i + 1} ---
URL: ${s.url}
Title: ${s.title}
Content:
${s.content}`
  ).join('\n\n')

  const prompt = `You are a crypto news analyst. Analyse each article below and return a JSON array with one object per article.

${articlesBlock}

Return ONLY a valid JSON array with exactly ${analysable.length} objects in the same order as the articles above. No other text.

Each object must have exactly these fields:
{
  "url": "exact url from the article",
  "summary": "2-3 sentence factual summary of the key points",
  "sentiment": 0.0,
  "coins": ["coin-id"]
}

Rules:
- summary: concise and factual, 2-3 sentences max
- sentiment: float from -1.0 (very bearish) to +1.0 (very bullish), 0 = neutral
- coins: CoinGecko coin IDs mentioned (e.g. "bitcoin", "ethereum", "solana"). Empty array [] if none.`

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages:   [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .replace(/```json|```/g, '')
      .trim()

    const parsed = JSON.parse(text) as ArticleAnalysis[]

    // Build a URL → analysis map for fast lookup
    const analysisMap = new Map(parsed.map(a => [a.url, a]))

    // Return results for ALL scraped articles (including failed scrapes)
    return scraped.map(s => {
      const analysis = analysisMap.get(s.url)
      if (analysis) {
        analysis.sentiment = Math.max(-1, Math.min(1, analysis.sentiment))
        return analysis
      }
      // Scrape failed — return neutral default
      return { url: s.url, summary: s.title, sentiment: 0, coins: [] }
    })

  } catch (err: any) {
    console.warn('[Scraper] Claude batch analysis failed:', err.message)
    // Return neutral defaults for everything on failure
    return scraped.map(s => ({
      url:       s.url,
      summary:   s.title,
      sentiment: 0,
      coins:     [],
    }))
  }
}
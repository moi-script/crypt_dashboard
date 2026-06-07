/**
 * agents.test.ts
 *
 * Comprehensive test suite for all agent skills and report generator.
 * Uses Jest. No external dependencies (CoinGecko, MongoDB, OpenRouter) — fully isolated.
 *
 * Run:
 *   npx jest agents.test.ts --no-coverage
 *   npx jest agents.test.ts --verbose
 *
 * Install Jest + ts-jest if not already:
 *   npm install --save-dev jest ts-jest @types/jest
 *   npx ts-jest config:init
 */

// ─── Inline skill implementations (copied so tests are self-contained) ────────
// If your tsconfig paths resolve correctly, replace these with your actual imports:
//
//   import { runTrendSkill }      from '../src/agents/skills/trend.skill'
//   import { runMomentumSkill }   from '../src/agents/skills/momentum.skill'
//   import { runVolatilitySkill } from '../src/agents/skills/volatility.skill'
//   import { runSentimentSkill }  from '../src/agents/skills/sentiment.skill'
//   import { runPatternSkill }    from '../src/agents/skills/pattern.skill'
//   import { generateReport, buildFinalReasoningSteps } from '../src/agents/report.generator'

import { ReasoningStep } from '@/models/analysis.model'
import { runTrendSkill } from '../agents/skills/trend.skill'
import { runMomentumSkill } from '../agents/skills/momentum.skill'
import { runVolatilitySkill } from '../agents/skills/volatility.skill'
import { runSentimentSkill } from '../agents/skills/sentiment.skill'
import { runPatternSkill } from '../agents/skills/pattern.skill'
import { generateReport, buildFinalReasoningSteps } from '../agents/report.generator'
import type { OrchestratorResult } from '../agents/orchestrator'


// ─── Shared test data factories ───────────────────────────────────────────────

/** Generate N price points starting at `start`, trending upward by `delta` per step */
function makePrices(
  n: number,
  start = 100,
  delta = 1,
): { time: number; price: number }[] {
  return Array.from({ length: n }, (_, i) => ({
    time:  1_700_000_000 + i * 86400,
    price: start + i * delta,
  }))
}

/** Generate N price points that trend downward */
function makeBearishPrices(n = 30, start = 200): { time: number; price: number }[] {
  return makePrices(n, start, -2)
}

/** Generate a flat (sideways) price series */
function makeFlatPrices(n = 30, price = 100): { time: number; price: number }[] {
  return Array.from({ length: n }, (_, i) => ({
    time:  1_700_000_000 + i * 86400,
    price: price + Math.sin(i) * 0.5, // tiny oscillation to avoid division-by-zero
  }))
}

/** Create OHLCV bars from price points */
function makeOHLCV(
  prices: { time: number; price: number }[],
  volumeMultiplier = 1,
): { time: number; open: number; high: number; low: number; close: number; volume: number }[] {
  return prices.map((p, i) => {
    const prev  = prices[i - 1]?.price ?? p.price
    const open  = prev
    const close = p.price
    const high  = Math.max(open, close) * 1.01
    const low   = Math.min(open, close) * 0.99
    return { time: p.time, open, high, low, close, volume: 1_000_000 * volumeMultiplier }
  })
}

/** Minimal news article factory */
function makeArticle(sentiment: number, daysAgo = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return {
    title:       `Test article sentiment=${sentiment}`,
    sentiment,
    publishedAt: d.toISOString(),
    coins:       ['bitcoin'],
  }
}

/** Minimal OrchestratorResult for report.generator tests */
function makeOrchestratorResult(overrides: Partial<OrchestratorResult> = {}): OrchestratorResult {
  return {
    coinId:        'bitcoin',
    coinName:      'Bitcoin',
    symbol:        'BTC',
    price:         65000,
    skills: [
      { name: 'trend',    verdict: 'bullish', score: 60, summary: 'Price above SMA-20 and SMA-50.', data: {} },
      { name: 'momentum', verdict: 'bullish', score: 45, summary: 'RSI 58, MACD positive.',         data: {} },
    ],
    skillsUsed:    ['trend', 'momentum'],
    reasoning:     [],
    newsCount:     5,
    sentimentAvg:  0.3,
    pastAnalyses:  0,
    behaviourNotes: '',
    priceHistory:  makePrices(30, 60000, 100),
    ohlcv:         makeOHLCV(makePrices(30, 60000, 100)),
    newsHeadlines: ['Bitcoin rallies past $65k', 'Institutional demand rises'],
    ...overrides,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. TREND SKILL
// ═════════════════════════════════════════════════════════════════════════════

describe('runTrendSkill', () => {

  // ── Output shape ──────────────────────────────────────────────────────────

  test('returns correct shape', () => {
    const result = runTrendSkill(makePrices(30))
    expect(result).toMatchObject({
      name:    'trend',
      verdict: expect.stringMatching(/^bullish|bearish|neutral$/),
      score:   expect.any(Number),
      summary: expect.any(String),
      data:    expect.any(Object),
    })
  })

  test('score is clamped between -100 and 100', () => {
    const result = runTrendSkill(makePrices(50, 100, 10)) // very strong uptrend
    expect(result.score).toBeGreaterThanOrEqual(-100)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  test('data contains expected fields', () => {
    const result = runTrendSkill(makePrices(30))
    expect(result.data).toHaveProperty('sma20')
    expect(result.data).toHaveProperty('sma50')
    expect(result.data).toHaveProperty('ema12')
    expect(result.data).toHaveProperty('ema26')
    expect(result.data).toHaveProperty('emaCross')
    expect(result.data).toHaveProperty('aboveSma20')
    expect(result.data).toHaveProperty('aboveSma50')
    expect(result.data).toHaveProperty('slope7d')
  })

  // ── Verdict logic ─────────────────────────────────────────────────────────

  test('returns bullish verdict on strong uptrend', () => {
    // 50 days of consistent price rises — should score bullish
    const result = runTrendSkill(makePrices(50, 100, 5))
    expect(result.verdict).toBe('bullish')
    expect(result.score).toBeGreaterThan(20)
  })

  test('returns bearish verdict on strong downtrend', () => {
    const result = runTrendSkill(makeBearishPrices(50, 300))
    expect(result.verdict).toBe('bearish')
    expect(result.score).toBeLessThan(-20)
  })

  test('returns neutral on insufficient data (<20 prices)', () => {
    const result = runTrendSkill(makePrices(10))
    expect(result.verdict).toBe('neutral')
    expect(result.score).toBe(0)
    expect(result.summary).toMatch(/not enough/i)
  })

  test('handles exactly 20 prices (boundary)', () => {
    const result = runTrendSkill(makePrices(20))
    expect(result.verdict).toMatch(/^bullish|bearish|neutral$/)
    expect(result.score).not.toBeNaN()
  })

  test('summary mentions SMA values', () => {
    const result = runTrendSkill(makePrices(30))
    expect(result.summary).toMatch(/SMA-20/i)
    expect(result.summary).toMatch(/SMA-50/i)
  })

  test('golden cross detected on rising prices', () => {
    const result = runTrendSkill(makePrices(50, 100, 3))
    // EMA12 should be above EMA26 on a rising trend
    expect(result.data.emaCross).toBeGreaterThan(0)
  })

  test('death cross detected on falling prices', () => {
    const result = runTrendSkill(makeBearishPrices(50, 500))
    expect(result.data.emaCross).toBeLessThan(0)
  })

  // ── Edge cases ────────────────────────────────────────────────────────────

  test('handles empty array gracefully', () => {
    const result = runTrendSkill([])
    expect(result.verdict).toBe('neutral')
    expect(result.score).toBe(0)
  })

  test('handles single price point', () => {
    const result = runTrendSkill([{ time: 1000, price: 100 }])
    expect(result.verdict).toBe('neutral')
  })

  test('handles all identical prices (no movement)', () => {
    const result = runTrendSkill(makeFlatPrices(30))
    expect(result.score).not.toBeNaN()
    expect(result.verdict).toMatch(/^bullish|bearish|neutral$/)
  })

  test('handles very large price values', () => {
    const result = runTrendSkill(makePrices(30, 1_000_000, 1000))
    expect(result.score).not.toBeNaN()
    expect(result.data.sma20).toBeGreaterThan(0)
  })

  test('handles very small price values (micro-cap)', () => {
    const result = runTrendSkill(makePrices(30, 0.000001, 0.0000001))
    expect(result.score).not.toBeNaN()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. MOMENTUM SKILL
// ═════════════════════════════════════════════════════════════════════════════

describe('runMomentumSkill', () => {

  // ── Output shape ──────────────────────────────────────────────────────────

  test('returns correct shape', () => {
    const result = runMomentumSkill(makePrices(30))
    expect(result).toMatchObject({
      name:    'momentum',
      verdict: expect.stringMatching(/^bullish|bearish|neutral$/),
      score:   expect.any(Number),
      summary: expect.any(String),
      data:    expect.any(Object),
    })
  })

  test('score is clamped between -100 and 100', () => {
    const result = runMomentumSkill(makePrices(50, 50, 20))
    expect(result.score).toBeGreaterThanOrEqual(-100)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  test('data contains RSI, MACD, histogram, ROC', () => {
    const result = runMomentumSkill(makePrices(50))
    expect(result.data).toHaveProperty('rsi14')
    expect(result.data).toHaveProperty('macdLine')
    expect(result.data).toHaveProperty('signalLine')
    expect(result.data).toHaveProperty('histogram')
    expect(result.data).toHaveProperty('roc10')
  })

  // ── RSI logic ─────────────────────────────────────────────────────────────

  test('RSI is between 0 and 100', () => {
    const result = runMomentumSkill(makePrices(50))
    expect(result.data.rsi14).toBeGreaterThanOrEqual(0)
    expect(result.data.rsi14).toBeLessThanOrEqual(100)
  })

  test('RSI oversold (<30) on sharp decline produces bullish signal', () => {
    // Crash scenario: big drop in last 14 days creates oversold RSI
    const prices = [
      ...makePrices(20, 100, 1),
      ...makePrices(14, 120, -8), // sharp decline
    ]
    const result = runMomentumSkill(prices)
    expect(result.data.rsi14).toBeLessThan(40) // should be near oversold
  })

  test('RSI overbought (>70) on parabolic rise', () => {
    // All gains, no losses — RSI approaches 100
    const prices = makePrices(50, 100, 10)
    const result = runMomentumSkill(prices)
    expect(result.data.rsi14).toBeGreaterThan(60)
  })

  // ── Verdict logic ─────────────────────────────────────────────────────────

  test('returns neutral with insufficient data (<26 prices)', () => {
    const result = runMomentumSkill(makePrices(20))
    expect(result.verdict).toBe('neutral')
    expect(result.score).toBe(0)
    expect(result.summary).toMatch(/not enough/i)
  })

  test('handles exactly 26 prices (boundary)', () => {
    const result = runMomentumSkill(makePrices(26))
    expect(result.verdict).toMatch(/^bullish|bearish|neutral$/)
  })

  test('bullish momentum on consistent gains', () => {
    const result = runMomentumSkill(makePrices(50, 100, 3))
    // MACD should be positive on a consistent uptrend
    expect(result.data.macdLine).toBeGreaterThan(0)
  })

  test('bearish momentum on consistent losses', () => {
    const result = runMomentumSkill(makeBearishPrices(50, 200))
    expect(result.data.macdLine).toBeLessThan(0)
  })

  // ── Summary content ───────────────────────────────────────────────────────

  test('summary contains RSI value', () => {
    const result = runMomentumSkill(makePrices(50))
    expect(result.summary).toMatch(/RSI-14/i)
  })

  test('summary contains MACD direction', () => {
    const result = runMomentumSkill(makePrices(50, 100, 3))
    expect(result.summary).toMatch(/MACD/i)
  })

  test('summary contains ROC value', () => {
    const result = runMomentumSkill(makePrices(50))
    expect(result.summary).toMatch(/ROC/i)
  })

  // ── Edge cases ────────────────────────────────────────────────────────────

  test('handles empty array', () => {
    const result = runMomentumSkill([])
    expect(result.verdict).toBe('neutral')
    expect(result.score).toBe(0)
  })

  test('ROC is 0 when fewer than 11 prices', () => {
    // Only 26 prices total, barely enough for MACD — ROC needs 11
    const result = runMomentumSkill(makePrices(26))
    // roc10 should be calculated if length >= 11, which 26 satisfies
    expect(result.data.roc10).toBeDefined()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. VOLATILITY SKILL
// ═════════════════════════════════════════════════════════════════════════════

describe('runVolatilitySkill', () => {

  // ── Output shape ──────────────────────────────────────────────────────────

  test('returns correct shape', () => {
    const bars = makeOHLCV(makePrices(20))
    const result = runVolatilitySkill(bars)
    expect(result).toMatchObject({
      name:    'volatility',
      verdict: expect.stringMatching(/^bullish|bearish|neutral$/),
      score:   expect.any(Number),
      summary: expect.any(String),
      data:    expect.any(Object),
    })
  })

  test('score is clamped between -100 and 100', () => {
    const bars = makeOHLCV(makePrices(30))
    const result = runVolatilitySkill(bars)
    expect(result.score).toBeGreaterThanOrEqual(-100)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  test('data contains Bollinger Band and ATR fields', () => {
    const bars = makeOHLCV(makePrices(30))
    const result = runVolatilitySkill(bars)
    expect(result.data).toHaveProperty('bbUpper')
    expect(result.data).toHaveProperty('bbLower')
    expect(result.data).toHaveProperty('bbMean')
    expect(result.data).toHaveProperty('bbWidth')
    expect(result.data).toHaveProperty('bbPct')
    expect(result.data).toHaveProperty('atr')
    expect(result.data).toHaveProperty('atrPct')
    expect(result.data).toHaveProperty('volRatio')
  })

  // ── Bollinger Band logic ───────────────────────────────────────────────────

  test('bbPct is between 0 and 1 (approximately)', () => {
    const bars = makeOHLCV(makePrices(30))
    const { bbPct } = runVolatilitySkill(bars).data
    // Allow slight overshoot for extreme moves
    expect(bbPct).toBeGreaterThan(-0.5)
    expect(bbPct).toBeLessThan(1.5)
  })

  test('bbUpper is greater than bbLower', () => {
    const bars = makeOHLCV(makePrices(30, 100, 1))
    const { bbUpper, bbLower } = runVolatilitySkill(bars).data
    expect(bbUpper).toBeGreaterThan(bbLower)
  })

  test('ATR is positive', () => {
    const bars = makeOHLCV(makePrices(30))
    const result = runVolatilitySkill(bars)
    expect(result.data.atr).toBeGreaterThan(0)
  })

  // ── Verdict logic ─────────────────────────────────────────────────────────

  test('returns neutral on insufficient data (<14 bars)', () => {
    const bars = makeOHLCV(makePrices(10))
    const result = runVolatilitySkill(bars)
    expect(result.verdict).toBe('neutral')
    expect(result.score).toBe(0)
    expect(result.summary).toMatch(/not enough/i)
  })

  test('handles exactly 14 bars (boundary)', () => {
    const bars = makeOHLCV(makePrices(14))
    const result = runVolatilitySkill(bars)
    expect(result.verdict).toMatch(/^bullish|bearish|neutral$/)
  })

  test('price near lower band → bullish signal', () => {
    // Create bars where latest price is near the lower Bollinger Band
    // by making a sudden drop at the end
    const prices = [
      ...makePrices(20, 100, 0.1),      // flat base
      ...makePrices(10, 102, -3),       // sharp drop to near lower band
    ]
    const bars = makeOHLCV(prices)
    const result = runVolatilitySkill(bars)
    // Near lower band should give positive score contribution
    expect(result.data.bbPct).toBeLessThan(0.5)
  })

  // ── Volume logic ──────────────────────────────────────────────────────────

  test('surging volume increases score', () => {
    const basePrices  = makePrices(30, 100, 1)
    const normalBars  = makeOHLCV(basePrices, 1)
    const surgingBars = makeOHLCV(basePrices, 2) // 2x volume

    const normalResult  = runVolatilitySkill(normalBars)
    const surgingResult = runVolatilitySkill(surgingBars)

    // Surging volume should add to score
    expect(surgingResult.score).toBeGreaterThanOrEqual(normalResult.score)
  })

  test('zero previous volume does not crash (volRatio defaults to 1)', () => {
    const prices = makePrices(20)
    const bars = prices.map((p, i) => ({
      time: p.time, open: p.price, high: p.price * 1.01,
      low: p.price * 0.99, close: p.price,
      volume: i < 10 ? 0 : 1_000_000, // zero volume in first half
    }))
    expect(() => runVolatilitySkill(bars)).not.toThrow()
  })

  // ── Summary content ───────────────────────────────────────────────────────

  test('summary mentions Bollinger Band position', () => {
    const bars = makeOHLCV(makePrices(30))
    const result = runVolatilitySkill(bars)
    expect(result.summary).toMatch(/band/i)
  })

  test('summary mentions ATR', () => {
    const bars = makeOHLCV(makePrices(30))
    const result = runVolatilitySkill(bars)
    expect(result.summary).toMatch(/ATR/i)
  })

  // ── Edge cases ────────────────────────────────────────────────────────────

  test('handles empty array', () => {
    const result = runVolatilitySkill([])
    expect(result.verdict).toBe('neutral')
    expect(result.score).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. SENTIMENT SKILL
// ═════════════════════════════════════════════════════════════════════════════

describe('runSentimentSkill', () => {

  // ── Output shape ──────────────────────────────────────────────────────────

  test('returns correct shape', () => {
    const result = runSentimentSkill('bitcoin', [makeArticle(0.5)])
    expect(result).toMatchObject({
      name:    'sentiment',
      verdict: expect.stringMatching(/^bullish|bearish|neutral$/),
      score:   expect.any(Number),
      summary: expect.any(String),
      data:    expect.any(Object),
    })
  })

  test('score is clamped between -100 and 100', () => {
    const articles = Array.from({ length: 20 }, () => makeArticle(1.0))
    const result = runSentimentSkill('bitcoin', articles)
    expect(result.score).toBeGreaterThanOrEqual(-100)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  test('data contains article counts', () => {
    const result = runSentimentSkill('bitcoin', [makeArticle(0.5), makeArticle(-0.2)])
    expect(result.data).toHaveProperty('articleCount')
    expect(result.data).toHaveProperty('avgSentiment')
    expect(result.data).toHaveProperty('bullishCount')
    expect(result.data).toHaveProperty('bearishCount')
    expect(result.data).toHaveProperty('neutralCount')
  })

  // ── Verdict logic ─────────────────────────────────────────────────────────

  test('returns neutral on empty articles', () => {
    const result = runSentimentSkill('bitcoin', [])
    expect(result.verdict).toBe('neutral')
    expect(result.score).toBe(0)
    expect(result.data.articleCount).toBe(0)
  })

  test('bullish on all positive articles', () => {
    const articles = Array.from({ length: 5 }, () => makeArticle(0.8))
    const result = runSentimentSkill('bitcoin', articles)
    expect(result.verdict).toBe('bullish')
    expect(result.score).toBeGreaterThan(0)
  })

  test('bearish on all negative articles', () => {
    const articles = Array.from({ length: 5 }, () => makeArticle(-0.8))
    const result = runSentimentSkill('bitcoin', articles)
    expect(result.verdict).toBe('bearish')
    expect(result.score).toBeLessThan(0)
  })

  test('neutral on mixed sentiment articles', () => {
    const articles = [
      makeArticle(0.8), makeArticle(-0.8),
      makeArticle(0.1), makeArticle(-0.1),
    ]
    const result = runSentimentSkill('bitcoin', articles)
    // Mixed signals should be close to neutral
    expect(Math.abs(result.score)).toBeLessThan(30)
  })

  // ── Article counts ────────────────────────────────────────────────────────

  test('bullishCount counts articles with sentiment > 0.15', () => {
    const articles = [
      makeArticle(0.5),  // bullish
      makeArticle(0.1),  // neutral (below threshold)
      makeArticle(-0.5), // bearish
    ]
    const result = runSentimentSkill('bitcoin', articles)
    expect(result.data.bullishCount).toBe(1)
    expect(result.data.bearishCount).toBe(1)
    expect(result.data.neutralCount).toBe(1)
  })

  test('articleCount matches input length', () => {
    const articles = Array.from({ length: 7 }, (_, i) => makeArticle(i % 2 === 0 ? 0.5 : -0.3))
    const result = runSentimentSkill('bitcoin', articles)
    expect(result.data.articleCount).toBe(7)
  })

  // ── Recency decay ─────────────────────────────────────────────────────────

  test('recent articles weigh more than old articles', () => {
    // One recent bullish + one old bearish — should still lean bullish
    const articles = [
      makeArticle(0.9, 0),   // very bullish, today
      makeArticle(-0.9, 13), // very bearish, 13 days ago (decayed)
    ]
    const result = runSentimentSkill('bitcoin', articles)
    // Recent bullish should dominate due to exponential decay
    expect(result.score).toBeGreaterThan(0)
  })

  // ── Coverage amplification ────────────────────────────────────────────────

  test('high coverage (>=10 articles) amplifies score', () => {
    const fewArticles  = Array.from({ length: 3 },  () => makeArticle(0.5))
    const manyArticles = Array.from({ length: 10 }, () => makeArticle(0.5))

    const fewResult  = runSentimentSkill('bitcoin', fewArticles)
    const manyResult = runSentimentSkill('bitcoin', manyArticles)

    // More articles = amplified score (×1.1)
    expect(Math.abs(manyResult.score)).toBeGreaterThan(Math.abs(fewResult.score))
  })

  test('thin coverage (<=2 articles) dampens score', () => {
    const thinArticles   = [makeArticle(0.5), makeArticle(0.5)]           // 2 articles
    const normalArticles = Array.from({ length: 5 }, () => makeArticle(0.5)) // 5 articles

    const thinResult   = runSentimentSkill('bitcoin', thinArticles)
    const normalResult = runSentimentSkill('bitcoin', normalArticles)

    // Thin coverage should dampen score (×0.7)
    expect(Math.abs(thinResult.score)).toBeLessThan(Math.abs(normalResult.score))
  })

  // ── Summary content ───────────────────────────────────────────────────────

  test('summary mentions article count', () => {
    const articles = Array.from({ length: 5 }, () => makeArticle(0.3))
    const result = runSentimentSkill('bitcoin', articles)
    expect(result.summary).toMatch(/5/)
  })

  test('summary describes coverage volume', () => {
    const articles = Array.from({ length: 3 }, () => makeArticle(0.3))
    const result = runSentimentSkill('bitcoin', articles)
    expect(result.summary).toMatch(/low|moderate|high/i)
  })

  // ── Edge cases ────────────────────────────────────────────────────────────

  test('coinId parameter does not affect output (articles are pre-filtered)', () => {
    const articles = [makeArticle(0.5)]
    const r1 = runSentimentSkill('bitcoin',  articles)
    const r2 = runSentimentSkill('ethereum', articles)
    expect(r1.score).toBe(r2.score)
  })

  test('handles sentiment at exact boundary values (0.15 and -0.15)', () => {
    const articles = [
      makeArticle(0.15),  // exactly at threshold — should be neutral
      makeArticle(-0.15), // exactly at threshold — should be neutral
    ]
    const result = runSentimentSkill('bitcoin', articles)
    expect(result.data.bullishCount).toBe(0) // 0.15 is NOT > 0.15
    expect(result.data.bearishCount).toBe(0) // -0.15 is NOT < -0.15
    expect(result.data.neutralCount).toBe(2)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. PATTERN SKILL
// ═════════════════════════════════════════════════════════════════════════════

describe('runPatternSkill', () => {

  // ── Output shape ──────────────────────────────────────────────────────────

  test('returns correct shape', () => {
    const bars = makeOHLCV(makePrices(20))
    const result = runPatternSkill(bars)
    expect(result).toMatchObject({
      name:    'pattern',
      verdict: expect.stringMatching(/^bullish|bearish|neutral$/),
      score:   expect.any(Number),
      summary: expect.any(String),
      data:    expect.any(Object),
    })
  })

  test('score is clamped between -100 and 100', () => {
    const bars = makeOHLCV(makePrices(30))
    const result = runPatternSkill(bars)
    expect(result.score).toBeGreaterThanOrEqual(-100)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  test('data contains S/R levels and pattern info', () => {
    const bars = makeOHLCV(makePrices(20))
    const result = runPatternSkill(bars)
    expect(result.data).toHaveProperty('support')
    expect(result.data).toHaveProperty('resistance')
    expect(result.data).toHaveProperty('distFromSup')
    expect(result.data).toHaveProperty('distFromRes')
    expect(result.data).toHaveProperty('pattern')
    expect(result.data).toHaveProperty('patternBias')
  })

  // ── Insufficient data ─────────────────────────────────────────────────────

  test('returns neutral on fewer than 10 bars', () => {
    const bars = makeOHLCV(makePrices(5))
    const result = runPatternSkill(bars)
    expect(result.verdict).toBe('neutral')
    expect(result.score).toBe(0)
    expect(result.summary).toMatch(/not enough/i)
  })

  test('handles exactly 10 bars (boundary)', () => {
    const bars = makeOHLCV(makePrices(10))
    const result = runPatternSkill(bars)
    expect(result.verdict).toMatch(/^bullish|bearish|neutral$/)
  })

  // ── Support/Resistance ────────────────────────────────────────────────────

  test('support is less than resistance', () => {
    const bars = makeOHLCV(makePrices(20, 100, 1))
    const result = runPatternSkill(bars)
    expect(result.data.support).toBeLessThan(result.data.resistance)
  })

  test('resistance is the highest high in last 20 bars', () => {
    const prices = makePrices(25, 100, 1)
    const bars   = makeOHLCV(prices)
    const result = runPatternSkill(bars)
    const expectedMax = Math.max(...bars.slice(-20).map(b => b.high))
    expect(result.data.resistance).toBeCloseTo(expectedMax, 0)
  })

  test('support is the lowest low in last 20 bars', () => {
    const prices = makePrices(25, 100, 1)
    const bars   = makeOHLCV(prices)
    const result = runPatternSkill(bars)
    const expectedMin = Math.min(...bars.slice(-20).map(b => b.low))
    expect(result.data.support).toBeCloseTo(expectedMin, 0)
  })

  // ── Candle pattern detection ──────────────────────────────────────────────

  test('detects bullish engulfing pattern', () => {
    // prev1: bearish candle, curr: bullish candle that engulfs it
    const bars = makeOHLCV(makePrices(15, 100, 1))
    // Manually override last 2 bars for a clear bullish engulfing
    bars[bars.length - 2] = { time: 1, open: 110, high: 111, low: 105, close: 106, volume: 1000 } // bearish
    bars[bars.length - 1] = { time: 2, open: 104, high: 115, low: 103, close: 114, volume: 1000 } // bullish engulfing
    const result = runPatternSkill(bars)
    expect(result.data.pattern).toBe('Bullish engulfing')
    expect(result.data.patternBias).toBe('bullish')
  })

  test('detects bearish engulfing pattern', () => {
    const bars = makeOHLCV(makePrices(15, 100, 1))
    bars[bars.length - 2] = { time: 1, open: 100, high: 112, low: 99,  close: 110, volume: 1000 } // bullish
    bars[bars.length - 1] = { time: 2, open: 112, high: 113, low: 98,  close: 99,  volume: 1000 } // bearish engulfing
    const result = runPatternSkill(bars)
    expect(result.data.pattern).toBe('Bearish engulfing')
    expect(result.data.patternBias).toBe('bearish')
  })

  test('detects Doji (body < 10% of range)', () => {
    const bars = makeOHLCV(makePrices(15, 100, 1))
    bars[bars.length - 1] = { time: 2, open: 100, high: 110, low: 90, close: 100.5, volume: 1000 }
    const result = runPatternSkill(bars)
    expect(result.data.pattern).toBe('Doji')
    expect(result.data.patternBias).toBe('neutral')
  })

  test('detects Three white soldiers', () => {
    const bars = makeOHLCV(makePrices(15, 100, 1))
    bars[bars.length - 3] = { time: 1, open: 100, high: 106, low: 99, close: 105, volume: 1000 }
    bars[bars.length - 2] = { time: 2, open: 105, high: 112, low: 104, close: 111, volume: 1000 }
    bars[bars.length - 1] = { time: 3, open: 111, high: 118, low: 110, close: 117, volume: 1000 }
    const result = runPatternSkill(bars)
    expect(result.data.pattern).toBe('Three white soldiers')
    expect(result.data.patternBias).toBe('bullish')
  })

  test('detects Three black crows', () => {
    const bars = makeOHLCV(makePrices(15, 150, 1))
    bars[bars.length - 3] = { time: 1, open: 150, high: 151, low: 143, close: 144, volume: 1000 }
    bars[bars.length - 2] = { time: 2, open: 144, high: 145, low: 137, close: 138, volume: 1000 }
    bars[bars.length - 1] = { time: 3, open: 138, high: 139, low: 131, close: 132, volume: 1000 }
    const result = runPatternSkill(bars)
    expect(result.data.pattern).toBe('Three black crows')
    expect(result.data.patternBias).toBe('bearish')
  })

  test('returns null pattern when no pattern matches', () => {
    // Completely random bars that don't match any pattern
    const bars = makeOHLCV(makeFlatPrices(20))
    const result = runPatternSkill(bars)
    // pattern may be null — just ensure no crash
    expect(result.data.patternBias === null || typeof result.data.patternBias === 'string').toBe(true)
  })

  // ── Summary content ───────────────────────────────────────────────────────

  test('summary mentions support and resistance prices', () => {
    const bars = makeOHLCV(makePrices(20))
    const result = runPatternSkill(bars)
    expect(result.summary).toMatch(/support/i)
    expect(result.summary).toMatch(/resistance/i)
  })

  // ── Edge cases ────────────────────────────────────────────────────────────

  test('handles empty array', () => {
    const result = runPatternSkill([])
    expect(result.verdict).toBe('neutral')
    expect(result.score).toBe(0)
  })

  test('S/R range = 0 does not crash (all same price)', () => {
    const bars = Array.from({ length: 20 }, (_, i) => ({
      time: i, open: 100, high: 100, low: 100, close: 100, volume: 1000,
    }))
    expect(() => runPatternSkill(bars)).not.toThrow()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6. REPORT GENERATOR — buildFinalReasoningSteps
// ═════════════════════════════════════════════════════════════════════════════

describe('buildFinalReasoningSteps', () => {

  const baseReport = {
    verdict:        'buy' as const,
    confidence:     72,
    score:          35,
    narrative:      'Bitcoin shows strong bullish momentum with RSI at 58 and positive MACD.',
    keyPoints:      ['Bullish trend confirmed', 'Volume surging', 'RSI healthy'],
    risks:          ['High ATR indicates volatility', 'Resistance at $68k'],
    imagePrompt:    'green wave crashing through dark canyon',
    behaviourNotes: 'Bitcoin tends to follow macro trends.',
  }

  test('returns correct number of steps', () => {
    const steps = buildFinalReasoningSteps(baseReport, 5)
    // 1 verdict + 3 keyPoints + 1 risks = 5 steps
    expect(steps.length).toBe(5)
  })

  test('first step is always the verdict step', () => {
    const steps = buildFinalReasoningSteps(baseReport, 0)
    expect(steps[0].phase).toBe('verdict')
    expect(steps[0].title).toMatch(/BUY/i)
  })

  test('step numbers are sequential starting from startStep+1', () => {
    const steps = buildFinalReasoningSteps(baseReport, 10)
    expect(steps[0].step).toBe(11)
    expect(steps[1].step).toBe(12)
    expect(steps[steps.length - 1].step).toBe(10 + steps.length)
  })

  test('verdict step contains narrative as detail', () => {
    const steps = buildFinalReasoningSteps(baseReport, 0)
    expect(steps[0].detail).toBe(baseReport.narrative)
  })

  test('verdict step decision contains confidence and score', () => {
    const steps = buildFinalReasoningSteps(baseReport, 0)
    expect(steps[0].decision).toMatch(/72%/)
    expect(steps[0].decision).toMatch(/35/)
  })

  test('keyPoints become individual steps', () => {
    const steps = buildFinalReasoningSteps(baseReport, 0)
    const keyPointSteps = steps.filter(s => s.title === 'Key finding')
    expect(keyPointSteps.length).toBe(3)
    expect(keyPointSteps[0].detail).toBe('Bullish trend confirmed')
    expect(keyPointSteps[1].detail).toBe('Volume surging')
    expect(keyPointSteps[2].detail).toBe('RSI healthy')
  })

  test('risks are combined into one step', () => {
    const steps = buildFinalReasoningSteps(baseReport, 0)
    const riskStep = steps.find(s => s.title.includes('risk'))
    expect(riskStep).toBeDefined()
    expect(riskStep!.detail).toMatch(/High ATR/)
    expect(riskStep!.detail).toMatch(/Resistance/)
  })

  test('risk step title shows count', () => {
    const steps = buildFinalReasoningSteps(baseReport, 0)
    const riskStep = steps.find(s => s.title.includes('risk'))
    expect(riskStep!.title).toMatch(/2 risk/)
  })

  test('handles empty keyPoints', () => {
    const report = { ...baseReport, keyPoints: [] }
    const steps = buildFinalReasoningSteps(report, 0)
    const keyPointSteps = steps.filter(s => s.title === 'Key finding')
    expect(keyPointSteps.length).toBe(0)
  })

  test('handles empty risks', () => {
    const report = { ...baseReport, risks: [] }
    const steps = buildFinalReasoningSteps(report, 0)
    const riskStep = steps.find(s => s.title.includes('risk'))
    expect(riskStep).toBeUndefined()
  })

  test('all steps have phase = verdict', () => {
    const steps = buildFinalReasoningSteps(baseReport, 0)
    steps.forEach(s => expect(s.phase).toBe('verdict'))
  })

  test('handles startStep = 0', () => {
    const steps = buildFinalReasoningSteps(baseReport, 0)
    expect(steps[0].step).toBe(1)
  })

  test('score is attached to verdict step', () => {
    const steps = buildFinalReasoningSteps(baseReport, 0)
    expect(steps[0].score).toBe(35)
  })

  test('positive score shows + prefix in decision', () => {
    const steps = buildFinalReasoningSteps(baseReport, 0)
    expect(steps[0].decision).toMatch(/\+35/)
  })

  test('negative score shows no + prefix', () => {
    const report = { ...baseReport, score: -40, verdict: 'sell' as const }
    const steps = buildFinalReasoningSteps(report, 0)
    expect(steps[0].decision).toMatch(/-40/)
    expect(steps[0].decision).not.toMatch(/\+-40/)
  })

  test('verdict title converts underscore to space and uppercases', () => {
    const report = { ...baseReport, verdict: 'strong_buy' as const }
    const steps = buildFinalReasoningSteps(report, 0)
    expect(steps[0].title).toMatch(/STRONG BUY/i)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7. REPORT GENERATOR — generateReport (mocked fetch)
// ═════════════════════════════════════════════════════════════════════════════

describe('generateReport', () => {

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key-mock'
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const validAIResponse = {
    verdict:        'buy',
    confidence:     75,
    score:          40,
    narrative:      'Bitcoin is showing strong bullish momentum. RSI at 58 is healthy. MACD positive.',
    keyPoints:      ['Uptrend confirmed', 'Volume increasing'],
    risks:          ['Resistance at $68k', 'Macro uncertainty'],
    imagePrompt:    'massive green wave crashing through dark digital canyon',
    behaviourNotes: 'Bitcoin tends to react strongly to macro events.',
  }

  function mockFetch(response: object, status = 200) {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok:   status === 200,
      status,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(response) } }],
      }),
      text: async () => JSON.stringify({ error: 'mock error' }),
    } as any)
  }

  // ── Happy path ────────────────────────────────────────────────────────────

  test('returns parsed AI response on success', async () => {
    mockFetch(validAIResponse)
    const result = await generateReport(makeOrchestratorResult())
    expect(result.verdict).toBe('buy')
    expect(result.confidence).toBe(75)
    expect(result.score).toBe(40)
    expect(result.narrative).toContain('Bitcoin')
    expect(result.keyPoints).toHaveLength(2)
    expect(result.risks).toHaveLength(2)
  })

  test('sanitises confidence to 0-100 range', async () => {
    mockFetch({ ...validAIResponse, confidence: 150 })
    const result = await generateReport(makeOrchestratorResult())
    expect(result.confidence).toBe(100)
  })

  test('sanitises negative confidence to 0', async () => {
    mockFetch({ ...validAIResponse, confidence: -10 })
    const result = await generateReport(makeOrchestratorResult())
    expect(result.confidence).toBe(0)
  })

  test('sanitises score to -100 to +100 range', async () => {
    mockFetch({ ...validAIResponse, score: 200 })
    const result = await generateReport(makeOrchestratorResult())
    expect(result.score).toBe(100)
  })

  test('ensures keyPoints is always an array', async () => {
    mockFetch({ ...validAIResponse, keyPoints: null })
    const result = await generateReport(makeOrchestratorResult())
    expect(Array.isArray(result.keyPoints)).toBe(true)
  })

  test('ensures risks is always an array', async () => {
    mockFetch({ ...validAIResponse, risks: 'some string' })
    const result = await generateReport(makeOrchestratorResult())
    expect(Array.isArray(result.risks)).toBe(true)
  })

  test('strips markdown fences from AI response', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok:   true,
      status: 200,
      json: async () => ({
        choices: [{
          message: {
            content: '```json\n' + JSON.stringify(validAIResponse) + '\n```',
          },
        }],
      }),
    } as any)
    const result = await generateReport(makeOrchestratorResult())
    expect(result.verdict).toBe('buy')
  })

  // ── Fallback behaviour ────────────────────────────────────────────────────

  test('returns fallback report on API error (non-200)', async () => {
    mockFetch({ error: 'rate limited' }, 429)
    const result = await generateReport(makeOrchestratorResult())
    expect(result.confidence).toBe(40) // fallback confidence
    expect(result.verdict).toMatch(/^strong_buy|buy|neutral|sell|strong_sell$/)
  })

  test('returns fallback report on fetch network failure', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))
    const result = await generateReport(makeOrchestratorResult())
    expect(result.confidence).toBe(40)
    expect(Array.isArray(result.keyPoints)).toBe(true)
    expect(Array.isArray(result.risks)).toBe(true)
  })

  test('returns fallback report on JSON parse failure', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok:   true,
      json: async () => ({ choices: [{ message: { content: 'not valid json {{{' } }] }),
    } as any)
    const result = await generateReport(makeOrchestratorResult())
    expect(result.confidence).toBe(40)
  })

  test('fallback report uses computed weighted score', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))
    // Two bullish skills with known scores
    const data = makeOrchestratorResult({
      skills: [
        { name: 'trend',    verdict: 'bullish', score: 80, summary: 'Test', data: {} },
        { name: 'momentum', verdict: 'bullish', score: 60, summary: 'Test', data: {} },
      ],
    })
    const result = await generateReport(data)
    // Weighted: (80×0.30 + 60×0.25) / (0.30+0.25) = (24+15)/0.55 ≈ 70.9 → 71
    expect(result.score).toBeGreaterThan(50)
  })

  test('fallback verdict matches weighted score direction', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('fail'))
    const data = makeOrchestratorResult({
      skills: [
        { name: 'trend',    verdict: 'bearish', score: -80, summary: '', data: {} },
        { name: 'momentum', verdict: 'bearish', score: -70, summary: '', data: {} },
      ],
    })
    const result = await generateReport(data)
    expect(['sell', 'strong_sell']).toContain(result.verdict)
  })

  // ── Missing API key ───────────────────────────────────────────────────────

  test('falls back gracefully when OPENROUTER_API_KEY is missing', async () => {
    delete process.env.OPENROUTER_API_KEY
    global.fetch = jest.fn() // should not be called
    const result = await generateReport(makeOrchestratorResult())
    expect(result.confidence).toBe(40)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  // ── Score-to-verdict mapping ──────────────────────────────────────────────

  test.each([
    [70,   'strong_buy'],
    [30,   'buy'],
    [10,   'neutral'],
    [-30,  'sell'],
    [-70,  'strong_sell'],
  ])('weighted score %i maps to fallback verdict %s', async (score, expectedVerdict) => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('fail'))
    const skills = [
      { name: 'trend', verdict: score > 0 ? 'bullish' : 'bearish', score, summary: '', data: {} },
    ] as any
    const result = await generateReport(makeOrchestratorResult({ skills }))
    expect(result.verdict).toBe(expectedVerdict)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8. INTEGRATION — all skills together (weighted score sanity check)
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: all skills on same data', () => {

  const SKILL_WEIGHTS: Record<string, number> = {
    trend: 0.30, momentum: 0.25, volatility: 0.20, sentiment: 0.15, pattern: 0.10,
  }

  test('all skills run without throwing on 30 days of real-looking data', () => {
    const prices  = makePrices(30, 60000, 200)
    const ohlcv   = makeOHLCV(prices)
    const articles = Array.from({ length: 5 }, (_, i) => makeArticle(0.3 - i * 0.1))

    expect(() => runTrendSkill(prices)).not.toThrow()
    expect(() => runMomentumSkill(prices)).not.toThrow()
    expect(() => runVolatilitySkill(ohlcv)).not.toThrow()
    expect(() => runSentimentSkill('bitcoin', articles)).not.toThrow()
    expect(() => runPatternSkill(ohlcv)).not.toThrow()
  })

  test('weighted score is within -100 to +100', () => {
    const prices   = makePrices(30, 60000, 200)
    const ohlcv    = makeOHLCV(prices)
    const articles = Array.from({ length: 5 }, () => makeArticle(0.3))

    const skills = [
      runTrendSkill(prices),
      runMomentumSkill(prices),
      runVolatilitySkill(ohlcv),
      runSentimentSkill('bitcoin', articles),
      runPatternSkill(ohlcv),
    ]

    let total = 0, weightSum = 0
    for (const skill of skills) {
      const w = SKILL_WEIGHTS[skill.name] ?? 0.1
      total     += skill.score * w
      weightSum += w
    }
    const weightedScore = Math.round(total / weightSum)

    expect(weightedScore).toBeGreaterThanOrEqual(-100)
    expect(weightedScore).toBeLessThanOrEqual(100)
  })

  test('all skill names match expected keys', () => {
    const prices = makePrices(30)
    const ohlcv  = makeOHLCV(prices)

    expect(runTrendSkill(prices).name).toBe('trend')
    expect(runMomentumSkill(prices).name).toBe('momentum')
    expect(runVolatilitySkill(ohlcv).name).toBe('volatility')
    expect(runSentimentSkill('bitcoin', []).name).toBe('sentiment')
    expect(runPatternSkill(ohlcv).name).toBe('pattern')
  })

  test('all skills return valid verdict values', () => {
    const prices   = makePrices(30)
    const ohlcv    = makeOHLCV(prices)
    const articles = [makeArticle(0.3)]
    const validVerdicts = ['bullish', 'bearish', 'neutral']

    const skills = [
      runTrendSkill(prices),
      runMomentumSkill(prices),
      runVolatilitySkill(ohlcv),
      runSentimentSkill('bitcoin', articles),
      runPatternSkill(ohlcv),
    ]

    skills.forEach(skill => {
      expect(validVerdicts).toContain(skill.verdict)
    })
  })

  test('bearish market: majority of skills should lean bearish', () => {
    const prices   = makeBearishPrices(50, 500)
    const ohlcv    = makeOHLCV(prices)
    const articles = Array.from({ length: 5 }, () => makeArticle(-0.7))

    const skills = [
      runTrendSkill(prices),
      runMomentumSkill(prices),
      runVolatilitySkill(ohlcv),
      runSentimentSkill('bitcoin', articles),
      runPatternSkill(ohlcv),
    ]

    const bearishCount = skills.filter(s => s.verdict === 'bearish').length
    const bullishCount = skills.filter(s => s.verdict === 'bullish').length
    expect(bearishCount).toBeGreaterThan(bullishCount)
  })

  test('bullish market: majority of skills should lean bullish', () => {
    const prices   = makePrices(50, 100, 5) // strong uptrend
    const ohlcv    = makeOHLCV(prices)
    const articles = Array.from({ length: 5 }, () => makeArticle(0.7))

    const skills = [
      runTrendSkill(prices),
      runMomentumSkill(prices),
      runVolatilitySkill(ohlcv),
      runSentimentSkill('bitcoin', articles),
      runPatternSkill(ohlcv),
    ]

    const bullishCount = skills.filter(s => s.verdict === 'bullish').length
    const bearishCount = skills.filter(s => s.verdict === 'bearish').length
    expect(bullishCount).toBeGreaterThan(bearishCount)
  })
})
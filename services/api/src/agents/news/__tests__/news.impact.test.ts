import { scoreNewsImpact } from '../news.impact'

const longSignal  = { bias: 'long'  as const }
const shortSignal = { bias: 'short' as const }

describe('scoreNewsImpact', () => {
  test('returns neutral with empty articles', () => {
    expect(scoreNewsImpact([], longSignal)).toEqual({
      verdict: 'neutral', confidenceDelta: 0, headlines: [],
    })
  })

  test('returns neutral when signal is null', () => {
    const result = scoreNewsImpact([{ title: 'BTC rally', summary: '', sentiment: 0 }], null)
    expect(result).toEqual({ verdict: 'neutral', confidenceDelta: 0, headlines: [] })
  })

  test('bullish keyword supports a long signal', () => {
    const result = scoreNewsImpact(
      [{ title: 'BTC breakout to ATH confirmed', summary: '', sentiment: 0 }],
      longSignal,
    )
    expect(result.verdict).toBe('supports')
    expect(result.confidenceDelta).toBe(5)
    expect(result.headlines).toHaveLength(1)
    expect(result.headlines[0].title).toBe('BTC breakout to ATH confirmed')
  })

  test('bullish keyword contradicts a short signal', () => {
    const result = scoreNewsImpact(
      [{ title: 'Bitcoin golden cross rally breakout', summary: '', sentiment: 0 }],
      shortSignal,
    )
    expect(result.verdict).toBe('contradicts')
    expect(result.confidenceDelta).toBe(-10)
  })

  test('bearish keyword contradicts a long signal', () => {
    const result = scoreNewsImpact(
      [{ title: 'BTC crash SEC lawsuit filed FUD', summary: '', sentiment: 0 }],
      longSignal,
    )
    expect(result.verdict).toBe('contradicts')
    expect(result.confidenceDelta).toBe(-10)
  })

  test('bearish keyword supports a short signal', () => {
    const result = scoreNewsImpact(
      [{ title: 'Bitcoin death cross breakdown capitulation', summary: '', sentiment: 0 }],
      shortSignal,
    )
    expect(result.verdict).toBe('supports')
    expect(result.confidenceDelta).toBe(5)
  })

  test('uses stored sentiment field when non-zero', () => {
    const result = scoreNewsImpact(
      [{ title: 'neutral title text here', summary: '', sentiment: 0.9 }],
      longSignal,
    )
    expect(result.verdict).toBe('supports')
    expect(result.confidenceDelta).toBe(5)
  })

  test('caps headlines to 3 even when more articles are passed', () => {
    const articles = Array.from({ length: 5 }, (_, i) => ({
      title: `Article ${i}`, summary: '', sentiment: 0,
    }))
    const result = scoreNewsImpact(articles, longSignal)
    expect(result.headlines).toHaveLength(3)
  })

  test('mixed signals average to neutral band', () => {
    const result = scoreNewsImpact(
      [
        { title: 'Bitcoin rally to ATH', summary: '', sentiment: 0 },
        { title: 'BTC crash SEC ban', summary: '', sentiment: 0 },
      ],
      longSignal,
    )
    expect(result.verdict).toBe('neutral')
    expect(result.confidenceDelta).toBe(0)
  })
})

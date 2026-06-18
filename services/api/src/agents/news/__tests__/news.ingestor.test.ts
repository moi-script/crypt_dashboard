// Shared getForCoin spy — captured once at module-mock time so clearMocks
// doesn't lose the reference (clearMocks resets call history, not the fn itself).
const mockGetForCoin = jest.fn(async () => [
  { id: 'art-1', title: 'BTC rally continues', summary: 'Bitcoin surges', sentiment: 0, publishedAt: new Date().toISOString(), coins: ['BTC'], url: 'http://a.com/1', source: 'Test' },
  { id: 'art-2', title: 'Already embedded article', summary: '', sentiment: 0, publishedAt: new Date().toISOString(), coins: ['BTC'], url: 'http://a.com/2', source: 'Test' },
])

jest.mock('@/services/news.service', () => ({
  NewsService: jest.fn().mockImplementation(() => ({
    getForCoin: mockGetForCoin,
  })),
}))

jest.mock('@/agents/memory/memory.embedder', () => ({
  embed: jest.fn(async () => Array(768).fill(0.1)),
}))

jest.mock('@/agents/memory/memory.store', () => ({
  saveMemory: jest.fn(async (e: any) => e),
}))

jest.mock('@/models/agentMemory.model', () => ({
  AgentMemoryDoc: {
    exists: jest.fn(async ({ articleId }: any) => articleId === 'art-2'),
  },
}))

import { ingestAndFetchNews } from '../news.ingestor'
import { embed }              from '@/agents/memory/memory.embedder'
import { saveMemory }         from '@/agents/memory/memory.store'

beforeEach(() => jest.clearAllMocks())

test('returns all articles and embeds only unseen ones', async () => {
  const result = await ingestAndFetchNews('user-1', 'BTC')

  expect(result.articles).toHaveLength(2)
  expect(result.articleIds).toEqual(['art-1', 'art-2'])

  // art-2 already exists — only art-1 should be embedded and saved
  expect(embed).toHaveBeenCalledTimes(1)
  expect(saveMemory).toHaveBeenCalledTimes(1)

  const savedArg = (saveMemory as jest.Mock).mock.calls[0][0]
  expect(savedArg.type).toBe('news')
  expect(savedArg.articleId).toBe('art-1')
  expect(savedArg.coin).toBe('BTC')
})

test('maps common symbols to CoinGecko IDs for the news query', async () => {
  await ingestAndFetchNews('user-1', 'ETH')
  expect(mockGetForCoin).toHaveBeenCalledWith('ethereum', 10)
})

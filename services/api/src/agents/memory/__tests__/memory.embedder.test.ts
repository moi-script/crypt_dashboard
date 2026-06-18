process.env.OPENAI_API_KEY = 'test-key'

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.5) }],
      }),
    },
  }))
})

import { embed } from '../memory.embedder'

test('embed returns a 1536-element number array', async () => {
  const vec = await embed('BTC trending up, SmartMoney long, confidence 80')
  expect(Array.isArray(vec)).toBe(true)
  expect(vec).toHaveLength(1536)
  expect(typeof vec[0]).toBe('number')
})

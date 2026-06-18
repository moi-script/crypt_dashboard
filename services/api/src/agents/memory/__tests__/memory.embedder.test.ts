import { embed } from '../memory.embedder'

test('embed returns a 1536-element number array', async () => {
  const vec = await embed('BTC trending up, SmartMoney long, confidence 80')
  expect(Array.isArray(vec)).toBe(true)
  expect(vec).toHaveLength(1536)
  expect(typeof vec[0]).toBe('number')
})

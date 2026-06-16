import mongoose from 'mongoose'
import { connectTestDb, clearTestDb, disconnectTestDb } from './db'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('in-memory mongo connects and round-trips a document', async () => {
  const M = mongoose.models.Smoke ?? mongoose.model('Smoke', new mongoose.Schema({ n: Number }))
  await M.create({ n: 7 })
  const found = await M.findOne({ n: 7 }).lean()
  expect(found?.n).toBe(7)
})

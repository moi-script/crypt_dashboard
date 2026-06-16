import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer | null = null

/** Spin up an in-memory MongoDB and connect mongoose to it. */
export async function connectTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
}

/** Drop all data between tests so each test starts clean. */
export async function clearTestDb(): Promise<void> {
  const { collections } = mongoose.connection
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({})
  }
}

/** Disconnect mongoose and stop the in-memory server. */
export async function disconnectTestDb(): Promise<void> {
  await mongoose.disconnect()
  if (mongod) await mongod.stop()
  mongod = null
}

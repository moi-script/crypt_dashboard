/**
 * One-time setup: create the Atlas Vector Search index for RAG memory retrieval.
 *
 * Works with the Atlas CLI local deployment (Docker) — no online cluster needed.
 *
 * Run once after starting the local deployment:
 *   npx ts-node -r tsconfig-paths/register src/scripts/createVectorIndex.ts
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()  // fallback to .env
import mongoose from 'mongoose'

const MONGO_URL    = process.env.MONGO_URL ?? 'mongodb://localhost:55219/?directConnection=true'
const INDEX_NAME   = process.env.VECTOR_INDEX_NAME ?? 'agentMemory_vector_index'
const COLLECTION   = 'agentmemories'   // Mongoose lowercases + pluralises 'AgentMemory'
const NUM_DIM      = 384               // all-MiniLM-L6-v2 output dimensions

const INDEX_DEFINITION = {
  name: INDEX_NAME,
  type: 'vectorSearch',
  definition: {
    fields: [
      {
        type:          'vector',
        path:          'embedding',
        numDimensions: NUM_DIM,
        similarity:    'cosine',
      },
      { type: 'filter', path: 'coin' },
      { type: 'filter', path: 'type' },
    ],
  },
}

async function main() {
  console.log(`Connecting to ${MONGO_URL} …`)
  await mongoose.connect(MONGO_URL)

  const db         = mongoose.connection.db!
  const collection = db.collection(COLLECTION)

  // Check if the index already exists
  const existing: any[] = []
  try {
    const cursor = collection.listSearchIndexes(INDEX_NAME)
    for await (const idx of cursor) existing.push(idx)
  } catch {
    // listSearchIndexes throws on plain mongod — Atlas local deployment supports it
  }

  if (existing.length > 0) {
    console.log(`Index "${INDEX_NAME}" already exists on "${COLLECTION}". Nothing to do.`)
    await mongoose.disconnect()
    return
  }

  console.log(`Creating vector search index "${INDEX_NAME}" on "${COLLECTION}" …`)
  try {
    // createSearchIndex is available in MongoDB Node.js driver >= 6.0
    await (collection as any).createSearchIndex(INDEX_DEFINITION)
    console.log('Index creation submitted. It may take 30-60 seconds to become active.')
    console.log('You can verify with: mongosh "mongodb://localhost:55219" --eval "db.agentmemories.listSearchIndexes()"')
  } catch (err: any) {
    if (err.message?.includes('already exists')) {
      console.log('Index already exists — skipping.')
    } else {
      console.error('Failed to create index:', err.message)
      process.exit(1)
    }
  }

  await mongoose.disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

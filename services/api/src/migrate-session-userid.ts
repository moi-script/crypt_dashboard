/**
 * migrate-session-userid.ts
 *
 * One-time script — run once to fix existing AgentSession documents
 * that were created without a userId (before the backfill fix).
 *
 * These sessions are "orphaned" — they exist in MongoDB but can't be
 * fetched by GET /api/agent/sessions/user/:userId because userId is null.
 *
 * After running this, the backfill in loadOrCreateSession handles all
 * future cases automatically.
 *
 * Run with:  npx ts-node migrate-session-userid.ts
 */

import './config/env'
import { connectDB } from './config/db'
import { AgentSessionDoc } from './models/agent.model'

async function migrate() {
  await connectDB()

  // 1. Show how many orphaned sessions exist
  const orphaned = await AgentSessionDoc.countDocuments({
    $or: [{ userId: null }, { userId: { $exists: false } }]
  })

  console.log(`Found ${orphaned} sessions without a userId.`)

  if (orphaned === 0) {
    console.log('Nothing to migrate.')
    process.exit(0)
  }

  // 2. List them so you can inspect before deleting
  const docs = await AgentSessionDoc
    .find({ $or: [{ userId: null }, { userId: { $exists: false } }] })
    .select('sessionId coinId createdAt messages')
    .lean()

  for (const d of docs) {
    const msgCount = d.messages?.length ?? 0
    console.log(
      `  sessionId=${d.sessionId}  coin=${d.coinId}  msgs=${msgCount}  created=${d.createdAt}`
    )
  }

  // 3. Decision: delete orphans that have 0 real messages (they're empty shells)
  //    Keep ones with actual conversations so data isn't lost.
  const emptyOrphans = docs.filter(d => {
    const realMsgs = (d.messages ?? []).filter(m => m.content !== '__init__')
    return realMsgs.length === 0
  })

  const hasMessages = docs.filter(d => {
    const realMsgs = (d.messages ?? []).filter(m => m.content !== '__init__')
    return realMsgs.length > 0
  })

  if (emptyOrphans.length > 0) {
    const ids = emptyOrphans.map(d => d.sessionId)
    await AgentSessionDoc.deleteMany({ sessionId: { $in: ids } })
    console.log(`Deleted ${emptyOrphans.length} empty orphaned sessions.`)
  }

  if (hasMessages.length > 0) {
    console.log(`\n${hasMessages.length} orphaned sessions have real messages and were kept.`)
    console.log('These sessions are not linked to any account.')
    console.log('They will be backfilled with a userId automatically the next time')
    console.log('the user opens them (if you can identify which user they belong to).')
  }

  console.log('\nMigration complete.')
  process.exit(0)
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
// services/api/src/agents/memory/memory.store.ts

import { AgentMemoryDoc }     from '../../models/agentMemory.model'
import { AgentReflectionDoc } from '../../models/agentReflection.model'
import type { AgentMemoryEntry, AgentReflection } from './memory.types'

export async function saveMemory(
  entry: Omit<AgentMemoryEntry, '_id'>,
): Promise<AgentMemoryEntry> {
  const doc = await AgentMemoryDoc.create(entry)
  return doc.toObject()
}

export async function saveReflection(
  r: Omit<AgentReflection, '_id'>,
): Promise<AgentReflection> {
  const doc = await AgentReflectionDoc.create(r)
  return doc.toObject()
}

export async function findMemoryByRunId(
  runId: string,
): Promise<AgentMemoryEntry | null> {
  return AgentMemoryDoc.findOne({ runId }).lean()
}

export async function findRecentReflection(
  agentId: string,
  coin: string,
): Promise<AgentReflection | null> {
  return AgentReflectionDoc
    .findOne({ agentId, coin })
    .sort({ 'period.end': -1 })
    .lean()
}

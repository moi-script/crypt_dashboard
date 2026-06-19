// services/api/src/agents/memory/memory.retriever.ts

import mongoose from 'mongoose'
import { AgentMemoryDoc }   from '../../models/agentMemory.model'
import { findRecentReflection } from './memory.store'
import { embed }            from './memory.embedder'
import { MEMORY_CONFIG }    from './memory.config'
import type { MemoryRetrievalResult } from './memory.types'

export async function retrieve(
  agentId:   string,
  coin:      string,
  queryText: string,
): Promise<MemoryRetrievalResult> {
  const queryVector = await embed(queryText)

  // Atlas $vectorSearch — falls back to empty array when index not yet created
  let similarMemories: MemoryRetrievalResult['similarMemories'] = []
  try {
    const results = await AgentMemoryDoc.aggregate([
      {
        $vectorSearch: {
          index:        MEMORY_CONFIG.vectorIndexName,
          path:         'embedding',
          queryVector,
          numCandidates: MEMORY_CONFIG.topK * 10,
          limit:        MEMORY_CONFIG.topK,
          filter:       { coin, type: { $in: ['decision', 'outcome', 'news'] } },
        },
      },
      {
        $project: {
          summary: 1, type: 1, outcome: 1, marketRegime: 1,
          signals: 1, timestamp: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ])

    similarMemories = results
      .filter((r: any) => (r.score ?? 0) >= MEMORY_CONFIG.similarityThreshold)
      .map((r: any) => ({
        summary:      r.summary,
        type:         r.type,
        outcome:      r.outcome,
        marketRegime: r.marketRegime,
        signals:      r.signals,
        timestamp:    r.timestamp,
      }))
  } catch (err: any) {
    // Vector index not yet created or Atlas not available — degrade gracefully
    console.warn('[MemoryRetriever] $vectorSearch failed (index not ready?):', err.message)
  }

  const reflection = await findRecentReflection(agentId, coin).catch(() => null)

  return { similarMemories, reflection }
}

export type MemoryEntryType = 'decision' | 'observation' | 'outcome' | 'news'

export interface AgentMemoryEntry {
  _id?:        string
  agentId:     string          // userId
  runId:       string          // links to AgentRun
  timestamp:   Date
  coin:        string          // e.g. 'BTC'

  type:        MemoryEntryType

  summary:     string          // short text used for embedding
  fullContext: Record<string, unknown>
  embedding:   number[]        // 1536-dim vector from text-embedding-3-small

  linkedDecisionId?: string    // set on 'outcome' entries

  outcome?: {
    pnl:             number
    pnlPercent:      number
    durationHeldMs:  number
    closedAt:        Date
    success:         boolean
    exitPrice?:      number
  }

  marketRegime: string
  signals:      string[]
  tools:        string[]

  // news-specific (only populated when type === 'news')
  articleId?:   string
  headline?:    string
  publishedAt?: Date
}

export interface AgentReflection {
  _id?:    string
  agentId: string
  period:  { start: Date; end: Date }
  coin?:   string

  summary:   string
  embedding: number[]

  stats: {
    totalDecisions: number
    winRate:        number
    avgPnlPercent:  number
    bestPattern:    string
    worstPattern:   string
  }

  lessonsLearned: string[]
}

export interface MemoryRetrievalResult {
  similarMemories: Array<{
    summary:      string
    type:         MemoryEntryType
    outcome?:     AgentMemoryEntry['outcome']
    marketRegime: string
    signals:      string[]
    timestamp:    Date
  }>
  reflection: AgentReflection | null
}

# Agent RAG Memory System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the autonomous agent episodic memory — persist every decision with an embedding, retrieve similar past situations before each decision, and write daily reflections — so the agent learns from its history instead of starting blind on every tick.

**Architecture:** A new `src/agents/memory/` module hooks into the existing agent loop at two points: (1) before `runPolicyEngine`, retrieve the top-5 similar past memories + latest reflection and inject them as a "Relevant history" block in the system prompt; (2) after a decision is recorded, embed and persist it. A third hook in `positionMonitor.ts` writes an outcome entry when a position closes. A nightly scheduler job aggregates outcomes into an `AgentReflection` document via the LLM.

**Tech Stack:** OpenAI `text-embedding-3-small` (1536d) for embeddings, MongoDB Atlas Vector Search (`$vectorSearch`) for similarity retrieval, Mongoose for models, existing `openai` npm package (already installed — reused with real OpenAI API key instead of DeepSeek base URL).

## Global Constraints

- All new files live under `services/api/src/` — the Node/Express backend.
- All tests use the existing `connectTestDb / clearTestDb / disconnectTestDb` harness from `src/__tests__/helpers/db`.
- Run tests with: `cd services/api && npx jest <path> --testTimeout=15000`
- Run type-check with: `cd services/api && npx tsc --noEmit`
- Never add a synchronous dependency on the memory system to the agent loop — every call is wrapped in `try/catch` with graceful fallback so a memory failure never blocks a trade.
- `OPENAI_API_KEY` is a new env var (separate from `DEEPSEEK_API_KEY`). Add it to `.env.local` — never commit secrets.
- MongoDB Atlas Vector Search index must be created manually in the Atlas UI after Task 2 (exact JSON in that task).
- Embedding is done with the **real** OpenAI API: `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })` — no `baseURL` override (unlike the DeepSeek client in `policy.engine.ts`).

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/agents/memory/memory.types.ts` | Create | `AgentMemoryEntry`, `AgentReflection`, `MemoryRetrievalResult` interfaces |
| `src/agents/memory/memory.config.ts` | Create | Env-based tunables: TOP_K, threshold, model name |
| `src/models/agentMemory.model.ts` | Create | Mongoose model + schema for `agentMemory` collection |
| `src/models/agentReflection.model.ts` | Create | Mongoose model + schema for `agentReflection` collection |
| `src/agents/memory/memory.embedder.ts` | Create | `embed(text): Promise<number[]>` — OpenAI wrapper |
| `src/agents/memory/memory.store.ts` | Create | `saveMemory`, `saveReflection`, `findByRunId` |
| `src/agents/memory/memory.retriever.ts` | Create | `retrieve(coin, text)` → `$vectorSearch` + latest reflection |
| `src/agents/memory/memory.writer.ts` | Create | `writeDecision(ctx, decision)`, `writeOutcome(runId, outcome)` |
| `src/agents/policy/prompts/memory.section.prompt.ts` | Create | Renders `MemoryRetrievalResult` into a prompt block |
| `src/agents/policy/policy.engine.ts` | Modify | Accept `memoryContext?: string`; inject into system prompt messages |
| `src/agents/policy/prompts/agent.system.prompt.ts` | Modify | Accept `memorySection?: string`; append to system prompt string |
| `src/agents/loop/agent.loop.ts` | Modify | Retrieve memories before policy engine; write decision after |
| `src/agents/loop/positionMonitor.ts` | Modify | Call `writeOutcome` in `closePosition()` after `PositionDoc.updateOne` |
| `src/agents/loop/scheduler.ts` | Modify | Add nightly reflection job per enabled user |
| `src/agents/memory/reflection.generator.ts` | Create | `runReflection(agentId, coin, period)` — aggregates outcomes → LLM summary → `AgentReflection` |

---

## Task 1: Types and Config

**Files:**
- Create: `services/api/src/agents/memory/memory.types.ts`
- Create: `services/api/src/agents/memory/memory.config.ts`

**Interfaces:**
- Produces: `AgentMemoryEntry`, `AgentReflection`, `MemoryRetrievalResult` — used by every subsequent task
- Produces: `MEMORY_CONFIG` object — used by embedder, retriever, writer

- [ ] **Step 1: Create `memory.types.ts`**

```typescript
// services/api/src/agents/memory/memory.types.ts

export type MemoryEntryType = 'decision' | 'observation' | 'outcome'

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
  }

  marketRegime: string
  signals:      string[]
  tools:        string[]
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
```

- [ ] **Step 2: Create `memory.config.ts`**

```typescript
// services/api/src/agents/memory/memory.config.ts

export const MEMORY_CONFIG = {
  embeddingModel:      process.env.EMBEDDING_MODEL      ?? 'text-embedding-3-small',
  topK:                Number(process.env.MEMORY_TOP_K)  || 5,
  similarityThreshold: Number(process.env.MEMORY_THRESHOLD) || 0.70,
  vectorIndexName:     process.env.VECTOR_INDEX_NAME     ?? 'agentMemory_vector_index',
  reflectionSchedule:  process.env.REFLECTION_SCHEDULE   ?? 'daily',
} as const
```

- [ ] **Step 3: Verify TypeScript is happy**

```bash
cd services/api && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/agents/memory/memory.types.ts services/api/src/agents/memory/memory.config.ts
git commit -m "feat(memory): add AgentMemoryEntry, AgentReflection types and memory config"
```

---

## Task 2: MongoDB Models

**Files:**
- Create: `services/api/src/models/agentMemory.model.ts`
- Create: `services/api/src/models/agentReflection.model.ts`

**Interfaces:**
- Consumes: `AgentMemoryEntry`, `AgentReflection` from Task 1
- Produces: `AgentMemoryDoc`, `AgentReflectionDoc` Mongoose models

> **Atlas Vector Search index** — After deploying this task, create this index on the `agentmemories` collection in the Atlas UI (Database → Search → Create Index → JSON Editor):
> ```json
> {
>   "fields": [
>     { "type": "vector", "path": "embedding", "numDimensions": 1536, "similarity": "cosine" },
>     { "type": "filter", "path": "coin" },
>     { "type": "filter", "path": "type" }
>   ]
> }
> ```
> Name the index `agentMemory_vector_index` (matches `MEMORY_CONFIG.vectorIndexName`).

- [ ] **Step 1: Write the failing model test**

Create `services/api/src/models/__tests__/agentMemory.model.test.ts`:

```typescript
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { AgentMemoryDoc } from '../agentMemory.model'
import { AgentReflectionDoc } from '../agentReflection.model'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('saves and retrieves an AgentMemoryEntry', async () => {
  const entry = await AgentMemoryDoc.create({
    agentId:     'user-1',
    runId:       'run-abc',
    timestamp:   new Date('2026-01-01'),
    coin:        'BTC',
    type:        'decision',
    summary:     'BTC trending up, SmartMoney long signal, confidence 80',
    fullContext: { price: 50000 },
    embedding:   new Array(1536).fill(0.1),
    marketRegime: 'trending_up',
    signals:     ['smartmoney_long'],
    tools:       ['chartSignal'],
  })
  expect(entry.runId).toBe('run-abc')
  expect(entry.embedding).toHaveLength(1536)
})

test('saves and retrieves an AgentReflection', async () => {
  const ref = await AgentReflectionDoc.create({
    agentId:  'user-1',
    period:   { start: new Date('2026-01-01'), end: new Date('2026-01-02') },
    coin:     'BTC',
    summary:  'Mostly profitable on trending days.',
    embedding: new Array(1536).fill(0.2),
    stats: { totalDecisions: 5, winRate: 0.8, avgPnlPercent: 2.1, bestPattern: 'wyckoff spring', worstPattern: 'harmonic in volatile' },
    lessonsLearned: ['Avoid harmonic patterns in high-volatility regime.'],
  })
  expect(ref.stats.winRate).toBe(0.8)
  expect(ref.lessonsLearned).toHaveLength(1)
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd services/api && npx jest src/models/__tests__/agentMemory.model.test.ts --testTimeout=15000
```
Expected: `Cannot find module '../agentMemory.model'`

- [ ] **Step 3: Create `agentMemory.model.ts`**

```typescript
// services/api/src/models/agentMemory.model.ts

import { Schema, model } from 'mongoose'
import type { AgentMemoryEntry } from '../agents/memory/memory.types'

const OutcomeSchema = new Schema({
  pnl:            { type: Number, required: true },
  pnlPercent:     { type: Number, required: true },
  durationHeldMs: { type: Number, required: true },
  closedAt:       { type: Date,   required: true },
  success:        { type: Boolean, required: true },
}, { _id: false })

const AgentMemorySchema = new Schema<AgentMemoryEntry>({
  agentId:     { type: String, required: true, index: true },
  runId:       { type: String, required: true, index: true },
  timestamp:   { type: Date,   required: true, index: true },
  coin:        { type: String, required: true, index: true },
  type:        { type: String, enum: ['decision', 'observation', 'outcome'], required: true },
  summary:     { type: String, required: true },
  fullContext: { type: Schema.Types.Mixed, default: {} },
  embedding:   { type: [Number], required: true },
  linkedDecisionId: String,
  outcome:     OutcomeSchema,
  marketRegime: { type: String, default: 'unknown' },
  signals:     [String],
  tools:       [String],
}, { timestamps: true })

AgentMemorySchema.index({ agentId: 1, coin: 1, timestamp: -1 })
AgentMemorySchema.index({ runId: 1 }, { unique: false })

export const AgentMemoryDoc = model<AgentMemoryEntry>('AgentMemory', AgentMemorySchema)
```

- [ ] **Step 4: Create `agentReflection.model.ts`**

```typescript
// services/api/src/models/agentReflection.model.ts

import { Schema, model } from 'mongoose'
import type { AgentReflection } from '../agents/memory/memory.types'

const AgentReflectionSchema = new Schema<AgentReflection>({
  agentId:  { type: String, required: true, index: true },
  period:   {
    start: { type: Date, required: true },
    end:   { type: Date, required: true },
    _id:   false,
  },
  coin:     String,
  summary:  { type: String, required: true },
  embedding: { type: [Number], required: true },
  stats: {
    totalDecisions: Number,
    winRate:        Number,
    avgPnlPercent:  Number,
    bestPattern:    String,
    worstPattern:   String,
    _id: false,
  },
  lessonsLearned: [String],
}, { timestamps: true })

AgentReflectionSchema.index({ agentId: 1, coin: 1, 'period.end': -1 })

export const AgentReflectionDoc = model<AgentReflection>('AgentReflection', AgentReflectionSchema)
```

- [ ] **Step 5: Run test — expect green**

```bash
cd services/api && npx jest src/models/__tests__/agentMemory.model.test.ts --testTimeout=15000
```
Expected: 2 tests PASS.

- [ ] **Step 6: Type-check**

```bash
cd services/api && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add services/api/src/models/agentMemory.model.ts services/api/src/models/agentReflection.model.ts services/api/src/models/__tests__/agentMemory.model.test.ts
git commit -m "feat(memory): add AgentMemory and AgentReflection Mongoose models"
```

---

## Task 3: Embedder

**Files:**
- Create: `services/api/src/agents/memory/memory.embedder.ts`

**Interfaces:**
- Consumes: `MEMORY_CONFIG.embeddingModel` from Task 1
- Produces: `embed(text: string): Promise<number[]>` — called by writer and retriever

- [ ] **Step 1: Write failing test**

Create `services/api/src/agents/memory/__tests__/memory.embedder.test.ts`:

```typescript
import { embed } from '../memory.embedder'

test('embed returns a 1536-element number array', async () => {
  const vec = await embed('BTC trending up, SmartMoney long, confidence 80')
  expect(Array.isArray(vec)).toBe(true)
  expect(vec).toHaveLength(1536)
  expect(typeof vec[0]).toBe('number')
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd services/api && npx jest src/agents/memory/__tests__/memory.embedder.test.ts --testTimeout=15000
```
Expected: `Cannot find module '../memory.embedder'`

- [ ] **Step 3: Create `memory.embedder.ts`**

```typescript
// services/api/src/agents/memory/memory.embedder.ts

import OpenAI from 'openai'
import { MEMORY_CONFIG } from './memory.config'

// Separate client from the DeepSeek one in policy.engine.ts — no baseURL override
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })

export async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: MEMORY_CONFIG.embeddingModel,
    input: text.slice(0, 8000),  // model max ~8k tokens
  })
  return response.data[0].embedding
}
```

- [ ] **Step 4: Add `OPENAI_API_KEY` to `.env.local`**

Open `services/api/.env.local` (create it if missing) and add:
```
OPENAI_API_KEY=sk-...your-key...
EMBEDDING_MODEL=text-embedding-3-small
MEMORY_TOP_K=5
MEMORY_THRESHOLD=0.70
VECTOR_INDEX_NAME=agentMemory_vector_index
```

- [ ] **Step 5: Run test — expect green**

```bash
cd services/api && npx jest src/agents/memory/__tests__/memory.embedder.test.ts --testTimeout=30000
```
Expected: 1 test PASS. (This makes a real API call — it needs `OPENAI_API_KEY` in env.)

- [ ] **Step 6: Commit**

```bash
git add services/api/src/agents/memory/memory.embedder.ts services/api/src/agents/memory/__tests__/memory.embedder.test.ts
git commit -m "feat(memory): add OpenAI text-embedding-3-small embedder"
```

---

## Task 4: Store and Retriever

**Files:**
- Create: `services/api/src/agents/memory/memory.store.ts`
- Create: `services/api/src/agents/memory/memory.retriever.ts`

**Interfaces:**
- Consumes: `AgentMemoryDoc`, `AgentReflectionDoc` from Task 2; `MEMORY_CONFIG` from Task 1
- Produces:
  - `saveMemory(entry: Omit<AgentMemoryEntry, '_id'>): Promise<AgentMemoryEntry>`
  - `saveReflection(r: Omit<AgentReflection, '_id'>): Promise<AgentReflection>`
  - `findMemoryByRunId(runId: string): Promise<AgentMemoryEntry | null>`
  - `retrieve(agentId: string, coin: string, queryText: string): Promise<MemoryRetrievalResult>`

- [ ] **Step 1: Write failing tests**

Create `services/api/src/agents/memory/__tests__/memory.store.test.ts`:

```typescript
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'
import { saveMemory, findMemoryByRunId } from '../memory.store'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('saveMemory persists an entry and findMemoryByRunId retrieves it', async () => {
  await saveMemory({
    agentId: 'u1', runId: 'run-1', timestamp: new Date(), coin: 'BTC',
    type: 'decision', summary: 'test', fullContext: {},
    embedding: new Array(1536).fill(0), marketRegime: 'ranging', signals: [], tools: [],
  })
  const found = await findMemoryByRunId('run-1')
  expect(found).not.toBeNull()
  expect(found!.coin).toBe('BTC')
})

test('saveMemory fails gracefully with partial data by throwing a validation error', async () => {
  await expect(
    saveMemory({ agentId: '', runId: '', timestamp: new Date(), coin: '', type: 'decision',
      summary: '', fullContext: {}, embedding: [], marketRegime: '', signals: [], tools: [] })
  ).rejects.toThrow()
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd services/api && npx jest src/agents/memory/__tests__/memory.store.test.ts --testTimeout=15000
```
Expected: `Cannot find module '../memory.store'`

- [ ] **Step 3: Create `memory.store.ts`**

```typescript
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
```

- [ ] **Step 4: Run store tests — expect green**

```bash
cd services/api && npx jest src/agents/memory/__tests__/memory.store.test.ts --testTimeout=15000
```
Expected: 2 PASS.

- [ ] **Step 5: Create `memory.retriever.ts`**

```typescript
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
          filter:       { coin, type: { $in: ['decision', 'outcome'] } },
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
```

- [ ] **Step 6: Commit**

```bash
git add services/api/src/agents/memory/memory.store.ts services/api/src/agents/memory/memory.retriever.ts services/api/src/agents/memory/__tests__/memory.store.test.ts
git commit -m "feat(memory): add memory store, retriever with Atlas vectorSearch"
```

---

## Task 5: Writer

**Files:**
- Create: `services/api/src/agents/memory/memory.writer.ts`

**Interfaces:**
- Consumes: `saveMemory` from Task 4; `embed` from Task 3; `Decision`, `LoopContext` from `loop.types.ts`
- Produces:
  - `writeDecision(ctx: LoopContext, decision: Decision): Promise<void>`
  - `writeOutcome(runId: string, outcome: AgentMemoryEntry['outcome']): Promise<void>`

- [ ] **Step 1: Write failing test**

Create `services/api/src/agents/memory/__tests__/memory.writer.test.ts`:

```typescript
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'
import { writeDecision, writeOutcome } from '../memory.writer'
import { AgentMemoryDoc } from '../../../models/agentMemory.model'
import type { LoopContext } from '../../loop/loop.types'
import type { Decision } from '../../loop/loop.types'

// Mock embedder so tests don't call the real OpenAI API
jest.mock('../memory.embedder', () => ({
  embed: jest.fn(async () => new Array(1536).fill(0.1)),
}))

const ctx: LoopContext = {
  runId: 'run-w1', userId: 'user-w1', strategy: 'chartSignal',
  startedAt: Date.now(), contextSummary: 'BTC at 50k, trending up',
  walletState: { mode: 'paper', balances: {}, openPositions: 0, totalValueUsd: 1000, dailyPnlUsd: 0 },
  marketData: {}, config: {} as any,
}

const decision: Decision = {
  intent: { type: 'propose_trade', tokenIn: 'USDC', tokenOut: 'BTC', amountUsd: 100, maxSlippageBps: 50, rationale: 'SmartMoney long signal' },
  confidence: 80,
  reasoning: 'SmartMoney confluence detected',
  toolCallTrace: ['chartSignal'],
}

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('writeDecision persists a decision-type memory entry', async () => {
  await writeDecision(ctx, decision)
  const entry = await AgentMemoryDoc.findOne({ runId: 'run-w1' }).lean()
  expect(entry).not.toBeNull()
  expect(entry!.type).toBe('decision')
  expect(entry!.coin).toBe('BTC')
  expect(entry!.embedding).toHaveLength(1536)
})

test('writeOutcome links back to the decision entry', async () => {
  await writeDecision(ctx, decision)
  const decisionEntry = await AgentMemoryDoc.findOne({ runId: 'run-w1' }).lean()

  await writeOutcome('run-w1', {
    pnl: 12.5, pnlPercent: 2.5, durationHeldMs: 3_600_000,
    closedAt: new Date(), success: true,
  })

  const outcomeEntry = await AgentMemoryDoc.findOne({ type: 'outcome', linkedDecisionId: decisionEntry!._id!.toString() }).lean()
  expect(outcomeEntry).not.toBeNull()
  expect(outcomeEntry!.outcome!.success).toBe(true)
})

test('writeDecision on no_action still persists (type decision, no coin defaults to unknown)', async () => {
  const noActionCtx = { ...ctx, runId: 'run-w2' }
  const noActionDecision: Decision = {
    intent: { type: 'no_action', rationale: 'no signal' },
    confidence: 90, reasoning: 'quiet market', toolCallTrace: [],
  }
  await writeDecision(noActionCtx, noActionDecision)
  const entry = await AgentMemoryDoc.findOne({ runId: 'run-w2' }).lean()
  expect(entry).not.toBeNull()
  expect(entry!.coin).toBe('unknown')
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd services/api && npx jest src/agents/memory/__tests__/memory.writer.test.ts --testTimeout=15000
```
Expected: `Cannot find module '../memory.writer'`

- [ ] **Step 3: Create `memory.writer.ts`**

```typescript
// services/api/src/agents/memory/memory.writer.ts

import { saveMemory, findMemoryByRunId } from './memory.store'
import { embed }                         from './memory.embedder'
import { AgentMemoryDoc }                from '../../models/agentMemory.model'
import type { LoopContext, Decision }    from '../loop/loop.types'
import type { AgentMemoryEntry }        from './memory.types'

function extractCoin(decision: Decision): string {
  const intent = decision.intent
  if (intent.type === 'propose_trade') return intent.tokenOut ?? 'unknown'
  return 'unknown'
}

function buildSummary(ctx: LoopContext, decision: Decision): string {
  const coin   = extractCoin(decision)
  const action = decision.intent.type
  const conf   = decision.confidence
  const reason = decision.reasoning.slice(0, 200)
  return `${coin} | strategy:${ctx.strategy} | action:${action} | confidence:${conf} | ${reason}`
}

export async function writeDecision(
  ctx:      LoopContext,
  decision: Decision,
): Promise<void> {
  try {
    const summary   = buildSummary(ctx, decision)
    const embedding = await embed(summary)

    await saveMemory({
      agentId:     ctx.userId,
      runId:       ctx.runId,
      timestamp:   new Date(),
      coin:        extractCoin(decision),
      type:        'decision',
      summary,
      fullContext: {
        contextSummary: ctx.contextSummary.slice(0, 1000),
        intent:         decision.intent,
        toolCallTrace:  decision.toolCallTrace,
        walletState:    ctx.walletState,
      },
      embedding,
      marketRegime: (ctx.marketData?.regime as string) ?? 'unknown',
      signals:      decision.toolCallTrace,
      tools:        decision.toolCallTrace,
    })
  } catch (err: any) {
    console.warn('[MemoryWriter] writeDecision failed (non-fatal):', err.message)
  }
}

export async function writeOutcome(
  runId:   string,
  outcome: NonNullable<AgentMemoryEntry['outcome']>,
): Promise<void> {
  try {
    const decisionEntry = await findMemoryByRunId(runId)
    if (!decisionEntry) return   // no decision entry to link to — skip silently

    const summary   = `Outcome for ${decisionEntry.coin} | pnl:${outcome.pnl.toFixed(2)} | success:${outcome.success}`
    const embedding = await embed(summary)

    await saveMemory({
      agentId:     decisionEntry.agentId,
      runId:       `${runId}-outcome`,
      timestamp:   outcome.closedAt,
      coin:        decisionEntry.coin,
      type:        'outcome',
      summary,
      fullContext: { outcome },
      embedding,
      linkedDecisionId: String(decisionEntry._id),
      outcome,
      marketRegime: decisionEntry.marketRegime,
      signals:      decisionEntry.signals,
      tools:        decisionEntry.tools,
    })
  } catch (err: any) {
    console.warn('[MemoryWriter] writeOutcome failed (non-fatal):', err.message)
  }
}
```

- [ ] **Step 4: Run tests — expect green**

```bash
cd services/api && npx jest src/agents/memory/__tests__/memory.writer.test.ts --testTimeout=15000
```
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/agents/memory/memory.writer.ts services/api/src/agents/memory/__tests__/memory.writer.test.ts
git commit -m "feat(memory): add writeDecision and writeOutcome memory writer"
```

---

## Task 6: Prompt Section + Policy Engine Integration

**Files:**
- Create: `services/api/src/agents/policy/prompts/memory.section.prompt.ts`
- Modify: `services/api/src/agents/policy/prompts/agent.system.prompt.ts`
- Modify: `services/api/src/agents/policy/policy.engine.ts`

**Interfaces:**
- Consumes: `MemoryRetrievalResult` from Task 1
- Produces: `renderMemorySection(result: MemoryRetrievalResult): string`
- `runPolicyEngine` gains optional 4th param: `memoryContext?: string`

- [ ] **Step 1: Create `memory.section.prompt.ts`**

```typescript
// services/api/src/agents/policy/prompts/memory.section.prompt.ts

import type { MemoryRetrievalResult } from '../../memory/memory.types'

export function renderMemorySection(result: MemoryRetrievalResult): string {
  if (result.similarMemories.length === 0 && !result.reflection) return ''

  const lines: string[] = ['## Relevant history (RAG context — use as advisory, not rules)']

  if (result.reflection) {
    const r = result.reflection
    lines.push(
      `\n### Most recent reflection (${r.period.start.toISOString().slice(0, 10)} – ${r.period.end.toISOString().slice(0, 10)})`,
      `Win rate: ${(r.stats.winRate * 100).toFixed(0)}% | Avg PnL: ${r.stats.avgPnlPercent.toFixed(2)}% | Decisions: ${r.stats.totalDecisions}`,
      `Best pattern: ${r.stats.bestPattern}`,
      `Worst pattern: ${r.stats.worstPattern}`,
      `Lessons: ${r.lessonsLearned.join(' | ')}`,
    )
  }

  if (result.similarMemories.length > 0) {
    lines.push('\n### Similar past situations')
    for (const m of result.similarMemories) {
      const ts    = new Date(m.timestamp).toISOString().slice(0, 16).replace('T', ' ')
      const pnl   = m.outcome ? ` → PnL: ${m.outcome.pnl.toFixed(2)} (${m.outcome.success ? '✓' : '✗'})` : ''
      lines.push(`- [${ts}] ${m.summary}${pnl}`)
    }
  }

  return lines.join('\n')
}
```

- [ ] **Step 2: Modify `agent.system.prompt.ts` to accept a memory section**

In `services/api/src/agents/policy/prompts/agent.system.prompt.ts`, update the `SystemPromptContext` interface and `buildAgentSystemPrompt` function:

```typescript
// Add memorySection to the interface:
export interface SystemPromptContext {
  mode:          AgentMode
  strategy:      string
  walletSummary: string
  maxTradeUsd:   number
  memorySection?: string   // ← add this
}

// In the return string of buildAgentSystemPrompt, append after the hard rules block:
// Replace the final return with:
return `You are an autonomous crypto portfolio agent running the "${ctx.strategy}" strategy.
${modeWarning}

## Your role
You are the reasoning engine. You perceive market data, reason about it, and produce a single decision.
You do NOT execute — a separate risk engine validates and executes your decisions.

## Wallet
${ctx.walletSummary}
Max trade size: $${ctx.maxTradeUsd} USD

## How to use your tools
1. Start by calling read tools (get_price, get_yields, get_token_volume, get_news_sentiment, get_wallet_state) to gather the data you need.
2. You may call read tools up to 5 times in a row to build a complete picture.
3. Once you have enough data, call exactly ONE act tool to express your decision:
   - propose_trade    → when you have a clear, data-backed trade idea
   - set_alert        → when conditions are interesting but not yet compelling
   - rebalance        → when portfolio drift exceeds tolerance
   - no_action        → when nothing compelling warrants action (this is often correct)

## Hard rules you must follow
- NEVER propose a trade without citing specific numbers from your read tool results.
- NEVER trade a token not in the allowlist (you will be blocked by the risk engine anyway).
- NEVER exceed the max trade size. Propose smaller if uncertain.
- NEVER rely on price predictions alone — yield anomalies, volume spikes, and confirmed divergences are more reliable signals.
- ALWAYS prefer no_action over a speculative trade. The cost of a bad trade >> cost of a missed opportunity.
- Expected profit must exceed fees/gas. If you cannot estimate profit, default to no_action or set_alert.
- If skills are in conflict or data is ambiguous, set an alert and do not trade.
${ctx.memorySection ? `\n${ctx.memorySection}` : ''}

## Output format
Call your tools, then call exactly one act tool. No prose explanations outside tool calls.
Your rationale belongs inside the tool call's "rationale" field.`
```

- [ ] **Step 3: Modify `policy.engine.ts` to accept and use memoryContext**

In `runPolicyEngine`, add the optional 4th parameter and pass the memory section into `buildAgentSystemPrompt`:

```typescript
// Change the function signature (line ~64):
export async function runPolicyEngine(
  ctx:                    LoopContext,
  strategyContextSummary: string,
  config:                 AgentConfig,
  memoryContext?:         string,     // ← add this
): Promise<Decision> {
```

Then in the `buildAgentSystemPrompt` call (around line ~86), pass the memory section:

```typescript
  const systemPrompt = buildAgentSystemPrompt({
    mode:          config.mode,
    strategy:      ctx.strategy,
    walletSummary,
    maxTradeUsd:   config.maxTradeUsd,
    memorySection: memoryContext,     // ← add this
  })
```

- [ ] **Step 4: Type-check**

```bash
cd services/api && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/agents/policy/prompts/memory.section.prompt.ts services/api/src/agents/policy/prompts/agent.system.prompt.ts services/api/src/agents/policy/policy.engine.ts
git commit -m "feat(memory): inject RAG context into agent system prompt"
```

---

## Task 7: Agent Loop Integration

**Files:**
- Modify: `services/api/src/agents/loop/agent.loop.ts`

**Interfaces:**
- Consumes: `retrieve` from Task 4; `renderMemorySection` from Task 6; `writeDecision` from Task 5; `runPolicyEngine` (updated signature from Task 6)

- [ ] **Step 1: Write a failing integration test**

Create `services/api/src/agents/loop/__tests__/memory.loop.integration.test.ts`:

```typescript
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'
import { AgentMemoryDoc } from '../../../models/agentMemory.model'
import { AgentConfigDoc } from '../../../models/agentConfig.model'
import { DEFAULT_AGENT_CONFIG } from '../../../config/agent.config'
import { getOrCreateWallet } from '../../../services/paperWallet.service'
import { runLoopTick } from '../agent.loop'

// Mock everything that touches external services
jest.mock('../../policy/policy.engine', () => ({
  runPolicyEngine: jest.fn(async () => ({
    intent: { type: 'no_action', rationale: 'test quiet market' },
    confidence: 90, reasoning: 'quiet', toolCallTrace: [],
  })),
}))

jest.mock('../../memory/memory.embedder', () => ({
  embed: jest.fn(async () => new Array(1536).fill(0.1)),
}))

jest.mock('../../memory/memory.retriever', () => ({
  retrieve: jest.fn(async () => ({ similarMemories: [], reflection: null })),
}))

jest.mock('../../policy/strategies/yieldHunter.strategy', () => ({
  yieldHunterStrategy: {
    buildContext: jest.fn(async () => ({
      contextSummary: 'yields stable', metadata: {}, deterministicDecision: null,
    })),
  },
}))

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    json: async () => ({ bitcoin: { usd: 50000 } }),
  })) as any
})

test('runLoopTick writes a decision memory entry after each tick', async () => {
  await getOrCreateWallet('user-mem')
  await AgentConfigDoc.create({
    userId: 'user-mem', ...DEFAULT_AGENT_CONFIG, enabled: true,
    requireManualApproval: false,
    strategies: { yieldHunter: true, rebalance: false, airdropWatch: false, chartSignal: false },
  })

  await runLoopTick('user-mem')

  const entries = await AgentMemoryDoc.find({ agentId: 'user-mem' }).lean()
  expect(entries.length).toBeGreaterThanOrEqual(1)
  expect(entries[0].type).toBe('decision')
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd services/api && npx jest src/agents/loop/__tests__/memory.loop.integration.test.ts --testTimeout=15000
```
Expected: fails because `agent.loop.ts` doesn't call `writeDecision` yet.

- [ ] **Step 3: Modify `agent.loop.ts`**

Add these imports at the top of `agent.loop.ts` (after existing imports):

```typescript
import { retrieve }            from '../memory/memory.retriever'
import { renderMemorySection } from '../policy/prompts/memory.section.prompt'
import { writeDecision }       from '../memory/memory.writer'
```

In `runLoopTick`, between `const { text: contextSummary } = buildContextSummary(...)` and `await persistOpportunities(...)`, add the memory retrieval:

```typescript
    // ── Memory retrieval (RAG) ──────────────────────────────────────────────
    let memoryContext: string | undefined
    try {
      const coin = config.watchlist[0] ?? 'BTC'
      const memResult = await retrieve(userId, coin.toUpperCase(), contextSummary)
      memoryContext = renderMemorySection(memResult) || undefined
    } catch (err: any) {
      console.warn('[AgentLoop] Memory retrieval failed (non-fatal):', err.message)
    }
```

Then pass `memoryContext` to `runPolicyEngine`. Change:

```typescript
    const decision = strategyResult.deterministicDecision
      ?? await runPolicyEngine(loopCtx, contextSummary, config)
```
to:
```typescript
    const decision = strategyResult.deterministicDecision
      ?? await runPolicyEngine(loopCtx, contextSummary, config, memoryContext)
```

After `await persistExecution(...)` and before the `AgentRunDoc.updateOne` at the end, add:

```typescript
    // ── Write decision memory ───────────────────────────────────────────────
    await writeDecision(loopCtx, decision)
```

- [ ] **Step 4: Run integration test — expect green**

```bash
cd services/api && npx jest src/agents/loop/__tests__/memory.loop.integration.test.ts --testTimeout=15000
```
Expected: 1 PASS.

- [ ] **Step 5: Run full test suite to catch regressions**

```bash
cd services/api && npx jest --testTimeout=15000
```
Expected: all tests pass (no regressions).

- [ ] **Step 6: Commit**

```bash
git add services/api/src/agents/loop/agent.loop.ts services/api/src/agents/loop/__tests__/memory.loop.integration.test.ts
git commit -m "feat(memory): retrieve RAG context before each tick and write decision after"
```

---

## Task 8: Outcome Hook in Position Monitor

**Files:**
- Modify: `services/api/src/agents/loop/positionMonitor.ts`

**Interfaces:**
- Consumes: `writeOutcome` from Task 5

- [ ] **Step 1: Write a failing test**

Create `services/api/src/agents/loop/__tests__/positionMonitor.memory.test.ts`:

```typescript
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'
import { AgentMemoryDoc } from '../../../models/agentMemory.model'
import { AgentRunDoc } from '../../../models/agentRun.model'
import { PositionDoc } from '../../../models/position.model'
import { runPositionMonitorSweep } from '../positionMonitor'

jest.mock('../../memory/memory.embedder', () => ({
  embed: jest.fn(async () => new Array(1536).fill(0.1)),
}))

// Seed a decision memory entry so writeOutcome can link to it
async function seedDecisionEntry(runId: string) {
  await AgentMemoryDoc.create({
    agentId: 'user-pm', runId, timestamp: new Date(), coin: 'BTC',
    type: 'decision', summary: 'BTC long', fullContext: {},
    embedding: new Array(1536).fill(0.1), marketRegime: 'trending_up',
    signals: [], tools: [],
  })
}

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ bitcoin: { usd: 55000 } }),  // above take-profit
  })) as any
})

test('closePosition writes an outcome memory entry when a position closes', async () => {
  const runId = 'run-pm1'
  await seedDecisionEntry(runId)

  await PositionDoc.create({
    positionId: 'pos-pm1', userId: 'user-pm', mode: 'paper', status: 'open',
    tokenIn: 'USDC', tokenOut: 'BTC', entryAmountUsd: 100, entryPrice: 50000,
    entryFeesUsd: 0, entryAt: new Date(), isOpen: true,
    strategy: 'chartSignal', runId,
    stopLossPrice: 48000, takeProfitPrice: 53000,
  })

  await runPositionMonitorSweep()

  const outcomeEntries = await AgentMemoryDoc.find({ type: 'outcome' }).lean()
  expect(outcomeEntries.length).toBeGreaterThanOrEqual(1)
  expect(outcomeEntries[0].linkedDecisionId).toBeDefined()
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd services/api && npx jest src/agents/loop/__tests__/positionMonitor.memory.test.ts --testTimeout=15000
```
Expected: 1 FAIL — `positionMonitor` doesn't call `writeOutcome` yet.

- [ ] **Step 3: Modify `positionMonitor.ts`**

Add import at the top:

```typescript
import { writeOutcome } from '../memory/memory.writer'
```

In `closePosition`, after the `PositionDoc.updateOne` call (the final `await PositionDoc.updateOne(...)` block), add:

```typescript
  // Write outcome memory — non-fatal, same position.runId used when the decision was written
  await writeOutcome(position.runId ?? '', {
    pnl:            result.simulatedPnlUsd ?? 0,
    pnlPercent:     position.entryAmountUsd > 0
      ? ((result.simulatedPnlUsd ?? 0) / position.entryAmountUsd) * 100
      : 0,
    durationHeldMs: result.executedAt.getTime() - new Date(position.entryAt).getTime(),
    closedAt:       result.executedAt,
    success:        (result.simulatedPnlUsd ?? 0) > 0,
  }).catch((err: any) => console.warn('[PositionMonitor] writeOutcome failed:', err.message))
```

Note: `position` in `closePosition` doesn't currently have `runId` or `entryAt` — extend the type parameter to include them:

```typescript
// Change the position parameter type in closePosition to include runId and entryAt:
async function closePosition(
  position: {
    positionId: string; userId?: string; tokenIn: string; tokenOut: string;
    entryAmountUsd: number; entryPrice?: number; strategy: string; confidence?: number;
    runId?: string; entryAt?: Date;   // ← add these two
  },
  exitPrice: number,
  reason: ExitReason,
): Promise<void> {
```

In `runPositionMonitorSweep`, the `openPositions` query result from `PositionDoc.find(...)` already includes `runId` and `entryAt` because the schema has them. The lean query returns all fields. No change needed in the query.

- [ ] **Step 4: Run test — expect green**

```bash
cd services/api && npx jest src/agents/loop/__tests__/positionMonitor.memory.test.ts --testTimeout=15000
```
Expected: 1 PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd services/api && npx jest --testTimeout=15000
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/agents/loop/positionMonitor.ts services/api/src/agents/loop/__tests__/positionMonitor.memory.test.ts
git commit -m "feat(memory): write outcome entry when a position closes"
```

---

## Task 9: Reflection Generator + Nightly Scheduler

**Files:**
- Create: `services/api/src/agents/memory/reflection.generator.ts`
- Modify: `services/api/src/agents/loop/scheduler.ts`

**Interfaces:**
- Consumes: `AgentMemoryDoc`, `AgentReflectionDoc` from Task 2; `embed` from Task 3; `saveReflection` from Task 4
- Produces: `runReflection(agentId: string, coin: string): Promise<void>`

- [ ] **Step 1: Write failing test**

Create `services/api/src/agents/memory/__tests__/reflection.generator.test.ts`:

```typescript
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'
import { AgentMemoryDoc }     from '../../../models/agentMemory.model'
import { AgentReflectionDoc } from '../../../models/agentReflection.model'
import { runReflection }      from '../reflection.generator'

jest.mock('../memory.embedder', () => ({
  embed: jest.fn(async () => new Array(1536).fill(0.2)),
}))

// Mock DeepSeek LLM call inside reflection.generator
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: 'BTC trending wins most.',
                lessonsLearned: ['Trade with trend.', 'Avoid ranging in low vol.'],
                bestPattern: 'trending_up long',
                worstPattern: 'ranging short',
              }),
            },
          }],
        })),
      },
    },
  }))
})

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

async function seedDecisions() {
  const base = {
    agentId: 'user-ref', coin: 'BTC', type: 'decision' as const,
    summary: 'BTC long', fullContext: {}, embedding: new Array(1536).fill(0),
    marketRegime: 'trending_up', signals: [], tools: [],
  }
  await AgentMemoryDoc.create({ ...base, runId: 'run-r1', timestamp: new Date(Date.now() - 3600_000) })
  await AgentMemoryDoc.create({ ...base, runId: 'run-r2', timestamp: new Date(Date.now() - 7200_000) })
  await AgentMemoryDoc.create({
    ...base, runId: 'run-r1-outcome', type: 'outcome',
    timestamp: new Date(), linkedDecisionId: 'fake-id',
    outcome: { pnl: 10, pnlPercent: 2, durationHeldMs: 3600000, closedAt: new Date(), success: true },
  })
}

test('runReflection creates an AgentReflection document', async () => {
  await seedDecisions()
  await runReflection('user-ref', 'BTC')
  const reflections = await AgentReflectionDoc.find({ agentId: 'user-ref' }).lean()
  expect(reflections).toHaveLength(1)
  expect(reflections[0].lessonsLearned.length).toBeGreaterThan(0)
  expect(reflections[0].coin).toBe('BTC')
})

test('runReflection is a no-op when there are no memory entries', async () => {
  await runReflection('user-ref', 'BTC')
  const reflections = await AgentReflectionDoc.find({}).lean()
  expect(reflections).toHaveLength(0)
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd services/api && npx jest src/agents/memory/__tests__/reflection.generator.test.ts --testTimeout=15000
```
Expected: `Cannot find module '../reflection.generator'`

- [ ] **Step 3: Create `reflection.generator.ts`**

```typescript
// services/api/src/agents/memory/reflection.generator.ts

import OpenAI           from 'openai'
import { AgentMemoryDoc } from '../../models/agentMemory.model'
import { saveReflection } from './memory.store'
import { embed }          from './memory.embedder'

// Uses DeepSeek (same as policy engine) for the reflection LLM call —
// keeping OpenAI SDK but pointing at DeepSeek base URL.
const llm = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey:  process.env.DEEPSEEK_API_KEY ?? '',
})

const LOOKBACK_MS = 24 * 60 * 60 * 1000  // 1 day

export async function runReflection(agentId: string, coin: string): Promise<void> {
  try {
    const since = new Date(Date.now() - LOOKBACK_MS)

    const entries = await AgentMemoryDoc.find({
      agentId, coin,
      type: { $in: ['decision', 'outcome'] },
      timestamp: { $gte: since },
    }).lean()

    if (entries.length === 0) return  // nothing to reflect on

    const decisions = entries.filter(e => e.type === 'decision')
    const outcomes  = entries.filter(e => e.type === 'outcome' && e.outcome)

    const winRate     = outcomes.length > 0
      ? outcomes.filter(e => e.outcome!.success).length / outcomes.length
      : 0
    const avgPnl      = outcomes.length > 0
      ? outcomes.reduce((s, e) => s + (e.outcome!.pnlPercent ?? 0), 0) / outcomes.length
      : 0

    const statsText = [
      `Coin: ${coin}`,
      `Decisions: ${decisions.length}`,
      `Outcomes with PnL: ${outcomes.length}`,
      `Win rate: ${(winRate * 100).toFixed(0)}%`,
      `Avg PnL%: ${avgPnl.toFixed(2)}%`,
      `Summaries: ${decisions.map(d => d.summary).join(' | ')}`,
    ].join('\n')

    const completion = await llm.chat.completions.create({
      model:       'deepseek-chat',
      max_tokens:  400,
      temperature: 0.4,
      messages: [
        {
          role:    'system',
          content: 'You are a trading performance analyst. Summarize what worked and what did not in the given period. Return ONLY valid JSON with keys: summary (string), lessonsLearned (string[]), bestPattern (string), worstPattern (string).',
        },
        { role: 'user', content: statsText },
      ],
    })

    let parsed: { summary: string; lessonsLearned: string[]; bestPattern: string; worstPattern: string }
    try {
      parsed = JSON.parse(completion.choices[0].message.content ?? '{}')
    } catch {
      parsed = { summary: 'Reflection unavailable.', lessonsLearned: [], bestPattern: 'n/a', worstPattern: 'n/a' }
    }

    const summaryText = parsed.summary
    const embedding   = await embed(summaryText)

    await saveReflection({
      agentId,
      coin,
      period: { start: since, end: new Date() },
      summary: summaryText,
      embedding,
      stats: {
        totalDecisions: decisions.length,
        winRate,
        avgPnlPercent:  avgPnl,
        bestPattern:    parsed.bestPattern,
        worstPattern:   parsed.worstPattern,
      },
      lessonsLearned: parsed.lessonsLearned,
    })

    console.log(`[ReflectionGenerator] Reflection written for ${agentId}/${coin}`)
  } catch (err: any) {
    console.warn('[ReflectionGenerator] Failed (non-fatal):', err.message)
  }
}
```

- [ ] **Step 4: Run reflection tests — expect green**

```bash
cd services/api && npx jest src/agents/memory/__tests__/reflection.generator.test.ts --testTimeout=15000
```
Expected: 2 PASS.

- [ ] **Step 5: Add nightly reflection job to `scheduler.ts`**

Add import at top of `scheduler.ts`:

```typescript
import { runReflection }  from '../memory/reflection.generator'
import { AgentConfigDoc } from '../../models/agentConfig.model'
```

(`AgentConfigDoc` is already imported — don't duplicate it.)

Add this function and interval after `stopScheduler`:

```typescript
// ── Nightly reflection sweep ──────────────────────────────────────────────────

let _reflectionTimer: NodeJS.Timeout | null = null

export function startReflectionScheduler(): void {
  if (_reflectionTimer) return

  const MS_PER_DAY = 24 * 60 * 60 * 1000

  _reflectionTimer = setInterval(async () => {
    try {
      const enabled = await AgentConfigDoc.find({ enabled: true }).select('userId watchlist').lean()
      for (const cfg of enabled) {
        const coins = (cfg.watchlist ?? ['bitcoin']).slice(0, 3)  // cap at 3 coins per user
        for (const coin of coins) {
          const symbol = coin.replace('bitcoin', 'BTC').replace('ethereum', 'ETH').toUpperCase()
          await runReflection(cfg.userId, symbol).catch(() => {})
        }
      }
    } catch (err: any) {
      console.error('[ReflectionScheduler] Sweep error:', err.message)
    }
  }, MS_PER_DAY)

  if (_reflectionTimer.unref) _reflectionTimer.unref()
  console.log('[ReflectionScheduler] Nightly reflection job started.')
}

export function stopReflectionScheduler(): void {
  if (_reflectionTimer) {
    clearInterval(_reflectionTimer)
    _reflectionTimer = null
  }
}
```

- [ ] **Step 6: Call `startReflectionScheduler()` in `app.ts`**

In `services/api/src/app.ts`, find where `startScheduler()` is called and add the reflection scheduler next to it:

```typescript
import { startReflectionScheduler } from './agents/loop/scheduler'
// ...existing startScheduler() call...
startReflectionScheduler()
```

- [ ] **Step 7: Type-check**

```bash
cd services/api && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Run full test suite**

```bash
cd services/api && npx jest --testTimeout=15000
```
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add services/api/src/agents/memory/reflection.generator.ts services/api/src/agents/memory/__tests__/reflection.generator.test.ts services/api/src/agents/loop/scheduler.ts services/api/src/app.ts
git commit -m "feat(memory): add reflection generator and nightly scheduler job"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Persist every decision with embedding → Task 5 + 7
- ✅ Retrieve top-N similar memories + reflection before each decision → Task 4 + 7
- ✅ Inject retrieved memories into prompt → Task 6
- ✅ Write outcome on position close → Task 8
- ✅ Nightly reflection job → Task 9
- ✅ MongoDB Atlas Vector Search (`$vectorSearch`) → Task 4
- ✅ OpenAI `text-embedding-3-small` → Task 3
- ✅ Graceful degradation: every memory call is `try/catch` non-fatal → Tasks 5, 7, 8, 9
- ✅ Models: `agentMemory`, `agentReflection` → Task 2
- ✅ All types defined → Task 1

**Type consistency:**
- `AgentMemoryEntry` defined in Task 1, imported in Tasks 2, 5
- `MemoryRetrievalResult` defined in Task 1, returned by `retrieve` in Task 4, consumed in Task 6
- `writeDecision(ctx: LoopContext, decision: Decision)` defined in Task 5, called in Task 7
- `writeOutcome(runId: string, outcome: AgentMemoryEntry['outcome'])` defined in Task 5, called in Task 8
- `runReflection(agentId: string, coin: string)` defined in Task 9, called in Task 9 scheduler
- `renderMemorySection(result: MemoryRetrievalResult)` defined in Task 6, called in Task 7
- `runPolicyEngine(..., memoryContext?: string)` updated in Task 6, called in Task 7 ✅

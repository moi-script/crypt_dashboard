

# Agent Memory & RAG System — Design Document

## 1. Purpose

The trading agent currently reasons with whatever fits in the LLM's context window per loop iteration. There is no durable record of *why* a decision was made, what the market looked like at the time, or what happened afterward. This document designs a memory subsystem that:

- Persists every agent decision, observation, and outcome to a database
- Embeds summaries for similarity-based retrieval (RAG)
- Periodically compresses history into "reflections" (lessons learned)
- Injects relevant past memory + reflections into the agent's prompt at decision time

This is additive to the existing agent — it does not replace `orchestrator.ts`, `agent.loop.ts`, or the skills/tools layer. It plugs in as a new module that reads from and writes to the loop.

---

## 2. Scope

### In scope
- New `agents/memory/` module (embedder, store, retriever, writer)
- New MongoDB collections: `agentMemory`, `agentReflection`
- Vector index setup (Atlas Vector Search or pgvector, see Section 8)
- Hooks into `agent.loop.ts`, `report.generator.ts`, and `execution.gateway.ts`
- Prompt template additions in `agents/policy/prompts/`
- A scheduled reflection job using the existing scheduler pattern
- Embedding provider integration (separate from the reasoning LLM)

### Out of scope (for this phase)
- Replacing the existing LLM (Claude/DeepSeek) reasoning pipeline
- Changing risk engine logic
- Building a separate Python service (evaluated in Section 9, not implemented yet)
- Fine-tuning or training any model on historical data
- Real-time streaming of memory updates to frontend (frontend just reads via existing report/agentRun endpoints)

---

## 3. What this system does

- Writes a structured "memory entry" at the end of every agent loop iteration (decision + context snapshot + embedding)
- Writes an "outcome" entry when a position closes, linked back to the originating decision
- Before each new decision, retrieves the top-N most similar past memories (by embedding similarity) + the most recent reflection for that coin/regime
- Injects retrieved memories into the prompt as a "relevant history" section
- Runs a nightly job that summarizes the day's/week's decisions into a `AgentReflection` document with win rate, best/worst patterns, and lessons learned in plain text
- Provides an audit trail: every trade can be traced back to the exact context and reasoning that produced it

## 4. What this system does NOT do

- Does not make trading decisions itself — it only supplies context
- Does not guarantee the LLM will use the retrieved memory correctly (it's advisory context, not a hard rule)
- Does not retroactively edit or "correct" past decisions
- Does not replace the risk engine's real-time checks
- Does not store raw API keys, secrets, or wallet credentials (memory entries contain market/decision data only)
- Does not perform online learning / weight updates — "learning" here means retrieval + summarization, not model training
- Does not block the agent loop if memory retrieval fails — retrieval failures should degrade gracefully (proceed without memory context, log a warning)

---

## 5. File structure

```
src/agents/memory/
├── memory.types.ts            # AgentMemoryEntry, AgentReflection, retrieval result types
├── memory.embedder.ts          # wraps embedding API (text -> vector)
├── memory.store.ts             # CRUD for agentMemory / agentReflection collections
├── memory.retriever.ts         # similarity search + filtering + ranking
├── memory.writer.ts            # writes decision/observation/outcome entries
├── memory.config.ts            # tunables: top-K, similarity threshold, embedding model
└── reflection.generator.ts     # scheduled job: aggregates -> LLM summary -> AgentReflection

src/models/
├── agentMemory.model.ts
└── agentReflection.model.ts

src/models/schemes/
├── agentMemory.schema.ts
└── agentReflection.schema.ts
```

Prompt additions:

```
src/agents/policy/prompts/
└── memory.section.prompt.ts    # renders retrieved memories + reflection into prompt text
```

Scheduler addition:

```
src/agents/loop/scheduler.ts    # add a 'reflection' job type, runs nightly per coin/agent
```

---

## 6. Data models

### AgentMemoryEntry

```typescript
interface AgentMemoryEntry {
  _id: ObjectId;
  agentId: string;
  runId: string;                 // links to agentRun
  timestamp: Date;
  coin: string;

  type: 'decision' | 'observation' | 'outcome';

  summary: string;               // short text used for embedding, e.g.
                                  // "BTC, regime: trending-bull, signals: [wyckoff-spring,
                                  //  bullish-divergence], action: long, conviction: 0.7"
  fullContext: Record<string, unknown>; // raw snapshot: indicators, prices, news refs
  embedding: number[];           // vector from memory.embedder.ts

  linkedDecisionId?: ObjectId;   // set on 'outcome' entries, points back to the decision

  outcome?: {
    pnl: number;
    pnlPercent: number;
    durationHeldMs: number;
    closedAt: Date;
    success: boolean;
  };

  marketRegime: string;          // from regimeDetector.service.ts
  signals: string[];             // tags from skills (e.g. 'wyckoff-spring')
  tools: string[];                // which tools/skills contributed to this decision
}
```

### AgentReflection

```typescript
interface AgentReflection {
  _id: ObjectId;
  agentId: string;
  period: { start: Date; end: Date };
  coin?: string;                  // omit for cross-coin/global reflection

  summary: string;                // LLM-generated digest (plain text)
  embedding: number[];

  stats: {
    totalDecisions: number;
    winRate: number;
    avgPnlPercent: number;
    bestPattern: string;          // e.g. "wyckoff accumulation in low-vol regime"
    worstPattern: string;
  };

  lessonsLearned: string[];       // bullet points, plain text
}
```

---

## 7. Integration with existing agent workflow

| Existing file | Change |
|---|---|
| `agents/loop/agent.loop.ts` | At start of iteration: call `memory.retriever.retrieve(coin, context)`. At end: call `memory.writer.writeDecision(...)`. |
| `agents/policy/policy.engine.ts` | Accept a `memoryContext` field, pass to prompt builder. |
| `agents/policy/prompts/*` | Add `memory.section.prompt.ts` — renders retrieved memories + reflection as a "Relevant history" block. |
| `agents/report.generator.ts` | After generating a report, call `memory.writer.writeDecision()` with the report's summary as the embedding text. |
| `execution/execution.gateway.ts` (and each executor in `execution/modes/`) | On position close, emit a close event → `memory.writer.writeOutcome(linkedDecisionId, outcomeData)`. |
| `agents/loop/scheduler.ts` | Register a nightly `reflection` job per agent/coin → `reflection.generator.run()`. |
| `config/agent.config.ts` | Add memory config block (embedding model, top-K, similarity threshold). |
| `config/env.ts` | Add `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`, `VECTOR_INDEX_NAME`. |

### Retrieval flow (per loop iteration)

1. `agent.loop.ts` builds the current context snapshot (as it does today)
2. Before calling the policy engine, call `memory.retriever.retrieve({ coin, contextSnapshot })`
   - Embeds a short summary of the current context
   - Vector search against `agentMemory` filtered by `coin` and `type IN ['decision','outcome']`
   - Fetches the most recent `AgentReflection` for `coin`
   - Returns `{ similarMemories: [...], reflection: {...} }`
3. Pass this into `policy.engine.ts` → rendered via `memory.section.prompt.ts` into the prompt
4. After the decision is made, `memory.writer.writeDecision()` persists it with a fresh embedding

### Write flow (on position close)

1. Executor (`paper.executor.ts` / `cex.executor.ts` / `onchain.executor.ts`) detects a close
2. Calls `execution.gateway.ts` close handler
3. Gateway calls `memory.writer.writeOutcome(linkedDecisionId, { pnl, pnlPercent, durationHeldMs, closedAt, success })`
4. This updates/creates an `outcome`-type `AgentMemoryEntry` linked to the original decision

### Reflection job (nightly, per coin)

1. Scheduler triggers `reflection.generator.run({ agentId, coin, period: 'daily' })`
2. Job queries `agentMemory` for the period's `decision` + `outcome` entries
3. Computes `stats` (win rate, avg PnL, pattern frequency vs outcome)
4. Sends aggregated data to the LLM with a prompt: "summarize what worked, what didn't, and 3-5 lessons"
5. Embeds the summary, writes `AgentReflection`

---

## 8. Packages to install

```bash
# Embedding client (if using OpenAI embeddings)
npm install openai

# If using MongoDB Atlas Vector Search — no new package needed,
# the existing mongodb/mongoose driver supports $vectorSearch aggregation stage

# If using pgvector instead (see Section 9)
npm install pg pgvector

# If self-hosting embeddings (avoid external API cost)
# requires a Python sidecar or ONNX runtime — adds complexity, see Section 9
```

Config additions (`.env.additions`):

```
EMBEDDING_PROVIDER=openai           # or 'local'
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_API_KEY=...
VECTOR_INDEX_NAME=agentMemory_vector_index
MEMORY_RETRIEVAL_TOP_K=5
MEMORY_SIMILARITY_THRESHOLD=0.75
REFLECTION_SCHEDULE=daily           # cron expression or named schedule
```

### Vector index setup (MongoDB Atlas)

Create a vector search index on `agentMemory.embedding`:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 1536, "similarity": "cosine" },
    { "type": "filter", "path": "coin" },
    { "type": "filter", "path": "type" }
  ]
}
```

If not on Atlas (e.g. self-hosted Mongo without vector search), fall back to `pgvector` on a Postgres instance — see trade-off discussion below.

---

## 9. Python vs Node.js — should the memory/RAG layer be a separate service?

### Your instinct (Python = better RAG/data-science fit) is directionally correct, but the decision isn't all-or-nothing. Three options:

### Option A — Keep everything in Node (extend current stack)

**Pros**
- No new service, no new deployment, no inter-service auth/networking
- Reuses existing Mongo models, existing agent loop, existing scheduler
- `openai` npm package + Mongo `$vectorSearch` covers embeddings + retrieval fully
- Faster to ship — this is what Section 5-8 above assumes

**Cons**
- Node's data-science/ML ecosystem is thinner — if you later want local embedding models, clustering of trade patterns, backtesting with pandas-style analysis, or statistical analysis of reflections, you'll be working against the grain
- TypeScript numeric/array libs (mathjs, etc.) are slower and less ergonomic than numpy/pandas for heavy analysis

**Best when**: the memory layer is mostly "store + retrieve + summarize via LLM" — which is most of what's designed above.

---

### Option B — Separate Python microservice for memory/RAG + analytics

A second server (FastAPI or similar) owns:
- Embedding generation (local models via `sentence-transformers`, or API)
- Vector store (pgvector, Qdrant, Chroma — Python has first-class clients for all of these)
- Reflection generation (pandas for stats, scikit-learn for pattern clustering)
- Exposes a small internal API: `POST /memory/retrieve`, `POST /memory/write`, `POST /reflection/run`

Node's `agent.loop.ts` calls this service via HTTP/gRPC instead of a local `memory.*` module.

**Pros**
- Python's RAG ecosystem is materially stronger: `langchain`/`llama-index` (optional, can skip if you want lean), `sentence-transformers` for free local embeddings, `pandas`/`numpy`/`scikit-learn` for pattern analysis on outcomes, `pgvector`/`chromadb`/`qdrant-client` all native
- Easy path to future ML: clustering similar setups, anomaly detection on regime shifts, backtesting frameworks (`backtrader`, `vectorbt`) are Python-only
- Clean separation of concerns — memory/analytics service can scale/restart independently of the trading loop

**Cons**
- New service = new deployment target, health checks, env management, inter-service network calls (latency added to every loop iteration)
- Duplicated data models (need to keep `AgentMemoryEntry` schema in sync across TS and Python, or use a shared schema definition / protobuf)
- New failure mode: memory service down → does the loop degrade gracefully or block?
- Two languages = two dependency ecosystems to maintain, two CI pipelines
- Auth between services needs to be set up (internal API key or mTLS)

**Best when**: you know you want heavier analytics/ML on trade history soon (pattern clustering, backtesting, statistical regime analysis) and want that to live in Python from day one.

---

### Option C — Hybrid (recommended starting point)

- **Phase 1**: Implement Section 5-8 in Node as designed. Use OpenAI embeddings (or any hosted embedding API) + Mongo Atlas Vector Search. This gets episodic memory + RAG working with minimal new infrastructure, in your current stack.
- **Phase 2**: If/when you need heavier analysis (pattern clustering across hundreds of trades, statistical backtests of "does signal X actually predict outcome Y"), add a small Python analytics service that:
  - Reads directly from the same Mongo collections (read-only, no schema duplication needed for analysis-only access)
  - Runs scheduled batch jobs (pandas/scikit-learn) and writes results back as `AgentReflection` documents or a new `agentInsights` collection
  - Does NOT sit in the hot path of the agent loop — Node still does real-time retrieval/write

This avoids adding a synchronous dependency to your trading loop (Python service down ≠ trading loop blocked) while giving you the data-science ecosystem for the analysis that actually benefits from it.

### Direct trade-off comparison

| Concern | Node-only (A) | Separate Python service (B) | Hybrid (C) |
|---|---|---|---|
| Time to ship | Fastest | Slowest | Fast (Phase 1), incremental (Phase 2) |
| RAG/embedding ecosystem | Adequate (API-based) | Best (local models, more vector DB options) | Adequate now, best later |
| Pattern analysis / backtesting | Weak | Strong | Strong, added later without blocking trading |
| Operational complexity | Low | High (2 services, inter-service auth, latency) | Low now, moderate later, but decoupled from hot path |
| Risk to agent loop latency | None | New network hop per iteration | None (Python is batch/offline) |
| Schema duplication | None | Required (or shared schema tooling) | None (Python reads existing Mongo schema) |

**Recommendation**: Build Option A now (Section 5-8). Revisit Option C's Phase 2 once you have enough `outcome` entries (weeks of trading data) to make pattern analysis worthwhile — at that point a read-only Python analytics service is low-risk to add because it doesn't sit on the agent's critical path.

---

## 10. Open questions to resolve before implementation

- Embedding provider: OpenAI (simplest) vs local model (`sentence-transformers`, requires either a Python sidecar or ONNX in Node)
- Vector index: confirm whether you're on MongoDB Atlas (enables `$vectorSearch` natively) — if self-hosted Mongo, need pgvector or a dedicated vector DB
- Retention policy: do `observation`-type entries get pruned after N days to control storage/embedding cost, or keep everything for audit purposes?
- Reflection cadence: daily per-coin, or also a weekly cross-coin reflection for regime-level lessons?
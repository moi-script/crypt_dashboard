Agent Loop — Full Execution Flow

1. Scheduler fires (scheduler.ts)

setInterval → runEnabledUserTicks()
  → AgentConfigDoc.find({ enabled: true })   // find all active users
  → runLoopTick(userId)                       // called per user, batched at 4 concurrent max

---
2. runLoopTick(userId) — the main tick (agent.loop.ts)

Step 1 — Load config & guard
getOrCreateConfig(userId)
→ if !config.enabled → return   // kill switch

Step 2 — Create run record
AgentRunDoc.create({ runId, status: 'running', ... })

Step 3 — Load wallet state
loadWalletState(userId, config)
  → getOrCreateWallet(userId)   let balances
  → PositionDoc.find(closed today)               // daily PnL
  → PositionDoc.countDocuments(otion count


we should specifically, 


Step 4 — Strategy builds market context
strategyImpl.buildContext(loopCt
// One of: yieldHunterStrategy | rebalanceStrategy | airdropWatchStrategy | chartSignalStrategy

Step 5 — Build context summary
buildContextSummary(loopCtx, strategyResult.contextSummary)

Step 6 — RAG memory retrieval
retrieve(userId, coin, contextSuver.ts
  → embed(queryText)                          // embed the context → vector
  → AgentMemoryDoc.aggregate($vesearch: similar past decisions
  → findRecentReflection(userId, coin)       // find nightly reflection doc
→ renderMemorySection(memResult) prompt string

Step 7 — Persist opportunities (
persistOpportunities(userId, strategy, runId, metadata)
  → OpportunityDoc.insertMany(...)           // saves yield spikes etc.

Step 8 — Run policy engine (LLM
runPolicyEngine(loopCtx, contextSummary, config, memoryContext)  // policy.engine.ts
  → buildAgentSystemPrompt(...) tem prompt
  → getToolSchemas()                         // fetch all tool definitions
  → [LOOP up to 5 iterations]:
      deepseek.chat.completions.create(...)  // call DeepSeek LLM
      → if READ tool called:
          dispatch(call, toolCtx (prices, OHLCV, etc.)
          → append result → loop again
      → if ACT tool called:
          dispatch(call, toolCtx)            // produce the trade Intent
          → break loop
      → if no tool call:
          intent = no_action → break
→ returns Decision { intent, conrace }

Step 9 — Execute intent
executeIntent(decision.intent, walletState, { userId, config, runId, ... })
  → risk.engine checks limits
  → paper executor or CEX/onchai
→ returns gateway { execution, riskPassed, pendingApproval }

Step 10 — Persist order & positi
persistExecution(...)
  → OrderDoc.create(...)
  → PositionDoc.create({ status:

Step 11 — Write decision to memory
writeDecision(loopCtx, decision)
  → buildSummary(ctx, decision)           // short text summary
  → embed(summary)
  → saveMemory({ type: 'decision', ... }) // persist to AgentMemoryDoc

Step 12 — Finalize run record
AgentRunDoc.updateOne({ runId }, { status: 'completed' | 'blocked' | 'pending_approval' })

---
Nightly side job — Reflection (scheduler.ts → reflection.generator.ts)

Runs every 24h separately:
startReflectionScheduler()
  → runReflection(userId, symbol)   // summarizes recent decisions into a reflection doc

When a position closes — Outcome memory (memory.writer.ts)

writeOutcome(runId, { pnl, succe
  → findMemoryByRunId(runId)         // link to original decision entry
  → embed(summary)
  → saveMemory({ type: 'outcome' })  // so future RAG retrieval knows what worked

---
The core cycle in one line:

▎ Scheduler → runLoopTick → loadontext → retrieve (RAG) →runPolicyEngine (LLM tool loop) → executeIntent → persistExecution → writeDecision
 this is m this is how my agent workflow, then i doknt have openai api key yet, it is not free though
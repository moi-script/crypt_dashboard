 
Proposal 

when agent runs

it reads different strategies, in coins, 
also does agent read the news about certain coins? how will it know the situations to provide a logical analysis for future trades


I am confuse by this

yieldHunter
rebalance
airdropWatch
chartSignal

does this really make a chart analysis like in real person trading

it will draw and indicator or lines lines in some charts 
can this make a draw data in that certain shot? like if there was a trade proposal it will provide a frame where in it will have some candle stick, timeframes, coin name, and some things that is needed when trading in real situation, so it will provide a lines in analysis like a prediction if it will go up, also this is where we will know if knowing the signal in charts,

the real problem we can face currently is that, this reads so many coins, it is burning much tokens in llm, we should make focus in btc itself, so we can make a better analysis base on its past behaviour, but again thats the real problem does my free tier in coin gecko recieve a past data for long?


- the history of api in open router how long does the chart history it can read?


example in this agent run, this run every 60 seconds, and it analze many different coind, it this will be inefficient and consume so unnnecesarry token, we should make an options on which coin we will be running on, for readings, 

now we have this, this should heavily focus in this, this is so weird that in 30 runs and there just only like 2-5 propose trades, it should be like this agent run --> 


it will draw and indicator or lines lines in some charts 
can this make a draw data in that certain shot? like if there was a trade proposal it will provide a frame where in it will have some candle stick, timeframes, coin name, and some things that is needed when trading in real situation, so it will provide a lines in analysis like a prediction if it will go up, also this is where we will know if knowing the signal in charts,

and now this will propose a trades as always and wether i can accept it or not that is where auto or manual toggler works

 Plan: Manual trade-approval queue                                                ↑

   Context                                                                          ↑

   When Auto-Trade is off (requireManualApproval: true, the default), a proposed tra↑e hits the gateway's approval gate (execution.gateway.ts:80) and returns manual_approval_required; the agent run is marked pending_approval. But there is ↑o approval queue — the trade is never executed and there's no UI/endpoint to release it. Trades are effectively dropped.                                              ↑

   This adds a real queue: list pending proposals, and Approve (execute now) or Reje↑t them.
                                                                                    ↑
   Key reuse: AgentRunDoc already persists the full proposal — status: 'pending_approval' with decision.intent + decision.confidence/reasoning. So we replay the stored intent rather than add a new collection. One gap: the persisted IntentSchema (agentRun.model.ts:14) drops stopLossPrice/takeProfitPrice/entryZone*/framework, so it must be extended or chart-signal approvals would lose their limit-order params.                      ↑

   Changes                                                                          ↑

   Persist the full intent — models/agentRun.model.ts                               ↑

   Add to IntentSchema: stopLossPrice, takeProfitPrice, entryZoneLow, entryZoneHigh,↑framework (all Number/String). Add 'rejected' to the run status enum.
                                                                                    ↑
   Status type — agents/loop/loop.types.ts
                                                                                    ↑
   Add 'rejected' to AgentRunStatus.
                                                                                    ↑
   Approve / reject logic — agents/loop/agent.loop.ts (export new fns)
                                                                                    ↑
   Co-locate with the existing file-local loadWalletState + persistExecution (reused, not exported):                                                                   ↑

   - approveRun(userId, runId):                                                     ↑
     a. AgentRunDoc.findOne({ runId, userId, status: 'pending_approval' }) → 404 if missing.                                                                         ↑
     b. intent = run.decision.intent; config = await getOrCreateConfig(userId).
     c. Build a replay config { ...config, requireManualApproval: false, enabled: tr↑e } (the user is explicitly releasing the trade, so bypass the gate + kill switch).
     d. walletState = await loadWalletState(userId, replayConfig); gateway = await executeIntent(intent, walletState, { userId, config: replayConfig, runId, strategy: run.strategy, rationale, confidence }).                                          ↑
     e. await persistExecution(...) — creates the fill order/position (or pending limit position for chart-signal, since the gateway now routes to the limit-deferr↑l path).
     f. Update run: status = completed (or blocked if !gateway.riskPassed), executionResult, completedAt. Return the execution result.
   - rejectRun(userId, runId): update the matching pending_approval run → status: 'rejected', completedAt; 404 if no match.
                                                                                    ↑
   Endpoints — controllers/agentRun.controller.ts + routes/agentRun.routes.ts
                                                                                    ↑
   - GET /api/agent-runs/approvals → runs with status: 'pending_approval' for the user (return runId, strategy, decision, startedAt).                                   ↑
   - POST /api/agent-runs/:runId/approve → approveRun, returns the execution result.
   - POST /api/agent-runs/:runId/reject → rejectRun.                                ↑
   - Route order: register /approvals and the /:runId/approve|reject routes before the existing GET /:runId so approvals isn't captured as a runId. All under the existing router.use(auth).
                                                                                    ↑
   Frontend — services/agent.service.frontend.ts + components/AgentChat/ChatDashboard.tsx                                           ↑

   - Service: listApprovals(), approveRun(runId), rejectRun(runId).                 ↑
   - RunsTab: fetch approvals in load(); render a "Pending Approval" section above the run list — one card per approval showing pair/amount/strategy/confidence/SL·TP an↑ Approve / Reject buttons that call the endpoints and re-load(). Reuse the existin↑ card styling + pnlColor/IntentBadge patterns already in the file. The Auto-Trade toggle (Config tab) already controls whether new proposals queue here.

 Tests (TDD — write failing first)

   API (agent.loop / controller, using the connectTestDb harness + mockRes() pattern):
   - Seed a pending_approval AgentRunDoc with a chart-signal intent (SL/TP + entry ne) → approveRun produces a pending limit PositionDoc and flips the run to completed.
 - Seed a market propose_trade proposal → approveRun fills (or routes per gateway) and sets executionResult.
 - rejectRun sets status: 'rejected' and never creates a position; both fns are scoped to userId (another user's run → 404).
   - listApprovals returns only the caller's pending_approval runs.

   Verification

 1. cd services/api && npx jest (run from services/api) — all green; npx tsc --noEmit clean (also frontend tsc).
 2. Manual: Auto-Trade off → trigger a tick that proposes a trade → it appears under "Pending Approval" in the Runs tab → Approve places the position (pending limit for chart-signal) / Reject marks it rejected and leaves the wallet untouched.

   Notes / non-goals

 - No expiry on pending approvals for now (runs already TTL after 90 days). Could add later.
   - Approve bypasses the kill switch by design (explicit human release); still paper-mode only via config.
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
                                   
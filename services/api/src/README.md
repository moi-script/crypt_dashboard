# Autonomous Agent — Implementation

This directory contains all new files to drop into `services/api/src/`.

## What was built

**Phase 0 (Paper / Monitor)** — fully implemented and safe to ship.

### New directories

| Directory | Purpose |
| --- | --- |
| `config/agent.config.ts` | Master config, mode flags, kill switch |
| `config/chains.config.ts` | Chain/RPC/router addresses for Phase 3 |
| `agents/loop/` | `agent.loop.ts` — the main tick; `scheduler.ts` — interval driver; `loop.types.ts` — shared types |
| `agents/tools/` | `tool.registry.ts`, `read.tools.ts`, `act.tools.ts`, `tool.types.ts` — LLM function-calling layer |
| `agents/policy/` | `policy.engine.ts` — LLM tool-call loop; `strategies/` — yieldHunter, rebalance, airdropWatch; `prompts/` — system prompt |
| `agents/skills/yield.skill.ts` | New 6th skill — DefiLlama APY comparison |
| `read/` | `context.builder.ts`, `ingestion/defillama.ingest.ts` |
| `execution/` | `execution.gateway.ts` — single execution entry; `modes/` — paper, cex (stub), onchain (stub); `wallet/keystore.ts` |
| `risk/` | `risk.engine.ts`, `risk.rules.ts`, `risk.config.ts` |
| `models/` | `agentRun.model.ts`, `position.model.ts` (Position + Order), `opportunity.model.ts` |
| `controllers/` | `agentRun.controller.ts`, `position.controller.ts`, `opportunity.controller.ts` |
| `routes/` | `agentRun.routes.ts`, `position.routes.ts` |

---

## How to activate

### Step 1 — Drop files in

Copy everything in this directory into `services/api/src/`, preserving the folder structure.

### Step 2 — Apply app.ts patch

Open `app.ts` and apply the additions from `PATCH_app.ts.md`.

### Step 3 — Add env vars

Append `.env.additions` to your `.env.local`.

### Step 4 — Install nanoid

```bash
npm install nanoid
```

### Step 5 — Start in paper mode

The agent is **disabled by default** (`agentConfig.enabled = false`). Enable via the API:

```bash
# Enable the loop (paper mode, no real money)
curl -X PUT http://localhost:4000/api/agent-runs/config \
  -H 'Content-Type: application/json' \
  -d '{"enabled": true}'

# Manually trigger one tick to test
curl -X POST http://localhost:4000/api/agent-runs/trigger?wait=true

# View the run
curl http://localhost:4000/api/agent-runs?limit=5

# View detected opportunities
curl http://localhost:4000/api/opportunities
```

---

## Phase progression

| Phase | What to do | Risk |
| --- | --- | --- |
| **0 (now)** | `enabled=true`, `mode=paper` | None — simulated fills only |
| **1** | Review AgentRun audit trail, tune strategy thresholds | None |
| **2 (CEX)** | Set `BINANCE_API_KEY` (trade-only, NO withdrawal), `mode=cex`, implement `cex.executor.ts` | Real $ but bounded by `maxTradeUsd=100` and `dailyLossCapUsd=50` |
| **3 (on-chain)** | Set `AGENT_PRIVATE_KEY`, implement `onchain.executor.ts` with smart wallet | Real $ + gas; add smart wallet contract rules |

---

## Hard rules (never change these)

1. `AGENT_PRIVATE_KEY` and `BINANCE_SECRET` are only read in `execution/wallet/keystore.ts` — never elsewhere.
2. Every intent passes `risk.engine.validate()` before execution — no shortcuts.
3. `agentConfig.mode` defaults to `'paper'` on every restart.
4. `agentConfig.enabled` defaults to `false` on every restart.
5. The LLM only ever emits intents — it never calls executors directly.

---

## New API endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/agent-runs` | List recent loop runs |
| GET | `/api/agent-runs/:runId` | Full run detail (context + decision + execution trace) |
| POST | `/api/agent-runs/trigger` | Manually trigger one loop tick |
| GET | `/api/agent-runs/config` | Current agent config |
| PUT | `/api/agent-runs/config` | Patch config (enable/disable, mode, etc.) |
| GET | `/api/agent-runs/stats` | Aggregate stats (win rate, PnL, intent breakdown) |
| GET | `/api/positions` | Open/closed positions |
| GET | `/api/positions/pnl/daily` | Today's PnL |
| GET | `/api/positions/pnl/summary` | All-time PnL summary |
| GET | `/api/opportunities` | Detected yield/price anomalies |
| GET | `/api/opportunities/summary` | Opportunity counts by type |

---

## Architecture diagram

```
scheduler.ts (setInterval every 60s)
    │
    ▼
agent.loop.ts (one tick = one AgentRunDoc)
    │
    ├─ 1. loadWalletState()        ← PositionDoc (paper balances + PnL)
    │
    ├─ 2. strategy.buildContext()  ← DefiLlama / CoinGecko via redis cache
    │     (yieldHunter / rebalance / airdropWatch)
    │
    ├─ 3. persistOpportunities()   ← OpportunityDoc (TTL 24h)
    │
    ├─ 4. runPolicyEngine()        ← DeepSeek tool-call loop (≤5 read iterations)
    │     │  get_price / get_yields / get_wallet_state / get_news_sentiment
    │     └─ → Decision { intent, confidence, toolCallTrace }
    │
    ├─ 5. executeIntent()          ← execution.gateway.ts
    │     │  kill switch check
    │     │  risk.engine.validate()   ← HARD GUARDRAILS
    │     │  manual approval gate
    │     └─ paper.executor.ts (Phase 0)
    │
    └─ 6. AgentRunDoc.update()     ← full audit trail
```

# Per-Account Agent & Paper Wallet — Design

**Date:** 2026-06-16
**Status:** Approved (design); pending implementation plan
**Author:** brainstormed with Claude

## Problem

When a user enables "agent mode" (the Agent Loop toggle in the Config tab), the
autonomous agent runs signals → config → wallet and may execute paper trades.
Today every one of those layers is a **global singleton**, attached to no user:

- **Wallet** (`services/api/src/services/paperWallet.service.ts`): hardcoded
  `WALLET_ID = 'paper-default'`. One wallet, one balance, one PnL for the entire
  system.
- **Agent loop** (`services/api/src/agents/loop/agent.loop.ts`):
  `loadWalletState()` returns a hardcoded `{ USDC: 5000 }` and reads no account.
- **Config** (`services/api/src/config/agent.config.ts`): a single in-memory
  `agentConfig` object; the enable toggle flips one global flag for the whole
  backend.
- **AgentRun** records (`agentRun.model.ts`): no `userId`; runs are not
  attributable to an account.
- **Routes**: `agentRun.routes.ts` and `paperWallet.routes.ts` are the only data
  routes **not** behind the `auth` middleware, so `req.userId` is never read.

The app already has a real auth system (`middleware/auth.ts`, JWT → `req.userId`,
sessions already migrated to user IDs, frontend `tokenStore` sends the Bearer
token). The agent/wallet layer simply ignores it.

## Goal

Scope the wallet, the agent config/toggle, and agent runs to the authenticated
`userId`, so that enabling agent mode trades against **the user's own paper
wallet**, provisioned automatically on first use.

## Decisions (locked)

- **Wallet type:** paper wallet, one per account. No real funds, no keys.
- **Agent scope:** full multi-tenant — each user enables/disables their own
  agent and trades against their own wallet and config.
- **Provisioning:** auto-provision a $5000 paper wallet for an account on first
  access (no explicit "attach" button); the toggle always works.
- **Scheduler approach:** **A — per-user fan-out.** One global timer; each tick
  finds users with `enabled = true` and runs one loop tick per user.

## Non-goals (YAGNI)

- Real on-chain / CEX execution per account (keystore stays global, mode stays
  locked to `'paper'`). Designed so a real wallet *could* attach later, but not
  built now.
- Per-user loop intervals or custom schedules (everyone shares one interval).
- Admin/cross-account views.

## Architecture

The core move: **key wallet, config, and runs by `userId` instead of global
singletons.**

### 1. PaperWallet — per account

- `paperWallet.model.ts`: replace the global `walletId` identity with a
  `userId` field (`required`, `unique`, indexed). Keep `walletId` only if useful
  as a secondary display id; `userId` is the lookup key. `TradeTransactionDoc`
  gains a `userId` field; indexes become `{ userId, executedAt }` etc.
- `paperWallet.service.ts`: every function takes `userId`:
  - `getOrCreateWallet(userId)` — auto-provisions $5000 USDC on first call.
  - `recordTrade(userId, input)`, `getTradeHistory(userId, …)`,
    `getTradeStats(userId)`, `resetWallet(userId)`.
  - Remove the module-level `WALLET_ID` constant.

### 2. AgentConfig — per account, persisted

- New `AgentConfigDoc` model keyed by `userId`, with the same fields as today's
  `AgentConfig` interface (`enabled`, `mode`, `loopIntervalMs`, `strategies`,
  `watchlist`, `maxTradeUsd`, `requireManualApproval`).
- `getOrCreateConfig(userId)` seeds a new doc from the existing defaults in
  `agent.config.ts` (those defaults become the seed template).
- `patchConfig(userId, patch)` keeps the existing safety guard (cannot disable
  manual approval while upgrading mode) and **locks `mode` to `'paper'`** for
  per-account configs in this phase.
- The exported in-memory `agentConfig` singleton is retired in favor of
  per-user docs. The defaults object remains as the seed.

### 3. AgentRun — attributable

- `agentRun.model.ts`: add `userId` (required, indexed). Indexes gain `userId`
  as the leading key for list/stats queries.

### 4. agent.loop — `runLoopTick(userId)`

- Signature becomes `runLoopTick(userId: string)`.
- Loads `getOrCreateConfig(userId)` and uses it everywhere the module currently
  reads the global `agentConfig`.
- `loadWalletState(userId)` reads the user's `PaperWalletDoc` (real balances)
  instead of returning hardcoded `{ USDC: 5000 }`; `mode`/PnL queries scope by
  `userId`.
- `persistOpportunities`, `persistExecution`, and the `AgentRunDoc` create/update
  all write `userId`.
- Kill switch: skip if that user's `config.enabled` is false.

### 5. scheduler — per-user fan-out

- Keep the single global `setInterval`.
- On each tick: `AgentConfigDoc.find({ enabled: true })` → for each user, run
  `runLoopTick(userId)`.
- Replace the single `_running` boolean with a **per-user in-flight set**
  (`Set<userId>`) so one user's slow tick doesn't overlap itself, while
  different users can run concurrently (bounded — see Error Handling).
- `triggerOneTick(userId)` for manual single-user triggers from the API.

### 6. Routes & controllers — scoped by `req.userId`

- Add `auth` to `/api/agent-runs` and `/api/paper-wallet` (mirror
  `portfolio.routes.ts` / `alert.routes.ts` which already do `router.use(auth)`).
- `agentRun.controller.ts`: every query filters by `req.userId`
  (`listRuns`, `getRun`, `getStats`, `getConfig`, `updateConfig`, `triggerRun`).
  `getConfig`/`updateConfig` operate on the caller's `AgentConfigDoc`.
- `paperWallet.controller.ts`: every handler scopes to `req.userId`.

### 7. Frontend — visible binding

- `ChatDashboard.tsx` `ConfigTab`:
  - Toggle reads/writes the logged-in account's config (auth header already
    sent via `tokenStore`; no change to `apiClient` needed).
  - Show "Wallet attached to `<email/account>` · $`<balance>`" so the
    account↔wallet binding is visible, satisfying the "attach to account first"
    intent even though provisioning is automatic.
- Fix the existing `POST /agent-runs/config` vs `PUT /config` mismatch
  (frontend posts; route defines PUT) — align on one verb during implementation.

## Data flow (enabled user, one tick)

```
scheduler tick
  └─ find configs where enabled = true        → [userA, userB, …]
       └─ for each userId (not already in-flight):
            runLoopTick(userId)
              ├─ getOrCreateConfig(userId)      (per-user kill switch, caps)
              ├─ loadWalletState(userId)        (real balances from PaperWalletDoc)
              ├─ strategy.buildContext(...)
              ├─ runPolicyEngine(...)           (LLM decision)
              ├─ executeIntent(...)             (risk → paper executor)
              ├─ recordTrade(userId, ...)       (debits/credits user's wallet)
              └─ persist AgentRun/Order/Position with userId
```

## Error handling

- **Unprovisioned user:** `getOrCreateWallet`/`getOrCreateConfig` create on
  demand, so a first-time enabled user is safe.
- **Per-user isolation:** a thrown error in one user's tick is caught and
  recorded on that user's `AgentRunDoc` (status `failed`); it must not abort the
  fan-out for other users.
- **Concurrency bound:** cap concurrent per-user ticks (e.g. small pool) so a
  large enabled-user set can't exhaust resources or rate-limit the LLM/market
  APIs in one tick. Users already in-flight are skipped that tick.
- **Auth:** unauthenticated requests to the now-protected routes return 401 via
  existing `AppError(401)` path.

## Migration

- Existing single global paper wallet (`walletId: 'paper-default'`) and its
  trades: either (a) one-off script assigns them to a designated owner `userId`,
  or (b) leave orphaned and start fresh per-user. Decide in the plan; given it's
  paper data, (b) "start fresh" is acceptable and simplest.
- Existing `AgentRun` docs without `userId`: leave as-is (they age out via the
  90-day TTL); new runs carry `userId`. List queries tolerate missing `userId`
  by simply filtering to the caller's id.

## Testing

- **Wallet service:** two users provisioned independently; trades on user A
  never touch user B's balances/history/PnL. Auto-provision yields $5000.
- **Config:** per-user enable/disable is isolated; `mode` stays `'paper'`;
  manual-approval safety guard still throws.
- **Loop:** `runLoopTick(userId)` reads the right wallet and writes `userId` on
  every persisted doc.
- **Scheduler fan-out:** with userA enabled and userB disabled, only userA ticks;
  an error in one user's tick doesn't stop another's; in-flight user is skipped.
- **Routes:** requests without a token → 401; user A cannot read user B's runs,
  wallet, or stats.

## Open questions for the plan

1. Keep `walletId` as a display field or drop it entirely in favor of `userId`?
2. Migration: assign legacy global wallet to an owner, or start fresh? (Leaning
   "start fresh".)
3. Concurrency cap value for the fan-out pool.
4. Align config endpoint on `PUT` or `POST`.

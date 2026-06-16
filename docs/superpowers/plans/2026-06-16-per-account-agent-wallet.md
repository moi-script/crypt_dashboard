# Per-Account Agent & Paper Wallet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope the paper wallet, agent config/enable-toggle, and agent runs to the authenticated `userId`, so enabling agent mode trades against the logged-in user's own auto-provisioned paper wallet.

**Architecture:** Replace the global singletons (`WALLET_ID = 'paper-default'`, in-memory `agentConfig`, account-less `AgentRun`) with per-`userId` documents. The agent config moves into a Mongo-backed `AgentConfigDoc` with a `getOrCreateConfig(userId)` service; the resolved config and `userId` are threaded down through `runLoopTick(userId) → executeIntent(…, ctx) → executePaper(…, ctx) → recordTrade(userId, …)`. The scheduler fans out: each tick finds users with `enabled = true` and runs one bounded-concurrency loop tick per user. The two unprotected routes (`/api/agent-runs`, `/api/paper-wallet`) get the existing `auth` middleware and scope every query to `req.userId`.

**Tech Stack:** Node + TypeScript, Express 5, Mongoose 9, Jest + ts-jest, mongodb-memory-server (added in Task 0). Frontend: Next.js + React, `apiClient` fetch wrapper.

**Spec:** `docs/superpowers/specs/2026-06-16-per-account-agent-wallet-design.md`

---

## File Structure

**Backend (`services/api/src/`)**
- `__tests__/helpers/db.ts` — *new* — shared mongodb-memory-server connect/clear/disconnect helpers for all DB tests.
- `models/paperWallet.model.ts` — *modify* — `userId` on wallet + transaction; indexes.
- `services/paperWallet.service.ts` — *modify* — every fn takes `userId`; auto-provision per user.
- `models/agentConfig.model.ts` — *new* — `AgentConfigDoc` keyed by `userId`.
- `config/agent.config.ts` — *modify* — export `DEFAULT_AGENT_CONFIG`; keep `AgentConfig`/`AgentMode` types.
- `services/agentConfig.service.ts` — *new* — `getOrCreateConfig(userId)`, `patchConfig(userId, patch)`.
- `models/agentRun.model.ts` — *modify* — add `userId`.
- `agents/loop/loop.types.ts` — *modify* — add `userId` to `AgentRunRecord`; add `ExecutionContext` type.
- `execution/execution.gateway.ts` — *modify* — `executeIntent(intent, walletState, ctx)` uses `ctx.config`.
- `execution/modes/paper.executor.ts` — *modify* — `executePaper(intent, execCtx)` passes `userId` to wallet calls.
- `agents/policy/policy.engine.ts` — *modify* — `runPolicyEngine(ctx, summary, config)`.
- `agents/loop/agent.loop.ts` — *modify* — `runLoopTick(userId)`, per-user wallet/config/scoping.
- `agents/loop/scheduler.ts` — *modify* — per-user fan-out + `triggerOneTick(userId)`.
- `controllers/agentRun.controller.ts` — *modify* — scope to `req.userId`.
- `routes/agentRun.routes.ts` — *modify* — `router.use(auth)`.
- `controllers/paperWallet.controller.ts` — *modify* — scope to `req.userId`.
- `routes/paperWallet.routes.ts` — *modify* — `router.use(auth)`.

**Frontend (`src/`)**
- `components/AgentChat/ChatDashboard.tsx` — *modify* — `ConfigTab` uses `PUT` for the toggle and shows the wallet-attached account + balance.

---

## Task 0: Test harness (mongodb-memory-server)

**Files:**
- Modify: `services/api/package.json` (devDependencies)
- Create: `services/api/src/__tests__/helpers/db.ts`
- Create: `services/api/src/__tests__/helpers/db.smoke.test.ts`

- [ ] **Step 1: Install mongodb-memory-server**

Run (from `services/api`):
```bash
npm install --save-dev mongodb-memory-server
```
Expected: package added to `devDependencies`, exit 0.

- [ ] **Step 2: Create the shared DB helper**

Create `services/api/src/__tests__/helpers/db.ts`:
```ts
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer | null = null

/** Spin up an in-memory MongoDB and connect mongoose to it. */
export async function connectTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
}

/** Drop all data between tests so each test starts clean. */
export async function clearTestDb(): Promise<void> {
  const { collections } = mongoose.connection
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({})
  }
}

/** Disconnect mongoose and stop the in-memory server. */
export async function disconnectTestDb(): Promise<void> {
  await mongoose.disconnect()
  if (mongod) await mongod.stop()
  mongod = null
}
```

- [ ] **Step 3: Write a smoke test that proves the harness works**

Create `services/api/src/__tests__/helpers/db.smoke.test.ts`:
```ts
import mongoose from 'mongoose'
import { connectTestDb, clearTestDb, disconnectTestDb } from './db'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('in-memory mongo connects and round-trips a document', async () => {
  const M = mongoose.models.Smoke ?? mongoose.model('Smoke', new mongoose.Schema({ n: Number }))
  await M.create({ n: 7 })
  const found = await M.findOne({ n: 7 }).lean()
  expect(found?.n).toBe(7)
})
```

- [ ] **Step 4: Run the smoke test**

Run (from `services/api`): `npx jest db.smoke --no-coverage`
Expected: 1 passed. (First run may take ~30s while mongodb-memory-server downloads its binary.)

- [ ] **Step 5: Commit**

```bash
git add services/api/package.json services/api/package-lock.json services/api/src/__tests__/helpers/
git commit -m "test: add mongodb-memory-server harness for per-account work"
```

---

## Task 1: PaperWallet model — per `userId`

**Files:**
- Modify: `services/api/src/models/paperWallet.model.ts`
- Test: `services/api/src/models/__tests__/paperWallet.model.test.ts`

- [ ] **Step 1: Write the failing test**

Create `services/api/src/models/__tests__/paperWallet.model.test.ts`:
```ts
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { PaperWalletDoc, TradeTransactionDoc } from '../paperWallet.model'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('wallet requires userId and enforces uniqueness per user', async () => {
  await PaperWalletDoc.create({ userId: 'user-a', walletId: 'paper-user-a' })
  await expect(
    PaperWalletDoc.create({ userId: 'user-a', walletId: 'paper-user-a-2' }),
  ).rejects.toThrow()
})

test('two different users can each have a wallet', async () => {
  await PaperWalletDoc.create({ userId: 'user-a', walletId: 'paper-user-a' })
  await PaperWalletDoc.create({ userId: 'user-b', walletId: 'paper-user-b' })
  expect(await PaperWalletDoc.countDocuments({})).toBe(2)
})

test('trade transaction stores userId', async () => {
  const tx = await TradeTransactionDoc.create({
    txId: 'tx-1', runId: 'run-1', userId: 'user-a', walletId: 'paper-user-a',
    side: 'buy', tokenIn: 'USDC', tokenOut: 'ETH',
    amountIn: 100, amountOut: 0.05, amountUsd: 100, priceUsd: 2000,
    strategy: 'yieldHunter', executedAt: new Date(),
  })
  expect(tx.userId).toBe('user-a')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest paperWallet.model --no-coverage`
Expected: FAIL — `userId` is not in the schema (uniqueness/validation assertions fail).

- [ ] **Step 3: Add `userId` to both schemas**

In `services/api/src/models/paperWallet.model.ts`:

Update the `IPaperWallet` interface — add `userId` as the first field:
```ts
export interface IPaperWallet {
  userId:        string          // owning account
  walletId:      string          // display id, e.g. "paper-<userId>"
  mode:          'paper'
  balances:      ITokenBalance[]
  totalValueUsd: number
  initialUsd:    number
  realizedPnlUsd: number
  unrealizedPnlUsd: number
  createdAt:     Date
  updatedAt:     Date
}
```

In `PaperWalletSchema`, change the identity fields so `userId` is the unique key and `walletId` is no longer unique:
```ts
const PaperWalletSchema = new Schema<IPaperWallet>({
  userId:           { type: String, required: true, unique: true, index: true },
  walletId:         { type: String, required: true },
  mode:             { type: String, enum: ['paper'], default: 'paper' },
  balances:         { type: [TokenBalanceSchema], default: [] },
  totalValueUsd:    { type: Number, default: 5000 },
  initialUsd:       { type: Number, default: 5000 },
  realizedPnlUsd:   { type: Number, default: 0 },
  unrealizedPnlUsd: { type: Number, default: 0 },
}, { timestamps: true })
```

Add `userId` to the `ITradeTransaction` interface (after `runId`):
```ts
  userId:          string          // owning account
```

Add `userId` to `TradeTransactionSchema` (after the `runId` field) and update the indexes:
```ts
  userId:            { type: String, required: true, index: true },
```
Replace the existing `walletId` index line:
```ts
TradeTransactionSchema.index({ userId: 1, executedAt: -1 })
```
(keep the `runId` and `tokenOut` indexes and the TTL index as-is; remove the old `{ walletId: 1, executedAt: -1 }` index.)

Remove the `default: 'paper-default'` from the `walletId` field of `TradeTransactionSchema` (it is now always derived per user):
```ts
  walletId:          { type: String, required: true },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest paperWallet.model --no-coverage`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/models/paperWallet.model.ts services/api/src/models/__tests__/paperWallet.model.test.ts
git commit -m "feat(wallet): key paper wallet + trades by userId"
```

---

## Task 2: paperWallet.service — per `userId`

**Files:**
- Modify: `services/api/src/services/paperWallet.service.ts`
- Test: `services/api/src/services/__tests__/paperWallet.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `services/api/src/services/__tests__/paperWallet.service.test.ts`:
```ts
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import {
  getOrCreateWallet, recordTrade, getTradeHistory, getTradeStats, resetWallet,
} from '../paperWallet.service'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

const tradeInput = (runId: string) => ({
  runId, tokenIn: 'USDC', tokenOut: 'ETH', amountUsd: 100, filledAmountUsd: 100,
  entryPrice: 2000, feesUsd: 0.1, slippagePct: 0.01,
  strategy: 'yieldHunter', rationale: 'test', confidence: 80,
})

test('auto-provisions a $5000 USDC wallet on first access', async () => {
  const w = await getOrCreateWallet('user-a')
  expect(w.userId).toBe('user-a')
  expect(w.walletId).toBe('paper-user-a')
  expect(w.totalValueUsd).toBe(5000)
  expect(w.balances.find(b => b.symbol === 'USDC')?.amount).toBe(5000)
})

test('trades on one user never touch another user balances', async () => {
  await getOrCreateWallet('user-a')
  await getOrCreateWallet('user-b')
  await recordTrade('user-a', tradeInput('run-a'))

  const a = await getOrCreateWallet('user-a')
  const b = await getOrCreateWallet('user-b')
  expect(a.balances.find(x => x.symbol === 'USDC')!.amount).toBeLessThan(5000)
  expect(b.balances.find(x => x.symbol === 'USDC')!.amount).toBe(5000)
})

test('history and stats are scoped to the user', async () => {
  await recordTrade('user-a', tradeInput('run-a'))
  await recordTrade('user-b', tradeInput('run-b'))

  const histA = await getTradeHistory('user-a')
  expect(histA).toHaveLength(1)
  expect(histA[0].userId).toBe('user-a')

  const statsB = await getTradeStats('user-b')
  expect(statsB.trades.total).toBe(1)
})

test('resetWallet only clears the target user', async () => {
  await recordTrade('user-a', tradeInput('run-a'))
  await recordTrade('user-b', tradeInput('run-b'))
  await resetWallet('user-a')

  expect(await getTradeHistory('user-a')).toHaveLength(0)
  expect(await getTradeHistory('user-b')).toHaveLength(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest paperWallet.service --no-coverage`
Expected: FAIL — functions currently take no `userId` (TypeScript/argument errors, wrong scoping).

- [ ] **Step 3: Thread `userId` through the service**

In `services/api/src/services/paperWallet.service.ts`:

Remove the module constant `const WALLET_ID = 'paper-default'`. Add a helper near the top (after `INITIAL_USD`):
```ts
const walletIdFor = (userId: string) => `paper-${userId}`
```

Rewrite `getOrCreateWallet` to take `userId`:
```ts
export async function getOrCreateWallet(userId: string) {
  let wallet = await PaperWalletDoc.findOne({ userId })

  if (!wallet) {
    wallet = await PaperWalletDoc.create({
      userId,
      walletId:      walletIdFor(userId),
      mode:          'paper',
      initialUsd:    INITIAL_USD,
      totalValueUsd: INITIAL_USD,
      balances: [
        { symbol: 'USDC', amount: INITIAL_USD, valueUsd: INITIAL_USD, avgCostUsd: 1, updatedAt: new Date() },
      ],
      realizedPnlUsd:   0,
      unrealizedPnlUsd: 0,
    })
    console.log(`[PaperWallet] Created paper wallet for ${userId} with $${INITIAL_USD} USDC`)
  }

  return wallet
}
```

Change `recordTrade` to take `userId` as the first argument and use it everywhere `WALLET_ID` was used:
```ts
export async function recordTrade(userId: string, input: RecordTradeInput): Promise<ITradeTransaction> {
  const wallet = await getOrCreateWallet(userId)
  // ... unchanged balance math ...
```
Inside `recordTrade`, replace the `PaperWalletDoc.updateOne({ walletId: WALLET_ID }, …)` filter with `{ userId }`, and in the `TradeTransactionDoc.create({…})` call set `userId` and `walletId: walletIdFor(userId)` instead of `walletId: WALLET_ID`:
```ts
  await PaperWalletDoc.updateOne(
    { userId },
    { $set: { balances, totalValueUsd, realizedPnlUsd: newRealizedPnl, updatedAt: new Date() } },
  )
```
```ts
  const tx = await TradeTransactionDoc.create({
    txId,
    runId:             input.runId,
    userId,
    orderId:           input.orderId,
    walletId:          walletIdFor(userId),
    // ... rest unchanged ...
  })
```

Update the query helpers to take `userId`:
```ts
export async function getTradeHistory(userId: string, limit = 50, skip = 0) {
  return TradeTransactionDoc
    .find({ userId })
    .sort({ executedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean()
}

export async function getTradeStats(userId: string) {
  const wallet = await getOrCreateWallet(userId)
  const allTrades = await TradeTransactionDoc.find({ userId }).lean()
  // ... rest of the body unchanged ...
}

export async function resetWallet(userId: string) {
  await PaperWalletDoc.deleteOne({ userId })
  await TradeTransactionDoc.deleteMany({ userId })
  return getOrCreateWallet(userId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest paperWallet.service --no-coverage`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/services/paperWallet.service.ts services/api/src/services/__tests__/paperWallet.service.test.ts
git commit -m "feat(wallet): scope paperWallet service functions by userId"
```

---

## Task 3: AgentConfig model + service — per `userId`

**Files:**
- Modify: `services/api/src/config/agent.config.ts`
- Create: `services/api/src/models/agentConfig.model.ts`
- Create: `services/api/src/services/agentConfig.service.ts`
- Test: `services/api/src/services/__tests__/agentConfig.service.test.ts`

- [ ] **Step 1: Export the defaults from `agent.config.ts`**

In `services/api/src/config/agent.config.ts`, keep the `AgentConfig` interface and `AgentMode` type. Rename the exported live object to a defaults template and drop the in-memory mutation helper (per-user state now lives in Mongo):
```ts
/** Seed values for a brand-new per-user agent config. */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: false,
  mode: 'paper',
  loopIntervalMs: 60_000,
  strategies: { yieldHunter: true, rebalance: false, airdropWatch: false },
  watchlist: ['bitcoin', 'ethereum', 'usd-coin', 'tether'],
  maxTradeUsd: 100,
  requireManualApproval: true,
}
```
Delete the old `export const agentConfig` object and the old `export function patchConfig`. (Their consumers are updated in Tasks 4–8.)

- [ ] **Step 2: Write the failing service test**

Create `services/api/src/services/__tests__/agentConfig.service.test.ts`:
```ts
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { getOrCreateConfig, patchConfig } from '../agentConfig.service'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('seeds a disabled paper config on first access', async () => {
  const c = await getOrCreateConfig('user-a')
  expect(c.userId).toBe('user-a')
  expect(c.enabled).toBe(false)
  expect(c.mode).toBe('paper')
  expect(c.maxTradeUsd).toBe(100)
})

test('enable toggle is isolated per user', async () => {
  await getOrCreateConfig('user-a')
  await getOrCreateConfig('user-b')
  await patchConfig('user-a', { enabled: true })

  expect((await getOrCreateConfig('user-a')).enabled).toBe(true)
  expect((await getOrCreateConfig('user-b')).enabled).toBe(false)
})

test('mode is locked to paper even if a patch tries to change it', async () => {
  await getOrCreateConfig('user-a')
  await patchConfig('user-a', { mode: 'onchain' as any })
  expect((await getOrCreateConfig('user-a')).mode).toBe('paper')
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest agentConfig.service --no-coverage`
Expected: FAIL — `agentConfig.service` and `agentConfig.model` do not exist.

- [ ] **Step 4: Create the model**

Create `services/api/src/models/agentConfig.model.ts`:
```ts
import { Schema, model } from 'mongoose'
import type { AgentConfig } from '../config/agent.config'

export interface IAgentConfig extends AgentConfig {
  userId: string
}

const AgentConfigSchema = new Schema<IAgentConfig>({
  userId:                { type: String, required: true, unique: true, index: true },
  enabled:               { type: Boolean, default: false },
  mode:                  { type: String, enum: ['paper', 'cex', 'onchain'], default: 'paper' },
  loopIntervalMs:        { type: Number, default: 60_000 },
  strategies: {
    yieldHunter:  { type: Boolean, default: true },
    rebalance:    { type: Boolean, default: false },
    airdropWatch: { type: Boolean, default: false },
  },
  watchlist:             { type: [String], default: ['bitcoin', 'ethereum', 'usd-coin', 'tether'] },
  maxTradeUsd:           { type: Number, default: 100 },
  requireManualApproval: { type: Boolean, default: true },
}, { timestamps: true })

export const AgentConfigDoc = model<IAgentConfig>('AgentConfig', AgentConfigSchema)
```

- [ ] **Step 5: Create the service**

Create `services/api/src/services/agentConfig.service.ts`:
```ts
import { AgentConfigDoc } from '../models/agentConfig.model'
import { DEFAULT_AGENT_CONFIG, type AgentConfig } from '../config/agent.config'

/** Get the user's agent config, seeding defaults on first access. */
export async function getOrCreateConfig(userId: string): Promise<AgentConfig & { userId: string }> {
  let doc = await AgentConfigDoc.findOne({ userId })
  if (!doc) {
    doc = await AgentConfigDoc.create({ userId, ...DEFAULT_AGENT_CONFIG })
  }
  return doc.toObject()
}

/**
 * Patch the user's config. Mode is locked to 'paper' in this phase, and the
 * manual-approval safety guard is preserved.
 */
export async function patchConfig(
  userId: string,
  patch: Partial<AgentConfig>,
): Promise<AgentConfig & { userId: string }> {
  await getOrCreateConfig(userId)  // ensure it exists

  const safePatch: Partial<AgentConfig> = { ...patch }
  // Phase 1: paper only — never allow graduating execution mode via the API.
  delete (safePatch as any).mode

  if (safePatch.requireManualApproval === false) {
    throw new Error('Cannot disable manual approval in paper phase')
  }

  const doc = await AgentConfigDoc.findOneAndUpdate(
    { userId },
    { $set: safePatch },
    { new: true },
  )
  return doc!.toObject()
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest agentConfig.service --no-coverage`
Expected: 3 passed.

- [ ] **Step 7: Commit**

```bash
git add services/api/src/config/agent.config.ts services/api/src/models/agentConfig.model.ts services/api/src/services/agentConfig.service.ts services/api/src/services/__tests__/agentConfig.service.test.ts
git commit -m "feat(agent): per-user persisted agent config"
```

---

## Task 4: AgentRun model — add `userId`

**Files:**
- Modify: `services/api/src/agents/loop/loop.types.ts`
- Modify: `services/api/src/models/agentRun.model.ts`
- Test: `services/api/src/models/__tests__/agentRun.model.test.ts`

- [ ] **Step 1: Write the failing test**

Create `services/api/src/models/__tests__/agentRun.model.test.ts`:
```ts
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { AgentRunDoc } from '../agentRun.model'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('agent run persists and filters by userId', async () => {
  await AgentRunDoc.create({ runId: 'run-a', userId: 'user-a', strategy: 'yieldHunter', mode: 'paper', startedAt: new Date(), status: 'running' })
  await AgentRunDoc.create({ runId: 'run-b', userId: 'user-b', strategy: 'yieldHunter', mode: 'paper', startedAt: new Date(), status: 'running' })

  const forA = await AgentRunDoc.find({ userId: 'user-a' }).lean()
  expect(forA).toHaveLength(1)
  expect(forA[0].runId).toBe('run-a')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest agentRun.model --no-coverage`
Expected: FAIL — `userId` not in schema, so the `find({ userId })` filter returns both/neither and the length assertion fails (or TS rejects the unknown field).

- [ ] **Step 3: Add `userId` to type + schema**

In `services/api/src/agents/loop/loop.types.ts`, add `userId` to `AgentRunRecord` (after `runId`):
```ts
export interface AgentRunRecord {
  runId: string
  userId: string
  strategy: string
  // ... rest unchanged ...
}
```

In `services/api/src/models/agentRun.model.ts`, add the field to `AgentRunSchema` (after `runId`) and add an index:
```ts
  runId:           { type: String, required: true, unique: true },
  userId:          { type: String, required: true, index: true },
```
Add after the existing indexes:
```ts
AgentRunSchema.index({ userId: 1, startedAt: -1 })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest agentRun.model --no-coverage`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/agents/loop/loop.types.ts services/api/src/models/agentRun.model.ts services/api/src/models/__tests__/agentRun.model.test.ts
git commit -m "feat(agent): attribute agent runs to userId"
```

---

## Task 5: Thread config + userId through execution and policy

This task adds an `ExecutionContext` and updates `executeIntent`, `executePaper`, and `runPolicyEngine` to take the resolved per-user config (no more global `agentConfig`). The agent loop wiring comes in Task 6.

**Files:**
- Modify: `services/api/src/agents/loop/loop.types.ts`
- Modify: `services/api/src/execution/execution.gateway.ts`
- Modify: `services/api/src/execution/modes/paper.executor.ts`
- Modify: `services/api/src/agents/policy/policy.engine.ts`
- Test: `services/api/src/execution/__tests__/execution.gateway.test.ts`

- [ ] **Step 1: Add the `ExecutionContext` type**

In `services/api/src/agents/loop/loop.types.ts`, add at the end:
```ts
// ── Execution context (threads per-user config + metadata to executors) ───────

import type { AgentConfig } from '../../config/agent.config'

export interface ExecutionContext {
  userId:     string
  config:     AgentConfig
  runId:      string
  strategy:   string
  rationale:  string
  confidence: number
}
```
(If `AgentMode` is already imported from `agent.config` at the top of the file, add `AgentConfig` to that existing import instead of adding a second `import` line.)

- [ ] **Step 2: Write the failing gateway test**

Create `services/api/src/execution/__tests__/execution.gateway.test.ts`:
```ts
import { executeIntent } from '../execution.gateway'
import { DEFAULT_AGENT_CONFIG } from '../../config/agent.config'
import type { ExecutionContext } from '../../agents/loop/loop.types'
import type { WalletState } from '../../agents/loop/loop.types'

const wallet: WalletState = { mode: 'paper', balances: { USDC: 5000 }, openPositions: 0, totalValueUsd: 5000, dailyPnlUsd: 0 }
const ctx = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  userId: 'user-a', runId: 'run-a', strategy: 'yieldHunter', rationale: 'r', confidence: 50,
  config: { ...DEFAULT_AGENT_CONFIG, enabled: true }, ...overrides,
})

test('kill switch blocks when the user config is disabled', async () => {
  const res = await executeIntent(
    { type: 'no_action', rationale: 'x' },
    wallet,
    ctx({ config: { ...DEFAULT_AGENT_CONFIG, enabled: false } }),
  )
  expect(res.riskPassed).toBe(false)
  expect(res.execution.status).toBe('blocked_by_risk')
})

test('no_action passes through when enabled', async () => {
  const res = await executeIntent({ type: 'no_action', rationale: 'x' }, wallet, ctx())
  expect(res.riskPassed).toBe(true)
  expect(res.execution.status).toBe('filled')
})

test('trade is queued for manual approval when required', async () => {
  const res = await executeIntent(
    { type: 'propose_trade', tokenIn: 'USDC', tokenOut: 'ETH', amountUsd: 50, maxSlippageBps: 50, rationale: 'r' },
    wallet,
    ctx({ config: { ...DEFAULT_AGENT_CONFIG, enabled: true, requireManualApproval: true } }),
  )
  expect(res.pendingApproval).toBe(true)
  expect(res.execution.status).toBe('manual_approval_required')
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest execution.gateway --no-coverage`
Expected: FAIL — `executeIntent` currently takes only `(intent, walletState)` and reads the deleted global `agentConfig`.

- [ ] **Step 4: Update `executeIntent` to use `ctx.config`**

In `services/api/src/execution/execution.gateway.ts`:

Replace the `agentConfig` import with the `ExecutionContext` type import:
```ts
import type { Intent, ExecutionResult, WalletState, ExecutionContext } from '../agents/loop/loop.types'
import type { AgentMode }                                              from '../config/agent.config'
import { riskEngine }                                                  from '../risk/risk.engine'
import { executePaper }                                                from './modes/paper.executor'
import { executeCex }                                                  from './modes/cex.executor'
import { executeOnchain }                                              from './modes/onchain.executor'
```

Change the signature and replace every `agentConfig.*` read with `ctx.config.*`, and pass the executor context to `executePaper`:
```ts
export async function executeIntent(
  intent:      Intent,
  walletState: WalletState,
  ctx:         ExecutionContext,
): Promise<GatewayResult> {
  const mode = ctx.config.mode as AgentMode

  if (!ctx.config.enabled) {
    return {
      riskPassed: false,
      riskBlockedBy: 'KillSwitch',
      riskReason: 'Agent is disabled for this user. Enable it to resume.',
      execution: { status: 'blocked_by_risk', riskRejectionReason: 'Kill switch active', executedAt: new Date() },
    }
  }
  // ... no_action branch unchanged ...

  const risk = riskEngine.validate(intent, walletState, mode)
  // ... risk block unchanged ...

  if (ctx.config.requireManualApproval && intent.type === 'propose_trade') {
    // ... unchanged ...
  }

  let result: ExecutionResult
  try {
    switch (mode) {
      case 'paper':
        result = await executePaper(intent, {
          userId: ctx.userId, runId: ctx.runId, strategy: ctx.strategy,
          rationale: ctx.rationale, confidence: ctx.confidence,
        })
        break
      case 'cex':     result = await executeCex(intent);     break
      case 'onchain': result = await executeOnchain(intent); break
      default: throw new Error(`Unknown execution mode: ${mode}`)
    }
  } catch (err: any) {
    result = { status: 'error', errorMessage: err.message, executedAt: new Date() }
  }

  return { riskPassed: true, execution: result }
}
```

- [ ] **Step 5: Update `executePaper` to carry `userId`**

In `services/api/src/execution/modes/paper.executor.ts`, add `userId` to the context type and pass it to the wallet calls:
```ts
export interface PaperExecutorContext {
  userId:     string
  runId:      string
  strategy:   string
  rationale:  string
  confidence: number
}
```
Change the signature to require the context:
```ts
export async function executePaper(
  intent: Intent,
  agentCtx: PaperExecutorContext,
): Promise<ExecutionResult> {
```
Replace `const wallet = await getOrCreateWallet()` with:
```ts
      const wallet = await getOrCreateWallet(agentCtx.userId)
```
Replace the `await recordTrade({ … })` call so `userId` is the first arg and the fallback `??` defaults are removed (context is now always present):
```ts
        await recordTrade(agentCtx.userId, {
          runId:           agentCtx.runId,
          orderId,
          tokenIn:         trade.tokenIn,
          tokenOut:        trade.tokenOut,
          amountUsd:       trade.amountUsd,
          filledAmountUsd: netAmountUsd,
          entryPrice:      outPrice,
          feesUsd:         fee,
          slippagePct:     slippage * 100,
          strategy:        agentCtx.strategy,
          rationale:       agentCtx.rationale,
          confidence:      agentCtx.confidence,
        })
```

- [ ] **Step 6: Update `runPolicyEngine` to take config**

In `services/api/src/agents/policy/policy.engine.ts`:

Remove the `agentConfig` import. Change the signature and replace the three `agentConfig.*` reads:
```ts
import type { Decision, Intent, LoopContext } from '../loop/loop.types'
import type { AgentConfig }                    from '../../config/agent.config'
```
```ts
export async function runPolicyEngine(
  ctx:                    LoopContext,
  strategyContextSummary: string,
  config:                 AgentConfig,
): Promise<Decision> {
  clearCandleCache()

  const toolCtx: ToolContext = { strategy: ctx.strategy, dryRun: config.mode === 'paper' }

  const walletSummary = [
    `Mode: ${config.mode}`,
    `Total value: $${ctx.walletState.totalValueUsd.toFixed(2)}`,
    `Daily PnL: $${ctx.walletState.dailyPnlUsd.toFixed(2)}`,
    `Open positions: ${ctx.walletState.openPositions}`,
  ].join(' | ')

  const systemPrompt = buildAgentSystemPrompt({
    mode:        config.mode,
    strategy:    ctx.strategy,
    walletSummary,
    maxTradeUsd: config.maxTradeUsd,
  })
  // ... rest of the function unchanged ...
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx jest execution.gateway --no-coverage`
Expected: 3 passed.

- [ ] **Step 8: Commit**

```bash
git add services/api/src/agents/loop/loop.types.ts services/api/src/execution/execution.gateway.ts services/api/src/execution/modes/paper.executor.ts services/api/src/agents/policy/policy.engine.ts services/api/src/execution/__tests__/execution.gateway.test.ts
git commit -m "feat(agent): thread per-user config + userId through execution and policy"
```

---

## Task 6: agent.loop `runLoopTick(userId)` + scheduler fan-out

**Files:**
- Modify: `services/api/src/agents/loop/agent.loop.ts`
- Modify: `services/api/src/agents/loop/scheduler.ts`
- Test: `services/api/src/agents/loop/__tests__/scheduler.test.ts`

- [ ] **Step 1: Update `agent.loop.ts` to be per-user**

In `services/api/src/agents/loop/agent.loop.ts`:

Replace the `agentConfig` import with the config service:
```ts
import { getOrCreateConfig } from '@/services/agentConfig.service'
import type { AgentConfig }  from '@/config/agent.config'
```

Change `loadWalletState` to read the user's real wallet and accept the resolved config:
```ts
async function loadWalletState(userId: string, config: AgentConfig): Promise<WalletState> {
  const wallet = await getOrCreateWallet(userId)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let dailyPnlUsd = 0
  try {
    const closedToday = await PositionDoc.find({ isOpen: false, exitAt: { $gte: today }, mode: config.mode }).lean()
    dailyPnlUsd = closedToday.reduce((s, p) => s + (p.realizedPnlUsd ?? 0), 0)
  } catch { /* DB may not be ready */ }

  const openCount = await PositionDoc.countDocuments({ isOpen: true, mode: config.mode }).catch(() => 0)

  const balances: Record<string, number> = {}
  for (const b of wallet.balances) balances[b.symbol] = b.valueUsd

  return {
    mode:          config.mode,
    balances,
    openPositions: openCount,
    totalValueUsd: wallet.totalValueUsd,
    dailyPnlUsd,
  }
}
```
Add `import { getOrCreateWallet } from '@/services/paperWallet.service'` to the imports.

In `persistExecution`, add a `userId` parameter and write it on the `OrderDoc`/`PositionDoc` creates, and replace `agentConfig.mode` with a passed `mode`:
```ts
async function persistExecution(
  userId:          string,
  mode:            AgentConfig['mode'],
  runId:           string,
  intent:          any,
  executionResult: any,
): Promise<void> {
  if (intent.type !== 'propose_trade') return
  try {
    const orderId = executionResult.orderId ?? `order-${generateMyId(10 as number)}`
    await OrderDoc.create({ orderId, runId, userId, mode, /* ...rest unchanged... */
      intentType: intent.type, tokenIn: intent.tokenIn, tokenOut: intent.tokenOut,
      amountUsd: intent.amountUsd, status: executionResult.status,
      filledAmountUsd: executionResult.filledAmountUsd, entryPrice: executionResult.entryPrice,
      feesUsd: executionResult.feesUsd, txHash: executionResult.txHash, blockNumber: executionResult.blockNumber,
      riskBlockedBy: executionResult.riskRejectionReason, errorMessage: executionResult.errorMessage,
      executedAt: executionResult.executedAt })

    if (executionResult.status === 'filled' && executionResult.filledAmountUsd) {
      await PositionDoc.create({ positionId: `pos-${generateMyId(10 as number)}`, userId, mode,
        tokenIn: intent.tokenIn, tokenOut: intent.tokenOut,
        entryAmountUsd: executionResult.filledAmountUsd, entryPrice: executionResult.entryPrice ?? 0,
        entryFeesUsd: executionResult.feesUsd ?? 0, entryAt: executionResult.executedAt,
        isOpen: true, strategy: (intent as any).strategyName ?? 'unknown', runId, orderId })
    }
  } catch (err: any) {
    console.warn('[AgentLoop] Failed to persist order/position:', err.message)
  }
}
```
> Note: `OrderDoc`/`PositionDoc` schemas may not yet declare `userId`. Adding an unknown field on `create` is harmless (Mongoose strips it under default `strictQuery`), but to make per-user position queries correct, add `userId: { type: String, index: true }` to both schemas in `services/api/src/models/position.model.ts`. Do this now as part of this step.

Rewrite `runLoopTick` to take `userId` and resolve that user's config:
```ts
export async function runLoopTick(userId: string): Promise<void> {
  const config = await getOrCreateConfig(userId)

  if (!config.enabled) {
    console.log(`[AgentLoop] Skipping tick for ${userId} — agent disabled.`)
    return
  }

  const runId     = `run-${generateMyId(10 as number)}`
  const startedAt = new Date()
  const strategy  = Object.entries(config.strategies).find(([, v]) => v)?.[0] ?? 'yieldHunter'

  console.log(`[AgentLoop] Tick: user=${userId} runId=${runId} strategy=${strategy} mode=${config.mode}`)

  let runDoc: any
  try {
    runDoc = await AgentRunDoc.create({ runId, userId, strategy, mode: config.mode, startedAt, status: 'running' })
  } catch (err: any) {
    console.error('[AgentLoop] Failed to create AgentRunDoc:', err.message)
    return
  }

  try {
    const walletState = await loadWalletState(userId, config)

    const strategyImpl = STRATEGIES[strategy]
    if (!strategyImpl) throw new Error(`Strategy "${strategy}" not found in registry.`)

    const loopCtx: LoopContext = { runId, strategy, startedAt: startedAt.getTime(), contextSummary: '', walletState, marketData: {} }
    const strategyResult = await strategyImpl.buildContext(loopCtx)

    const { text: contextSummary } = buildContextSummary(loopCtx, strategyResult.contextSummary)
    loopCtx.contextSummary = contextSummary

    await persistOpportunities(strategy, runId, strategyResult.metadata)

    const decision = await runPolicyEngine(loopCtx, contextSummary, config)

    const gateway = await executeIntent(decision.intent, walletState, {
      userId, config, runId, strategy,
      rationale: decision.reasoning, confidence: decision.confidence,
    })

    await persistExecution(userId, config.mode, runId, decision.intent, gateway.execution)

    const finalStatus: AgentRunRecord['status'] = gateway.pendingApproval
      ? 'pending_approval'
      : !gateway.riskPassed ? 'blocked' : 'completed'

    await AgentRunDoc.updateOne({ runId }, { $set: {
      completedAt: new Date(), status: finalStatus,
      contextSnapshot: contextSummary.slice(0, 2000), decision, executionResult: gateway.execution,
    } })

    console.log(`[AgentLoop] Tick complete: runId=${runId} status=${finalStatus}`)
  } catch (err: any) {
    console.error(`[AgentLoop] Tick failed: ${err.message}`)
    await AgentRunDoc.updateOne({ runId }, { $set: { completedAt: new Date(), status: 'failed', errorMessage: err.message } }).catch(() => {})
  }
}
```

- [ ] **Step 2: Write the failing scheduler test**

Create `services/api/src/agents/loop/__tests__/scheduler.test.ts`:
```ts
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'

// Mock the loop so we only test fan-out, not a full LLM tick.
const ticked: string[] = []
jest.mock('../agent.loop', () => ({
  runLoopTick: jest.fn(async (userId: string) => { ticked.push(userId) }),
}))

import { runEnabledUserTicks } from '../scheduler'
import { AgentConfigDoc } from '../../../models/agentConfig.model'
import { DEFAULT_AGENT_CONFIG } from '../../../config/agent.config'

beforeAll(connectTestDb)
afterEach(async () => { ticked.length = 0; await clearTestDb() })
afterAll(disconnectTestDb)

test('runs a tick only for users whose config is enabled', async () => {
  await AgentConfigDoc.create({ userId: 'user-on',  ...DEFAULT_AGENT_CONFIG, enabled: true })
  await AgentConfigDoc.create({ userId: 'user-off', ...DEFAULT_AGENT_CONFIG, enabled: false })

  await runEnabledUserTicks()

  expect(ticked).toEqual(['user-on'])
})

test('one user failing does not stop other users ticking', async () => {
  const { runLoopTick } = require('../agent.loop') as { runLoopTick: jest.Mock }
  runLoopTick.mockImplementationOnce(async () => { throw new Error('boom') })

  await AgentConfigDoc.create({ userId: 'user-1', ...DEFAULT_AGENT_CONFIG, enabled: true })
  await AgentConfigDoc.create({ userId: 'user-2', ...DEFAULT_AGENT_CONFIG, enabled: true })

  await expect(runEnabledUserTicks()).resolves.not.toThrow()
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest scheduler --no-coverage`
Expected: FAIL — `runEnabledUserTicks` does not exist yet.

- [ ] **Step 4: Rewrite the scheduler for per-user fan-out**

Replace `services/api/src/agents/loop/scheduler.ts` with:
```ts
/**
 * scheduler.ts
 *
 * Drives per-user agent loop ticks on a single global interval.
 * Each tick fans out to every user whose AgentConfig has enabled = true,
 * with bounded concurrency and a per-user in-flight guard.
 */

import { runLoopTick } from './agent.loop'
import { AgentConfigDoc } from '../../models/agentConfig.model'
import { DEFAULT_AGENT_CONFIG } from '../../config/agent.config'

const GLOBAL_INTERVAL_MS = Number(process.env.AGENT_LOOP_INTERVAL_MS) || DEFAULT_AGENT_CONFIG.loopIntervalMs
const MAX_CONCURRENT_TICKS = 4

let _timer: NodeJS.Timeout | null = null
let _sweeping = false
const _inFlight = new Set<string>()

/** Find all enabled users and run one bounded-concurrency tick per user. */
export async function runEnabledUserTicks(): Promise<void> {
  const enabled = await AgentConfigDoc.find({ enabled: true }).select('userId').lean()
  const userIds = enabled.map(c => c.userId).filter(id => !_inFlight.has(id))

  for (let i = 0; i < userIds.length; i += MAX_CONCURRENT_TICKS) {
    const batch = userIds.slice(i, i + MAX_CONCURRENT_TICKS)
    await Promise.all(batch.map(async userId => {
      _inFlight.add(userId)
      try {
        await runLoopTick(userId)
      } catch (err: any) {
        console.error(`[Scheduler] Tick failed for ${userId}:`, err.message)
      } finally {
        _inFlight.delete(userId)
      }
    }))
  }
}

export function startScheduler(): void {
  if (_timer) {
    console.warn('[Scheduler] Already running — stopScheduler() first.')
    return
  }
  console.log(`[Scheduler] Starting per-user agent loop — interval: ${GLOBAL_INTERVAL_MS / 1000}s`)

  _timer = setInterval(async () => {
    if (_sweeping) {
      console.warn('[Scheduler] Skipping sweep — previous sweep still running.')
      return
    }
    _sweeping = true
    try {
      await runEnabledUserTicks()
    } catch (err: any) {
      console.error('[Scheduler] Sweep error:', err.message)
    } finally {
      _sweeping = false
    }
  }, GLOBAL_INTERVAL_MS)

  if (_timer.unref) _timer.unref()
}

export function stopScheduler(): void {
  if (_timer) {
    clearInterval(_timer)
    _timer = null
    console.log('[Scheduler] Agent loop stopped.')
  }
}

export function isSchedulerRunning(): boolean {
  return _timer !== null
}

/** Manually trigger one tick for a single user (used by the admin/API trigger). */
export async function triggerOneTick(userId: string): Promise<void> {
  if (_inFlight.has(userId)) throw new Error('A tick is already running for this user — try again shortly.')
  _inFlight.add(userId)
  try {
    await runLoopTick(userId)
  } finally {
    _inFlight.delete(userId)
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest scheduler --no-coverage`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/agents/loop/agent.loop.ts services/api/src/agents/loop/scheduler.ts services/api/src/models/position.model.ts services/api/src/agents/loop/__tests__/scheduler.test.ts
git commit -m "feat(agent): per-user loop ticks with scheduler fan-out"
```

---

## Task 7: Agent-runs routes auth + controller scoping

**Files:**
- Modify: `services/api/src/routes/agentRun.routes.ts`
- Modify: `services/api/src/controllers/agentRun.controller.ts`
- Test: `services/api/src/controllers/__tests__/agentRun.controller.test.ts`

- [ ] **Step 1: Write the failing controller test**

Create `services/api/src/controllers/__tests__/agentRun.controller.test.ts`:
```ts
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { listRuns, getConfig, updateConfig } from '../agentRun.controller'
import { AgentRunDoc } from '../../models/agentRun.model'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

function mockRes() {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

test('listRuns only returns the caller\'s runs', async () => {
  await AgentRunDoc.create({ runId: 'r-a', userId: 'user-a', strategy: 's', mode: 'paper', startedAt: new Date(), status: 'completed' })
  await AgentRunDoc.create({ runId: 'r-b', userId: 'user-b', strategy: 's', mode: 'paper', startedAt: new Date(), status: 'completed' })

  const req: any = { userId: 'user-a', query: {} }
  const res = mockRes()
  await listRuns(req, res, jest.fn())

  const payload = res.json.mock.calls[0][0]
  expect(payload.runs).toHaveLength(1)
  expect(payload.runs[0].runId).toBe('r-a')
})

test('getConfig seeds and returns the caller\'s config', async () => {
  const req: any = { userId: 'user-a' }
  const res = mockRes()
  await getConfig(req, res, jest.fn())
  const payload = res.json.mock.calls[0][0]
  expect(payload.config.enabled).toBe(false)
})

test('updateConfig enables only the caller', async () => {
  const req: any = { userId: 'user-a', body: { enabled: true } }
  const res = mockRes()
  await updateConfig(req, res, jest.fn())
  const payload = res.json.mock.calls[0][0]
  expect(payload.config.enabled).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest agentRun.controller --no-coverage`
Expected: FAIL — controller still reads the deleted global `agentConfig`/`patchConfig` and ignores `req.userId`.

- [ ] **Step 3: Rewrite the controller to scope by `req.userId`**

In `services/api/src/controllers/agentRun.controller.ts`, replace the config imports and update each handler:
```ts
import type { Response, NextFunction } from 'express'
import type { AuthRequest }            from '../middleware/auth'
import { AgentRunDoc }                 from '../models/agentRun.model'
import { getOrCreateConfig, patchConfig } from '../services/agentConfig.service'
import { triggerOneTick, isSchedulerRunning } from '../agents/loop/scheduler'
import { checkKeyPresence }            from '../execution/wallet/keystore'
```
- `listRuns`: add `userId` to the filter — `const filter: Record<string, unknown> = { userId: req.userId }`.
- `getRun`: `const run = await AgentRunDoc.findOne({ runId: req.params.runId, userId: req.userId }).lean()`.
- `getStats`: add `userId: req.userId` to every `countDocuments`/`find` filter (e.g. `AgentRunDoc.countDocuments({ userId: req.userId })`, the `status` counts gain `userId`, the `since24h` query gains `userId`, and the recent-decisions `find` gains `userId`).
- `getConfig`:
```ts
export async function getConfig(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const config = await getOrCreateConfig(req.userId!)
    res.json({ config, schedulerActive: isSchedulerRunning(), keyPresence: checkKeyPresence() })
  } catch (err) { next(err) }
}
```
- `updateConfig`:
```ts
export async function updateConfig(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const config = await patchConfig(req.userId!, req.body)
    res.json({ ok: true, config })
  } catch (err: any) { next(err) }
}
```
- `triggerRun`: pass the user id — `triggerOneTick(req.userId!)` (and in the `wait === 'true'` branch likewise). Update the `.catch` log message text only if desired.

Change every handler's first param type from `Request` to `AuthRequest`.

- [ ] **Step 4: Add `auth` to the routes**

In `services/api/src/routes/agentRun.routes.ts`, import and mount the middleware:
```ts
import { Router } from 'express'
import { auth }   from '../middleware/auth'
import { listRuns, getRun, triggerRun, getConfig, updateConfig, getStats } from '../controllers/agentRun.controller'

const router = Router()
router.use(auth)

router.get('/stats',    getStats)
router.get('/config',   getConfig)
router.put('/config',   updateConfig)
router.post('/trigger', triggerRun)
router.get('/',         listRuns)
router.get('/:runId',   getRun)
export default router
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest agentRun.controller --no-coverage`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/routes/agentRun.routes.ts services/api/src/controllers/agentRun.controller.ts services/api/src/controllers/__tests__/agentRun.controller.test.ts
git commit -m "feat(agent): authenticate and scope agent-run routes by userId"
```

---

## Task 8: Paper-wallet routes auth + controller scoping

**Files:**
- Modify: `services/api/src/routes/paperWallet.routes.ts`
- Modify: `services/api/src/controllers/paperWallet.controller.ts`
- Test: `services/api/src/controllers/__tests__/paperWallet.controller.test.ts`

- [ ] **Step 1: Write the failing controller test**

Create `services/api/src/controllers/__tests__/paperWallet.controller.test.ts`:
```ts
import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { getWallet, getTrades } from '../paperWallet.controller'
import { recordTrade } from '../../services/paperWallet.service'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

function mockRes() {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

test('getWallet returns the caller\'s auto-provisioned wallet', async () => {
  const req: any = { userId: 'user-a' }
  const res = mockRes()
  await getWallet(req, res, jest.fn())
  const wallet = res.json.mock.calls[0][0]
  expect(wallet.userId).toBe('user-a')
  expect(wallet.totalValueUsd).toBe(5000)
})

test('getTrades is scoped to the caller', async () => {
  await recordTrade('user-a', { runId: 'r', tokenIn: 'USDC', tokenOut: 'ETH', amountUsd: 100, filledAmountUsd: 100, entryPrice: 2000, feesUsd: 0.1, slippagePct: 0.01, strategy: 's', rationale: 'r', confidence: 50 })
  await recordTrade('user-b', { runId: 'r', tokenIn: 'USDC', tokenOut: 'ETH', amountUsd: 100, filledAmountUsd: 100, entryPrice: 2000, feesUsd: 0.1, slippagePct: 0.01, strategy: 's', rationale: 'r', confidence: 50 })

  const req: any = { userId: 'user-a', query: {} }
  const res = mockRes()
  await getTrades(req, res, jest.fn())
  const payload = res.json.mock.calls[0][0]
  expect(payload.trades).toHaveLength(1)
  expect(payload.trades[0].userId).toBe('user-a')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest paperWallet.controller --no-coverage`
Expected: FAIL — controller calls the service with no `userId`.

- [ ] **Step 3: Scope the controller to `req.userId`**

Replace `services/api/src/controllers/paperWallet.controller.ts` body so each handler passes `req.userId`:
```ts
import type { Response, NextFunction } from 'express'
import type { AuthRequest }            from '../middleware/auth'
import { getOrCreateWallet, getTradeHistory, getTradeStats, resetWallet } from '../services/paperWallet.service'

export async function getWallet(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await getOrCreateWallet(req.userId!)) } catch (err) { next(err) }
}

export async function getTrades(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const limit  = Math.min(parseInt(req.query.limit as string) || 50, 200)
    const skip   = Math.max(parseInt(req.query.skip  as string) || 0, 0)
    const trades = await getTradeHistory(req.userId!, limit, skip)
    res.json({ trades, count: trades.length, skip, limit })
  } catch (err) { next(err) }
}

export async function getStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await getTradeStats(req.userId!)) } catch (err) { next(err) }
}

export async function postReset(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json({ ok: true, wallet: await resetWallet(req.userId!) }) } catch (err) { next(err) }
}
```

- [ ] **Step 4: Add `auth` to the routes**

Replace `services/api/src/routes/paperWallet.routes.ts`:
```ts
import { Router } from 'express'
import { auth }   from '../middleware/auth'
import { getWallet, getTrades, getStats, postReset } from '../controllers/paperWallet.controller'

const router = Router()
router.use(auth)

router.get('/',       getWallet)
router.get('/trades', getTrades)
router.get('/stats',  getStats)
router.post('/reset', postReset)

export default router
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest paperWallet.controller --no-coverage`
Expected: 2 passed.

- [ ] **Step 6: Full backend test + typecheck**

Run (from `services/api`): `npx jest --no-coverage` then `npx tsc --noEmit`
Expected: all test suites pass; `tsc` reports no errors. (If `tsc` flags a leftover reference to the removed `agentConfig`/old `triggerOneTick()` signature, fix the referenced file — the only expected consumers were updated in Tasks 5–8.)

- [ ] **Step 7: Commit**

```bash
git add services/api/src/routes/paperWallet.routes.ts services/api/src/controllers/paperWallet.controller.ts services/api/src/controllers/__tests__/paperWallet.controller.test.ts
git commit -m "feat(wallet): authenticate and scope paper-wallet routes by userId"
```

---

## Task 9: Frontend — PUT toggle + visible wallet binding

**Files:**
- Modify: `src/components/AgentChat/ChatDashboard.tsx`

- [ ] **Step 1: Switch the enable toggle to PUT**

In `src/components/AgentChat/ChatDashboard.tsx`, inside `ConfigTab`'s `toggle`, change the call from `apiClient.post` to `apiClient.put`:
```tsx
      const res = await apiClient.put<{ ok: boolean; config: AgentConfig }>("/agent-runs/config", { enabled: !config.enabled });
```

- [ ] **Step 2: Show the wallet-attached account + balance**

Still in `ConfigTab`, import the auth hook and a wallet fetch. Add near the top of the file's imports:
```tsx
import { useAuth } from "@/controllers/useAuth";
```
Add state + effect inside `ConfigTab` (after the existing `useState` lines):
```tsx
  const { user } = useAuth();
  const [walletUsd, setWalletUsd] = useState<number | null>(null);

  useEffect(() => {
    apiClient.get<{ totalValueUsd: number }>("/paper-wallet")
      .then(w => setWalletUsd(w.totalValueUsd))
      .catch(() => {});
  }, []);
```
Add a banner just above the Loop toggle card's closing pattern — insert this block as the first child of the returned `<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>`:
```tsx
      {/* Wallet binding */}
      <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 6px", fontFamily: "var(--font-mono)" }}>Paper Wallet</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
            Attached to {user?.email ?? "your account"}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: accentColor, fontFamily: "var(--font-mono)" }}>
            {walletUsd != null ? `$${walletUsd.toFixed(2)}` : "—"}
          </span>
        </div>
      </div>
```

- [ ] **Step 3: Verify the frontend builds**

Run (from repo root `my-app`): `npx tsc --noEmit -p tsconfig.json`
Expected: no type errors in `ChatDashboard.tsx`.

- [ ] **Step 4: Manual smoke (optional but recommended)**

Start the API (`cd services/api && npm run dev`) and the frontend (`npm run dev`), log in, open the agent Config tab. Expected: a "Paper Wallet — Attached to <your email> — $5000.00" banner; toggling Enable flips state via `PUT /api/agent-runs/config` and persists across reload.

- [ ] **Step 5: Commit**

```bash
git add src/components/AgentChat/ChatDashboard.tsx
git commit -m "feat(ui): show per-account wallet binding and use PUT for agent toggle"
```

---

## Self-Review Notes (resolved during planning)

- **Spec coverage:** wallet per-user (Tasks 1–2), config per-user + locked paper mode (Task 3), runs attributed (Task 4), per-user execution threading (Task 5), per-user loop + fan-out scheduler approach A (Task 6), auth + scoping on both unprotected route groups (Tasks 7–8), auto-provision on first access (`getOrCreateWallet`/`getOrCreateConfig`), frontend PUT + visible binding (Task 9). Migration "start fresh" needs no task (legacy global docs are simply never read once lookups are keyed by `userId`).
- **Type consistency:** `getOrCreateWallet(userId)`, `recordTrade(userId, input)`, `getOrCreateConfig(userId)`, `patchConfig(userId, patch)`, `runLoopTick(userId)`, `triggerOneTick(userId)`, `executeIntent(intent, walletState, ctx)`, `executePaper(intent, agentCtx)`, `runPolicyEngine(ctx, summary, config)` are used consistently across tasks. `ExecutionContext` and `PaperExecutorContext` field names match between definition (Task 5) and use (Task 6).
- **Known follow-ups (out of scope):** `cex`/`onchain` executors remain global-key-based (mode is locked to paper); `loopIntervalMs` is per-user in the config doc for display but the scheduler uses one global interval.

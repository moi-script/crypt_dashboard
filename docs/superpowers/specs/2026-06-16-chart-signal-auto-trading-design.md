# Chart-signal auto trading design

## Problem

The autonomous agent loop (`services/api/src/agents/loop/agent.loop.ts`) only ever
runs one of three registered strategies — `yieldHunter`, `rebalance`,
`airdropWatch`. None of these analyze a coin's price action, so the LLM policy
engine that drives the loop is never given a real "buy/sell this coin" signal
and almost always returns `no_action`. From the user's perspective the agent
just produces notes ("propose", "failed", "done") and never actually trades.

Meanwhile, four fully-built deterministic chart strategies already exist and
are unused: `smartMoney.strategy.ts`, `wyckoff.strategy.ts`,
`elliott.strategy.ts`, `harmonic.strategy.ts`. Each one consumes
`MarketPrimitives` for a symbol and returns a `TradeSignal` with bias, entry
zone, stop loss, take-profit levels, risk/reward, and confidence — exactly
the shape needed to drive real paper trades. They are never called from
anywhere in the codebase.

There is also no mechanism to close a position once opened: `IPosition` has
no stop-loss/take-profit fields, and nothing monitors open positions to exit
them. Wallet balance changes (`PaperWalletDoc.realizedPnlUsd`,
`totalValueUsd`) only happen inside `recordTrade()`, which is correct and
complete — it just never gets invoked for an automatic exit.

## Goal

Wire the four existing chart strategies into the agent loop as a new
strategy, `chartSignal`, that deterministically opens positions with a real
stop loss and take profit, and add a background job that closes those
positions when price hits one of those levels — so wins grow the paper
wallet and losses shrink it, with a real trade history to show for it.

## Architecture overview

Today's loop, for every strategy:

```
buildContext() → contextSummary (text) → runPolicyEngine() (DeepSeek decides)
   → decision.intent → executeIntent() → executor → persistExecution()
```

`chartSignal` skips the LLM decision step entirely:

1. For each symbol in `config.watchlist`, build `MarketPrimitives` via the
   existing `buildMarketPrimitives(symbol, btcContext)`
   (`services/api/src/services/chartAnalysis.service.ts`).
2. Run all four strategy functions against those primitives:
   `runSmartMoneyStrategy`, `runWyckoffStrategy`, `runElliottStrategy`,
   `runHarmonicStrategy`.
3. Collect every result where `skipped === false` and `signal.bias ===
   'long'`. Short signals are not acted on — the paper wallet is spot-only
   (no margin/borrow), so there is no way to simulate a short. They are
   logged in the run's context summary as skipped, with the reason.
4. Filter to `signal.confidence >= config.minSignalConfidence` (new config
   field, default `55`).
5. Across all watchlist symbols and frameworks, pick the single
   highest-confidence qualifying signal. If none qualify, the result is
   `no_action`.
6. If a position is already open for that signal's `tokenOut` symbol for
   this user, skip opening a second one (no stacking) — falls back to
   `no_action`.
7. Build a `TradeIntent` directly from the winning signal (no LLM
   round-trip) — `tokenIn: 'USDC'`, `tokenOut: signal.symbol`, `amountUsd:
   config.maxTradeUsd`, plus the new `stopLossPrice` /
   `takeProfitPrice` fields (see below).

### Wiring into `agent.loop.ts`

`StrategyResult.metadata` (in `strategy.types.ts`) gains an optional field:

```ts
deterministicDecision?: Decision
```

In `runLoopTick()`, after `buildContext()`:

```ts
const decision = strategyResult.metadata.deterministicDecision
  ?? await runPolicyEngine(loopCtx, contextSummary, config)
```

Every other strategy leaves `metadata.deterministicDecision` undefined and
behaves exactly as it does today. From this point on
(`executeIntent` → `persistExecution` → `AgentRunDoc` update), the pipeline
is unchanged and shared by every strategy.

## Trade intent & data model changes

`TradeIntent` (`loop.types.ts`) gains two optional fields, used only by
`chartSignal` (other strategies leave them undefined):

```ts
stopLossPrice?: number
takeProfitPrice?: number   // first take-profit tier only — see "Out of scope"
```

`IPosition` (`position.model.ts`) gains:

```ts
stopLossPrice?:   number
takeProfitPrice?: number
framework?:       string   // 'SmartMoney' | 'Wyckoff' | 'ElliottWave' | 'Harmonic'
confidence?:      number   // 0–100, from the originating signal
```

`persistExecution()` in `agent.loop.ts` copies `stopLossPrice` /
`takeProfitPrice` (from the intent) and `framework` / `confidence` (from
`decision`) onto the `PositionDoc` it creates on a filled trade.

`AgentConfig` (`config/agent.config.ts`) gains:

```ts
strategies: {
  yieldHunter: boolean
  rebalance: boolean
  airdropWatch: boolean
  chartSignal: boolean       // new, default false
}
minSignalConfidence: number  // new, default 55
```

## Guardrails on opening a position

Opening a `chartSignal` trade goes through the exact same gates every other
strategy already uses:

- `riskEngine.validate()` (position sizing, daily loss limits, etc.)
- `config.requireManualApproval` (if true, the trade is queued as
  `pending_approval` exactly like any other `propose_trade`)
- `executionGateway` routes to `executePaper` in paper mode only — `cex` and
  `onchain` modes are untouched by this feature.

### Addendum: the manual-approval gate currently has no release valve

While planning the implementation, found that `patchConfig()`
(`services/api/src/services/agentConfig.service.ts:27-29`) unconditionally
throws if a caller tries to set `requireManualApproval: false` — there is no
way to ever disable it via the API. There is also no approve/reject endpoint
anywhere for a `pending_approval` `AgentRunDoc` — once a trade lands in that
state, it sits there permanently. This means that even with real signals,
no opening trade could ever actually fill today. This is likely the more
fundamental cause of "the agent never trades" than the missing strategies.

Fix: relax `patchConfig()` to allow `requireManualApproval: false` **only
when `mode === 'paper'`** (the user's current config, or the patch result if
`mode` is also being read from the existing doc). `cex` and `onchain` modes
keep the hard block — manual approval can never be disabled for real-money
execution. This lets the user flip `chartSignal` trades to auto-execute in
paper mode while leaving the live-money safety rail untouched.

## Position monitor (the close/exit mechanism)

New file `services/api/src/agents/loop/positionMonitor.ts`, following the
same shape as `scheduler.ts`:

- `runPositionMonitorSweep()`: loads every `PositionDoc` with `isOpen: true,
  mode: 'paper'`, groups by `tokenOut` symbol, fetches one live price per
  symbol.
- For each open position:
  - If `currentPrice <= stopLossPrice` → **loss exit**.
  - Else if `takeProfitPrice` is set and `currentPrice >= takeProfitPrice` →
    **win exit**.
  - Else → leave open.
- On an exit, build a closing `TradeIntent` (`tokenIn: position.tokenOut,
  tokenOut: 'USDC', amountUsd: <current USD value of the held amount>`) and
  run it through `executeIntent()` → `executePaper()` → `recordTrade()` —
  the same path opens use. `recordTrade()` already computes
  `realizedPnlUsd` via weighted-avg cost basis and updates
  `PaperWalletDoc.realizedPnlUsd` / `totalValueUsd` — no changes needed
  there.
- **Closing trades skip the risk engine and the manual-approval gate.** A
  stop loss must fire regardless of approval settings — gating it on
  approval would defeat the point of having one. (Opens still go through
  both, unchanged.)
- After a successful close, update the `PositionDoc`: `isOpen: false`,
  `exitPrice`, `exitAt`, `realizedPnlUsd` (taken from the `recordTrade()`
  result), and create an `OrderDoc` for the close the same way
  `persistExecution()` does for opens.
- `startPositionMonitor()` / `stopPositionMonitor()` exported and started
  alongside `startScheduler()` at server boot, on its own interval (new env
  var `POSITION_MONITOR_INTERVAL_MS`, default 60s — independent of the
  5-minute agent loop interval since exits need to be checked more often
  than new entries are considered).

## Frontend changes

`src/services/agent.service.frontend.ts`:

```ts
export interface Position {
  // ...existing fields
  stopLossPrice?:   number;
  takeProfitPrice?: number;
  framework?:       string;
  confidence?:      number;
}
```

`AgentConfig` interface gains `chartSignal: boolean` and
`minSignalConfidence: number` to match the backend.

`TradingDashboard.tsx`:
- Open positions render with entry price, live current price, stop-loss /
  take-profit levels, framework + confidence, and distance-to-target.
- Closed positions render with a win/loss badge and realized P&L (data
  already available via `getPnlSummary()` / `listPositions({ open: false
  })` — those endpoints don't need to change, just consumed).
- Wherever the existing strategy toggles (`yieldHunter`, `rebalance`,
  `airdropWatch`) live in the settings UI, add a `chartSignal` toggle next
  to them.

## Testing

- Unit test for the `chartSignal` strategy: given mocked `MarketPrimitives`
  that make one of the four chart-strategy functions return a qualifying
  long signal, assert the resulting `deterministicDecision.intent` is a
  `propose_trade` with the right `stopLossPrice` / `takeProfitPrice`.
- Unit test for "no qualifying signal" → `no_action`.
- Unit test for "already has an open position on this symbol" → skipped.
- Unit test for `positionMonitor`: given an open position and a mocked price
  feed crossing `stopLossPrice`, assert the position is closed, wallet
  `realizedPnlUsd` decreases, and an `OrderDoc`/closed `PositionDoc` exist.
  Same for a take-profit crossing increasing `realizedPnlUsd`.
- Existing tests for `agent.loop.ts`, `execution.gateway.ts`,
  `paperWallet.service.ts` must continue to pass unchanged, since this
  feature reuses their pipelines without modifying their behavior for other
  strategies.

## Out of scope (explicit simplifications)

- **No shorting/margin.** Short-biased signals are skipped, not acted on —
  the paper wallet is spot-only.
- **No partial take-profit scaling.** Chart strategies return
  `take_profit_levels: number[]` (up to 3 tiers); only the first tier is
  used as a single full-exit target. `tp2`/`tp3` are not used by the
  monitor (could be surfaced for display only, but no scale-out logic).
- **No new position-sizing model.** Every `chartSignal` trade uses the flat
  `config.maxTradeUsd`, same as any other strategy's trade.
- **`cex` and `onchain` execution modes are untouched.** This is a
  paper-mode-only feature, consistent with the project's existing
  paper-first default.
- **No trailing stop loss.** `stopLossPrice` and `takeProfitPrice` are fixed
  at entry; they don't move as price moves in the position's favor.

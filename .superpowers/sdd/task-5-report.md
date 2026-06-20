# Task 5 Report: Stale Coin Data Rule + Async Risk Engine

## Status: DONE

## Changes Made

### 1. `services/api/src/risk/risk.rules.ts`
- Added import for `DataHealthDoc` from `../models/candle.model`
- Added `SYMBOL_TO_COINGECKO` mapping constant (BTC/WBTC → bitcoin, ETH/WETH → ethereum)
- Added new async `ruleStaleCoinData(ctx)` function at end of file
  - Fails open (allows) if no `data_health` record found in MongoDB
  - Blocks trade if `health.staleSince !== null`
  - Catches DB errors and fails open with a warning log

### 2. `services/api/src/risk/risk.engine.ts`
- Added `ruleStaleCoinData` to destructured import from `./risk.rules`
- Changed `RuleFn` type to `(ctx: RuleContext) => RuleResult | Promise<RuleResult>`
- Made `validate()` async, return type changed to `Promise<ValidationResult>`
- Updated rules array type annotation to match async-capable fn signature
- Added `StaleCoinData` rule at second position (after `AllowedTokens`)
- Changed `const result = rule.fn()` to `const result = await rule.fn()`

### 3. `services/api/src/execution/execution.gateway.ts`
- Changed `const risk = riskEngine.validate(...)` to `const risk = await riskEngine.validate(...)`

## Verification
- `npx tsc --noEmit` exited with zero errors across all modified files

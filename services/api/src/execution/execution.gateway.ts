/**
 * execution.gateway.ts
 *
 * The single entry point for all execution.
 * Every intent must pass through here — direct calls to executors are never made.
 *
 * Flow:
 *   1. Validate intent with risk engine (again — defense in depth)
 *   2. Check manual approval flag
 *   3. Route to the correct executor based on mode
 *   4. Return ExecutionResult
 */

import type { Intent, ExecutionResult, WalletState, ExecutionContext } from '../agents/loop/loop.types'
import type { AgentMode }                            from '../config/agent.config'
import { riskEngine }                                from '../risk/risk.engine'
import { executePaper }                              from './modes/paper.executor'
// import { executeCex }                                from './modes/cex.executor'
import { executeCex } from './modes/cex.executor';
import { executeOnchain }                            from './modes/onchain.executor'

export interface GatewayResult {
  execution:        ExecutionResult
  riskPassed:       boolean
  riskBlockedBy?:   string
  riskReason?:      string
  pendingApproval?: boolean
}

export async function executeIntent(
  intent:      Intent,
  walletState: WalletState,
  ctx:         ExecutionContext,
): Promise<GatewayResult> {
  const mode = ctx.config.mode as AgentMode

  // ── 1. Kill switch ──────────────────────────────────────────────────────────
  if (!ctx.config.enabled) {
    return {
      riskPassed: false,
      riskBlockedBy: 'KillSwitch',
      riskReason: 'Agent is disabled for this user. Enable it to resume.',
      execution: {
        status:       'blocked_by_risk',
        riskRejectionReason: 'Kill switch active',
        executedAt:   new Date(),
      },
    }
  }

  // ── 2. no_action intents skip everything ────────────────────────────────────
  if (intent.type === 'no_action') {
    return {
      riskPassed: true,
      execution: {
        status:          'filled',
        simulatedPnlUsd: 0,
        executedAt:      new Date(),
      },
    }
  }

  // ── 3. Risk engine validation ────────────────────────────────────────────────
  const risk = await riskEngine.validate(intent, walletState, mode)

  if (!risk.allowed) {
    return {
      riskPassed:    false,
      riskBlockedBy: risk.blockedBy,
      riskReason:    risk.reason,
      execution: {
        status:              'blocked_by_risk',
        riskRejectionReason: risk.reason,
        executedAt:          new Date(),
      },
    }
  }

  // ── 4. Manual approval gate ──────────────────────────────────────────────────
  if (ctx.config.requireManualApproval && intent.type === 'propose_trade') {
    console.log(`[ExecutionGateway] Trade intent queued for manual approval: ${JSON.stringify(intent)}`)
    return {
      riskPassed:     true,
      pendingApproval: true,
      execution: {
        status:     'manual_approval_required',
        executedAt: new Date(),
      },
    }
  }

  // ── 4b. Limit-order deferral (paper only) ────────────────────────────────────
  // chartSignal entries are pullback setups: don't market-fill now. Defer the
  // fill — the position monitor opens the position once price re-enters the
  // entry zone. We only signal intent here; persistExecution records a pending
  // position and the monitor handles activation/expiry.
  if (
    mode === 'paper' &&
    intent.type === 'propose_trade' &&
    intent.entryZoneLow !== undefined &&
    intent.entryZoneHigh !== undefined
  ) {
    return {
      riskPassed: true,
      execution: { status: 'pending_limit', executedAt: new Date() },
    }
  }

  // ── 5. Route to executor ─────────────────────────────────────────────────────
  let result: ExecutionResult
  try {
    switch (mode) {
      case 'paper':
        result = await executePaper(intent, {
          userId: ctx.userId, runId: ctx.runId, strategy: ctx.strategy,
          rationale: ctx.rationale, confidence: ctx.confidence,
        })
        break
      case 'cex':
        result = await executeCex(intent)
        break
      case 'onchain':
        result = await executeOnchain(intent)
        break
      default:
        throw new Error(`Unknown execution mode: ${mode}`)
    }
  } catch (err: any) {
    result = {
      status:       'error',
      errorMessage: err.message,
      executedAt:   new Date(),
    }
  }

  return { riskPassed: true, execution: result }
}

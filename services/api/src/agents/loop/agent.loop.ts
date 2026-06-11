/**
 * agent.loop.ts
 *
 * The autonomous agent loop: perceive → reason → decide → act → record.
 *
 * Called by the scheduler (scheduler.ts) on every tick.
 * One invocation = one AgentRun document.
 *
 * Design notes:
 * - Every step is logged. If the loop crashes, the AgentRunDoc is updated to 'failed'.
 * - The execution gateway is the last thing called — everything before is read-only.
 * - Kill switch checked at the top of every tick.
 */

// import { nanoid } from 'nanoid'
import { agentConfig }     from '../../config/agent.config'
// import { runPolicyEngine } from '../policy/policy.engine'
import { runPolicyEngine } from '../policy/policy.engine'
// import { executeIntent }   from '../../execution/execution.gateway'
import { executeIntent } from '@/execution/execution.gateway'
// import { AgentRunDoc }     from '../../models/agentRun.model'
import { AgentRunDoc } from '@/models/agentRun.model'
// import { OpportunityDoc }  from '../../models/opportunity.model'
import { OpportunityDoc } from '@/models/opportunity.model'
// import { PositionDoc, OrderDoc } from '../../models/position.model'
import { PositionDoc , OrderDoc} from '@/models/position.model'
// import { buildContextSummary }  from '../../read/context.builder'
import { buildContextSummary } from '@/read/context.builder'
import { yieldHunterStrategy }  from '../policy/strategies/yieldHunter.strategy'
// import { rebalanceStrategy }    from '../policy/strategies/rebalance.strategy'
import { rebalanceStrategy } from '../policy/strategies/rebalance.strategy'
// import { airdropWatchStrategy } from '../policy/strategies/airdropWatch.strategy'
import { airdropWatchStrategy } from '../policy/strategies/airdropWatch.strategy'
// import { airdropWatchStrategy } from '../policy/strategies/airdropWatch.strategy'
import type { LoopContext, WalletState, AgentRunRecord, TradeIntent } from './loop.types'
import type { Strategy } from '../policy/strategies/strategy.types'

import { generateMyId } from '@/utils/nanoid'
// ── Strategy registry ─────────────────────────────────────────────────────────

const STRATEGIES: Record<string, Strategy> = {
  yieldHunter:  yieldHunterStrategy,
  rebalance:    rebalanceStrategy,
  airdropWatch: airdropWatchStrategy,
}
// async function generateMyId(idNumb : number) {
//   const { nanoid } = await import('nanoid');
//   const id = nanoid(idNumb);
//   return id;
// }

// ── Wallet state (paper mode) ─────────────────────────────────────────────────

async function loadWalletState(): Promise<WalletState> {
  // In paper mode: read from PositionDoc to compute current balances + PnL
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let dailyPnlUsd = 0
  try {
    const closedToday = await PositionDoc.find({
      isOpen: false,
      exitAt: { $gte: today },
      mode:   agentConfig.mode,
    }).lean()
    dailyPnlUsd = closedToday.reduce((s, p) => s + (p.realizedPnlUsd ?? 0), 0)
  } catch { /* DB may not be ready */ }

  const openCount = await PositionDoc.countDocuments({ isOpen: true, mode: agentConfig.mode }).catch(() => 0)

  return {
    mode:            agentConfig.mode,
    balances:        { USDC: 5000 },  // initial paper wallet — production: pull from DB
    openPositions:   openCount,
    totalValueUsd:   5000,
    dailyPnlUsd,
  }
}

// ── Detect and persist opportunities ─────────────────────────────────────────

async function persistOpportunities(
  strategyName:  string,
  runId:         string,
  metadata:      Record<string, unknown>,
): Promise<void> {
  try {
    const spikedPools = metadata.spikedPools as any[] | undefined
    if (!spikedPools?.length) return

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)  // 24h TTL

    const docs = spikedPools.slice(0, 5).map(pool => ({
      opportunityId: `opp-${runId}-${pool.pool?.slice(0, 8) ?? generateMyId(6 as number)}`,
      type:          'yield_anomaly' as const,
      strategy:      strategyName,
      runId,
      title:         `${pool.protocol}/${pool.chain} APY spike: ${pool.apyPct}%`,
      detail:        `${pool.symbol} APY jumped ${pool.spikePct}pt above 7d avg (${pool.avg7dApyPct}%). TVL: $${(pool.tvlUsd / 1e6).toFixed(1)}M.`,
      asset:         pool.symbol ?? 'USDC',
      protocol:      pool.protocol,
      chain:         pool.chain,
      score:         Math.min(100, Math.round(50 + pool.spikePct * 5)),
      acted:         false,
      detectedAt:    new Date(),
      expiresAt,
      metadata:      pool,
    }))

    await OpportunityDoc.insertMany(docs, { ordered: false }).catch(() => {})
  } catch (err: any) {
    console.warn('[AgentLoop] Failed to persist opportunities:', err.message)
  }
}

// ── Persist order + position from execution result ────────────────────────────

async function persistExecution(
  runId:          string,
  intent:         any,
  executionResult: any,
): Promise<void> {
  if (intent.type !== 'propose_trade') return

  try {
    const orderId = executionResult.orderId ?? `order-${generateMyId(10 as number)}`
    await OrderDoc.create({
      orderId,
      runId,
      mode:           agentConfig.mode,
      intentType:     intent.type,
      tokenIn:        intent.tokenIn,
      tokenOut:       intent.tokenOut,
      amountUsd:      intent.amountUsd,
      status:         executionResult.status,
      filledAmountUsd: executionResult.filledAmountUsd,
      entryPrice:     executionResult.entryPrice,
      feesUsd:        executionResult.feesUsd,
      txHash:         executionResult.txHash,
      blockNumber:    executionResult.blockNumber,
      riskBlockedBy:  executionResult.riskRejectionReason,
      errorMessage:   executionResult.errorMessage,
      executedAt:     executionResult.executedAt,
    })

    if (executionResult.status === 'filled' && executionResult.filledAmountUsd) {
      await PositionDoc.create({
        positionId:     `pos-${generateMyId(10 as number)}`,
        mode:           agentConfig.mode,
        tokenIn:        intent.tokenIn,
        tokenOut:       intent.tokenOut,
        entryAmountUsd: executionResult.filledAmountUsd,
        entryPrice:     executionResult.entryPrice ?? 0,
        entryFeesUsd:   executionResult.feesUsd ?? 0,
        entryAt:        executionResult.executedAt,
        isOpen:         true,
        strategy:       (intent as any).strategyName ?? 'unknown',
        runId,
        orderId,
      })
    }
  } catch (err: any) {
    console.warn('[AgentLoop] Failed to persist order/position:', err.message)
  }
}

// ── Main loop tick ────────────────────────────────────────────────────────────

export async function runLoopTick(): Promise<void> {
  // Kill switch
  if (!agentConfig.enabled) {
    console.log('[AgentLoop] Skipping tick — agent is disabled.')
    return
  }

  const runId     = `run-${generateMyId(10 as number)}`
  const startedAt = new Date()
  const strategy  = Object.entries(agentConfig.strategies).find(([, v]) => v)?.[0] ?? 'yieldHunter'

  console.log(`[AgentLoop] Tick starting: runId=${runId} strategy=${strategy} mode=${agentConfig.mode}`)

  // Create the run document as 'running'
  let runDoc: any
  try {
    runDoc = await AgentRunDoc.create({
      runId,
      strategy,
      mode:      agentConfig.mode,
      startedAt,
      status:    'running',
    })
  } catch (err: any) {
    console.error('[AgentLoop] Failed to create AgentRunDoc:', err.message)
    return
  }

  try {
    // ── 1. Load wallet state ──────────────────────────────────────────────────
    const walletState = await loadWalletState()

    // ── 2. Build strategy context ─────────────────────────────────────────────
    const strategyImpl = STRATEGIES[strategy]
    if (!strategyImpl) {
      throw new Error(`Strategy "${strategy}" not found in registry.`)
    }

    const loopCtx: LoopContext = {
      runId,
      strategy,
      startedAt:       startedAt.getTime(),
      contextSummary:  '',
      walletState,
      marketData:      {},
    }

    const strategyResult = await strategyImpl.buildContext(loopCtx)

    // ── 3. Build context summary for LLM ──────────────────────────────────────
    const { text: contextSummary } = buildContextSummary(loopCtx, strategyResult.contextSummary)
    loopCtx.contextSummary = contextSummary

    // Persist detected opportunities
    await persistOpportunities(strategy, runId, strategyResult.metadata)

    // ── 4. Run policy engine (LLM tool-call loop) ─────────────────────────────
    const decision = await runPolicyEngine(loopCtx, contextSummary)

    console.log(`[AgentLoop] Decision: ${decision.intent.type} (confidence ${decision.confidence}%)`)
    console.log(`[AgentLoop] Rationale: ${decision.reasoning.slice(0, 120)}`)
    console.log(`[AgentLoop] Tool calls: ${decision.toolCallTrace.join(' → ')}`)

    // ── 5. Execute (via gateway → risk engine → executor) ─────────────────────
    const gateway = await executeIntent(decision.intent, walletState)

    console.log(`[AgentLoop] Execution: status=${gateway.execution.status} riskPassed=${gateway.riskPassed}`)

    // ── 6. Persist order/position if trade executed ───────────────────────────
    await persistExecution(runId, decision.intent, gateway.execution)

    // ── 7. Update AgentRunDoc with final outcome ──────────────────────────────
    const finalStatus: AgentRunRecord['status'] = gateway.pendingApproval
      ? 'pending_approval'
      : !gateway.riskPassed
      ? 'blocked'
      : 'completed'

    await AgentRunDoc.updateOne({ runId }, {
      $set: {
        completedAt:     new Date(),
        status:          finalStatus,
        contextSnapshot: contextSummary.slice(0, 2000),  // cap to avoid huge docs
        decision,
        executionResult: gateway.execution,
      },
    })

    console.log(`[AgentLoop] Tick complete: runId=${runId} status=${finalStatus}`)

  } catch (err: any) {
    console.error(`[AgentLoop] Tick failed: ${err.message}`)
    await AgentRunDoc.updateOne({ runId }, {
      $set: {
        completedAt:  new Date(),
        status:       'failed',
        errorMessage: err.message,
      },
    }).catch(() => {})
  }
}

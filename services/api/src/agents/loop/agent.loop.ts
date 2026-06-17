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
import { getOrCreateConfig } from '@/services/agentConfig.service'
import { getOrCreateWallet } from '@/services/paperWallet.service'
import type { AgentConfig }  from '@/config/agent.config'
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
import { chartSignalStrategy } from '../policy/strategies/chartSignal.strategy'
import type { LoopContext, WalletState, AgentRunRecord, TradeIntent } from './loop.types'
import type { Strategy } from '../policy/strategies/strategy.types'

import { generateMyId } from '@/utils/nanoid'

// How long a pending limit order waits for price to re-enter the entry zone
// before it's cancelled. Defaults to 6h.
const LIMIT_ORDER_TTL_MS = Number(process.env.LIMIT_ORDER_TTL_MS) || 6 * 60 * 60 * 1000

// ── Strategy registry ─────────────────────────────────────────────────────────

const STRATEGIES: Record<string, Strategy> = {
  yieldHunter:  yieldHunterStrategy,
  rebalance:    rebalanceStrategy,
  airdropWatch: airdropWatchStrategy,
  chartSignal:  chartSignalStrategy,
}
// async function generateMyId(idNumb : number) {
//   const { nanoid } = await import('nanoid');
//   const id = nanoid(idNumb);
//   return id;
// }

// ── Wallet state (paper mode) ─────────────────────────────────────────────────

async function loadWalletState(userId: string, config: AgentConfig): Promise<WalletState> {
  const wallet = await getOrCreateWallet(userId)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let dailyPnlUsd = 0
  try {
    const closedToday = await PositionDoc.find({ userId, isOpen: false, exitAt: { $gte: today }, mode: config.mode }).lean()
    dailyPnlUsd = closedToday.reduce((s, p) => s + (p.realizedPnlUsd ?? 0), 0)
  } catch { /* DB may not be ready */ }

  const openCount = await PositionDoc.countDocuments({ userId, isOpen: true, mode: config.mode }).catch(() => 0)

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

// ── Detect and persist opportunities ─────────────────────────────────────────

async function persistOpportunities(
  userId:        string,
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
      userId,
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
  userId:          string,
  mode:            AgentConfig['mode'],
  runId:           string,
  intent:          any,
  executionResult: any,
  strategy:        string,
  confidence:      number,
): Promise<void> {
  if (intent.type !== 'propose_trade') return

  const isLimit = executionResult.status === 'pending_limit'

  try {
    const orderId = executionResult.orderId ?? `order-${generateMyId(10 as number)}`
    await OrderDoc.create({
      orderId,
      runId,
      userId,
      mode,
      intentType:      isLimit ? 'limit_entry' : intent.type,
      tokenIn:         intent.tokenIn,
      tokenOut:        intent.tokenOut,
      amountUsd:       intent.amountUsd,
      status:          isLimit ? 'pending' : executionResult.status,
      filledAmountUsd: executionResult.filledAmountUsd,
      entryPrice:      executionResult.entryPrice,
      feesUsd:         executionResult.feesUsd,
      txHash:          executionResult.txHash,
      blockNumber:     executionResult.blockNumber,
      riskBlockedBy:   executionResult.riskRejectionReason,
      errorMessage:    executionResult.errorMessage,
      executedAt:      executionResult.executedAt,
    })

    if (isLimit) {
      // Limit order: record a PENDING position. The position monitor fills it
      // (flips to 'open') once price re-enters the entry zone, or cancels it
      // after entryExpiresAt.
      await PositionDoc.create({
        positionId:      `pos-${generateMyId(10 as number)}`,
        userId,
        mode,
        status:          'pending',
        tokenIn:         intent.tokenIn,
        tokenOut:        intent.tokenOut,
        entryAmountUsd:  intent.amountUsd,
        entryFeesUsd:    0,
        entryAt:         executionResult.executedAt,
        isOpen:          false,
        strategy,
        runId,
        orderId,
        stopLossPrice:   intent.stopLossPrice,
        takeProfitPrice: intent.takeProfitPrice,
        entryZoneLow:    intent.entryZoneLow,
        entryZoneHigh:   intent.entryZoneHigh,
        entryExpiresAt:  new Date(Date.now() + LIMIT_ORDER_TTL_MS),
        framework:       intent.framework,
        confidence,
      })
    } else if (executionResult.status === 'filled' && executionResult.filledAmountUsd) {
      await PositionDoc.create({
        positionId:      `pos-${generateMyId(10 as number)}`,
        userId,
        mode,
        status:          'open',
        tokenIn:         intent.tokenIn,
        tokenOut:        intent.tokenOut,
        entryAmountUsd:  executionResult.filledAmountUsd,
        entryPrice:      executionResult.entryPrice ?? 0,
        entryFeesUsd:    executionResult.feesUsd ?? 0,
        entryAt:         executionResult.executedAt,
        isOpen:          true,
        strategy,
        runId,
        orderId,
        stopLossPrice:   intent.stopLossPrice,
        takeProfitPrice: intent.takeProfitPrice,
        framework:       intent.framework,
        confidence,
      })
    }
  } catch (err: any) {
    console.warn('[AgentLoop] Failed to persist order/position:', err.message)
  }
}

// ── Main loop tick ────────────────────────────────────────────────────────────

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

    const loopCtx: LoopContext = { runId, userId, strategy, startedAt: startedAt.getTime(), contextSummary: '', walletState, marketData: {}, config }
    const strategyResult = await strategyImpl.buildContext(loopCtx)

    const { text: contextSummary } = buildContextSummary(loopCtx, strategyResult.contextSummary)
    loopCtx.contextSummary = contextSummary

    await persistOpportunities(userId, strategy, runId, strategyResult.metadata)

    const decision = strategyResult.deterministicDecision
      ?? await runPolicyEngine(loopCtx, contextSummary, config)

    const gateway = await executeIntent(decision.intent, walletState, {
      userId, config, runId, strategy,
      rationale: decision.reasoning, confidence: decision.confidence,
    })

    await persistExecution(userId, config.mode, runId, decision.intent, gateway.execution, strategy, decision.confidence)

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

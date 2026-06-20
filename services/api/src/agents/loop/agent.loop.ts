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
import type { LoopContext, WalletState, AgentRunRecord, TradeIntent, ExecutionResult } from './loop.types'
import type { Strategy } from '../policy/strategies/strategy.types'

import { generateMyId } from '@/utils/nanoid'
import { retrieve }            from '../memory/memory.retriever'
import { renderMemorySection } from '../policy/prompts/memory.section.prompt'
import { writeDecision }       from '../memory/memory.writer'
import { ohlcvIngest }         from '@/read/ingestion/ohlcv.ingest'

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

export async function loadWalletState(userId: string, config: AgentConfig): Promise<WalletState> {
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
        stopLossPrice:    intent.stopLossPrice,
        takeProfitPrice:  intent.takeProfitPrice,
        takeProfitPrice2: (intent as any).takeProfitPrice2,
        entryZoneLow:     intent.entryZoneLow,
        entryZoneHigh:    intent.entryZoneHigh,
        entryExpiresAt:   new Date(Date.now() + LIMIT_ORDER_TTL_MS),
        framework:        intent.framework,
        confidence,
        bias:             (intent as any).bias,
        trailingStopPct:  (intent as any).trailingStopPct,
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
        stopLossPrice:    intent.stopLossPrice,
        takeProfitPrice:  intent.takeProfitPrice,
        takeProfitPrice2: (intent as any).takeProfitPrice2,
        maxHoldHours:     48,
        framework:        intent.framework,
        confidence,
        bias:             (intent as any).bias,
        trailingStopPct:  (intent as any).trailingStopPct,
      })
    }
  } catch (err: any) {
    console.warn('[AgentLoop] Failed to persist order/position:', err.message)
  }
}

// ── Invalidation monitor: close positions that hit SL or TP ──────────────────
// Runs at the start of every loop tick before any new analysis.
// Uses the last 1H candle close as a proxy for current price.

async function monitorAndCloseStoppedPositions(userId: string, config: AgentConfig): Promise<void> {
  const openPositions = await PositionDoc.find({
    userId, isOpen: true, mode: config.mode,
    stopLossPrice: { $exists: true, $ne: null },
  }).lean().catch(() => [])

  if (!openPositions.length) return

  for (const pos of openPositions as any[]) {
    if (!pos.tokenOut) continue
    try {
      const symbol = `${String(pos.tokenOut).toUpperCase()}USDT`
      const { candles } = await ohlcvIngest.fetch({ symbol, timeframe: '1h', limit: 1 })
      const currentPrice = candles[candles.length - 1]?.close
      if (!currentPrice) continue

      const slHit = pos.stopLossPrice   && currentPrice <= pos.stopLossPrice
      const tpHit = pos.takeProfitPrice && currentPrice >= pos.takeProfitPrice

      if (slHit || tpHit) {
        const entryPrice   = pos.entryPrice ?? currentPrice
        const pnlPct       = (currentPrice - entryPrice) / entryPrice
        const realizedPnlUsd = (pos.entryAmountUsd ?? 0) * pnlPct

        await PositionDoc.updateOne(
          { _id: pos._id },
          { $set: { isOpen: false, status: 'closed', exitAt: new Date(), exitPrice: currentPrice, realizedPnlUsd } },
        )
        console.log(
          `[AgentLoop] ${tpHit ? 'TP' : 'SL'} triggered: ${pos.positionId} ` +
          `${pos.tokenOut} @ $${currentPrice} | PnL: $${realizedPnlUsd.toFixed(2)}`,
        )
      }
    } catch (err: any) {
      console.warn(`[AgentLoop] SL monitor failed for ${pos.positionId}:`, err.message)
    }
  }
}

// ── Main loop tick ────────────────────────────────────────────────────────────

export async function runLoopTick(userId: string): Promise<void> {
  const config = await getOrCreateConfig(userId)

  if (!config.enabled) {
    console.log(`[AgentLoop] Skipping tick for ${userId} — agent disabled.`)
    return
  }

  // Check and close any open positions that hit SL/TP before starting analysis
  await monitorAndCloseStoppedPositions(userId, config)

  const runId     = `run-${generateMyId(10 as number)}`
  const startedAt = new Date()
  const strategy  = Object.entries(config.strategies).find(([, v]) => v)?.[0] ?? 'yieldHunter'

  console.log(`[AgentLoop] Tick: user=${userId} runId=${runId} strategy=${strategy} mode=${config.mode}`)
  console.log(
    `[AgentLoop][Step 1] Config — strategy:${strategy} | mode:${config.mode} | ` +
    `maxTradeUsd:$${config.maxTradeUsd} | watchlist:[${config.watchlist.join(', ')}]`,
  )

  let runDoc: any
  try {
    runDoc = await AgentRunDoc.create({ runId, userId, strategy, mode: config.mode, startedAt, status: 'running' })
    console.log(`[AgentLoop][Step 2] Run created — runId:${runId}`)
  } catch (err: any) {
    console.error('[AgentLoop] Failed to create AgentRunDoc:', err.message)
    return
  }

  try {
    const walletState = await loadWalletState(userId, config)
    console.log(
      `[AgentLoop][Step 3] Wallet — total:$${walletState.totalValueUsd.toFixed(2)} | ` +
      `dailyPnL:$${walletState.dailyPnlUsd.toFixed(2)} | openPositions:${walletState.openPositions}`,
    )

    const strategyImpl = STRATEGIES[strategy]
    if (!strategyImpl) throw new Error(`Strategy "${strategy}" not found in registry.`)

    const loopCtx: LoopContext = { runId, userId, strategy, startedAt: startedAt.getTime(), contextSummary: '', walletState, marketData: {}, config }
    const strategyResult = await strategyImpl.buildContext(loopCtx)
    console.log(
      `[AgentLoop][Step 4] Strategy context — strategy:${strategy} | ` +
      `deterministicDecision:${strategyResult.deterministicDecision ? strategyResult.deterministicDecision.intent.type : 'none (LLM will decide)'} | ` +
      `contextLines:${strategyResult.contextSummary.split('\n').length}`,
    )

    const { text: contextSummary } = buildContextSummary(loopCtx, strategyResult.contextSummary)
    loopCtx.contextSummary = contextSummary
    console.log(`[AgentLoop][Step 5] Context summary built — ${contextSummary.length} chars`)

    // ── Memory retrieval (RAG) ──────────────────────────────────────────────
    let memoryContext: string | undefined
    try {
      const coin = config.watchlist[0] ?? 'BTC'
      const memResult = await retrieve(userId, coin.toUpperCase(), contextSummary)
      memoryContext = renderMemorySection(memResult) || undefined
    } catch (err: any) {
      console.warn('[AgentLoop] Memory retrieval failed (non-fatal):', err.message)
    }
    console.log(
      `[AgentLoop][Step 6] Memory — coin:${(config.watchlist[0] ?? 'BTC').toUpperCase()} | ` +
      `retrieved:${memoryContext ? 'yes' : 'no'}`,
    )

    await persistOpportunities(userId, strategy, runId, strategyResult.metadata)
    const spikedCount = (strategyResult.metadata?.spikedPools as any[] | undefined)?.length ?? 0
    console.log(`[AgentLoop][Step 7] Opportunities — ${spikedCount} yield spike(s) persisted`)

    console.log(`[AgentLoop][Step 8] Policy engine starting — deterministic:${!!strategyResult.deterministicDecision}`)
    const decision = strategyResult.deterministicDecision
      ?? await runPolicyEngine(loopCtx, contextSummary, config, memoryContext)
    console.log(
      `[AgentLoop][Step 8] Policy engine done — intent:${decision.intent.type} | ` +
      `confidence:${decision.confidence} | toolCalls:[${decision.toolCallTrace.join(', ')}]`,
    )

    console.log(`[AgentLoop][Step 9] Executing intent — type:${decision.intent.type}`)
    const gateway = await executeIntent(decision.intent, walletState, {
      userId, config, runId, strategy,
      rationale: decision.reasoning, confidence: decision.confidence,
    })
    console.log(
      `[AgentLoop][Step 9] Execution result — riskPassed:${gateway.riskPassed} | status:${gateway.execution.status}` +
      (gateway.riskBlockedBy ? ` | blockedBy:${gateway.riskBlockedBy} (${gateway.riskReason})` : '') +
      (gateway.execution.entryPrice ? ` | entryPrice:$${gateway.execution.entryPrice}` : ''),
    )

    await persistExecution(userId, config.mode, runId, decision.intent, gateway.execution, strategy, decision.confidence)
    console.log(
      `[AgentLoop][Step 10] Execution persisted — orderId:${gateway.execution.orderId ?? 'n/a'} | ` +
      `status:${gateway.execution.status}`,
    )

    // ── Write decision memory ───────────────────────────────────────────────
    await writeDecision(loopCtx, decision)
    console.log(`[AgentLoop][Step 11] Decision written to memory`)

    // Save chart snapshot for chartSignal runs that produced a signal
    const chartSnapshot = strategyResult.metadata?.chartSnapshot as import('@/agents/loop/loop.types').ChartSnapshot | undefined
    if (chartSnapshot) {
      await AgentRunDoc.updateOne({ runId }, { $set: { chartSnapshot } }).catch(() => {})
    }

    const finalStatus: AgentRunRecord['status'] = gateway.pendingApproval
      ? 'pending_approval'
      : !gateway.riskPassed ? 'blocked' : 'completed'

    await AgentRunDoc.updateOne({ runId }, { $set: {
      completedAt: new Date(), status: finalStatus,
      contextSnapshot: contextSummary.slice(0, 2000), decision, executionResult: gateway.execution,
    } })

    const durationMs = Date.now() - startedAt.getTime()
    console.log(
      `[AgentLoop][Step 12] Run finalized — runId:${runId} | status:${finalStatus} | duration:${durationMs}ms`,
    )
    console.log(`[AgentLoop] ─────────────────────────────────────────────────────`)

    console.log(`[AgentLoop] Tick complete: runId=${runId} status=${finalStatus}`)
  } catch (err: any) {
    console.error(`[AgentLoop] Tick failed: ${err.message}`)
    await AgentRunDoc.updateOne({ runId }, { $set: { completedAt: new Date(), status: 'failed', errorMessage: err.message } }).catch(() => {})
  }
}

// ── Manual approval actions ───────────────────────────────────────────────────

export async function approveRun(userId: string, runId: string): Promise<ExecutionResult> {
  const run = await AgentRunDoc.findOne({ runId, userId, status: 'pending_approval' }).lean()
  if (!run) throw Object.assign(new Error(`Run "${runId}" not found`), { statusCode: 404 })

  const intent    = run.decision!.intent
  const confidence = run.decision!.confidence
  const rationale  = run.decision!.reasoning

  const config      = await getOrCreateConfig(userId)
  const replayConfig: AgentConfig = { ...config, requireManualApproval: false, enabled: true }
  const walletState = await loadWalletState(userId, replayConfig)

  const gateway = await executeIntent(intent as any, walletState, {
    userId, config: replayConfig, runId, strategy: run.strategy, rationale, confidence,
  })

  await persistExecution(userId, replayConfig.mode, runId, intent, gateway.execution, run.strategy, confidence)

  const finalStatus = !gateway.riskPassed ? 'blocked' : 'completed'
  await AgentRunDoc.updateOne({ runId }, {
    $set: { status: finalStatus, executionResult: gateway.execution, completedAt: new Date() },
  })

  return gateway.execution
}

export async function rejectRun(userId: string, runId: string): Promise<void> {
  const result = await AgentRunDoc.updateOne(
    { runId, userId, status: 'pending_approval' },
    { $set: { status: 'rejected', completedAt: new Date() } },
  )
  if (result.matchedCount === 0) throw Object.assign(new Error(`Run "${runId}" not found`), { statusCode: 404 })
}

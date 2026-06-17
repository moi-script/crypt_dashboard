/**
 * positionMonitor.ts
 *
 * Background sweep that closes open paper positions when the live price
 * crosses their stop-loss or take-profit level. Runs independently of the
 * per-user agent loop and ignores `config.enabled` — an open position must
 * still be resolved even if the agent has since been disabled for that user.
 *
 * Closing trades go straight to `executePaper`, bypassing the risk engine
 * and the manual-approval gate (`executeIntent` / `execution.gateway.ts`):
 * a stop loss has to fire regardless of approval settings, otherwise it
 * isn't a safety mechanism.
 */

import { PositionDoc, OrderDoc } from '../../models/position.model'
import { executePaper, getLivePrice } from '../../execution/modes/paper.executor'
import { generateMyId } from '../../utils/nanoid'
import type { TradeIntent } from './loop.types'

type ExitReason = 'stop_loss' | 'take_profit'

async function closePosition(
  position: { positionId: string; userId?: string; tokenIn: string; tokenOut: string; entryAmountUsd: number; entryPrice?: number; strategy: string; confidence?: number },
  exitPrice: number,
  reason: ExitReason,
): Promise<void> {
  if (!position.userId || !position.entryPrice) return

  const unitsHeld = position.entryAmountUsd / position.entryPrice
  const closeIntent: TradeIntent = {
    type: 'propose_trade',
    tokenIn: position.tokenOut,
    tokenOut: position.tokenIn,
    amountUsd: unitsHeld * exitPrice,
    maxSlippageBps: 50,
    rationale: `Auto-exit on ${reason.replace('_', ' ')} at $${exitPrice.toFixed(4)}`,
  }

  const runId = `monitor-${generateMyId(10)}`
  const result = await executePaper(closeIntent, {
    userId: position.userId,
    runId,
    strategy: position.strategy,
    rationale: closeIntent.rationale,
    confidence: position.confidence ?? 0,
  })

  if (result.status !== 'filled') {
    console.warn(`[PositionMonitor] Failed to close ${position.positionId}: ${result.errorMessage ?? result.status}`)
    return
  }

  await OrderDoc.create({
    orderId: result.orderId ?? `order-${generateMyId(10)}`,
    runId,
    userId: position.userId,
    mode: 'paper',
    intentType: 'close_position',
    tokenIn: closeIntent.tokenIn,
    tokenOut: closeIntent.tokenOut,
    amountUsd: closeIntent.amountUsd,
    status: result.status,
    filledAmountUsd: result.filledAmountUsd,
    entryPrice: result.entryPrice,
    feesUsd: result.feesUsd,
    executedAt: result.executedAt,
    positionId: position.positionId,
  })

  await PositionDoc.updateOne({ positionId: position.positionId }, { $set: {
    status: 'closed',
    isOpen: false,
    exitPrice,
    exitAmountUsd: result.filledAmountUsd,
    exitAt: result.executedAt,
    realizedPnlUsd: result.simulatedPnlUsd ?? 0,
  } })

  console.log(`[PositionMonitor] Closed ${position.positionId} (${reason}) — PnL: $${(result.simulatedPnlUsd ?? 0).toFixed(2)}`)
}

// ── Limit-order activation ──────────────────────────────────────────────────
// Fill a pending limit order once price has re-entered the entry zone. Goes
// straight to executePaper (same bypass rationale as closePosition).

async function activateLimitPosition(
  position: { positionId: string; userId?: string; tokenIn: string; tokenOut: string; entryAmountUsd: number; strategy: string; stopLossPrice?: number; takeProfitPrice?: number; confidence?: number },
  fillPrice: number,
): Promise<void> {
  if (!position.userId) return

  const buyIntent: TradeIntent = {
    type: 'propose_trade',
    tokenIn: position.tokenIn,
    tokenOut: position.tokenOut,
    amountUsd: position.entryAmountUsd,
    maxSlippageBps: 50,
    rationale: `Limit entry filled — price re-entered zone at $${fillPrice.toFixed(4)}`,
    stopLossPrice: position.stopLossPrice,
    takeProfitPrice: position.takeProfitPrice,
  }

  const runId = `monitor-${generateMyId(10)}`
  const result = await executePaper(buyIntent, {
    userId: position.userId,
    runId,
    strategy: position.strategy,
    rationale: buyIntent.rationale,
    confidence: position.confidence ?? 0,
  })

  if (result.status !== 'filled') {
    console.warn(`[PositionMonitor] Limit fill rejected for ${position.positionId}: ${result.errorMessage ?? result.status}`)
    return
  }

  const orderId = result.orderId ?? `order-${generateMyId(10)}`
  await OrderDoc.create({
    orderId,
    runId,
    userId: position.userId,
    mode: 'paper',
    intentType: 'open_position',
    tokenIn: buyIntent.tokenIn,
    tokenOut: buyIntent.tokenOut,
    amountUsd: buyIntent.amountUsd,
    status: result.status,
    filledAmountUsd: result.filledAmountUsd,
    entryPrice: result.entryPrice,
    feesUsd: result.feesUsd,
    executedAt: result.executedAt,
    positionId: position.positionId,
  })

  await PositionDoc.updateOne({ positionId: position.positionId }, { $set: {
    status: 'open',
    isOpen: true,
    entryPrice: result.entryPrice,
    entryAmountUsd: result.filledAmountUsd,
    entryFeesUsd: result.feesUsd ?? 0,
    entryAt: result.executedAt,
    orderId,
  } })

  console.log(`[PositionMonitor] Opened ${position.positionId} (limit fill) at $${(result.entryPrice ?? fillPrice).toFixed(4)}`)
}

export async function runPositionMonitorSweep(): Promise<void> {
  const openPositions = await PositionDoc.find({
    status: 'open',
    mode: 'paper',
    $or: [{ stopLossPrice: { $exists: true } }, { takeProfitPrice: { $exists: true } }],
  }).lean()

  const pendingPositions = await PositionDoc.find({
    status: 'pending',
    mode: 'paper',
  }).lean()

  if (openPositions.length === 0 && pendingPositions.length === 0) return

  const uniqueSymbols = [...new Set([...openPositions, ...pendingPositions].map(p => p.tokenOut))]
  const prices: Record<string, number> = {}
  for (const symbol of uniqueSymbols) {
    prices[symbol] = await getLivePrice(symbol)
  }

  // ── Pending limit orders: expire or activate ──────────────────────────────
  const now = Date.now()
  for (const position of pendingPositions) {
    try {
      if (position.entryExpiresAt && now > new Date(position.entryExpiresAt).getTime()) {
        await PositionDoc.updateOne({ positionId: position.positionId }, { $set: { status: 'cancelled', isOpen: false } })
        console.log(`[PositionMonitor] Cancelled expired limit order ${position.positionId}`)
        continue
      }

      const currentPrice = prices[position.tokenOut]
      if (!currentPrice) continue

      const inZone =
        position.entryZoneLow  !== undefined && position.entryZoneHigh !== undefined &&
        currentPrice >= position.entryZoneLow && currentPrice <= position.entryZoneHigh
      if (!inZone) continue

      await activateLimitPosition(position, currentPrice)
    } catch (err: any) {
      console.warn(`[PositionMonitor] Error processing pending position ${position.positionId}:`, err.message)
    }
  }

  // ── Open positions: stop-loss / take-profit ───────────────────────────────
  for (const position of openPositions) {
    const currentPrice = prices[position.tokenOut]
    if (!currentPrice) continue

    const hitStopLoss   = position.stopLossPrice   !== undefined && currentPrice <= position.stopLossPrice
    const hitTakeProfit = position.takeProfitPrice !== undefined && currentPrice >= position.takeProfitPrice
    if (!hitStopLoss && !hitTakeProfit) continue

    try {
      await closePosition(position, currentPrice, hitStopLoss ? 'stop_loss' : 'take_profit')
    } catch (err: any) {
      console.warn(`[PositionMonitor] Error processing position ${position.positionId}:`, err.message)
    }
  }
}

// ── Scheduler wrapper ─────────────────────────────────────────────────────────

const INTERVAL_MS = Number(process.env.POSITION_MONITOR_INTERVAL_MS) || 60_000

let _timer: NodeJS.Timeout | null = null
let _sweeping = false

export function startPositionMonitor(): void {
  if (_timer) {
    console.warn('[PositionMonitor] Already running — stopPositionMonitor() first.')
    return
  }
  console.log(`[PositionMonitor] Starting — interval: ${INTERVAL_MS / 1000}s`)

  _timer = setInterval(async () => {
    if (_sweeping) return
    _sweeping = true
    try {
      await runPositionMonitorSweep()
    } catch (err: any) {
      console.error('[PositionMonitor] Sweep error:', err.message)
    } finally {
      _sweeping = false
    }
  }, INTERVAL_MS)

  if (_timer.unref) _timer.unref()
}

export function stopPositionMonitor(): void {
  if (_timer) {
    clearInterval(_timer)
    _timer = null
    console.log('[PositionMonitor] Stopped.')
  }
}

export function isPositionMonitorRunning(): boolean {
  return _timer !== null
}

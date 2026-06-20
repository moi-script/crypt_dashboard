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
import { writeOutcome } from '../memory/memory.writer'
import type { TradeIntent } from './loop.types'

type ExitReason = 'stop_loss' | 'take_profit'

async function closePosition(
  position: { positionId: string; userId?: string; tokenIn: string; tokenOut: string; entryAmountUsd: number; entryPrice?: number; strategy: string; confidence?: number; runId?: string; entryAt?: Date },
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

  // Write outcome memory — non-fatal; skip if position has no runId (not opened by agent loop)
  if (!position.runId) {
    console.warn(`[PositionMonitor] Skipping writeOutcome for ${position.positionId} — no runId (not an agent-loop position)`)
  } else {
    await writeOutcome(position.runId, {
      pnl:            result.simulatedPnlUsd ?? 0,
      pnlPercent:     position.entryAmountUsd > 0
        ? ((result.simulatedPnlUsd ?? 0) / position.entryAmountUsd) * 100
        : 0,
      durationHeldMs: result.executedAt.getTime() - new Date(position.entryAt ?? result.executedAt).getTime(),
      closedAt:       result.executedAt,
      success:        (result.simulatedPnlUsd ?? 0) > 0,
    }).catch((err: any) => console.warn('[PositionMonitor] writeOutcome failed:', err.message))
  }
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

      // Zone-break invalidation: if price breaks materially below/above zone, thesis is dead
      if (position.entryZoneLow !== undefined && position.entryZoneHigh !== undefined) {
        const zoneBrokenDown = currentPrice < position.entryZoneLow * 0.97   // 3% below zone low
        const zoneBrokenUp   = currentPrice > position.entryZoneHigh * 1.05  // 5% above zone high (chased)
        if (zoneBrokenDown || zoneBrokenUp) {
          await PositionDoc.updateOne({ positionId: position.positionId }, { $set: { status: 'cancelled', isOpen: false } })
          console.log(`[PositionMonitor] Zone break: cancelled ${position.positionId} — price $${currentPrice.toFixed(4)} ${zoneBrokenDown ? 'broke 3% below zone low' : 'ran 5% above zone high'}`)
          continue
        }
      }

      const inZone =
        position.entryZoneLow  !== undefined && position.entryZoneHigh !== undefined &&
        currentPrice >= position.entryZoneLow && currentPrice <= position.entryZoneHigh
      if (!inZone) continue

      // Candle-close confirmation: require a completed 1H candle closing inside zone
      // (prevents fills on wicks that touch the zone and immediately reverse)
      try {
        const sym   = position.tokenOut
        const klRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}USDT&interval=1h&limit=2`)
        if (klRes.ok) {
          const klines = await klRes.json() as number[][]
          const lastClosedClose = klines?.[0]?.[4] ? parseFloat(String(klines[0][4])) : null
          const zoneLow  = position.entryZoneLow!
          const zoneHigh = position.entryZoneHigh!
          if (lastClosedClose !== null && (lastClosedClose < zoneLow || lastClosedClose > zoneHigh)) {
            // Last CLOSED 1H candle is outside the zone — this is a wick, not confirmation
            console.log(`[PositionMonitor] ${position.positionId}: tick in zone but 1H close $${lastClosedClose.toFixed(4)} outside — awaiting candle confirmation`)
            continue
          }
        }
      } catch { /* non-fatal — proceed without confirmation on fetch error */ }

      await activateLimitPosition(position, currentPrice)
    } catch (err: any) {
      console.warn(`[PositionMonitor] Error processing pending position ${position.positionId}:`, err.message)
    }
  }

  // ── Server-side trailing stop: ratchet SL up as price rises ─────────────
  for (const position of openPositions) {
    const runnerTrailPct = (position as any).runnerTrailPct as number | undefined
    const trailPct = (position as any).trailingStopPct as number | undefined ?? runnerTrailPct
    if (!trailPct || !position.entryPrice) continue
    const currentPrice = prices[position.tokenOut]
    if (!currentPrice) continue

    const hwm       = ((position as any).highWaterMarkPrice as number | undefined) ?? position.entryPrice
    const newHwm    = Math.max(hwm, currentPrice)
    const newTrailSL = parseFloat((newHwm * (1 - trailPct / 100)).toFixed(4))
    const currentSL  = position.stopLossPrice ?? 0

    if (newHwm > hwm || newTrailSL > currentSL) {
      const update: Record<string, number> = { highWaterMarkPrice: newHwm }
      if (newTrailSL > currentSL) update.stopLossPrice = newTrailSL
      await PositionDoc.updateOne({ positionId: position.positionId }, { $set: update }).catch(() => {})
      if (newTrailSL > currentSL) {
        console.log(`[PositionMonitor] Trail: ${position.positionId} SL $${currentSL.toFixed(4)} → $${newTrailSL.toFixed(4)} (HWM $${newHwm.toFixed(4)})`)
        // Refresh in-memory value so the SL/TP check below uses the new SL
        position.stopLossPrice = newTrailSL
      }
    }
  }

  // ── Time-based exit: close dead positions that haven't moved toward TP ──────
  for (const position of openPositions) {
    const maxHoldHours = (position as any).maxHoldHours as number | undefined
    if (!maxHoldHours || !position.entryPrice || !position.entryAt) continue
    const ageHours = (now - new Date(position.entryAt).getTime()) / 3_600_000
    if (ageHours < maxHoldHours) continue

    const currentPrice = prices[position.tokenOut]
    if (!currentPrice) continue

    // Only time-exit if price hasn't moved meaningfully toward TP1 (< 25% of the way)
    const tp = position.takeProfitPrice
    if (tp && position.entryPrice) {
      const totalMove  = tp - position.entryPrice
      const actualMove = currentPrice - position.entryPrice
      if (totalMove > 0 && actualMove / totalMove >= 0.25) continue // trade is progressing, let it run
    }

    try {
      console.log(`[PositionMonitor] Time exit: ${position.positionId} open ${ageHours.toFixed(1)}h > ${maxHoldHours}h limit`)
      await closePosition(position, currentPrice, 'stop_loss')
    } catch (err: any) {
      console.warn(`[PositionMonitor] Error on time exit ${position.positionId}:`, err.message)
    }
  }

  // ── Open positions: stop-loss / TP1 scale-out / full TP ──────────────────
  for (const position of openPositions) {
    const currentPrice = prices[position.tokenOut]
    if (!currentPrice) continue

    const hitStopLoss   = position.stopLossPrice   !== undefined && currentPrice <= position.stopLossPrice
    const hitTakeProfit = position.takeProfitPrice !== undefined && currentPrice >= position.takeProfitPrice
    if (!hitStopLoss && !hitTakeProfit) continue

    try {
      const tp2          = (position as any).takeProfitPrice2 as number | undefined
      const tp1ScaledOut = (position as any).tp1ScaledOut as boolean | undefined

      const runnerActive = (position as any).runnerActive as boolean | undefined

      // TP1 hit + TP2 exists + not yet scaled → do 50% exit, move SL to BE, switch to TP2
      if (hitTakeProfit && tp2 && !tp1ScaledOut && position.entryPrice) {
        const halfAmount = position.entryAmountUsd * 0.5
        console.log(`[PositionMonitor] TP1 scale-out: ${position.positionId} — exit 50% @ $${currentPrice}, move SL → BE, set TP = $${tp2}`)
        await PositionDoc.updateOne({ positionId: position.positionId }, {
          $set: {
            entryAmountUsd:  halfAmount,
            stopLossPrice:   position.entryPrice,
            takeProfitPrice: tp2,
            tp1ScaledOut:    true,
          },
        })

      // TP2 hit after TP1 scale-out + no runner yet → exit 90%, keep 10% as runner with 5% trail
      } else if (hitTakeProfit && tp1ScaledOut && !runnerActive && position.entryPrice) {
        const runnerAmount   = position.entryAmountUsd * 0.10
        const exitAmount     = position.entryAmountUsd * 0.90
        const runnerTrailPct = 5
        const runnerSL       = parseFloat((currentPrice * (1 - runnerTrailPct / 100)).toFixed(4))
        console.log(`[PositionMonitor] TP2 hit — keeping 10% runner @ $${runnerAmount.toFixed(2)}, trail ${runnerTrailPct}% SL $${runnerSL}`)
        // Simulate partial exit at current price (record PnL for the 90% slice)
        const pnlPct    = position.entryPrice > 0 ? (currentPrice - position.entryPrice) / position.entryPrice : 0
        const partialPnl = exitAmount * pnlPct
        await PositionDoc.updateOne({ positionId: position.positionId }, {
          $set: {
            entryAmountUsd:  runnerAmount,
            stopLossPrice:   runnerSL,
            takeProfitPrice: undefined,   // let the runner ride with trailing stop only
            runnerActive:    true,
            runnerTrailPct:  runnerTrailPct,
            highWaterMarkPrice: currentPrice,
            realizedPnlUsd:  (position as any).realizedPnlUsd ? (position as any).realizedPnlUsd + partialPnl : partialPnl,
          },
          $unset: { takeProfitPrice: '' },
        })

      // Runner's trailing stop hit → close the runner
      } else if (hitStopLoss && runnerActive) {
        console.log(`[PositionMonitor] Runner stopped out: ${position.positionId} @ $${currentPrice}`)
        await closePosition(position, currentPrice, 'stop_loss')

      } else {
        await closePosition(position, currentPrice, hitStopLoss ? 'stop_loss' : 'take_profit')
      }
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

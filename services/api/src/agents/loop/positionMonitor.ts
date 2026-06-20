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

  // $inc preserves any realizedPnlUsd already credited by TP1/TP2 partial exits.
  // $set on the same update handles the close-specific fields.
  await PositionDoc.updateOne({ positionId: position.positionId }, {
    $set: {
      status: 'closed',
      isOpen: false,
      exitPrice,
      exitAmountUsd: result.filledAmountUsd,
      exitAt: result.executedAt,
    },
    $inc: { realizedPnlUsd: result.simulatedPnlUsd ?? 0 },
  })

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

  // Use fillPrice (the confirmed zone price) as entry, not executePaper's live market price.
  // executePaper is called only to update the wallet ledger; the position records the
  // actual limit fill price which is guaranteed to be inside the entry zone.
  const limitEntryPrice = fillPrice
  const limitFee = position.entryAmountUsd * 0.001  // maker fee on limit fills
  await PositionDoc.updateOne({ positionId: position.positionId }, { $set: {
    status: 'open',
    isOpen: true,
    entryPrice: limitEntryPrice,
    entryAmountUsd: position.entryAmountUsd - limitFee,
    entryFeesUsd: limitFee,
    entryAt: result.executedAt,
    orderId,
  } })

  console.log(`[PositionMonitor] Opened ${position.positionId} (limit fill) at $${limitEntryPrice.toFixed(4)} (fee $${limitFee.toFixed(4)})`)
}

// ── SL exit price model ───────────────────────────────────────────────────────
// Paper SL fills model realistic slippage. If price gapped >1% past the SL
// level the fill takes additional gap slippage; otherwise 0.3% below the SL.
function computeSlExitPrice(currentPrice: number, slPrice: number | undefined): number {
  if (!slPrice) return parseFloat((currentPrice * (1 - 0.003)).toFixed(4))
  const gapped = currentPrice < slPrice * 0.99   // gapped through by >1%
  return gapped
    ? parseFloat((currentPrice * (1 - 0.002)).toFixed(4))   // extra 0.2% for gap fill
    : parseFloat((slPrice       * (1 - 0.003)).toFixed(4))  // 0.3% below intended SL
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

  // Fetch live prices in parallel
  const prices: Record<string, number> = {}
  await Promise.all(uniqueSymbols.map(async sym => { prices[sym] = await getLivePrice(sym) }))

  // Fetch 1H candle low/high in parallel for all symbols that have SL-protected open positions.
  // This catches flash crashes that bottomed out and recovered within the 60s sweep interval.
  const symbolsWithSL = [...new Set(openPositions.filter(p => p.stopLossPrice).map(p => p.tokenOut))]
  const candleLows: Record<string, number>  = {}
  const candleHighs: Record<string, number> = {}
  await Promise.all(symbolsWithSL.map(async sym => {
    try {
      const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}USDT&interval=1h&limit=1`)
      if (r.ok) {
        const k = await r.json() as string[][]
        candleLows[sym]  = parseFloat(k[0][3])  // index 3 = candle low
        candleHighs[sym] = parseFloat(k[0][2])  // index 2 = candle high
      }
    } catch { /* non-fatal — live price check still fires for this sweep */ }
  }))

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

  // ── Server-side trailing stop: ratchet SL up (longs) or down (shorts) ───
  for (const position of openPositions) {
    const runnerTrailPct = (position as any).runnerTrailPct as number | undefined
    const trailPct = (position as any).trailingStopPct as number | undefined ?? runnerTrailPct
    if (!trailPct || !position.entryPrice) continue
    const currentPrice = prices[position.tokenOut]
    if (!currentPrice) continue

    const positionBias = (position as any).bias as 'long' | 'short' | undefined
    const posIsLong = !positionBias || positionBias === 'long'

    if (posIsLong) {
      const hwm        = ((position as any).highWaterMarkPrice as number | undefined) ?? position.entryPrice
      const newHwm     = Math.max(hwm, currentPrice)
      const newTrailSL = parseFloat((newHwm * (1 - trailPct / 100)).toFixed(4))
      const currentSL  = position.stopLossPrice ?? 0

      if (newHwm > hwm || newTrailSL > currentSL) {
        const update: Record<string, number> = { highWaterMarkPrice: newHwm }
        if (newTrailSL > currentSL) update.stopLossPrice = newTrailSL
        await PositionDoc.updateOne({ positionId: position.positionId }, { $set: update }).catch(() => {})
        if (newTrailSL > currentSL) {
          console.log(`[PositionMonitor] Trail (long): ${position.positionId} SL $${currentSL.toFixed(4)} → $${newTrailSL.toFixed(4)} (HWM $${newHwm.toFixed(4)})`)
          position.stopLossPrice = newTrailSL
        }
      }
    } else {
      // Short: low-water-mark, trail SL downward
      const lwm        = ((position as any).highWaterMarkPrice as number | undefined) ?? position.entryPrice
      const newLwm     = Math.min(lwm, currentPrice)
      const newTrailSL = parseFloat((newLwm * (1 + trailPct / 100)).toFixed(4))
      const currentSL  = position.stopLossPrice ?? Infinity

      if (newLwm < lwm || newTrailSL < currentSL) {
        const update: Record<string, number> = { highWaterMarkPrice: newLwm }
        if (newTrailSL < currentSL) update.stopLossPrice = newTrailSL
        await PositionDoc.updateOne({ positionId: position.positionId }, { $set: update }).catch(() => {})
        if (newTrailSL < currentSL) {
          console.log(`[PositionMonitor] Trail (short): ${position.positionId} SL $${currentSL.toFixed(4)} → $${newTrailSL.toFixed(4)} (LWM $${newLwm.toFixed(4)})`)
          position.stopLossPrice = newTrailSL
        }
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
      const timeBias   = (position as any).bias as 'long' | 'short' | undefined
      const timeIsLong = !timeBias || timeBias === 'long'
      const totalMove  = Math.abs(tp - position.entryPrice)
      const actualMove = timeIsLong ? currentPrice - position.entryPrice : position.entryPrice - currentPrice
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

    const bias     = (position as any).bias as 'long' | 'short' | undefined
    const isLong   = !bias || bias === 'long'  // default long for backward compat
    const FEE_PCT  = 0.001  // taker fee on partial exits (full closes use executePaper which already fees)

    // Live-price SL/TP check
    const liveSL = position.stopLossPrice   !== undefined && (isLong ? currentPrice <= position.stopLossPrice : currentPrice >= position.stopLossPrice)
    const liveTp = position.takeProfitPrice !== undefined && (isLong ? currentPrice >= position.takeProfitPrice : currentPrice <= position.takeProfitPrice)

    // 1H candle cross-check: catches flash crashes that bottomed and recovered within the sweep interval.
    // If the last 1H candle's low (for longs) or high (for shorts) crossed the SL, fire it
    // even though the live price has since recovered.
    const candleLow  = candleLows[position.tokenOut]
    const candleHigh = candleHighs[position.tokenOut]
    const flashSL = position.stopLossPrice !== undefined && (
      (isLong  && candleLow  !== undefined && candleLow  <= position.stopLossPrice) ||
      (!isLong && candleHigh !== undefined && candleHigh >= position.stopLossPrice)
    )

    const hitStopLoss   = liveSL || flashSL
    const hitTakeProfit = liveTp
    if (!hitStopLoss && !hitTakeProfit) continue

    // When fired by flash-cross (not live price), use the candle extreme for slippage modeling
    const slPriceRef = (flashSL && !liveSL)
      ? (isLong ? (candleLow ?? currentPrice) : (candleHigh ?? currentPrice))
      : currentPrice

    try {
      const tp2          = (position as any).takeProfitPrice2 as number | undefined
      const tp1ScaledOut = (position as any).tp1ScaledOut as boolean | undefined
      const runnerActive = (position as any).runnerActive as boolean | undefined

      // TP1 hit + TP2 exists + not yet scaled → 50% exit, move SL to BE, switch to TP2
      if (hitTakeProfit && tp2 && !tp1ScaledOut && position.entryPrice) {
        const halfAmount = position.entryAmountUsd * 0.5
        const pnlPct     = isLong
          ? (currentPrice - position.entryPrice) / position.entryPrice
          : (position.entryPrice - currentPrice) / position.entryPrice
        const partialPnl = parseFloat((halfAmount * pnlPct * (1 - FEE_PCT)).toFixed(4))
        console.log(`[PositionMonitor] TP1 scale-out: ${position.positionId} — exit 50% @ $${currentPrice}, locked PnL $${partialPnl.toFixed(2)}, SL → BE, TP → $${tp2}`)

        await OrderDoc.create({
          orderId:         `order-tp1-${generateMyId(10)}`,
          runId:           (position as any).runId ?? `monitor-${generateMyId(10)}`,
          userId:          position.userId,
          mode:            'paper',
          intentType:      'partial_exit',
          tokenIn:         position.tokenOut,
          tokenOut:        position.tokenIn,
          amountUsd:       halfAmount,
          status:          'filled',
          filledAmountUsd: parseFloat((halfAmount * (1 + pnlPct) * (1 - FEE_PCT)).toFixed(4)),
          entryPrice:      currentPrice,
          feesUsd:         parseFloat((halfAmount * FEE_PCT).toFixed(4)),
          executedAt:      new Date(),
          positionId:      position.positionId,
        })

        // BE stop: for longs = entryPrice, for shorts = entryPrice (same concept, opposite polarity)
        const beStop = position.entryPrice
        await PositionDoc.updateOne({ positionId: position.positionId }, {
          $set: {
            entryAmountUsd:  halfAmount,
            stopLossPrice:   beStop,
            takeProfitPrice: tp2,
            tp1ScaledOut:    true,
          },
          $inc: { realizedPnlUsd: partialPnl },
        })

      // TP2 hit after TP1 scale-out + no runner yet → exit 90%, keep 10% runner with 5% trail
      } else if (hitTakeProfit && tp1ScaledOut && !runnerActive && position.entryPrice) {
        const runnerAmount   = position.entryAmountUsd * 0.10
        const exitAmount     = position.entryAmountUsd * 0.90
        const runnerTrailPct = 5
        const runnerSL       = isLong
          ? parseFloat((currentPrice * (1 - runnerTrailPct / 100)).toFixed(4))
          : parseFloat((currentPrice * (1 + runnerTrailPct / 100)).toFixed(4))
        const pnlPct     = position.entryPrice > 0
          ? (isLong ? (currentPrice - position.entryPrice) / position.entryPrice
                    : (position.entryPrice - currentPrice) / position.entryPrice)
          : 0
        const partialPnl = parseFloat((exitAmount * pnlPct * (1 - FEE_PCT)).toFixed(4))
        console.log(`[PositionMonitor] TP2 hit — keeping 10% runner @ $${runnerAmount.toFixed(2)}, trail ${runnerTrailPct}% SL $${runnerSL}, locked PnL $${partialPnl.toFixed(2)}`)

        await OrderDoc.create({
          orderId:         `order-tp2-${generateMyId(10)}`,
          runId:           (position as any).runId ?? `monitor-${generateMyId(10)}`,
          userId:          position.userId,
          mode:            'paper',
          intentType:      'partial_exit',
          tokenIn:         position.tokenOut,
          tokenOut:        position.tokenIn,
          amountUsd:       exitAmount,
          status:          'filled',
          filledAmountUsd: parseFloat((exitAmount * (1 + pnlPct) * (1 - FEE_PCT)).toFixed(4)),
          entryPrice:      currentPrice,
          feesUsd:         parseFloat((exitAmount * FEE_PCT).toFixed(4)),
          executedAt:      new Date(),
          positionId:      position.positionId,
        })

        await PositionDoc.updateOne({ positionId: position.positionId }, {
          $set: {
            entryAmountUsd:     runnerAmount,
            stopLossPrice:      runnerSL,
            runnerActive:       true,
            runnerTrailPct:     runnerTrailPct,
            highWaterMarkPrice: currentPrice,
          },
          $inc:  { realizedPnlUsd: partialPnl },
          $unset: { takeProfitPrice: '' },
        })

      // Runner's trailing stop hit → close the runner
      } else if (hitStopLoss && runnerActive) {
        const slExitPrice = computeSlExitPrice(slPriceRef, position.stopLossPrice)
        const flashNote = flashSL && !liveSL ? ` [flash-crash candle low $${slPriceRef.toFixed(4)}]` : ''
        console.log(`[PositionMonitor] Runner stopped out: ${position.positionId} @ $${slExitPrice.toFixed(4)} (intended SL $${position.stopLossPrice?.toFixed(4)})${flashNote}`)
        await closePosition(position, slExitPrice, 'stop_loss')

      } else {
        // Full close: apply SL slippage model for stops; model taker fee for TP exits
        const exitPrice = hitStopLoss
          ? computeSlExitPrice(slPriceRef, position.stopLossPrice)
          : isLong
            ? parseFloat((currentPrice * (1 - FEE_PCT)).toFixed(4))
            : parseFloat((currentPrice * (1 + FEE_PCT)).toFixed(4))
        if (hitStopLoss && flashSL && !liveSL) {
          console.log(`[PositionMonitor] Flash-crash SL: ${position.positionId} live $${currentPrice.toFixed(4)} recovered above SL $${position.stopLossPrice?.toFixed(4)} but 1H candle low $${slPriceRef.toFixed(4)} crossed it — exit at $${exitPrice.toFixed(4)}`)
        }
        await closePosition(position, exitPrice, hitStopLoss ? 'stop_loss' : 'take_profit')
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

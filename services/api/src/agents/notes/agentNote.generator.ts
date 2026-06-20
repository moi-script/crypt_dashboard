/**
 * agentNote.generator.ts
 *
 * Generates human-readable notes for agent decisions and position outcomes.
 * Provides two main functions:
 * - buildEntryNote: Creates a comprehensive entry note with strategy context, decision, and risk analysis
 * - buildOutcomeNote: Creates a brief outcome note that appends to the entry note on position close
 */

import type { LoopContext, Decision, TradeIntent } from '../loop/loop.types'
import type { GatewayResult } from '../../execution/execution.gateway'

/**
 * buildEntryNote
 *
 * Produces a multi-line human-readable note explaining the trade decision.
 * Includes header, strategy analysis, tool trace, decision details, and risk gate status.
 */
export function buildEntryNote(
  ctx: LoopContext,
  decision: Decision,
  gateway: GatewayResult,
): string {
  const lines: string[] = []

  // ── Header line ──────────────────────────────────────────────────────────────
  const intent = decision.intent
  const coin =
    intent.type === 'propose_trade' ? (intent as TradeIntent).tokenOut : 'N/A'
  const dateStr = new Date()
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ')
  const header = `[${coin} | ${ctx.strategy} | ${dateStr} UTC]`
  lines.push(header)
  lines.push('')

  // ── Strategy analysis section ────────────────────────────────────────────────
  if (ctx.contextSummary && ctx.contextSummary.length > 0) {
    lines.push('Strategy analysis:')
    if (ctx.contextSummary.length > 600) {
      lines.push(ctx.contextSummary.slice(0, 600))
      lines.push('... (truncated)')
    } else {
      lines.push(ctx.contextSummary)
    }
    lines.push('')
  }

  // ── Tool call trace ──────────────────────────────────────────────────────────
  if (decision.toolCallTrace.length > 0) {
    lines.push(`Tool calls: ${decision.toolCallTrace.join(' → ')}`)
    lines.push('')
  }

  // ── Decision section ─────────────────────────────────────────────────────────
  if (intent.type !== 'propose_trade') {
    // Non-trade intents: simple decision + rationale
    lines.push(`Decision: ${intent.type.toUpperCase()}`)
    const rationale =
      'rationale' in intent ? intent.rationale : decision.reasoning
    lines.push(`Rationale: ${rationale}`)
  } else {
    // Trade intent: detailed entry parameters
    const trade = intent as TradeIntent
    lines.push(
      `Decision: LONG ${trade.tokenOut} — size $${trade.amountUsd.toFixed(2)}`,
    )

    if (
      trade.entryZoneLow !== undefined &&
      trade.entryZoneHigh !== undefined
    ) {
      lines.push(
        `Entry zone: $${trade.entryZoneLow.toFixed(2)} – $${trade.entryZoneHigh.toFixed(2)} (limit order, fills when price re-enters zone)`,
      )
    }

    if (trade.stopLossPrice !== undefined) {
      lines.push(`Stop loss: $${trade.stopLossPrice.toFixed(2)}`)
    }

    if (trade.takeProfitPrice !== undefined) {
      lines.push(`Take profit 1: $${trade.takeProfitPrice.toFixed(2)}`)
    }

    if ((trade as any).takeProfitPrice2 !== undefined) {
      lines.push(
        `Take profit 2: $${((trade as any).takeProfitPrice2 as number).toFixed(2)}`,
      )
    }

    if (trade.framework !== undefined) {
      lines.push(`Framework: ${trade.framework}`)
    }

    if (trade.rationale !== undefined) {
      lines.push(`Rationale: ${trade.rationale}`)
    }

    lines.push('')
    lines.push(`Confidence: ${decision.confidence}%`)
  }

  lines.push('')

  // ── Risk gate section ────────────────────────────────────────────────────────
  if (!gateway.riskPassed) {
    lines.push(
      `Risk gate: BLOCKED by ${gateway.riskBlockedBy} — ${gateway.riskReason}`,
    )
  } else if (gateway.pendingApproval) {
    lines.push('Risk gate: PASSED (8/8 rules) — queued for manual approval')
  } else {
    // Calculate portfolio heat
    const tradeUsd =
      intent.type === 'propose_trade' ? (intent as TradeIntent).amountUsd : 0
    const totalValueUsd = ctx.walletState.totalValueUsd
    const heatPct =
      totalValueUsd > 0 ? ((tradeUsd / totalValueUsd) * 100).toFixed(1) : '0.0'
    lines.push(
      `Risk gate: PASSED (8/8 rules) | portfolio heat: $${tradeUsd.toFixed(0)}/${totalValueUsd.toFixed(0)} (${heatPct}%)`,
    )
  }

  return lines.join('\n')
}

/**
 * buildOutcomeNote
 *
 * Returns a SHORT string that APPENDS to the entry note when a position closes.
 * Format: outcome with exit reason, price, duration, and P&L.
 */
export function buildOutcomeNote(
  exitReason: string,
  exitPrice: number,
  pnl: number,
  pnlPct: number,
  durationHeldMs: number,
): string {
  const exitReasonUpper = exitReason.replace('_', ' ').toUpperCase()

  const hours = Math.floor(durationHeldMs / 3_600_000)
  const minutes = Math.floor((durationHeldMs % 3_600_000) / 60_000)
  const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

  const sign = pnl >= 0 ? '+' : ''

  return `\n\nOUTCOME [${exitReasonUpper}]: exit $${exitPrice.toFixed(2)} after ${duration}. Realized ${sign}$${pnl.toFixed(2)} (${sign}${pnlPct.toFixed(2)}%).`
}

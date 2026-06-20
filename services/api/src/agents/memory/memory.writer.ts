// services/api/src/agents/memory/memory.writer.ts

import { saveMemory, findMemoryByRunId } from './memory.store'
import { embed }                         from './memory.embedder'
import type { LoopContext, Decision }    from '../loop/loop.types'
import type { AgentMemoryEntry }        from './memory.types'
import { buildOutcomeNote }             from '../notes/agentNote.generator'
import { AgentRunDoc }                  from '../../models/agentRun.model'

function extractCoin(decision: Decision): string {
  const intent = decision.intent
  if (intent.type === 'propose_trade') return intent.tokenOut ?? 'unknown'
  return 'unknown'
}

function buildSummary(ctx: LoopContext, decision: Decision): string {
  const coin   = extractCoin(decision)
  const action = decision.intent.type
  const conf   = decision.confidence
  const reason = decision.reasoning.slice(0, 200)
  return `${coin} | strategy:${ctx.strategy} | action:${action} | confidence:${conf} | ${reason}`
}

export async function writeDecision(
  ctx:      LoopContext,
  decision: Decision,
): Promise<void> {
  try {
    const summary   = buildSummary(ctx, decision)
    const embedding = await embed(summary)

    await saveMemory({
      agentId:     ctx.userId,
      runId:       ctx.runId,
      timestamp:   new Date(),
      coin:        extractCoin(decision),
      type:        'decision',
      summary,
      fullContext: {
        contextSummary: ctx.contextSummary.slice(0, 1000),
        intent:         decision.intent,
        toolCallTrace:  decision.toolCallTrace,
      },
      embedding,
      marketRegime: (ctx.marketData?.regime as string) ?? 'unknown',
      signals:      decision.toolCallTrace,
      tools:        decision.toolCallTrace,
    })
  } catch (err: any) {
    console.warn('[MemoryWriter] writeDecision failed (non-fatal):', err.message)
  }
}

export async function writeOutcome(
  runId:   string,
  outcome: NonNullable<AgentMemoryEntry['outcome']>,
): Promise<void> {
  try {
    const decisionEntry = await findMemoryByRunId(runId)
    if (!decisionEntry) return   // no decision entry to link to — skip silently

    const summary   = `Outcome for ${decisionEntry.coin} | pnl:${outcome.pnl.toFixed(2)} | success:${outcome.success}`
    const embedding = await embed(summary)

    await saveMemory({
      agentId:     decisionEntry.agentId,
      runId:       `${runId}-outcome`,
      timestamp:   outcome.closedAt,
      coin:        decisionEntry.coin,
      type:        'outcome',
      summary,
      fullContext: { outcome },
      embedding,
      linkedDecisionId: String(decisionEntry._id),
      outcome,
      marketRegime: decisionEntry.marketRegime,
      signals:      decisionEntry.signals,
      tools:        decisionEntry.tools,
    })

    // Append outcome note to the original run's agentNote field
    try {
      const outcomeText = buildOutcomeNote(
        outcome.success ? 'take_profit' : 'stop_loss',
        0,
        outcome.pnl,
        outcome.pnlPercent ?? 0,
        outcome.durationHeldMs ?? 0,
      )
      const runDoc = await AgentRunDoc.findOne({ runId }).select('agentNote').lean()
      if (runDoc) {
        const updated = (runDoc.agentNote ?? '') + outcomeText
        await AgentRunDoc.updateOne({ runId }, { $set: { agentNote: updated } }).catch(() => {})
        console.log(`[MemoryWriter] Outcome note appended to run ${runId}`)
      }
    } catch (err: any) {
      console.warn('[MemoryWriter] Outcome note append failed (non-fatal):', err.message)
    }
  } catch (err: any) {
    console.warn('[MemoryWriter] writeOutcome failed (non-fatal):', err.message)
  }
}

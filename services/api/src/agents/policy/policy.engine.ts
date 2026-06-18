/**
 * policy.engine.ts
 *
 * The tool-call loop: sends context to the LLM, handles read tool calls
 * iteratively, and captures the final act-tool call as a Decision.
 *
 * Flow:
 *   1. Build system prompt (from agent.system.prompt.ts)
 *   2. Send context + tool schemas to DeepSeek
 *   3. If model returns a READ tool call  → dispatch, append result, loop (cap 5)
 *   4. If model returns an ACT tool call  → produce Decision { intent, rationale }
 *   5. If model returns text / no call    → Decision { intent: no_action }
 */

import OpenAI from 'openai'

import { buildAgentSystemPrompt }         from './prompts/agent.system.prompt'
import { getToolSchemas, dispatch, isActTool, isReadTool, clearCandleCache } from '../tools/tool.registry'
import type { Decision, Intent, LoopContext }              from '../loop/loop.types'
import type { AgentConfig }                                from '../../config/agent.config'
import type { ToolCall, ToolContext }                      from '../tools/tool.types'
import { MarketRegime }                                    from '../chartAnalysis.types'

// ─── Regime → Skills routing table ───────────────────────────
// Imported from regimeDetector.prompt.ts where REGIME_TO_SKILLS is defined,
// but duplicated here for direct use without the prompt file's other exports.
const REGIME_TO_SKILLS: Record<string, string[]> = {
  trending_up:      ['smartMoney', 'elliott', 'multiTimeframe', 'fibonacci'],
  trending_down:    ['smartMoney', 'elliott', 'multiTimeframe', 'fibonacci'],
  ranging:          ['wyckoff', 'pivots', 'fibonacci', 'harmonics', 'smartMoney'],
  accumulation:     ['wyckoff', 'smartMoney', 'fibonacci', 'structure'],
  distribution:     ['wyckoff', 'smartMoney', 'harmonics', 'structure'],
  price_discovery:  ['fibonacci', 'elliott', 'smartMoney', 'multiTimeframe'],
};

/**
 * Returns the ordered list of skills that should run for a given market regime.
 * Called by orchestrator.ts before the skill execution loop.
 *
 * @param regime - The detected MarketRegime for the current coin/timeframe
 * @returns string[] - Skill names in priority order for this regime
 */
export function selectSkillsForRegime(regime: MarketRegime): string[] {
  return REGIME_TO_SKILLS[regime] ?? ['smartMoney', 'structure', 'fibonacci'];
}

const MAX_READ_ITERATIONS = 5

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey:  process.env.DEEPSEEK_API_KEY ?? '',
})

// ── Message types (OpenAI-compatible) ─────────────────────────────────────────

type Message =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenAI.Chat.ChatCompletionMessageToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

// ── Main function ─────────────────────────────────────────────────────────────

export async function runPolicyEngine(
  ctx:                    LoopContext,
  strategyContextSummary: string,
  config:                 AgentConfig,
  memoryContext?:         string,
): Promise<Decision> {
  // Clear the candle cache at the start of each policy engine run
  // so tool calls in this run start fresh but share within the run
  clearCandleCache()

  const toolCtx: ToolContext = {
    userId:   ctx.userId,
    strategy: ctx.strategy,
    dryRun:   config.mode === 'paper',
  }

  const walletSummary = [
    `Mode: ${config.mode}`,
    `Total value: $${ctx.walletState.totalValueUsd.toFixed(2)}`,
    `Daily PnL: $${ctx.walletState.dailyPnlUsd.toFixed(2)}`,
    `Open positions: ${ctx.walletState.openPositions}`,
  ].join(' | ')

  const systemPrompt = buildAgentSystemPrompt({
    mode:          config.mode,
    strategy:      ctx.strategy,
    walletSummary,
    maxTradeUsd:   config.maxTradeUsd,
    memorySection: memoryContext,
  })

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: strategyContextSummary },
  ]

  const toolSchemas  = getToolSchemas()
  const toolCallTrace: string[] = []
  let intent: Intent | null = null

  // ── Tool-call loop ──────────────────────────────────────────────────────────
  for (let iteration = 0; iteration < MAX_READ_ITERATIONS + 1; iteration++) {
    const completion = await deepseek.chat.completions.create({
      model:       'deepseek-chat',
      max_tokens:  1200,
      temperature: 0.3,
      messages:    messages as any,
      tools:       toolSchemas.map(s => ({ type: 'function' as const, function: s })),
      tool_choice: 'auto',
    })

    const choice = completion.choices?.[0]
    const msg    = choice?.message

    if (!msg) break

    messages.push({
      role:       'assistant',
      content:    msg.content ?? null,
      tool_calls: msg.tool_calls ?? undefined,
    })

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      intent = {
        type:      'no_action',
        rationale: msg.content ?? 'Model returned no tool call and no explanation.',
      }
      break
    }

    let foundActTool = false
    for (const tc of msg.tool_calls) {
      if (tc.type !== 'function') continue;

      const call: ToolCall = {
        id:        tc.id,
        name:      tc.function.name,
        arguments: JSON.parse(tc.function.arguments ?? '{}'),
      }

      toolCallTrace.push(call.name)

      if (isActTool(call.name)) {
        const result = await dispatch(call, toolCtx)
        if (!result.isError) {
          intent = result.output as Intent
        } else {
          console.warn('[PolicyEngine] Act tool error:', result.errorMessage)
          intent = { type: 'no_action', rationale: `Act tool failed: ${result.errorMessage}` }
        }
        messages.push({
          role:         'tool',
          tool_call_id: call.id,
          content:      JSON.stringify(result.output ?? { error: result.errorMessage }),
        })
        foundActTool = true
        break
      }

      if (isReadTool(call.name)) {
        const result = await dispatch(call, toolCtx)
        messages.push({
          role:         'tool',
          tool_call_id: call.id,
          content:      JSON.stringify(result.output ?? { error: result.errorMessage }),
        })
      }
    }

    if (foundActTool) break

    if (iteration >= MAX_READ_ITERATIONS) {
      console.warn('[PolicyEngine] Reached max read iterations without act tool — defaulting to no_action')
      intent = {
        type:      'no_action',
        rationale: `Reached ${MAX_READ_ITERATIONS} read iterations without a clear signal.`,
      }
    }
  }

  if (!intent) {
    intent = { type: 'no_action', rationale: 'Policy engine loop ended without a decision.' }
  }

  const rationale  = 'rationale' in intent ? intent.rationale : ''
  const confidence =
    intent.type === 'no_action'     ? 90 :
    intent.type === 'propose_trade' ? 65 :
    intent.type === 'set_alert'     ? 80 :
    70

  return {
    intent,
    confidence,
    reasoning:     rationale,
    toolCallTrace,
  }
}
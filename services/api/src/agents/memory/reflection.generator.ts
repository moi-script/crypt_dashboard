// services/api/src/agents/memory/reflection.generator.ts

import OpenAI           from 'openai'
import { AgentMemoryDoc } from '../../models/agentMemory.model'
import { saveReflection } from './memory.store'
import { embed }          from './memory.embedder'

// Uses DeepSeek (same as policy engine) for the reflection LLM call —
// keeping OpenAI SDK but pointing at DeepSeek base URL.
// Lazy-init: client is only constructed on first use so tests can mock the
// openai module before any real instantiation occurs.
let _llm: OpenAI | null = null

function getLlm(): OpenAI {
  if (_llm) return _llm
  _llm = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey:  process.env.DEEPSEEK_API_KEY ?? '',
  })
  return _llm
}

const LOOKBACK_MS = 24 * 60 * 60 * 1000  // 1 day

export async function runReflection(agentId: string, coin: string): Promise<void> {
  try {
    const since = new Date(Date.now() - LOOKBACK_MS)

    const entries = await AgentMemoryDoc.find({
      agentId, coin,
      type: { $in: ['decision', 'outcome'] },
      timestamp: { $gte: since },
    }).lean()

    if (entries.length === 0) return  // nothing to reflect on

    const decisions = entries.filter(e => e.type === 'decision')
    const outcomes  = entries.filter(e => e.type === 'outcome' && e.outcome)

    const winRate     = outcomes.length > 0
      ? outcomes.filter(e => e.outcome!.success).length / outcomes.length
      : 0
    const avgPnl      = outcomes.length > 0
      ? outcomes.reduce((s, e) => s + (e.outcome!.pnlPercent ?? 0), 0) / outcomes.length
      : 0

    const statsText = [
      `Coin: ${coin}`,
      `Decisions: ${decisions.length}`,
      `Outcomes with PnL: ${outcomes.length}`,
      `Win rate: ${(winRate * 100).toFixed(0)}%`,
      `Avg PnL%: ${avgPnl.toFixed(2)}%`,
      `Summaries: ${decisions.map(d => d.summary).join(' | ')}`,
    ].join('\n')

    const completion = await getLlm().chat.completions.create({
      model:       'deepseek-chat',
      max_tokens:  400,
      temperature: 0.4,
      messages: [
        {
          role:    'system',
          content: 'You are a trading performance analyst. Summarize what worked and what did not in the given period. Return ONLY valid JSON with keys: summary (string), lessonsLearned (string[]), bestPattern (string), worstPattern (string).',
        },
        { role: 'user', content: statsText },
      ],
    })

    let parsed: { summary: string; lessonsLearned: string[]; bestPattern: string; worstPattern: string }
    try {
      parsed = JSON.parse(completion.choices[0].message.content ?? '{}')
    } catch {
      parsed = { summary: 'Reflection unavailable.', lessonsLearned: [], bestPattern: 'n/a', worstPattern: 'n/a' }
    }

    const summaryText = parsed.summary
    const embedding   = await embed(summaryText)

    await saveReflection({
      agentId,
      coin,
      period: { start: since, end: new Date() },
      summary: summaryText,
      embedding,
      stats: {
        totalDecisions: decisions.length,
        winRate,
        avgPnlPercent:  avgPnl,
        bestPattern:    parsed.bestPattern,
        worstPattern:   parsed.worstPattern,
      },
      lessonsLearned: parsed.lessonsLearned,
    })

    console.log(`[ReflectionGenerator] Reflection written for ${agentId}/${coin}`)
  } catch (err: any) {
    console.warn('[ReflectionGenerator] Failed (non-fatal):', err.message)
  }
}

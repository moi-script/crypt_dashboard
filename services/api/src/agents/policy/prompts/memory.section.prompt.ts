import type { MemoryRetrievalResult } from '../../memory/memory.types'

export function renderMemorySection(result: MemoryRetrievalResult): string {
  if (result.similarMemories.length === 0 && !result.reflection) return ''

  const lines: string[] = ['## Relevant history (RAG context — use as advisory, not rules)']

  if (result.reflection) {
    const r = result.reflection
    lines.push(
      `\n### Most recent reflection (${r.period.start.toISOString().slice(0, 10)} – ${r.period.end.toISOString().slice(0, 10)})`,
      `Win rate: ${(r.stats.winRate * 100).toFixed(0)}% | Avg PnL: ${r.stats.avgPnlPercent.toFixed(2)}% | Decisions: ${r.stats.totalDecisions}`,
      `Best pattern: ${r.stats.bestPattern}`,
      `Worst pattern: ${r.stats.worstPattern}`,
      `Lessons: ${r.lessonsLearned.join(' | ')}`,
    )
  }

  if (result.similarMemories.length > 0) {
    lines.push('\n### Similar past situations')
    for (const m of result.similarMemories) {
      const ts    = new Date(m.timestamp).toISOString().slice(0, 16).replace('T', ' ')
      const pnl   = m.outcome ? ` → PnL: ${m.outcome.pnl.toFixed(2)} (${m.outcome.success ? '✓' : '✗'})` : ''
      lines.push(`- [${ts}] ${m.summary}${pnl}`)
    }
  }

  return lines.join('\n')
}

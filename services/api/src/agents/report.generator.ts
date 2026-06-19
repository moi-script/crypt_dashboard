/**
 * report.generator.ts
 *
 * Takes all skill outputs from the orchestrator and makes ONE
 * OpenRouter API call to synthesise everything into a structured report.
 *
 * Uses the OpenRouter free-tier model via the OpenAI-compatible endpoint.
 * Set your key in the environment: OPENROUTER_API_KEY=sk-or-...
 */

import type { OrchestratorResult } from './orchestrator'
import type { SkillResult } from '../models/analysis.model'
import OpenAI from 'openai'
// ── OpenRouter config ─────────────────────────────────────────────────────




const OPENROUTER_MODEL = 'deepseek-v4-flash'   // routes to a free model automatically


let _deepseek: OpenAI | null = null
function getClient(): OpenAI {
  if (!_deepseek) {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set')
    _deepseek = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey })
  }
  return _deepseek
}



export interface GeneratedReport {
  verdict: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell'
  confidence: number       // 0-100
  score: number       // -100 to +100
  narrative: string       // full paragraph reasoning
  keyPoints: string[]     // 3-5 bullet points
  risks: string[]     // 2-4 risk factors
  imagePrompt: string       // prompt for AI image generation
  behaviourNotes: string       // notes about this coin's character/patterns
}

// ── Compute weighted score from skills ────────────────────────────────────

const SKILL_WEIGHTS: Record<string, number> = {
  trend: 0.30,
  momentum: 0.25,
  volatility: 0.20,
  sentiment: 0.15,
  pattern: 0.10,
}

function computeWeightedScore(skills: SkillResult[]): number {
  let total = 0
  let weightSum = 0
  for (const skill of skills) {
    const w = SKILL_WEIGHTS[skill.name] ?? 0.1
    total += skill.score * w
    weightSum += w
  }
  return weightSum > 0 ? Math.round(total / weightSum) : 0
}

function scoreToVerdict(score: number): GeneratedReport['verdict'] {
  if (score >= 60) return 'strong_buy'
  if (score >= 25) return 'buy'
  if (score <= -60) return 'strong_sell'
  if (score <= -25) return 'sell'
  return 'neutral'
}

// ── Single OpenRouter call ────────────────────────────────────────────────

export async function generateReport(data: OrchestratorResult): Promise<GeneratedReport> {
  const weightedScore = computeWeightedScore(data.skills)
  const prelimVerdict = scoreToVerdict(weightedScore)

  // Build skill summaries block
  const skillBlock = data.skills.map(s =>
    `[${s.name.toUpperCase()}] verdict=${s.verdict} score=${s.score}/100\n${s.summary}`
  ).join('\n\n')

  // Recent price context
  const recentPrices = data.priceHistory.slice(-7).map(p => `$${p.price.toFixed(2)}`).join(' → ')

  // News headlines
  const newsBlock = data.newsHeadlines.length > 0
    ? data.newsHeadlines.slice(0, 8).map((h, i) => `${i + 1}. ${h}`).join('\n')
    : 'No recent news found.'

  // Past behaviour context
  const behaviourBlock = data.behaviourNotes
    ? `Previous behaviour notes: ${data.behaviourNotes}`
    : `This is analysis run #${data.pastAnalyses + 1} for this coin.`

  const prompt = `You are an expert crypto market analyst. Analyse the data below and return ONLY a valid JSON object — no other text, no markdown fences.

=== COIN ===
Name: ${data.coinName} (${data.symbol})
Current price: $${data.price.toFixed(4)}
7-day price trail: ${recentPrices}
Past analysis runs: ${data.pastAnalyses}
${behaviourBlock}

=== SKILL RESULTS ===
${skillBlock}

=== NEWS (last 14 days, ${data.newsCount} articles) ===
Average sentiment: ${data.sentimentAvg.toFixed(2)} (-1 bearish to +1 bullish)
Headlines:
${newsBlock}

=== PRELIMINARY SCORE ===
Weighted score: ${weightedScore}/100 → ${prelimVerdict}

=== TASK ===
Based on ALL the above, produce a JSON object with EXACTLY these fields:

{
  "verdict": "strong_buy|buy|neutral|sell|strong_sell",
  "confidence": 0,
  "score": 0,
  "narrative": "3-4 sentences of clear reasoning that explains WHY the verdict is what it is, referencing specific data points",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "risks": ["risk 1", "risk 2"],
  "imagePrompt": "a vivid visual scene representing the market mood for this coin — abstract, dramatic, no text",
  "behaviourNotes": "1-2 sentences about this coin's personality, tendencies, or patterns you observe from the data"
}

Rules:
- verdict: must match the weighted score direction unless you have strong reason to override
- confidence: 0-100 integer. Lower if skills conflict. Higher if all skills agree.
- score: -100 to +100 integer. Your final assessment score.
- narrative: be specific — mention actual numbers, indicators, patterns. Do NOT be generic.
- keyPoints: 3-5 short bullet strings, each under 120 characters
- risks: 2-4 specific risk factors for this coin right now
- imagePrompt: vivid, cinematic, abstract. E.g. "a massive green wave crashing through a dark canyon, digital particles, cinematic lighting"
- behaviourNotes: observations about this specific coin's tendencies based on data patterns`

  try {

    const completion = await getClient().chat.completions.create({
      model: OPENROUTER_MODEL,
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (completion.choices?.[0]?.message?.content ?? '')
      .replace(/```json|```/g, '')
      .trim()

    const parsed = JSON.parse(text) as GeneratedReport

    console.log("Parse reports ::", parsed);

    // Sanitise
    parsed.confidence = Math.max(0, Math.min(100, parsed.confidence))
    parsed.score = Math.max(-100, Math.min(100, parsed.score))
    parsed.keyPoints = Array.isArray(parsed.keyPoints) ? parsed.keyPoints : []
    parsed.risks = Array.isArray(parsed.risks) ? parsed.risks : []

    return parsed

  } catch (err: any) {
    console.warn('[ReportGenerator] OpenRouter call failed:', err.message)

    // Fallback: use computed score, generate basic report
    return {
      verdict: prelimVerdict,
      confidence: 40,
      score: weightedScore,
      narrative: `Analysis based on ${data.skills.length} technical skills. Score: ${weightedScore}/100. ${data.skills.map(s => s.summary).join(' ')}`,
      keyPoints: data.skills.map(s => `${s.name}: ${s.verdict} (${s.score})`),
      risks: ['AI report generation unavailable — interpret raw skill scores directly.'],
      imagePrompt: `abstract crypto market visualization for ${data.coinName}`,
      behaviourNotes: '',
    }
  }
}


// ── Build final reasoning steps from AI report ───────────────────────────
// Called by analysis.service after generateReport() returns

import type { ReasoningStep } from '../models/analysis.model'

export function buildFinalReasoningSteps(
  report: GeneratedReport,
  startStep: number,
): ReasoningStep[] {
  const steps: ReasoningStep[] = []
  let n = startStep

  // Verdict step
  steps.push({
    step: ++n,
    phase: 'verdict',
    title: `Final verdict: ${report.verdict.replace('_', ' ').toUpperCase()}`,
    detail: report.narrative,
    score: report.score,
    decision: `Confidence: ${report.confidence}%. Score: ${report.score > 0 ? '+' : ''}${report.score}/100.`,
  })

  // Key points as individual reasoning steps
  for (const point of report.keyPoints) {
    steps.push({
      step: ++n,
      phase: 'verdict',
      title: 'Key finding',
      detail: point,
    })
  }

  // Risks
  if (report.risks.length > 0) {
    steps.push({
      step: ++n,
      phase: 'verdict',
      title: `${report.risks.length} risk factor${report.risks.length > 1 ? 's' : ''} identified`,
      detail: report.risks.map((r, i) => `${i + 1}. ${r}`).join('\n'),
      decision: 'Factor these risks into any position sizing decisions.',
    })
  }

  return steps
}
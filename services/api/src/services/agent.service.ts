/**
 * agent.service.ts  (updated — richer analysis output + expanded system prompt)
 */

import {
  type AgentEmotion,
  type AgentChatSession,
  type AgentChatMessage,
  makeEmotion,
} from '../agents/emotion.types'

import {
  type MarketSnapshot,
  deriveEmotion,
  getEmotionState,
  setEmotionState,
  initEmotionState,
  EMOTION_COOLDOWN,
} from '../agents/emotion.state'

import { AgentSessionDoc, type IAgentSession } from '../models/agent.model'
import { AnalysisDoc } from '../models/analysis.model'
import { CoinGeckoService } from './coingecko.service'
import OpenAI from 'openai'

const cg = new CoinGeckoService()
const sessionCache = new Map<string, AgentChatSession>()

const apiKey = process.env.DEEPSEEK_API_KEY
if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set')

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey:  process.env.DEEPSEEK_API_KEY ?? '',
})

// ── Session helpers ───────────────────────────────────────────────────────────

async function loadOrCreateSession(
  sessionId: string,
  coinId:    string,
  userId?:   string,
): Promise<AgentChatSession> {
  if (sessionCache.has(sessionId)) return sessionCache.get(sessionId)!

  const existing = await AgentSessionDoc.findOne({ sessionId }).lean()

  if (existing) {
    const session: AgentChatSession = {
      sessionId:      existing.sessionId,
      coinId:         existing.coinId,
      messages:       existing.messages as AgentChatMessage[],
      currentEmotion: existing.currentEmotion as AgentEmotion,
      createdAt:      existing.createdAt.getTime(),
      updatedAt:      existing.updatedAt.getTime(),
    }
    initEmotionState(sessionId)
    setEmotionState(sessionId, {
      current:     existing.currentEmotion as AgentEmotion,
      lockedUntil: 0,
      turnCount:   existing.messages.filter(m => m.role === 'user').length,
    })
    sessionCache.set(sessionId, session)
    return session
  }

  const now     = Date.now()
  const emotion = makeEmotion('thinking', 'low', 'New session', "Hey! What's on your mind?")

  const session: AgentChatSession = {
    sessionId, coinId,
    messages:       [],
    currentEmotion: emotion,
    createdAt:      now,
    updatedAt:      now,
  }

  await AgentSessionDoc.create({
    sessionId, userId, coinId,
    messages:       [],
    currentEmotion: emotion,
    createdAt:      new Date(now),
    updatedAt:      new Date(now),
  })

  initEmotionState(sessionId)
  sessionCache.set(sessionId, session)
  return session
}

async function persistSession(session: AgentChatSession): Promise<void> {
  try {
    await AgentSessionDoc.updateOne(
      { sessionId: session.sessionId },
      {
        $set: {
          coinId:         session.coinId,
          messages:       session.messages.slice(-20),
          currentEmotion: session.currentEmotion,
          updatedAt:      new Date(),
        },
      },
      { upsert: true },
    )
    sessionCache.set(session.sessionId, session)
  } catch (err: any) {
    console.warn('[AgentService] Failed to persist session:', err.message)
  }
}

// ── Market snapshot ───────────────────────────────────────────────────────────

async function buildMarketSnapshot(
  coinId:       string,
  isAnalysing?: boolean,
): Promise<MarketSnapshot> {
  try {
    const [detail, lastAnalysis] = await Promise.all([
      cg.getCoinDetail(coinId, { marketData: true }),
      AnalysisDoc.findOne({ coinId }).sort({ runAt: -1 }).lean(),
    ])

    const change24h = detail.market_data?.price_change_percentage_24h ?? 0
    const change7d  = detail.market_data?.price_change_percentage_7d  ?? 0

    let lastAccurate: boolean | undefined
    if (lastAnalysis) {
      const verdict = lastAnalysis.verdict
      if (verdict === 'strong_buy' || verdict === 'buy') {
        lastAccurate = change24h > 1
      } else if (verdict === 'strong_sell' || verdict === 'sell') {
        lastAccurate = change24h < -1
      } else {
        lastAccurate = Math.abs(change24h) < 3
      }
    }

    const skillConflict = lastAnalysis
      ? (lastAnalysis.skills?.filter((s: any) => s.verdict === 'bullish').length > 0 &&
         lastAnalysis.skills?.filter((s: any) => s.verdict === 'bearish').length > 0)
      : false

    return {
      change24h, change7d,
      verdict:      lastAnalysis?.verdict,
      confidence:   lastAnalysis?.confidence,
      lastAccurate, isAnalysing, skillConflict,
    }
  } catch {
    return { change24h: 0, change7d: 0, isAnalysing }
  }
}

// ── JSON repair helpers ───────────────────────────────────────────────────────

function extractContent(raw: string): string | null {
  const match = raw.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/s)
  if (match) return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
  return null
}

function safeParseJSON(raw: string): {
  content:         string
  emotion?:        AgentEmotion
  suggestAnalysis?: boolean
  suggestAlert?:   boolean
} | null {
  let cleaned = raw.replace(/```json|```/g, '').trim()

  const start = cleaned.indexOf('{')
  const end   = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  cleaned = cleaned.slice(start, end + 1)

  cleaned = cleaned.replace(/("(?:[^"\\]|\\.)*")/gs, (m) =>
    m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
  )

  try { return JSON.parse(cleaned) } catch { /* continue */ }

  try {
    const fixed = cleaned.replace(/,\s*([}\]])/g, '$1')
    return JSON.parse(fixed)
  } catch { /* continue */ }

  const content = extractContent(cleaned)
  if (content) return { content }
  return null
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(
  emotion:      AgentEmotion,
  snapshot:     MarketSnapshot,
  coinId:       string,
  history:      AgentChatMessage[],
  lastAnalysis: any | null,
): string {
  const recentMsgs = history.slice(-5, -1).map(m =>
    `${m.role === 'user' ? 'User' : 'You'}: ${m.content.slice(0, 100)}`
  ).join('\n')

  const marketSummary = [
    `${coinId.toUpperCase()} 24h: ${snapshot.change24h.toFixed(2)}%`,
    lastAnalysis
      ? `Last verdict: ${lastAnalysis.verdict} (score ${lastAnalysis.score}, confidence ${lastAnalysis.confidence}%)`
      : 'No analysis yet',
    snapshot.lastAccurate === true  ? 'Last prediction: CORRECT' :
    snapshot.lastAccurate === false ? 'Last prediction: WRONG'   : '',
  ].filter(Boolean).join(' | ')

  // If the last analysis is recent (within 10 mins), inject its full data
  const analysisBlock = lastAnalysis && (Date.now() - new Date(lastAnalysis.runAt).getTime() < 10 * 60 * 1000)
    ? `\n=== FRESH ANALYSIS JUST RAN ===
Verdict: ${lastAnalysis.verdict.toUpperCase()} | Score: ${lastAnalysis.score}/100 | Confidence: ${lastAnalysis.confidence}%
Narrative: ${lastAnalysis.narrative}
Key Points: ${(lastAnalysis.keyPoints ?? []).map((k: string, i: number) => `${i+1}. ${k}`).join(' | ')}
Risks: ${(lastAnalysis.risks ?? []).slice(0,3).join(' | ')}
Skills: ${(lastAnalysis.skills ?? []).map((s: any) => `${s.name}=${s.verdict}(${s.score})`).join(', ')}
`
    : ''

  const personality: Record<string, string> = {
    happy:      'Enthusiastic and upbeat. Use exclamations. You can go up to 5 sentences.',
    depressed:  'Somber and cautious. You can be detailed but slightly pessimistic.',
    nervous:    'Hedge with "maybe" and "I think". Mention uncertainties.',
    frustrated: 'Blunt and self-critical about missed calls, but thorough.',
    shocked:    'Dramatic about market moves. Very expressive.',
    thinking:   'Methodical and deeply analytical. Walk through your reasoning.',
  }

  const sanitise = (s: string) => s.replace(/"/g, "'").replace(/\n/g, ' ').slice(0, 80)

  const template = {
    content: '__REPLY__',
    emotion: {
      emotion:   emotion.emotion,
      intensity: emotion.intensity,
      reason:    sanitise(emotion.reason),
      asset:     `/emotions/${emotion.emotion}.png`,
      message:   sanitise(emotion.message),
    },
    suggestAnalysis: false,
    suggestAlert:    false,
  }

  return `You are a crypto AI agent. Current mood: ${emotion.emotion.toUpperCase()}.
Personality: ${personality[emotion.emotion] ?? 'Neutral and helpful.'}
Market context: ${marketSummary}
${analysisBlock}
${recentMsgs ? `Recent conversation:\n${recentMsgs}\n` : ''}
INSTRUCTIONS:
- Reply in character with your mood. Up to 5 sentences — be substantive, not just a one-liner.
- If analysis data is present above, reference SPECIFIC numbers: the score, verdict, key points, and skill results.
- You're an analyst with personality — share your actual opinion about what the data means.
- After analysis, always mention: the verdict, the score, at least 2 key points, and 1-2 risks.
- Replace __REPLY__ with your response text only. Do NOT add literal newlines inside the content string. Use \\n if needed.
- Do NOT change any other field. Return the JSON exactly as structured below.
- Return ONLY the JSON object. No markdown, no explanation, nothing else.
- CRITICAL: If the user asks to run analysis, analyze, or check the market — set suggestAnalysis to true.

${JSON.stringify(template, null, 0)}`
}

// ── Canned responses for automated triggers ───────────────────────────────────

const ANALYSIS_CANNED: Record<string, string> = {
  happy:      "On it! Crunching the numbers now — feeling good about this one!",
  depressed:  "Running it... though I'm not sure it'll change much.",
  nervous:    "Okay, maybe I'll find something useful this time. Scanning now...",
  frustrated: "Running analysis again. Need to redeem myself after that last miss.",
  shocked:    "Analyzing NOW — with moves like these I have to know what's happening!",
  thinking:   "Initiating full analysis. Processing all available signals. Stand by.",
}

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ChatInput {
  sessionId:    string
  message:      string
  coinId?:      string
  userId?:      string
  isAnalysing?: boolean
}

export interface ChatOutput {
  sessionId:       string
  content:         string
  emotion:         AgentEmotion
  suggestAnalysis: boolean
  suggestAlert:    boolean
  history:         AgentChatMessage[]
  // ── new: attached analysis report for rich rendering ──
  analysisReport?: {
    verdict:     string
    score:       number
    confidence:  number
    narrative:   string
    keyPoints:   string[]
    risks:       string[]
    skillsUsed:  string[]
    skills:      { name: string; verdict: string; score: number; summary: string }[]
    reasoning:   { step: number; phase: string; title: string; detail: string; score?: number; decision?: string }[]
    coinName:    string
    symbol:      string
    priceAtRun:  number
    runAt:       string
  }
}

// ── Main service ──────────────────────────────────────────────────────────────

export class AgentService {

  async chat(input: ChatInput): Promise<ChatOutput> {
    const { sessionId, message, coinId = 'bitcoin', userId, isAnalysing } = input

    const session  = await loadOrCreateSession(sessionId, coinId, userId)
    const snapshot = await buildMarketSnapshot(coinId, isAnalysing)
    const emotion  = deriveEmotion(snapshot, sessionId)

    session.currentEmotion = emotion
    session.updatedAt      = Date.now()

    const emotionState = getEmotionState(sessionId) ?? initEmotionState(sessionId)
    emotionState.current     = emotion
    emotionState.lockedUntil = Date.now() + (EMOTION_COOLDOWN[emotion.emotion] ?? 0)
    emotionState.turnCount  += 1
    setEmotionState(sessionId, emotionState)

    let lastAnalysis = null
    try {
      lastAnalysis = await AnalysisDoc.findOne({ coinId }).sort({ runAt: -1 }).lean()
    } catch { /* ignore */ }

    session.messages.push({ role: 'user', content: message, ts: Date.now() })

    // ── Skip API call when analysis is running ────────────────────────────────
    if (isAnalysing) {
      const content = ANALYSIS_CANNED[emotion.emotion] ?? 'Running analysis, stand by...'
      session.messages.push({ role: 'agent', content, emotion, ts: Date.now() })
      if (session.messages.length > 20) session.messages = session.messages.slice(-20)
      persistSession(session).catch(() => {})
      return {
        sessionId, content, emotion,
        suggestAnalysis: false,
        suggestAlert:    false,
        history:         session.messages,
      }
    }

    // ── Normal chat — call DeepSeek ───────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(emotion, snapshot, coinId, session.messages, lastAnalysis)

    let content         = ''
    let responseEmotion = emotion
    let suggestAnalysis = false
    let suggestAlert    = false

    try {
      const completion = await deepseek.chat.completions.create({
        model:       'deepseek-v4-flash',
        max_tokens:  800,   // bumped from 600 to allow richer responses
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: message },
        ],
      })

      const raw = completion.choices?.[0]?.message?.content ?? ''
      console.log('[AgentService] finish_reason:', completion.choices?.[0]?.finish_reason)
      console.log('[AgentService] Raw:', raw)

      const parsed = safeParseJSON(raw)

      if (parsed?.content) {
        content         = parsed.content
        responseEmotion = (parsed.emotion as AgentEmotion) ?? emotion
        suggestAnalysis = parsed.suggestAnalysis ?? false
        suggestAlert    = parsed.suggestAlert    ?? false
        responseEmotion.asset = `/emotions/${responseEmotion.emotion}.png`
      } else {
        console.warn('[AgentService] JSON parse failed, using fallback')
        content = this.fallbackResponse(emotion, message)
      }

    } catch (err: any) {
      console.warn('[AgentService] Chat failed:', err.message)
      content = this.fallbackResponse(emotion, message)
    }

    session.messages.push({ role: 'agent', content, emotion: responseEmotion, ts: Date.now() })
    if (session.messages.length > 20) session.messages = session.messages.slice(-20)

    persistSession(session).catch(() => {})

    return {
      sessionId, content,
      emotion:         responseEmotion,
      suggestAnalysis, suggestAlert,
      history:         session.messages,
    }
  }

  // ── Notify session after analysis completes ───────────────────────────────
  // Now returns the full analysis object attached to the response

 async notifyAnalysisComplete(
  sessionId:  string,
  coinId:     string,
  verdict:    string,
  score:      number,
  confidence: number,
): Promise<ChatOutput> {
  const session = await loadOrCreateSession(sessionId, coinId)
  const analysis = await AnalysisDoc.findOne({ coinId }).sort({ runAt: -1 }).lean()
  const snapshot = await buildMarketSnapshot(coinId, false)
  const emotion  = deriveEmotion(snapshot, sessionId)

  const verdictEmoji: Record<string, string> = {
    strong_buy: '🚀', buy: '📈', neutral: '⚖️', sell: '📉', strong_sell: '💀',
  }
  const emoji = verdictEmoji[verdict] ?? '📊'

  let richContent = `${emoji} Analysis complete for ${analysis?.coinName ?? coinId.toUpperCase()}! `
  if (analysis) {
    richContent += `My verdict: **${verdict.replace('_', ' ').toUpperCase()}** with a score of ${score > 0 ? '+' : ''}${score}/100 at ${confidence}% confidence. `
    if (analysis.narrative)  richContent += `${analysis.narrative} `
    if (analysis.keyPoints?.length) richContent += `Key findings: ${analysis.keyPoints.slice(0, 3).join(' • ')}. `
    if (analysis.risks?.length)     richContent += `Watch out for: ${analysis.risks.slice(0, 2).join('; ')}.`
  } else {
    richContent += `Verdict: ${verdict.replace('_', ' ').toUpperCase()}, score ${score > 0 ? '+' : ''}${score}/100, confidence ${confidence}%.`
  }

  // ── Build report FIRST ──────────────────────────────────────────────
  const analysisReport = analysis ? {
    verdict:     analysis.verdict,
    score:       analysis.score,
    confidence:  analysis.confidence ?? 0,
    narrative:   analysis.narrative,
    keyPoints:   analysis.keyPoints ?? [],
    risks:       analysis.risks ?? [],
    skillsUsed:  analysis.skillsUsed ?? [],
    skills:      (analysis.skills ?? []).map((s: any) => ({
      name: s.name, verdict: s.verdict, score: s.score, summary: s.summary,
    })),
    reasoning: (analysis.reasoning ?? []).map((r: any) => ({
      step: r.step, phase: r.phase, title: r.title, detail: r.detail, score: r.score, decision: r.decision,
    })),
    coinName:   analysis.coinName,
    symbol:     analysis.symbol,
    priceAtRun: analysis.priceAtRun ?? 0,
    runAt:      analysis.runAt instanceof Date ? analysis.runAt.toISOString() : String(analysis.runAt),
  } : undefined

  // ── Push WITH report attached ───────────────────────────────────────
  session.messages.push({
    role:    'agent',
    content: richContent,
    emotion: emotion,
    ts:      Date.now(),
    report:  analysisReport,
  })

  if (session.messages.length > 20) session.messages = session.messages.slice(-20)
  await persistSession(session)

  return {
    sessionId,
    content: richContent,
    emotion,
    suggestAnalysis: false,
    suggestAlert:    false,
    history:         session.messages,
    analysisReport,
  }
}
  // ── Session helpers ───────────────────────────────────────────────────────

  async getSession(sessionId: string): Promise<AgentChatSession | null> {
    if (sessionCache.has(sessionId)) return sessionCache.get(sessionId)!
    const doc = await AgentSessionDoc.findOne({ sessionId }).lean()
    if (!doc) return null
    return {
      sessionId:      doc.sessionId,
      coinId:         doc.coinId,
      messages:       doc.messages as AgentChatMessage[],
      currentEmotion: doc.currentEmotion as AgentEmotion,
      createdAt:      doc.createdAt.getTime(),
      updatedAt:      doc.updatedAt.getTime(),
    }
  }

  // Never returns 404 — creates the doc if missing (used by GET /api/agent/session/:id)
  async getOrCreateSession(
    sessionId: string,
    coinId:    string,
    userId?:   string,
  ): Promise<AgentChatSession> {
    if (sessionCache.has(sessionId)) return sessionCache.get(sessionId)!
    const doc = await AgentSessionDoc.findOne({ sessionId }).lean()
    if (doc) {
      const session: AgentChatSession = {
        sessionId:      doc.sessionId,
        coinId:         doc.coinId,
        messages:       doc.messages as AgentChatMessage[],
        currentEmotion: doc.currentEmotion as AgentEmotion,
        createdAt:      doc.createdAt.getTime(),
        updatedAt:      doc.updatedAt.getTime(),
      }
      sessionCache.set(sessionId, session)
      return session
    }
    // Document missing — upsert it now
    return loadOrCreateSession(sessionId, coinId, userId)
  }

  async getUserSessions(userId: string): Promise<IAgentSession[]> {
    return AgentSessionDoc.find({ userId }).sort({ updatedAt: -1 }).limit(10).lean()
  }

  async clearSession(sessionId: string): Promise<void> {
    sessionCache.delete(sessionId)
    await AgentSessionDoc.deleteOne({ sessionId })
  }

  // ── Fallback responses ────────────────────────────────────────────────────

  private fallbackResponse(emotion: AgentEmotion, message: string): string {
    const isGreeting = ['hi', 'hello', 'hey', 'how are you'].some(g =>
      message.toLowerCase().includes(g)
    )
    if (isGreeting) {
      const responses: Record<string, string> = {
        happy:      "Hey! Markets are looking great today! Really feeling good.",
        depressed:  "Hey... it's rough out there. I'm watching closely.",
        nervous:    "Oh hi! I'm on edge — signals are mixed everywhere.",
        frustrated: "Hey. Still processing that last miss, but I'm refocused.",
        shocked:    "Hey!! Did you see what just happened?! Wild.",
        thinking:   "Hey, one sec — still processing the data...",
      }
      return responses[emotion.emotion] ?? "Hey there!"
    }
    return `Feeling ${emotion.emotion} about the market. ${emotion.message}`
  }
}
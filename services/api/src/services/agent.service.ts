/**
 * agent.service.ts (fixed)
 *
 * Key fixes:
 * - Drastically simplified system prompt so free models don't generate broken JSON
 * - Robust JSON extraction and repair logic
 * - Emotion fields pre-filled in prompt template to reduce hallucination
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
import { AnalysisDoc }       from '../models/analysis.model'
import { CoinGeckoService }  from './coingecko.service'

const cg = new CoinGeckoService()

const sessionCache = new Map<string, AgentChatSession>()

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

// ── JSON repair helper ────────────────────────────────────────────────────────

function extractContent(raw: string): string | null {
  const match = raw.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/s)
  if (match) return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
  return null
}

function safeParseJSON(raw: string): {
  content: string
  emotion?: AgentEmotion
  suggestAnalysis?: boolean
  suggestAlert?: boolean
} | null {
  // 1. Strip markdown fences
  let cleaned = raw.replace(/```json|```/g, '').trim()

  // 2. Extract outermost JSON object
  const start = cleaned.indexOf('{')
  const end   = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  cleaned = cleaned.slice(start, end + 1)

  // 3. Direct parse
  try {
    return JSON.parse(cleaned)
  } catch { /* continue */ }

  // 4. Fix common issues
  try {
    const fixed = cleaned
      .replace(/("(?:[^"\\]|\\.)*")/gs, (m) =>
        m.replace(/\n/g, '\\n').replace(/\r/g, '\\r')
      )
      .replace(/,\s*([}\]])/g, '$1')
    return JSON.parse(fixed)
  } catch { /* continue */ }

  // 5. Extract just content field as last resort
  const content = extractContent(cleaned)
  if (content) return { content }
  return null
}

// ── System prompt — minimal to avoid JSON truncation ─────────────────────────

function buildSystemPrompt(
  emotion:      AgentEmotion,
  snapshot:     MarketSnapshot,
  coinId:       string,
  history:      AgentChatMessage[],
  lastAnalysis: any | null,
): string {
  const recentMsgs = history.slice(-4).map(m =>
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

  const personality: Record<string, string> = {
    happy:      'You are enthusiastic and upbeat. Use exclamations.',
    depressed:  'You are somber and cautious. Keep it short.',
    nervous:    'You hedge everything with maybe and I think.',
    frustrated: 'You are blunt and self-critical about missed calls.',
    shocked:    'You are dramatic about market moves.',
    thinking:   'You are methodical and analytical.',
  }

  // Pre-fill JSON template — model only replaces the content value
  const jsonTemplate = JSON.stringify({
    content:         "__REPLY__",
    emotion: {
      emotion:   emotion.emotion,
      intensity: emotion.intensity,
      reason:    emotion.reason,
      asset:     `/emotions/${emotion.emotion}.png`,
      message:   emotion.message,
    },
    suggestAnalysis: false,
    suggestAlert:    false,
  })

  return `You are a crypto AI agent. Mood: ${emotion.emotion.toUpperCase()}.
${personality[emotion.emotion] ?? ''}
Market: ${marketSummary}
${recentMsgs ? `Recent chat:\n${recentMsgs}` : ''}

Reply under 80 words in character with your mood.
Output ONLY this JSON with __REPLY__ replaced by your response (no newlines in reply text, use \\n instead):
${jsonTemplate}`
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

    const systemPrompt = buildSystemPrompt(emotion, snapshot, coinId, session.messages, lastAnalysis)

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')

    let content         = ''
    let responseEmotion = emotion
    let suggestAnalysis = false
    let suggestAlert    = false

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer':  process.env.APP_URL ?? 'http://localhost:3000',
          'X-Title':       'Crypto Agent',
        },
        body: JSON.stringify({
          model:       'openrouter/free',
          max_tokens:  350,
          temperature: 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: message },
          ],
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`OpenRouter ${response.status}: ${errText.slice(0, 100)}`)
      }

      const json = await response.json() as {
        choices: { message: { content: string } }[]
      }

      const raw = json.choices?.[0]?.message?.content ?? ''
      console.log('[AgentService] Raw:', raw.slice(0, 150))

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

    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20)
    }

    persistSession(session).catch(() => {})

    return {
      sessionId, content,
      emotion: responseEmotion,
      suggestAnalysis, suggestAlert,
      history: session.messages,
    }
  }

  async notifyAnalysisComplete(
    sessionId:  string,
    coinId:     string,
    verdict:    string,
    score:      number,
    confidence: number,
  ): Promise<void> {
    const session = await loadOrCreateSession(sessionId, coinId)
    const verdictMessages: Record<string, string> = {
      strong_buy:  `Analysis complete! Very bullish — strong buy at ${confidence}% confidence. Score: +${score}/100.`,
      buy:         `Done! Leaning bullish. Buy signal at ${confidence}% confidence. Score: +${score}/100.`,
      neutral:     `Analysis done. Mixed signals — neutral. Score: ${score}/100.`,
      sell:        `Analysis done. Concerning signs. Sell at ${confidence}% confidence. Score: ${score}/100.`,
      strong_sell: `Analysis complete. Bearish — strong sell at ${confidence}% confidence. Score: ${score}/100.`,
    }
    session.messages.push({
      role: 'agent',
      content: verdictMessages[verdict] ?? `Analysis complete. Verdict: ${verdict}.`,
      emotion: session.currentEmotion,
      ts: Date.now(),
    })
    if (session.messages.length > 20) session.messages = session.messages.slice(-20)
    await persistSession(session)
  }

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

  async getUserSessions(userId: string): Promise<IAgentSession[]> {
    return AgentSessionDoc.find({ userId }).sort({ updatedAt: -1 }).limit(10).lean()
  }

  async clearSession(sessionId: string): Promise<void> {
    sessionCache.delete(sessionId)
    await AgentSessionDoc.deleteOne({ sessionId })
  }

  private fallbackResponse(emotion: AgentEmotion, message: string): string {
    const isGreeting = ['hi','hello','hey','how are you'].some(g =>
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
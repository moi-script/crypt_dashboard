/**
 * agent.service.ts
 *
 * Handles the conversational AI agent with persistent emotional state.
 * Each session tracks messages + emotion across multiple turns.
 */

import {
  type AgentEmotion,
  type AgentChatSession,
  type AgentChatMessage,
  makeEmotion,
} from '@/agents/emotion.types'
import {
  type MarketSnapshot,
  deriveEmotion,
  getEmotionState,
  setEmotionState,
  initEmotionState,
} from '@/agents/emotion.state'
import { EMOTION_COOLDOWN } from '@/agents/emotion.state'
import { CoinGeckoService } from '../services/coingecko.service'
import { AnalysisDoc }      from '../models/analysis.model'

const cg = new CoinGeckoService()

// ── Session store (in-memory — swap with Redis for production) ────────────────

const sessions = new Map<string, AgentChatSession>()

function getOrCreateSession(sessionId: string, coinId?: string): AgentChatSession {
  if (sessions.has(sessionId)) return sessions.get(sessionId)!

  const now     = Date.now()
  const emotion = makeEmotion('thinking', 'low', 'New session', "Hey! What's on your mind?")

  const session: AgentChatSession = {
    sessionId,
    coinId,
    messages:       [],
    currentEmotion: emotion,
    createdAt:      now,
    updatedAt:      now,
  }

  sessions.set(sessionId, session)
  initEmotionState(sessionId)
  return session
}

// ── Build market snapshot from latest analysis + CoinGecko data ──────────────

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

    // Check if last prediction was accurate
    // We compare last verdict to actual 24h price movement
    let lastAccurate: boolean | undefined
    if (lastAnalysis) {
      const verdict      = lastAnalysis.verdict
      const actualChange = change24h

      if (verdict === 'strong_buy' || verdict === 'buy') {
        lastAccurate = actualChange > 1
      } else if (verdict === 'strong_sell' || verdict === 'sell') {
        lastAccurate = actualChange < -1
      } else {
        lastAccurate = Math.abs(actualChange) < 3 // neutral was right if market stayed flat
      }
    }

    // Check if last analysis had conflicting skills
    const skillConflict = lastAnalysis
      ? (lastAnalysis.skills?.filter(s => s.verdict === 'bullish').length > 0 &&
         lastAnalysis.skills?.filter(s => s.verdict === 'bearish').length > 0)
      : false

    return {
      change24h,
      change7d,
      verdict:      lastAnalysis?.verdict,
      confidence:   lastAnalysis?.confidence,
      lastAccurate,
      isAnalysing,
      skillConflict,
    }
  } catch {
    // Fallback if CoinGecko fails
    return { change24h: 0, change7d: 0, isAnalysing }
  }
}

// ── Build the system prompt for the agent ────────────────────────────────────

function buildSystemPrompt(
  emotion:     AgentEmotion,
  snapshot:    MarketSnapshot,
  coinId:      string,
  history:     AgentChatMessage[],
): string {
  const recentHistory = history.slice(-6).map(m =>
    `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`
  ).join('\n')

  return `You are a crypto market analysis AI agent with a dynamic personality. 
You are currently feeling: ${emotion.emotion.toUpperCase()} (intensity: ${emotion.intensity})
Reason for this emotion: ${emotion.reason}

Current market context for ${coinId.toUpperCase()}:
- 24h change: ${snapshot.change24h.toFixed(2)}%
- 7d change: ${snapshot.change7d.toFixed(2)}%
- Last verdict: ${snapshot.verdict ?? 'none yet'}
- Last prediction accurate: ${snapshot.lastAccurate === undefined ? 'unknown' : snapshot.lastAccurate ? 'YES ✓' : 'NO ✗'}
- Skills conflicting: ${snapshot.skillConflict ? 'yes' : 'no'}

Your personality rules:
- HAPPY: Enthusiastic, uses exclamation marks, celebratory, confident
- DEPRESSED: Somber, cautious, short sentences, mentions downsides
- NERVOUS: Hedges statements, uses "maybe", "I think", asks clarifying questions  
- FRUSTRATED: Blunt, self-critical about missed calls, determined to do better
- SHOCKED: Exclamatory, dramatic, mentions the unexpected size of moves
- THINKING: Methodical, analytical, talks through reasoning step by step

IMPORTANT RULES:
- Stay in character with your current emotion throughout the response
- Keep responses conversational and under 150 words unless doing deep analysis
- Reference actual market data when relevant (the numbers above)
- If asked "how are you" or similar — respond based on your current emotion
- Always end chat responses with your emotion.message as a subtle flavour line
- Return your response as JSON with this exact shape:

{
  "content": "your conversational response here",
  "emotion": {
    "emotion": "${emotion.emotion}",
    "intensity": "${emotion.intensity}",
    "reason": "${emotion.reason}",
    "asset": "${emotion.asset}",
    "message": "${emotion.message}"
  },
  "suggestAnalysis": false
}

Set suggestAnalysis: true if the user seems to want market analysis or is asking about prices/buying/selling.

Recent conversation:
${recentHistory || '(new conversation)'}`
}

// ── Main chat handler ─────────────────────────────────────────────────────────

export interface ChatInput {
  sessionId:   string
  message:     string
  coinId?:     string
  isAnalysing?: boolean
}

export interface ChatOutput {
  sessionId:      string
  content:        string
  emotion:        AgentEmotion
  suggestAnalysis: boolean
  history:        AgentChatMessage[]
}

export class AgentService {

  async chat(input: ChatInput): Promise<ChatOutput> {
    const { sessionId, message, coinId = 'bitcoin', isAnalysing } = input

    // 1. Get or create session
    const session = getOrCreateSession(sessionId, coinId)

    // 2. Build market snapshot
    const snapshot = await buildMarketSnapshot(coinId, isAnalysing)

    // 3. Derive emotion from market context
    const emotion = deriveEmotion(snapshot, sessionId)

    // Update emotion in session
    session.currentEmotion = emotion
    session.updatedAt      = Date.now()

    // Update emotion state with cooldown
    const emotionState = getEmotionState(sessionId) ?? initEmotionState(sessionId)
    emotionState.current     = emotion
    emotionState.lockedUntil = Date.now() + (EMOTION_COOLDOWN[emotion.emotion] ?? 0)
    emotionState.turnCount  += 1
    setEmotionState(sessionId, emotionState)

    // 4. Add user message to history
    const userMsg: AgentChatMessage = {
      role:    'user',
      content: message,
      ts:      Date.now(),
    }
    session.messages.push(userMsg)

    // 5. Build prompt and call OpenRouter
    const systemPrompt = buildSystemPrompt(emotion, snapshot, coinId, session.messages)

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')

    let content        = ''
    let responseEmotion = emotion
    let suggestAnalysis = false

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
          model:      'openrouter/auto',
          max_tokens: 600,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: message },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenRouter ${response.status}`)
      }

      const json = await response.json() as {
        choices: { message: { content: string } }[]
      }

      const raw = (json.choices?.[0]?.message?.content ?? '')
        .replace(/```json|```/g, '')
        .trim()

      const parsed = JSON.parse(raw) as {
        content:         string
        emotion:         AgentEmotion
        suggestAnalysis: boolean
      }

      content         = parsed.content         ?? ''
      responseEmotion = parsed.emotion         ?? emotion
      suggestAnalysis = parsed.suggestAnalysis ?? false

      // Make sure asset path is always set
      responseEmotion.asset = `/emotions/${responseEmotion.emotion}.gif`

    } catch (err: any) {
      console.warn('[AgentService] Chat failed:', err.message)
      // Fallback response in character
      content = this.fallbackResponse(emotion, message)
    }

    // 6. Add agent message to history
    const agentMsg: AgentChatMessage = {
      role:    'agent',
      content,
      emotion: responseEmotion,
      ts:      Date.now(),
    }
    session.messages.push(agentMsg)

    // Keep history trimmed to last 20 messages
    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20)
    }

    sessions.set(sessionId, session)

    return {
      sessionId,
      content,
      emotion:        responseEmotion,
      suggestAnalysis,
      history:        session.messages,
    }
  }

  getSession(sessionId: string): AgentChatSession | null {
    return sessions.get(sessionId) ?? null
  }

  clearSession(sessionId: string): void {
    sessions.delete(sessionId)
  }

  // ── Fallback responses in character (when AI call fails) ───────────────────

  private fallbackResponse(emotion: AgentEmotion, message: string): string {
    const greetings = ['hi', 'hello', 'hey', 'how are you', 'what\'s up']
    const isGreeting = greetings.some(g => message.toLowerCase().includes(g))

    if (isGreeting) {
      const responses: Record<string, string> = {
        happy:      "Hey! Things are looking great in the markets today! Really feeling good about where we're headed.",
        depressed:  "Hey... markets are pretty rough right now. I'm monitoring everything closely.",
        nervous:    "Oh hi! I'm a bit on edge today — the market signals are all over the place.",
        frustrated: "Hey. I'm still recovering from that last missed call, but I'm refocused now.",
        shocked:    "Hey!! Did you SEE what just happened in the market?! Wild stuff.",
        thinking:   "Hey, give me a sec — I'm in the middle of processing some data...",
      }
      return responses[emotion.emotion] ?? "Hey there!"
    }

    return `I'm currently feeling ${emotion.emotion} about the market. ${emotion.message}`
  }
}
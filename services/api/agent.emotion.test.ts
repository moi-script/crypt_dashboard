/**
 * agent.emotion.test.ts
 *
 * Full test suite for:
 *   - emotion.types  (makeEmotion, EMOTION_ASSETS)
 *   - emotion.state  (deriveEmotion, cooldown, initEmotionState, getEmotionState, setEmotionState)
 *   - AgentService   (chat, session management, fallback, history trimming)
 *
 * Run:
 *   npx jest agent.emotion.test.ts --verbose
 *
 * All external deps (fetch, CoinGecko, MongoDB) are fully mocked.
 * No network calls are made.
 */

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  makeEmotion,
  EMOTION_ASSETS,
  type EmotionType,
  type AgentEmotion,
} from '@/agents/emotion.types'

import { AgentChatMessage } from '@/agents/emotion.types'
import {
  deriveEmotion,
  initEmotionState,
  getEmotionState,
  setEmotionState,
  type MarketSnapshot,
} from '@/agents/emotion.state'
import { AgentService } from '@/services/agent.service'
// ── Mock CoinGecko + MongoDB so no real network/db calls happen ───────────────

jest.mock('@/services/coingecko.service', () => ({
  CoinGeckoService: jest.fn().mockImplementation(() => ({
    getCoinDetail: jest.fn().mockResolvedValue({
      market_data: {
        price_change_percentage_24h: 3.5,
        price_change_percentage_7d:  8.2,
      },
    }),
  })),
}))

jest.mock('@/models/analysis.model', () => ({
  AnalysisDoc: {
    findOne: jest.fn().mockReturnValue({
      sort:  jest.fn().mockReturnThis(),
      lean:  jest.fn().mockResolvedValue(null),
    }),
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Unique session ID per test to avoid state bleed */
let sessionCounter = 0
function uid(): string {
  return `test-session-${++sessionCounter}-${Date.now()}`
}

/** Build a market snapshot with sensible defaults */
function snap(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    change24h:     0,
    change7d:      0,
    isAnalysing:   false,
    skillConflict: false,
    ...overrides,
  }
}

/** Mock a successful OpenRouter response */
function mockFetchSuccess(
  content:         string,
  emotion:         Partial<AgentEmotion> = {},
  suggestAnalysis  = false,
) {
  const fullEmotion: AgentEmotion = {
    emotion:   'happy',
    intensity: 'medium',
    reason:    'Market up',
    asset:     '/emotions/happy.gif',
    message:   'Feeling good!',
    ...emotion,
  }

  global.fetch = jest.fn().mockResolvedValueOnce({
    ok:     true,
    status: 200,
    json:   async () => ({
      choices: [{
        message: {
          content: JSON.stringify({ content, emotion: fullEmotion, suggestAnalysis }),
        },
      }],
    }),
  } as any)
}

/** Mock a failing OpenRouter response */
function mockFetchFail(status = 401) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok:     false,
    status,
    text:   async () => JSON.stringify({ error: { message: 'Unauthorized', code: status } }),
    json:   async () => ({ error: { message: 'Unauthorized' } }),
  } as any)
}

/** Mock a network-level fetch error */
function mockFetchNetworkError() {
  global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'))
}

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'sk-or-test-key'
  jest.clearAllMocks()
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ═════════════════════════════════════════════════════════════════════════════
// 1. makeEmotion
// ═════════════════════════════════════════════════════════════════════════════

describe('makeEmotion', () => {

  test('returns correct shape', () => {
    const e = makeEmotion('happy', 'high', 'Market up 10%', 'Feeling great!')
    expect(e).toMatchObject({
      emotion:   'happy',
      intensity: 'high',
      reason:    'Market up 10%',
      message:   'Feeling great!',
      asset:     expect.any(String),
    })
  })

  test('asset path matches EMOTION_ASSETS map', () => {
    const emotionTypes: EmotionType[] = ['happy', 'depressed', 'nervous', 'frustrated', 'shocked', 'thinking']
    for (const type of emotionTypes) {
      const e = makeEmotion(type, 'low', 'test', 'test')
      expect(e.asset).toBe(EMOTION_ASSETS[type])
    }
  })

  test('all six emotion types produce valid asset paths', () => {
    const types: EmotionType[] = ['happy', 'depressed', 'nervous', 'frustrated', 'shocked', 'thinking']
    types.forEach(type => {
      const e = makeEmotion(type, 'medium', 'r', 'm')
      expect(e.asset).toMatch(/^\/emotions\/.+\.gif$/)
    })
  })

  test('preserves reason and message exactly', () => {
    const reason  = 'The market crashed 20% in one hour'
    const message = 'WHOA. I did NOT see that coming.'
    const e = makeEmotion('shocked', 'high', reason, message)
    expect(e.reason).toBe(reason)
    expect(e.message).toBe(message)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. EMOTION_ASSETS
// ═════════════════════════════════════════════════════════════════════════════

describe('EMOTION_ASSETS', () => {

  test('has an entry for every emotion type', () => {
    const types: EmotionType[] = ['happy', 'depressed', 'nervous', 'frustrated', 'shocked', 'thinking']
    types.forEach(t => {
      expect(EMOTION_ASSETS[t]).toBeDefined()
      expect(typeof EMOTION_ASSETS[t]).toBe('string')
    })
  })

  test('all paths start with /emotions/', () => {
    Object.values(EMOTION_ASSETS).forEach(path => {
      expect(path).toMatch(/^\/emotions\//)
    })
  })

  test('all paths end with a file extension', () => {
    Object.values(EMOTION_ASSETS).forEach(path => {
      expect(path).toMatch(/\.(gif|mp4|webm|png)$/)
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. initEmotionState / getEmotionState / setEmotionState
// ═════════════════════════════════════════════════════════════════════════════

describe('emotion state store', () => {

  test('initEmotionState creates a new state', () => {
    const id    = uid()
    const state = initEmotionState(id)
    expect(state).toMatchObject({
      current:     expect.any(Object),
      lockedUntil: 0,
      turnCount:   0,
    })
  })

  test('getEmotionState returns null for unknown session', () => {
    expect(getEmotionState('nonexistent-session-xyz')).toBeNull()
  })

  test('getEmotionState returns state after init', () => {
    const id = uid()
    initEmotionState(id)
    const state = getEmotionState(id)
    expect(state).not.toBeNull()
    expect(state!.turnCount).toBe(0)
  })

  test('setEmotionState persists and getEmotionState retrieves it', () => {
    const id      = uid()
    const emotion = makeEmotion('happy', 'high', 'test', 'test')
    setEmotionState(id, { current: emotion, lockedUntil: 9999, turnCount: 5 })
    const retrieved = getEmotionState(id)
    expect(retrieved!.turnCount).toBe(5)
    expect(retrieved!.lockedUntil).toBe(9999)
    expect(retrieved!.current.emotion).toBe('happy')
  })

  test('setEmotionState overwrites existing state', () => {
    const id = uid()
    initEmotionState(id)
    const emotion = makeEmotion('frustrated', 'high', 'bad call', 'ugh')
    setEmotionState(id, { current: emotion, lockedUntil: 0, turnCount: 10 })
    expect(getEmotionState(id)!.current.emotion).toBe('frustrated')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. deriveEmotion — market rules
// ═════════════════════════════════════════════════════════════════════════════

describe('deriveEmotion', () => {

  // ── isAnalysing always wins ───────────────────────────────────────────────

  test('returns thinking when isAnalysing = true regardless of market', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ isAnalysing: true, change24h: 20 }), id)
    expect(result.emotion).toBe('thinking')
  })

  test('thinking overrides even a locked emotion', () => {
    const id      = uid()
    const emotion = makeEmotion('happy', 'high', 'test', 'test')
    setEmotionState(id, { current: emotion, lockedUntil: Date.now() + 999_999, turnCount: 1 })
    const result = deriveEmotion(snap({ isAnalysing: true }), id)
    expect(result.emotion).toBe('thinking')
  })

  // ── Emotion cooldown ──────────────────────────────────────────────────────

  test('respects cooldown — returns locked emotion when still in window', () => {
    const id      = uid()
    const locked  = makeEmotion('frustrated', 'high', 'bad call', 'ugh')
    setEmotionState(id, {
      current:     locked,
      lockedUntil: Date.now() + 999_999, // locked for a long time
      turnCount:   1,
    })
    // Even though market is up 10%, frustration is locked
    const result = deriveEmotion(snap({ change24h: 10 }), id)
    expect(result.emotion).toBe('frustrated')
  })

  test('allows emotion change after cooldown expires', () => {
    const id      = uid()
    const expired = makeEmotion('frustrated', 'high', 'bad call', 'ugh')
    setEmotionState(id, {
      current:     expired,
      lockedUntil: Date.now() - 1000, // already expired
      turnCount:   1,
    })
    const result = deriveEmotion(snap({ change24h: 10 }), id)
    expect(result.emotion).toBe('happy')
  })

  // ── lastAccurate = false → frustrated ────────────────────────────────────

  test('frustrated when lastAccurate = false', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ lastAccurate: false }), id)
    expect(result.emotion).toBe('frustrated')
  })

  test('frustrated intensity is high when confidence > 70', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ lastAccurate: false, confidence: 85 }), id)
    expect(result.emotion).toBe('frustrated')
    expect(result.intensity).toBe('high')
  })

  test('frustrated intensity is medium when confidence <= 70', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ lastAccurate: false, confidence: 60 }), id)
    expect(result.intensity).toBe('medium')
  })

  test('frustrated intensity is medium when confidence is undefined', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ lastAccurate: false, confidence: undefined }), id)
    expect(result.intensity).toBe('medium')
  })

  // ── lastAccurate = true → happy ───────────────────────────────────────────

  test('happy when lastAccurate = true', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ lastAccurate: true }), id)
    expect(result.emotion).toBe('happy')
    expect(result.intensity).toBe('high')
  })

  // ── Shocked — extreme moves ───────────────────────────────────────────────

  test('shocked on +16% move', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ change24h: 16 }), id)
    expect(result.emotion).toBe('shocked')
    expect(result.intensity).toBe('high')
  })

  test('shocked on -20% crash', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ change24h: -20 }), id)
    expect(result.emotion).toBe('shocked')
  })

  test('not shocked at exactly 15% (boundary — needs > 15)', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ change24h: 15 }), id)
    expect(result.emotion).not.toBe('shocked')
  })

  test('shocked message mentions the direction (up)', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ change24h: 18 }), id)
    expect(result.message).toMatch(/up/i)
  })

  test('shocked message mentions the direction (down)', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ change24h: -18 }), id)
    expect(result.message).toMatch(/down/i)
  })

  // ── Depressed — market down ───────────────────────────────────────────────

  test('depressed on -6% change', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ change24h: -6 }), id)
    expect(result.emotion).toBe('depressed')
    expect(result.intensity).toBe('medium')
  })

  test('depressed high intensity on -11% change', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ change24h: -11 }), id)
    expect(result.emotion).toBe('depressed')
    expect(result.intensity).toBe('high')
  })

test('not depressed HIGH intensity at exactly -5% (boundary)', () => {
  const id = uid()
  initEmotionState(id)
  const result = deriveEmotion(snap({ change24h: -5 }), id)
  expect(result.emotion).toBe('depressed')
  expect(result.intensity).toBe('low')   // mild branch, not the -5 branch
})

  // ── Happy — market up ─────────────────────────────────────────────────────

  test('happy on +6% change', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ change24h: 6 }), id)
    expect(result.emotion).toBe('happy')
    expect(result.intensity).toBe('medium')
  })

  test('happy high intensity on +11% change', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ change24h: 11 }), id)
    expect(result.emotion).toBe('happy')
    expect(result.intensity).toBe('high')
  })

test('not happy HIGH intensity at exactly +5% (boundary)', () => {
  const id = uid()
  initEmotionState(id)
  const result = deriveEmotion(snap({ change24h: 5 }), id)
  expect(result.emotion).toBe('happy')
  expect(result.intensity).toBe('low')   // mild branch, not the +5 branch
})

  // ── Nervous — sideways / conflict ─────────────────────────────────────────

  test('nervous on skill conflict', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ change24h: 3, skillConflict: true }), id)
    expect(result.emotion).toBe('nervous')
  })

  test('nervous on flat market (abs24h < 2, abs7d < 3)', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ change24h: 0.5, change7d: 1 }), id)
    expect(result.emotion).toBe('nervous')
  })

  test('nervous reason mentions conflicting signals when skillConflict = true', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ skillConflict: true }), id)
    expect(result.reason).toMatch(/conflict/i)
  })

  // ── Mild moves ────────────────────────────────────────────────────────────

  test('happy low on +3% change', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ change24h: 3, change7d: 5 }), id)
    expect(result.emotion).toBe('happy')
    expect(result.intensity).toBe('low')
  })

  test('depressed low on -3% change', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ change24h: -3, change7d: -5 }), id)
    expect(result.emotion).toBe('depressed')
    expect(result.intensity).toBe('low')
  })

  // ── Default fallback ──────────────────────────────────────────────────────

  test('returns nervous low as default when market is calm and no prior state', () => {
    const id = uid()
    // No initEmotionState — blank session
    const result = deriveEmotion(snap({ change24h: 0, change7d: 0 }), id)
    expect(result.emotion).toBe('nervous')
  })

  // ── Priority order ────────────────────────────────────────────────────────

  test('lastAccurate=false takes priority over shocked market', () => {
    const id = uid()
    initEmotionState(id)
    // Even a 20% move is overridden by a wrong prediction
    const result = deriveEmotion(snap({ lastAccurate: false, change24h: 20 }), id)
    expect(result.emotion).toBe('frustrated')
  })

  test('lastAccurate=true takes priority over depressed market', () => {
    const id = uid()
    initEmotionState(id)
    const result = deriveEmotion(snap({ lastAccurate: true, change24h: -8 }), id)
    expect(result.emotion).toBe('happy')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. AgentService — session management
// ═════════════════════════════════════════════════════════════════════════════

describe('AgentService — session management', () => {
  let svc: AgentService

  beforeEach(() => {
    svc = new AgentService()
  })

  test('getSession returns null for unknown sessionId', () => {
    expect(svc.getSession('nonexistent-xyz')).toBeNull()
  })

  test('clearSession removes the session', async () => {
    const id = uid()
    mockFetchSuccess('Hello!')
    await svc.chat({ sessionId: id, message: 'hi' })
    expect(svc.getSession(id)).not.toBeNull()
    svc.clearSession(id)
    expect(svc.getSession(id)).toBeNull()
  })

  test('clearSession on unknown id does not throw', () => {
    expect(() => svc.clearSession('unknown-session')).not.toThrow()
  })

  test('session is created on first chat call', async () => {
    const id = uid()
    mockFetchSuccess('Hey!')
    await svc.chat({ sessionId: id, message: 'hi' })
    expect(svc.getSession(id)).not.toBeNull()
  })

  test('session has correct sessionId', async () => {
    const id = uid()
    mockFetchSuccess('Hey!')
    await svc.chat({ sessionId: id, message: 'hello' })
    expect(svc.getSession(id)!.sessionId).toBe(id)
  })

  test('session stores coinId', async () => {
    const id = uid()
    mockFetchSuccess('Hey!')
    await svc.chat({ sessionId: id, message: 'hi', coinId: 'ethereum' })
    expect(svc.getSession(id)!.coinId).toBe('ethereum')
  })

  test('coinId defaults to bitcoin when not provided', async () => {
    const id = uid()
    mockFetchSuccess('Hey!')
    await svc.chat({ sessionId: id, message: 'hi' })
    expect(svc.getSession(id)!.coinId).toBe('bitcoin')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6. AgentService — chat output shape
// ═════════════════════════════════════════════════════════════════════════════

describe('AgentService — chat output', () => {
  let svc: AgentService

  beforeEach(() => {
    svc = new AgentService()
  })

  test('returns correct output shape', async () => {
    const id = uid()
    mockFetchSuccess('Markets look great today!')
    const result = await svc.chat({ sessionId: id, message: 'hi' })

    expect(result).toMatchObject({
      sessionId:       id,
      content:         expect.any(String),
      emotion:         expect.objectContaining({
        emotion:   expect.stringMatching(/^happy|depressed|nervous|frustrated|shocked|thinking$/),
        intensity: expect.stringMatching(/^low|medium|high$/),
        reason:    expect.any(String),
        asset:     expect.any(String),
        message:   expect.any(String),
      }),
      suggestAnalysis: expect.any(Boolean),
      history:         expect.any(Array),
    })
  })

  test('content is a non-empty string on success', async () => {
    const id = uid()
    mockFetchSuccess('Things are looking bullish!')
    const result = await svc.chat({ sessionId: id, message: 'what do you think?' })
    expect(result.content.length).toBeGreaterThan(0)
  })

  test('emotion asset always has /emotions/ prefix', async () => {
    const id = uid()
    mockFetchSuccess('Hey!', { emotion: 'happy', asset: '/emotions/happy.gif' })
    const result = await svc.chat({ sessionId: id, message: 'hi' })
    expect(result.emotion.asset).toMatch(/^\/emotions\//)
  })

  test('suggestAnalysis is true when AI returns it as true', async () => {
    const id = uid()
    mockFetchSuccess('Should I buy?', {}, true)
    const result = await svc.chat({ sessionId: id, message: 'should I buy bitcoin?' })
    expect(result.suggestAnalysis).toBe(true)
  })

  test('suggestAnalysis defaults to false', async () => {
    const id = uid()
    mockFetchSuccess('Just saying hi!')
    const result = await svc.chat({ sessionId: id, message: 'hey' })
    expect(result.suggestAnalysis).toBe(false)
  })

  test('sessionId in response matches input sessionId', async () => {
    const id = uid()
    mockFetchSuccess('Hi there!')
    const result = await svc.chat({ sessionId: id, message: 'hello' })
    expect(result.sessionId).toBe(id)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7. AgentService — message history
// ═════════════════════════════════════════════════════════════════════════════

describe('AgentService — message history', () => {
  let svc: AgentService

  beforeEach(() => {
    svc = new AgentService()
  })

  test('history grows with each message pair (user + agent)', async () => {
    const id = uid()
    mockFetchSuccess('Response 1')
    await svc.chat({ sessionId: id, message: 'message 1' })
    expect(svc.getSession(id)!.messages.length).toBe(2) // user + agent

    mockFetchSuccess('Response 2')
    await svc.chat({ sessionId: id, message: 'message 2' })
    expect(svc.getSession(id)!.messages.length).toBe(4)
  })

  test('history contains user and agent roles', async () => {
    const id = uid()
    mockFetchSuccess('Hey!')
    await svc.chat({ sessionId: id, message: 'hi' })
    const msgs = svc.getSession(id)!.messages
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('agent')
  })

  test('user message content is preserved exactly', async () => {
    const id      = uid()
    const message = 'Should I sell my bitcoin right now?'
    mockFetchSuccess('Here is my analysis...')
    await svc.chat({ sessionId: id, message })
    expect(svc.getSession(id)!.messages[0].content).toBe(message)
  })

  test('agent message has emotion attached', async () => {
    const id = uid()
    mockFetchSuccess('Looking good!', { emotion: 'happy', intensity: 'medium' })
    await svc.chat({ sessionId: id, message: 'hi' })
    const agentMsg = svc.getSession(id)!.messages[1]
    expect(agentMsg.emotion).toBeDefined()
    expect(agentMsg.emotion!.emotion).toBe('happy')
  })

  test('all messages have a timestamp (ts)', async () => {
    const id = uid()
    mockFetchSuccess('Hi!')
    await svc.chat({ sessionId: id, message: 'hello' })
    svc.getSession(id)!.messages.forEach((m  : AgentChatMessage) => {
      expect(m.ts).toBeGreaterThan(0)
    })
  })

  test('history is trimmed to 20 messages max', async () => {
    const id = uid()
    // Send 11 messages — produces 22 entries (user + agent each)
    // Should be trimmed to last 20
    for (let i = 0; i < 11; i++) {
      mockFetchSuccess(`Response ${i}`)
      await svc.chat({ sessionId: id, message: `Message ${i}` })
    }
    expect(svc.getSession(id)!.messages.length).toBe(20)
  })

  test('history in response matches session messages', async () => {
    const id = uid()
    mockFetchSuccess('Hello!')
    const result = await svc.chat({ sessionId: id, message: 'hi' })
    expect(result.history).toEqual(svc.getSession(id)!.messages)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8. AgentService — fallback behaviour
// ═════════════════════════════════════════════════════════════════════════════

describe('AgentService — fallback behaviour', () => {
  let svc: AgentService

  beforeEach(() => {
    svc = new AgentService()
  })

  test('falls back gracefully on OpenRouter 401', async () => {
    const id = uid()
    mockFetchFail(401)
    const result = await svc.chat({ sessionId: id, message: 'hi' })
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.emotion).toBeDefined()
  })

  test('falls back gracefully on network error', async () => {
    const id = uid()
    mockFetchNetworkError()
    const result = await svc.chat({ sessionId: id, message: 'hi' })
    expect(result.content.length).toBeGreaterThan(0)
  })

  test('falls back gracefully on JSON parse error', async () => {
    const id = uid()
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok:   true,
      json: async () => ({ choices: [{ message: { content: 'not valid json {{{' } }] }),
    } as any)
    const result = await svc.chat({ sessionId: id, message: 'hi' })
    expect(result.content.length).toBeGreaterThan(0)
  })

  test('fallback greeting response for "hi" contains context', async () => {
    const id = uid()
    mockFetchFail(500)
    const result = await svc.chat({ sessionId: id, message: 'hi' })
    // Fallback greeting responses are non-empty strings
    expect(typeof result.content).toBe('string')
    expect(result.content.length).toBeGreaterThan(5)
  })

  test('fallback non-greeting includes emotion type in response', async () => {
    const id = uid()
    mockFetchFail(500)
    const result = await svc.chat({ sessionId: id, message: 'what is your analysis?' })
    // Non-greeting fallback: "I'm currently feeling X about the market."
    expect(result.content).toMatch(/feeling|market|analysis/i)
  })

  test('still adds messages to history even on fallback', async () => {
    const id = uid()
    mockFetchNetworkError()
    await svc.chat({ sessionId: id, message: 'hi there' })
    expect(svc.getSession(id)!.messages.length).toBe(2)
  })

  test('throws when OPENROUTER_API_KEY is not set', async () => {
    delete process.env.OPENROUTER_API_KEY
    const id = uid()
    await expect(svc.chat({ sessionId: id, message: 'hi' })).rejects.toThrow('OPENROUTER_API_KEY')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9. AgentService — emotion persistence across turns
// ═════════════════════════════════════════════════════════════════════════════

describe('AgentService — emotion persistence across turns', () => {
  let svc: AgentService

  beforeEach(() => {
    svc = new AgentService()
  })

  test('emotion is present on every response', async () => {
    const id = uid()
    for (let i = 0; i < 3; i++) {
      mockFetchSuccess(`Turn ${i}`)
      const result = await svc.chat({ sessionId: id, message: `message ${i}` })
      expect(result.emotion).toBeDefined()
      expect(result.emotion.emotion).toMatch(/^happy|depressed|nervous|frustrated|shocked|thinking$/)
    }
  })

  test('session currentEmotion is updated after each turn', async () => {
    const id = uid()
    mockFetchSuccess('Turn 1', { emotion: 'happy' })
    await svc.chat({ sessionId: id, message: 'first message' })
    const session = svc.getSession(id)
    expect(session!.currentEmotion).toBeDefined()
    expect(session!.currentEmotion.emotion).toMatch(/^happy|depressed|nervous|frustrated|shocked|thinking$/)
  })

  test('isAnalysing = true forces thinking emotion', async () => {
    const id = uid()
    mockFetchSuccess('Analysing...', { emotion: 'thinking' })
    const result = await svc.chat({ sessionId: id, message: 'run analysis', isAnalysing: true })
    // deriveEmotion with isAnalysing=true always returns thinking
    expect(result.emotion.emotion).toBe('thinking')
  })

  test('session updatedAt changes after each turn', async () => {
    const id = uid()
    mockFetchSuccess('First')
    await svc.chat({ sessionId: id, message: 'msg 1' })
    const firstUpdated = svc.getSession(id)!.updatedAt

    await new Promise(r => setTimeout(r, 5)) // tiny delay

    mockFetchSuccess('Second')
    await svc.chat({ sessionId: id, message: 'msg 2' })
    const secondUpdated = svc.getSession(id)!.updatedAt

    expect(secondUpdated).toBeGreaterThanOrEqual(firstUpdated)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10. AgentService — OpenRouter request format
// ═════════════════════════════════════════════════════════════════════════════

describe('AgentService — OpenRouter request format', () => {
  let svc: AgentService

  beforeEach(() => {
    svc = new AgentService()
  })

  test('sends POST to OpenRouter endpoint', async () => {
    const id = uid()
    mockFetchSuccess('Hey!')
    await svc.chat({ sessionId: id, message: 'hi' })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  test('includes Authorization header with Bearer token', async () => {
    const id = uid()
    mockFetchSuccess('Hey!')
    await svc.chat({ sessionId: id, message: 'hi' })
    const [, options] = (global.fetch as jest.Mock).mock.calls[0]
    expect(options.headers['Authorization']).toBe('Bearer sk-or-test-key')
  })

  test('sends Content-Type application/json', async () => {
    const id = uid()
    mockFetchSuccess('Hey!')
    await svc.chat({ sessionId: id, message: 'hi' })
    const [, options] = (global.fetch as jest.Mock).mock.calls[0]
    expect(options.headers['Content-Type']).toBe('application/json')
  })

  test('sends system and user messages in correct order', async () => {
    const id = uid()
    mockFetchSuccess('Hey!')
    await svc.chat({ sessionId: id, message: 'test message' })
    const [, options] = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1].role).toBe('user')
    expect(body.messages[1].content).toBe('test message')
  })

  test('strips markdown fences from AI response', async () => {
    const id = uid()
    const payload = { content: 'Hi!', emotion: { emotion: 'happy', intensity: 'low', reason: 'r', asset: '/emotions/happy.gif', message: 'm' }, suggestAnalysis: false }
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok:   true,
      json: async () => ({
        choices: [{ message: { content: '```json\n' + JSON.stringify(payload) + '\n```' } }],
      }),
    } as any)
    const result = await svc.chat({ sessionId: id, message: 'hello' })
    expect(result.content).toBe('Hi!')
  })
})
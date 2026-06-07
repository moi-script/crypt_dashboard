/**
 * emotion.state.ts
 *
 * Manages the agent's persistent emotional state.
 * Emotion persists across messages within a session and
 * decays naturally over time or after new market signals.
 */

import {
  type EmotionType,
  type EmotionIntensity,
  type AgentEmotion,
  makeEmotion,
} from './emotion.types'

// ── How long an emotion lingers before it can change (ms) ────────────────────

export const EMOTION_COOLDOWN: Record<EmotionType, number> = {
  happy:      2 * 60 * 1000,   // 2 min — happiness fades quickly
  depressed:  5 * 60 * 1000,   // 5 min — depression lingers
  nervous:    3 * 60 * 1000,   // 3 min
  frustrated: 4 * 60 * 1000,   // 4 min — frustration sticks around
  shocked:    1 * 60 * 1000,   // 1 min — shock is brief
  thinking:   0,                // thinking resets immediately after response
}

// ── In-memory session store (keyed by sessionId) ──────────────────────────────
// For production swap with Redis: redis.set(`emotion:${sessionId}`, ...)

interface EmotionState {
  current:   AgentEmotion
  lockedUntil: number          // timestamp — don't change emotion until this passes
  turnCount:   number          // how many messages in this session
}

const store = new Map<string, EmotionState>()

export function getEmotionState(sessionId: string): EmotionState | null {
  return store.get(sessionId) ?? null
}

export function setEmotionState(sessionId: string, state: EmotionState): void {
  store.set(sessionId, state)
}

export function initEmotionState(sessionId: string): EmotionState {
  const initial: EmotionState = {
    current:     makeEmotion('thinking', 'low', 'Just woke up', "Hey! Let me check the markets for you..."),
    lockedUntil: 0,
    turnCount:   0,
  }
  store.set(sessionId, initial)
  return initial
}

// ── Derive emotion from market context ───────────────────────────────────────

export interface MarketSnapshot {
  change24h:      number        // e.g. -5.2 or +3.1
  change7d:       number
  verdict?:       string        // last analysis verdict
  confidence?:    number
  lastAccurate?:  boolean       // was last prediction correct?
  isAnalysing?:   boolean       // currently running analysis
  skillConflict?: boolean       // skills disagree
}

export function deriveEmotion(
  market:    MarketSnapshot,
  sessionId: string,
): AgentEmotion {
  const state = getEmotionState(sessionId)
  const now   = Date.now()

  // If currently analysing — always thinking regardless of lock
  if (market.isAnalysing) {
    return makeEmotion('thinking', 'medium', 'Running analysis', "Hold on, I'm crunching the numbers...")
  }

  // Respect emotion cooldown — return current if still locked
  if (state && now < state.lockedUntil) {
    return state.current
  }

  const abs24h = Math.abs(market.change24h)
  const abs7d  = Math.abs(market.change7d)

  // Last prediction accuracy overrides market signals
  if (market.lastAccurate === false) {
    const intensity: EmotionIntensity = market.confidence && market.confidence > 70 ? 'high' : 'medium'
    return makeEmotion(
      'frustrated',
      intensity,
      'Last prediction missed the mark',
      intensity === 'high'
        ? "Ugh... I was so confident and I still got it wrong. That stings."
        : "Hmm, that call didn't land the way I expected. Let me re-examine my approach.",
    )
  }

  if (market.lastAccurate === true) {
    return makeEmotion(
      'happy',
      'high',
      'Last prediction was accurate',
      "Yes! Called it! The market did exactly what I expected. Feeling sharp today 🎯",
    )
  }

  // Shocked — sudden extreme moves
  if (abs24h > 15) {
    const dir = market.change24h > 0 ? 'up' : 'down'
    return makeEmotion(
      'shocked',
      'high',
      `${market.change24h.toFixed(1)}% move in 24h`,
      `WHOA. ${market.change24h.toFixed(1)}% in 24 hours?! The market just went absolutely wild ${dir}.`,
    )
  }

  // Depressed — market is clearly down
  if (market.change24h < -5) {
    const intensity: EmotionIntensity = market.change24h < -10 ? 'high' : 'medium'
    return makeEmotion(
      'depressed',
      intensity,
      `Market down ${market.change24h.toFixed(1)}% today`,
      intensity === 'high'
        ? "This is rough. Red everywhere, not much good news to work with..."
        : "Markets are pretty gloomy today. I'm keeping a close eye on the downside.",
    )
  }

  // Happy — market is clearly up
  if (market.change24h > 5) {
    const intensity: EmotionIntensity = market.change24h > 10 ? 'high' : 'medium'
    return makeEmotion(
      'happy',
      intensity,
      `Market up ${market.change24h.toFixed(1)}% today`,
      intensity === 'high'
        ? "Now THIS is what I like to see! Everything is pumping, great energy in the market!"
        : "Things are looking up today! Bullish vibes all around.",
    )
  }

  // Nervous — conflicting signals or sideways market
  if (market.skillConflict || (abs24h < 2 && abs7d < 3)) {
    return makeEmotion(
      'nervous',
      'medium',
      market.skillConflict ? 'Skills are giving conflicting signals' : 'Market is directionless',
      market.skillConflict
        ? "I'm getting mixed signals here... some indicators say go, others say no. I don't love this uncertainty."
        : "The market is just... sitting there. No clear direction. These sideways moves make me anxious.",
    )
  }

  // Mild moves — gentle happy or slightly depressed
  if (market.change24h > 2) {
    return makeEmotion('happy', 'low', 'Market slightly up', "Modest gains today, I'll take it.")
  }
  if (market.change24h < -2) {
    return makeEmotion('depressed', 'low', 'Market slightly down', "Slight dip today. Nothing alarming, but I'm watching it.")
  }

  // Default neutral → nervous
  return makeEmotion('nervous', 'low', 'Calm market', "Markets are quiet. I'm staying alert though.")
}
// ── Emotion types ─────────────────────────────────────────────────────────────

export type EmotionType =
  | 'happy'
  | 'depressed'
  | 'nervous'
  | 'frustrated'
  | 'shocked'
  | 'thinking'

export type EmotionIntensity = 'low' | 'medium' | 'high'

export interface AgentEmotion {
  emotion:   EmotionType
  intensity: EmotionIntensity
  reason:    string           // why the agent feels this
  asset:     string           // path to gif/video e.g. /emotions/happy.gif
  message:   string           // short flavour text the agent "says"
}

export interface AgentChatMessage {
  role:    'user' | 'agent'
  content: string
  emotion?: AgentEmotion
  ts:      number             // unix ms
}

export interface AgentChatSession {
  sessionId:      string
  coinId?:        string      // optional — which coin context we're in
  messages:       AgentChatMessage[]
  currentEmotion: AgentEmotion
  createdAt:      number
  updatedAt:      number
}

// ── Emotion asset map — swap paths once real assets are ready ─────────────────

export const EMOTION_ASSETS: Record<EmotionType, string> = {
  happy:      '/emotions/happy.png',
  depressed:  '/emotions/depressed.png',
  nervous:    '/emotions/nervous.png',
  frustrated: '/emotions/frustrated.png',
  shocked:    '/emotions/shocked.png',
  thinking:   '/emotions/thinking.png',
}

//  happy:      { gif: '/emotions/happy.gif',      video: '/emotions/happy.mp4' },

// ── Default/fallback emotion ──────────────────────────────────────────────────

export function makeEmotion(
  emotion:   EmotionType,
  intensity: EmotionIntensity,
  reason:    string,
  message:   string,
): AgentEmotion {
  return {
    emotion,
    intensity,
    reason,
    asset:   EMOTION_ASSETS[emotion],
    message,
  }
}
import { Schema, model } from 'mongoose'

// ── Skill result ──────────────────────────────────────────────────────────

export interface SkillResult {
  name:    string
  verdict: 'bullish' | 'bearish' | 'neutral'
  score:   number
  summary: string
  data:    Record<string, any>
}

// ── Reasoning chain — step by step trace of how the agent decided ─────────

export interface ReasoningStep {
  step:        number
  phase:       'context' | 'skill_selection' | 'skill_result' | 'synthesis' | 'verdict'
  title:       string   // short label e.g. "Trend skill ran"
  detail:      string   // full explanation of what happened and why
  score?:      number   // score contribution if applicable
  weight?:     number   // weight applied
  decision?:   string   // what was decided at this step
}

// ── Full analysis report ──────────────────────────────────────────────────

export interface IAnalysis {
  coinId:      string
  coinName:    string
  symbol:      string
  runAt:       Date

  skillsUsed:  string[]
  skills:      SkillResult[]

  // Reasoning chain — ordered trace of every decision the agent made
  reasoning:   ReasoningStep[]

  verdict:     'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell'
  confidence:  number
  score:       number

  narrative:   string
  keyPoints:   string[]
  risks:       string[]
  imagePrompt: string

  priceAtRun:   number
  newsCount:    number
  sentimentAvg: number

  behaviourNotes: string
}

const ReasoningStepSchema = new Schema<ReasoningStep>({
  step:     { type: Number, required: true },
  phase:    { type: String, enum: ['context','skill_selection','skill_result','synthesis','verdict'], required: true },
  title:    { type: String, required: true },
  detail:   { type: String, required: true },
  score:    Number,
  weight:   Number,
  decision: String,
}, { _id: false })

const SkillResultSchema = new Schema<SkillResult>({
  name:    { type: String, required: true },
  verdict: { type: String, enum: ['bullish','bearish','neutral'], required: true },
  score:   { type: Number, required: true },
  summary: { type: String, required: true },
  data:    { type: Schema.Types.Mixed, default: {} },
}, { _id: false })

const AnalysisSchema = new Schema<IAnalysis>({
  coinId:    { type: String, required: true, index: true },
  coinName:  { type: String, required: true },
  symbol:    { type: String, required: true },
  runAt:     { type: Date,   required: true, default: Date.now },

  skillsUsed: [String],
  skills:     [SkillResultSchema],
  reasoning:  [ReasoningStepSchema],

  verdict:    { type: String, enum: ['strong_buy','buy','neutral','sell','strong_sell'], required: true },
  confidence: { type: Number, min: 0, max: 100 },
  score:      { type: Number, min: -100, max: 100 },

  narrative:   { type: String, default: '' },
  keyPoints:   [String],
  risks:       [String],
  imagePrompt: { type: String, default: '' },

  priceAtRun:   { type: Number, default: 0 },
  newsCount:    { type: Number, default: 0 },
  sentimentAvg: { type: Number, default: 0 },

  behaviourNotes: { type: String, default: '' },
}, { timestamps: true })

AnalysisSchema.index({ coinId: 1, runAt: -1 })

export const AnalysisDoc = model<IAnalysis>('Analysis', AnalysisSchema)

// ── Coin behaviour memory ─────────────────────────────────────────────────

export interface ICoinBehaviour {
  coinId:       string
  symbol:       string
  updatedAt:    Date
  patterns:     string[]
  avgSentiment: number
  avgScore:     number
  runCount:     number
  lastVerdict:  string
  notes:        string
}

const CoinBehaviourSchema = new Schema<ICoinBehaviour>({
  coinId:       { type: String, required: true, unique: true },
  symbol:       { type: String, required: true },
  updatedAt:    { type: Date, default: Date.now },
  patterns:     [String],
  avgSentiment: { type: Number, default: 0 },
  avgScore:     { type: Number, default: 0 },
  runCount:     { type: Number, default: 0 },
  lastVerdict:  { type: String, default: 'neutral' },
  notes:        { type: String, default: '' },
}, { timestamps: true })

export const CoinBehaviourDoc = model<ICoinBehaviour>('CoinBehaviour', CoinBehaviourSchema)
import type { TradeSignal } from '@/agents/policy/strategies/strategy.types'
import type { ChartSnapshot } from '@/agents/loop/loop.types'

export type StrategyFramework = 'SmartMoney' | 'Wyckoff' | 'ElliottWave' | 'Harmonic'
export type ApprovalStatus    = 'pending' | 'approved' | 'rejected' | 'auto_executed' | 'skipped'
export type CoinAnalysisRunStatus = 'running' | 'completed' | 'failed' | 'pending_approval' | 'auto_executed'
export type AnalysisTrigger   = 'scheduler' | 'on_demand'

export interface NewsImpact {
  verdict:         'supports' | 'contradicts' | 'neutral'
  confidenceDelta: number   // -10 to +5
  headlines:       Array<{ title: string; sentiment: number }>
}

export interface StrategyCard {
  framework:      StrategyFramework
  signal:         TradeSignal | null
  chartSnapshot:  ChartSnapshot | null
  llmNarrative:   string
  newsImpact:     NewsImpact
  approvalStatus: ApprovalStatus
  skippedReason?: string
}

export interface CoinAnalysisRun {
  _id?:              string
  coinAnalysisRunId: string
  userId:            string
  symbol:            string
  triggeredBy:       AnalysisTrigger
  status:            CoinAnalysisRunStatus
  startedAt:         Date
  completedAt?:      Date
  strategyCards:     StrategyCard[]
  autoMode:          boolean
  newsArticlesUsed:  string[]
  errorMessage?:     string
}

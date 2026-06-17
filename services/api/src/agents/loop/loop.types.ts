/**
 * loop.types.ts
 *
 * Shared types for the autonomous agent loop.
 * These cross agent/loop, agent/policy, and models boundaries.
 */

import type { AgentMode, AgentConfig } from '../../config/agent.config'

// ── Decision ──────────────────────────────────────────────────────────────────

export type IntentType =
  | 'propose_trade'
  | 'set_alert'
  | 'rebalance'
  | 'no_action'

export interface TradeIntent {
  type: 'propose_trade'
  tokenIn: string        // symbol or address
  tokenOut: string
  amountUsd: number
  maxSlippageBps: number
  rationale: string
  venue?: string         // 'binance' | 'uniswap_v3_base' | etc.
  stopLossPrice?: number     // set by chartSignal strategy only
  takeProfitPrice?: number   // set by chartSignal strategy only
  entryZoneLow?: number      // set by chartSignal strategy only — limit-order entry zone
  entryZoneHigh?: number     // set by chartSignal strategy only — limit-order entry zone
  framework?: string         // 'SmartMoney' | 'Wyckoff' | 'ElliottWave' | 'Harmonic'
}

export interface AlertIntent {
  type: 'set_alert'
  coinId: string
  condition: 'above' | 'below' | 'pct_change'
  threshold: number
  rationale: string
}

export interface RebalanceIntent {
  type: 'rebalance'
  targetWeights: Record<string, number>  // token → % e.g. { USDC: 60, ETH: 40 }
  rationale: string
}

export interface NoActionIntent {
  type: 'no_action'
  rationale: string
}

export type Intent = TradeIntent | AlertIntent | RebalanceIntent | NoActionIntent

export interface Decision {
  intent: Intent
  confidence: number      // 0–100
  reasoning: string       // short summary why
  toolCallTrace: string[] // names of tool calls made during reasoning
}

// ── LoopContext ───────────────────────────────────────────────────────────────

export interface WalletState {
  mode: AgentMode
  balances: Record<string, number>   // token → USD value
  openPositions: number
  totalValueUsd: number
  dailyPnlUsd: number
}

export interface LoopContext {
  runId: string
  userId: string
  strategy: string
  startedAt: number
  contextSummary: string            // what the LLM sees
  walletState: WalletState
  marketData: Record<string, unknown>
  config: AgentConfig
}

// ── AgentRun record (persisted) ───────────────────────────────────────────────

export type AgentRunStatus = 'running' | 'completed' | 'failed' | 'blocked' | 'pending_approval'

export interface AgentRunRecord {
  runId: string
  userId: string
  strategy: string
  mode: AgentMode
  startedAt: Date
  completedAt?: Date
  status: AgentRunStatus
  contextSnapshot: string
  decision: Decision | null
  executionResult?: ExecutionResult
  errorMessage?: string
}

// ── ExecutionResult ───────────────────────────────────────────────────────────

export type ExecutionStatus = 'filled' | 'rejected' | 'pending' | 'pending_limit' | 'blocked_by_risk' | 'manual_approval_required' | 'error'

export interface ExecutionResult {
  status: ExecutionStatus
  orderId?: string
  filledAmountUsd?: number
  entryPrice?: number
  feesUsd?: number
  txHash?: string                // on-chain only
  blockNumber?: number           // on-chain only
  riskRejectionReason?: string   // why risk engine blocked it
  errorMessage?: string
  simulatedPnlUsd?: number       // paper mode only
  executedAt: Date
}

// ── Execution context (threads per-user config + metadata to executors) ───────

export interface ExecutionContext {
  userId:     string
  config:     AgentConfig
  runId:      string
  strategy:   string
  rationale:  string
  confidence: number
}

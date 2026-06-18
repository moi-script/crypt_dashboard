import { apiClient } from "./api.client";
import type { ToolResult } from "@/components/AgentToolCards";
// ── Emotion ───────────────────────────────────────────────────────────────────

export interface AgentEmotion {
  emotion:   "happy" | "depressed" | "nervous" | "frustrated" | "shocked" | "thinking";
  intensity: "low" | "medium" | "high";
  reason:    string;
  asset:     string;
  message:   string;
}

// ── Chat session ──────────────────────────────────────────────────────────────

export interface AgentMessage {
  role:    "user" | "agent";
  content: string;
  emotion?: AgentEmotion;
  ts:      number;
}

export interface AnalysisReport {
  verdict:    string;
  score:      number;
  confidence: number;
  narrative:  string;
  keyPoints:  string[];
  risks:      string[];
  skillsUsed: string[];
  skills:     SkillResult[];
  reasoning:  ReasoningStep[];
  coinName:   string;
  symbol:     string;
  priceAtRun: number;
  runAt:      string;
}

export interface SkillResult {
  name:    string;
  verdict: "bullish" | "bearish" | "neutral";
  score:   number;
  summary: string;
}

export interface ReasoningStep {
  step:      number;
  phase:     string;
  title:     string;
  detail:    string;
  score?:    number;
  decision?: string;
  weight?:   number;
}

export interface ChatResponse {
  sessionId:       string;
  content:         string;
  emotion:         AgentEmotion;
  suggestAnalysis: boolean;
  suggestAlert:    boolean;
  history:         AgentMessage[];
  analysisReport?: AnalysisReport; // populated after runAnalysis
}

export interface AgentSession {
  sessionId:      string;
  coinId:         string;
  messages:       AgentMessage[];
  currentEmotion: AgentEmotion;
  createdAt:      number;
  updatedAt:      number;
}

// ── Autonomous agent loop types ───────────────────────────────────────────────

export type AgentRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "pending_approval"
  | "rejected";

export type ExecutionStatus =
  | "filled"
  | "rejected"
  | "pending"
  | "blocked_by_risk"
  | "manual_approval_required"
  | "error";

export interface AgentRunDecision {
  intent: {
    type:           string;
    tokenIn?:       string;
    tokenOut?:      string;
    amountUsd?:     number;
    rationale?:     string;
    coinId?:        string;
    condition?:     string;
    threshold?:     number;
    targetWeights?: Record<string, number>;
  };
  confidence:    number;
  reasoning:     string;
  toolCallTrace: string[];
}

export interface AgentRunExecution {
  status:              ExecutionStatus;
  orderId?:            string;
  filledAmountUsd?:    number;
  entryPrice?:         number;
  feesUsd?:            number;
  txHash?:             string;
  riskRejectionReason?: string;
  errorMessage?:       string;
  simulatedPnlUsd?:    number;
  executedAt:          string;
}

export interface AgentRun {
  runId:           string;
  strategy:        string;
  mode:            "paper" | "cex" | "onchain";
  startedAt:       string;
  completedAt?:    string;
  status:          AgentRunStatus;
  contextSnapshot: string;
  decision?:       AgentRunDecision;
  executionResult?: AgentRunExecution;
  errorMessage?:   string;
  chartSnapshot?:  ChartSnapshot;
}

// ── Chart snapshot ────────────────────────────────────────────────────────────

export interface ChartOverlay {
  supportResistance: Array<{
    price:    number
    type:     'support' | 'resistance'
    strength: 'strong' | 'moderate' | 'weak'
  }>
  trendlines: Array<{
    p1:        { time: number; price: number }
    p2:        { time: number; price: number }
    direction: 'up' | 'down'
  }>
  orderBlocks?:     Array<{ high: number; low: number; type: 'bullish' | 'bearish'; status: string }>
  elliottPivots?:   Array<{ price: number; timestamp: number; waveLabel: string }>
  wyckoffRange?:    { high: number; low: number; phase: string }
  harmonicPattern?: { name: string; prz_high: number; prz_low: number; xabcd: Record<string, number>; xabcd_ts: Record<string, number> }
}

export interface ChartSnapshot {
  symbol:           string
  binanceSymbol:    string
  framework:        string
  snapshotAt:       string
  entryZone:        { low: number; high: number }
  stopLoss:         number
  takeProfitLevels: number[]
  confidence:       number
  overlays:         ChartOverlay
}

export interface Candle {
  timestamp: number
  open:      number
  high:      number
  low:       number
  close:     number
  volume:    number
}

export interface ApprovalRun {
  runId:          string
  strategy:       string
  startedAt:      string
  decision?:      AgentRunDecision
  chartSnapshot?: ChartSnapshot
}

export interface AgentConfig {
  enabled:               boolean;
  mode:                  "paper" | "cex" | "onchain";
  loopIntervalMs:        number;
  strategies:            { yieldHunter: boolean; rebalance: boolean; airdropWatch: boolean };
  watchlist:             string[];
  maxTradeUsd:           number;
  requireManualApproval: boolean;
}

export interface AgentRunStats {
  total:            number;
  completed:        number;
  failed:           number;
  blocked:          number;
  pending:          number;
  last24h:          number;
  intentBreakdown:  Record<string, number>;
}

// ── Positions & orders ────────────────────────────────────────────────────────

export interface Position {
  positionId:      string;
  status?:         "pending" | "open" | "closed" | "cancelled";
  mode:            "paper" | "cex" | "onchain";
  tokenIn:         string;
  tokenOut:        string;
  entryAmountUsd:  number;
  entryPrice?:     number;
  entryFeesUsd:    number;
  entryAt:         string;
  exitPrice?:      number;
  exitAmountUsd?:  number;
  exitAt?:         string;
  isOpen:          boolean;
  realizedPnlUsd?: number;
  strategy:        string;
  runId:           string;
  stopLossPrice?:   number;
  takeProfitPrice?: number;
  entryZoneLow?:    number;
  entryZoneHigh?:   number;
  entryExpiresAt?:  string;
  framework?:       string;
  confidence?:      number;
}

export interface DailyPnl {
  date:        string;
  totalPnlUsd: number;
  tradeCount:  number;
  winCount:    number;
  lossCount:   number;
  winRate:     number | null;
}

export interface PnlSummary {
  totalPnlUsd:   number;
  totalTrades:   number;
  openPositions: number;
  totalOrders:   number;
  wins:          number;
  losses:        number;
  winRate:       number | null;
  avgWinUsd:     number;
  avgLossUsd:    number;
  profitFactor:  number | null;
}

// ── Opportunities ─────────────────────────────────────────────────────────────

export type OpportunityType =
  | "yield_anomaly"
  | "price_spike"
  | "volume_spike"
  | "airdrop_signal"
  | "sentiment_shift";

export interface Opportunity {
  opportunityId: string;
  type:          OpportunityType;
  strategy:      string;
  runId:         string;
  title:         string;
  detail:        string;
  asset:         string;
  protocol?:     string;
  chain?:        string;
  score:         number;
  acted:         boolean;
  actionTaken?:  string;
  detectedAt:    string;
  expiresAt:     string;
  metadata:      Record<string, unknown>;
}

export interface OpportunitySummary {
  total:   number;
  acted:   number;
  unacted: number;
  byType:  { _id: string; count: number; avgScore: number }[];
}

// ── Service ───────────────────────────────────────────────────────────────────

export const agentService = {
  // ── Chat ────────────────────────────────────────────────────────────────────
  chat: (params: {
    sessionId:    string;
    message:      string;
    coinId?:      string;
    userId?:      string;
    isAnalysing?: boolean;
  }) => apiClient.post<ChatResponse>("/agent/chat/stream", params),

  getSession: (sessionId: string, coinId?: string, userId?: string) => {
    const q = new URLSearchParams();
    if (coinId) q.set("coinId", coinId);
    if (userId) q.set("userId", userId);
    const qs = q.toString();
    return apiClient.get<AgentSession>(`/agent/session/${sessionId}${qs ? `?${qs}` : ""}`);
  },
saveToolResult: (
  sessionId: string,
  messageId: string,
  toolResult: ToolResult,
  ts?: number,
  extra?: { content?: string; emotion?: unknown },
) =>
  apiClient.post<{ ok: boolean }>(`/agent/session/${sessionId}/tool-result`, {
    messageId,
    toolResult,
    ts,
    content: extra?.content,
    emotion: extra?.emotion,
  }),

  getUserSessions: (userId: string) =>
    apiClient.get<AgentSession[]>(`/agent/sessions/user/${userId}`),

  clearSession: (sessionId: string) =>
    apiClient.del<{ ok: boolean }>(`/agent/session/${sessionId}`),

  // ── Autonomous agent runs ────────────────────────────────────────────────────
  listRuns: (params?: { limit?: number; strategy?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit)    q.set("limit",    String(params.limit));
    if (params?.strategy) q.set("strategy", params.strategy);
    if (params?.status)   q.set("status",   params.status);
    const qs = q.toString();
    return apiClient.get<{ runs: AgentRun[]; total: number }>(
      `/agent-runs${qs ? `?${qs}` : ""}`,
    );
  },

  getRun: (runId: string) =>
    apiClient.get<AgentRun>(`/agent-runs/${runId}`),

  triggerRun: (wait = false) =>
    apiClient.post<{ triggered: boolean; waited: boolean }>(
      `/agent-runs/trigger${wait ? "?wait=true" : ""}`,
      {},
    ),

  getConfig: () =>
    apiClient.get<{ config: AgentConfig; schedulerActive: boolean; keyPresence: Record<string, boolean> }>(
      "/agent-runs/config",
    ),

  updateConfig: (patch: Partial<AgentConfig>) =>
    apiClient.post<{ ok: boolean; config: AgentConfig }>("/agent-runs/config", patch),

  getStats: () => apiClient.get<AgentRunStats>("/agent-runs/stats"),

  // ── Positions ────────────────────────────────────────────────────────────────
  listPositions: (params?: { mode?: string; open?: boolean; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.mode  !== undefined) q.set("mode",  params.mode);
    if (params?.open  !== undefined) q.set("open",  String(params.open));
    if (params?.limit !== undefined) q.set("limit", String(params.limit));
    const qs = q.toString();
    return apiClient.get<{ positions: Position[]; count: number }>(
      `/positions${qs ? `?${qs}` : ""}`,
    );
  },

  getDailyPnl: () => apiClient.get<DailyPnl>("/positions/pnl/daily"),

  getPnlSummary: () => apiClient.get<PnlSummary>("/positions/pnl/summary"),

  // ── Opportunities ────────────────────────────────────────────────────────────
  listOpportunities: (params?: { type?: string; strategy?: string; acted?: boolean; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.type     !== undefined) q.set("type",     params.type);
    if (params?.strategy !== undefined) q.set("strategy", params.strategy);
    if (params?.acted    !== undefined) q.set("acted",    String(params.acted));
    if (params?.limit    !== undefined) q.set("limit",    String(params.limit));
    const qs = q.toString();
    return apiClient.get<{ opportunities: Opportunity[]; count: number }>(
      `/opportunities${qs ? `?${qs}` : ""}`,
    );
  },

  getOpportunitySummary: () =>
    apiClient.get<OpportunitySummary>("/opportunities/summary"),
};

// ── Approval & chart service functions ────────────────────────────────────────

export async function listApprovals(): Promise<ApprovalRun[]> {
  const data = await apiClient.get<{ approvals: ApprovalRun[] }>('/agent-runs/approvals')
  return data.approvals ?? []
}

export async function approveRun(runId: string): Promise<{ status: string }> {
  return apiClient.post<{ status: string }>(`/agent-runs/${runId}/approve`, {})
}

export async function rejectRun(runId: string): Promise<void> {
  await apiClient.post(`/agent-runs/${runId}/reject`, {})
}

export async function getOhlcv(
  symbol: string,
  timeframe: string,
  limit = 300,
): Promise<{ candles: Candle[] }> {
  return apiClient.get<{ candles: Candle[] }>(
    `/chart/ohlcv/${symbol}?timeframe=${timeframe}&limit=${limit}`,
  )
}

// ── Coin Analysis Run (4-framework parallel analysis) ─────────────────────────

export type StrategyFramework = 'SmartMoney' | 'Wyckoff' | 'ElliottWave' | 'Harmonic'
export type CardApprovalStatus = 'pending' | 'approved' | 'rejected' | 'auto_executed' | 'skipped'
export type CoinAnalysisRunStatus = 'running' | 'completed' | 'failed' | 'pending_approval' | 'auto_executed'

export interface NewsImpact {
  verdict:         'supports' | 'contradicts' | 'neutral'
  confidenceDelta: number
  headlines:       Array<{ title: string; sentiment: number }>
}

export interface StrategyCard {
  framework:      StrategyFramework
  signal:         { bias: string; confidence: number; signalType: string } | null
  chartSnapshot:  ChartSnapshot | null
  llmNarrative:   string
  newsImpact:     NewsImpact
  approvalStatus: CardApprovalStatus
  skippedReason?: string
}

export interface CoinAnalysisRun {
  coinAnalysisRunId: string
  userId:            string
  symbol:            string
  triggeredBy:       'scheduler' | 'on_demand'
  status:            CoinAnalysisRunStatus
  startedAt:         string
  completedAt?:      string
  strategyCards:     StrategyCard[]
  autoMode:          boolean
  newsArticlesUsed:  string[]
  errorMessage?:     string
}

export const coinAnalysisService = {
  trigger: (symbol: string) =>
    apiClient.post<{ coinAnalysisRunId: string }>('/coin-analysis/trigger', { symbol }),

  getLatest: (symbol?: string) => {
    const qs = symbol ? `?symbol=${symbol}` : ''
    return apiClient.get<CoinAnalysisRun>(`/coin-analysis/latest${qs}`)
  },

  getRun: (runId: string) =>
    apiClient.get<CoinAnalysisRun>(`/coin-analysis/${runId}`),

  approveCard: (runId: string, framework: StrategyFramework) =>
    apiClient.post<{ execution: any }>(`/coin-analysis/${runId}/cards/${framework}/approve`, {}),

  rejectCard: (runId: string, framework: StrategyFramework) =>
    apiClient.post<void>(`/coin-analysis/${runId}/cards/${framework}/reject`, {}),
}
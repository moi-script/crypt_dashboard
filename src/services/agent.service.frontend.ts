import { apiClient } from "./api.client";

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
  | "pending_approval";

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
  mode:            "paper" | "cex" | "onchain";
  tokenIn:         string;
  tokenOut:        string;
  entryAmountUsd:  number;
  entryPrice:      number;
  entryFeesUsd:    number;
  entryAt:         string;
  exitPrice?:      number;
  exitAmountUsd?:  number;
  exitAt?:         string;
  isOpen:          boolean;
  realizedPnlUsd?: number;
  strategy:        string;
  runId:           string;
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
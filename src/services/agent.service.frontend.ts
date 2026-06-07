import { apiClient } from "./api.client";

export interface AgentEmotion {
  emotion:   "happy" | "depressed" | "nervous" | "frustrated" | "shocked" | "thinking";
  intensity: "low" | "medium" | "high";
  reason:    string;
  asset:     string;
  message:   string;
}

export interface AgentMessage {
  role:    "user" | "agent";
  content: string;
  emotion?: AgentEmotion;
  ts:      number;
}

export interface ChatResponse {
  sessionId:       string;
  content:         string;
  emotion:         AgentEmotion;
  suggestAnalysis: boolean;
  suggestAlert:    boolean;
  history:         AgentMessage[];
}

export interface AgentSession {
  sessionId:      string;
  coinId:         string;
  messages:       AgentMessage[];
  currentEmotion: AgentEmotion;
  createdAt:      number;
  updatedAt:      number;
}

export const agentService = {
  chat: (params: {
    sessionId:    string;
    message:      string;
    coinId?:      string;
    userId?:      string;
    isAnalysing?: boolean;
  }) => apiClient.post<ChatResponse>("/agent/chat", params),

  getSession: (sessionId: string) =>
    apiClient.get<AgentSession>(`/agent/session/${sessionId}`),

  clearSession: (sessionId: string) =>
    apiClient.del<{ ok: boolean }>(`/agent/session/${sessionId}`),
};
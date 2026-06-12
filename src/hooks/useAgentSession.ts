"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/services/api.client";

export interface AgentEmotion {
  emotion:   "happy" | "depressed" | "nervous" | "frustrated" | "shocked" | "thinking";
  intensity: "low" | "medium" | "high";
  reason:    string;
  asset:     string;
  message:   string;
}

export interface SessionListItem {
  sessionId:      string;
  coinId:         string;
  updatedAt:      number;
  createdAt:      number;
  messageCount:   number;
  lastMessage?:   string;
  currentEmotion?: AgentEmotion;
}

export interface UseAgentSessionReturn {
  sessionId:          string | null;
  isRestoring:        boolean;
  sessions:           SessionListItem[];
  sessionsLoading:    boolean;
  startNewSession:    () => Promise<void>;
  switchToSession:    (sid: string) => void;
  deleteSession:      (sid: string) => Promise<void>;
  refreshSessionList: () => Promise<void>;
  markSessionUpdated: (sid: string, lastMsg: string, emotion?: AgentEmotion) => void;
}

export interface RawSession {
  sessionId:      string;
  coinId:         string;
  userId?:        string;
  messages:       { role: string; content: string; ts: number }[];
  currentEmotion: AgentEmotion;
  createdAt:      string | number;
  updatedAt:      string | number;
}

function toMs(v: string | number): number {
  if (typeof v === "string") return new Date(v).getTime();
  return v > 1e12 ? v : v * 1000;
}

function rawToItem(s: RawSession): SessionListItem {
  const msgs = s.messages ?? [];
  const last = msgs.at(-1);
  return {
    sessionId:      s.sessionId,
    coinId:         s.coinId,
    updatedAt:      toMs(s.updatedAt),
    createdAt:      toMs(s.createdAt),
    messageCount:   msgs.length,
    lastMessage:    last?.content?.slice(0, 80),
    currentEmotion: s.currentEmotion,
  };
}

export function useAgentSession(
  userId: string | null,
  coinId: string,
): UseAgentSessionReturn {
  const [sessionId,       setSessionId]       = useState<string | null>(null);
  const [isRestoring,     setIsRestoring]     = useState(true);
  const [sessions,        setSessions]        = useState<SessionListItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // const previewsRef = useRef Record<string, { lastMsg: string; emotion?: AgentEmotion; updatedAt: number }>({});
const previewsRef = useRef<Record<string, { lastMsg: string; emotion?: AgentEmotion; updatedAt: number }>>({});
  // ── Fetch session list from MongoDB ───────────────────────────────────────
  // Matches: GET /api/agent/sessions (controller reads userId from req.user)
  const refreshSessionList = useCallback(async () => {
    if (!userId) return;
    setSessionsLoading(true);
    try {
      const raw = await apiClient.get<RawSession[]>("/agent/sessions");
      setSessions(
        raw
          .map(s => rawToItem(s))
          .sort((a, b) => b.updatedAt - a.updatedAt)
      );
    } catch {
      // non-critical — sidebar just stays empty
    } finally {
      setSessionsLoading(false);
    }
  }, [userId]);

  // ── On mount: restore last active session ────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      setIsRestoring(true);
      setSessionId(null);
      setSessions([]);

      if (!userId) {
        // Not logged in — create a transient session
        try {
          const res = await apiClient.post<{ sessionId: string }>(
            "/agent/session/create", { coinId }
          );
          if (!cancelled) setSessionId(res.sessionId);
        } catch {
          if (!cancelled) setSessionId(`sess_${coinId}_${Date.now()}`);
        } finally {
          if (!cancelled) setIsRestoring(false);
        }
        return;
      }

      try {
        // Fetch all sessions for this user
        const raw = await apiClient.get<RawSession[]>("/agent/sessions");

        if (cancelled) return;

        const sorted = [...raw].sort(
          (a, b) => toMs(b.updatedAt) - toMs(a.updatedAt)
        );

        if (sorted.length > 0) {
          // Resume the most recently updated session
          setSessionId(sorted[0].sessionId);
          setSessions(sorted.map(rawToItem));
        } else {
          // No sessions yet — create the first one
          const res = await apiClient.post<{ sessionId: string }>(
            "/agent/session/create", { coinId }
          );
          if (!cancelled) {
            setSessionId(res.sessionId);
            setSessions([]);
          }
        }
      } catch {
        // Fallback: create a fresh session
        try {
          const res = await apiClient.post<{ sessionId: string }>(
            "/agent/session/create", { coinId }
          );
          if (!cancelled) setSessionId(res.sessionId);
        } catch {
          if (!cancelled) setSessionId(`sess_${coinId}_${Date.now()}`);
        }
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    }

    restore();
    return () => { cancelled = true; };
  }, [userId, coinId]);

  // ── Start a new session ───────────────────────────────────────────────────
  // Matches: POST /api/agent/session/create
  const startNewSession = useCallback(async () => {
    try {
      const res = await apiClient.post<{ sessionId: string }>(
        "/agent/session/create", { coinId }
      );
      setSessionId(res.sessionId);
      // Refresh sidebar to show the new entry
      await refreshSessionList();
    } catch {
      // fallback to local id so UI doesn't break
      setSessionId(`sess_${coinId}_${Date.now()}`);
    }
  }, [coinId, refreshSessionList]);

  // ── Switch to an existing session ─────────────────────────────────────────
  const switchToSession = useCallback((sid: string) => {
    setSessionId(sid);
  }, []);

  // ── Delete a session ──────────────────────────────────────────────────────
  // Matches: DELETE /api/agent/session/:sessionId
  const deleteSession = useCallback(async (sid: string) => {
    try {
      await apiClient.del(`/agent/session/${sid}`);
    } catch { /* ignore */ }

    setSessions(prev => {
      const remaining = prev.filter(s => s.sessionId !== sid);

      if (sid === sessionId) {
        if (remaining.length > 0) {
          setSessionId(remaining[0].sessionId);
        } else {
          // Create a new session if none remain
          apiClient.post<{ sessionId: string }>(
            "/agent/session/create", { coinId }
          ).then(res => setSessionId(res.sessionId)).catch(() => {});
        }
      }

      return remaining;
    });
  }, [sessionId, coinId]);

  // ── Optimistic sidebar update after each message ──────────────────────────
  const markSessionUpdated = useCallback((
    sid:      string,
    lastMsg:  string,
    emotion?: AgentEmotion,
  ) => {
    previewsRef.current[sid] = {
      lastMsg:   lastMsg.slice(0, 80),
      emotion,
      updatedAt: Date.now(),
    };

    setSessions(prev => {
      const now    = Date.now();
      const exists = prev.find(s => s.sessionId === sid);

      if (exists) {
        return prev
          .map(s => s.sessionId === sid
            ? {
                ...s,
                updatedAt:      now,
                lastMessage:    lastMsg.slice(0, 80),
                currentEmotion: emotion ?? s.currentEmotion,
                messageCount:   s.messageCount + 1,
              }
            : s
          )
          .sort((a, b) => b.updatedAt - a.updatedAt);
      }

      return [{
        sessionId:      sid,
        coinId,
        updatedAt:      now,
        createdAt:      now,
        messageCount:   1,
        lastMessage:    lastMsg.slice(0, 80),
        currentEmotion: emotion,
      }, ...prev];
    });
  }, [coinId]);

  return {
    sessionId,
    isRestoring,
    sessions,
    sessionsLoading,
    startNewSession,
    switchToSession,
    deleteSession,
    refreshSessionList,
    markSessionUpdated,
  };
}
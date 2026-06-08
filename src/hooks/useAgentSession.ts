"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/services/api.client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentEmotion {
  emotion:   "happy" | "depressed" | "nervous" | "frustrated" | "shocked" | "thinking";
  intensity: "low" | "medium" | "high";
  reason:    string;
  asset:     string;
  message:   string;
}

export interface SessionListItem {
  sessionId:     string;
  coinId:        string;
  updatedAt:     number;
  createdAt:     number;
  messageCount:  number;
  lastMessage?:  string;
  currentEmotion?: AgentEmotion;
}

export interface UseAgentSessionReturn {
  sessionId:          string | null;
  isRestoring:        boolean;
  sessions:           SessionListItem[];
  sessionsLoading:    boolean;
  startNewSession:    () => string;
  switchToSession:    (sid: string) => void;
  deleteSession:      (sid: string) => Promise<void>;
  refreshSessionList: () => Promise<void>;
  markSessionUpdated: (sid: string, lastMsg: string, emotion?: AgentEmotion) => void;
}

// ── localStorage — only used to remember which session was last active ────────
// MongoDB is the source of truth for ALL sessions.
// localStorage only remembers "which session was I last looking at"
// so we can jump straight back to it without an extra round-trip.

const ls = {
  get(k: string) {
    if (typeof window === "undefined") return null;
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string) {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(k, v); } catch { /* quota */ }
  },
  del(k: string) {
    if (typeof window === "undefined") return;
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  },
};

// Key: "which sessionId was the user last looking at for this coin"
function lastActiveKey(userId: string, coinId: string) {
  return `agent_last:${userId}:${coinId}`;
}

function getLastActive(userId: string, coinId: string): string | null {
  return ls.get(lastActiveKey(userId, coinId));
}
function setLastActive(userId: string, coinId: string, sid: string) {
  ls.set(lastActiveKey(userId, coinId), sid);
}
function clearLastActive(userId: string, coinId: string) {
  ls.del(lastActiveKey(userId, coinId));
}

function newSid(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── API ───────────────────────────────────────────────────────────────────────

export interface RawSession {
  sessionId:      string;
  coinId:         string;
  userId?:        string;
  messages:       { role: string; content: string; ts: number }[];
  currentEmotion: AgentEmotion;
  createdAt:      string | number;
  updatedAt:      string | number;
}

// Fetch all sessions for a user from MongoDB — this is the source of truth
async function fetchUserSessions(userId: string): Promise<RawSession[]> {
  try {
    return await apiClient.get<RawSession[]>(`/agent/sessions/user/${userId}`);
  } catch { return []; }
}

// Get or create a specific session — never 404s
async function fetchOrCreateSession(
  sid:    string,
  coinId: string,
  userId: string,
): Promise<RawSession | null> {
  try {
    const params = new URLSearchParams({ coinId, userId });
    return await apiClient.get<RawSession>(`/agent/session/${sid}?${params}`);
  } catch { return null; }
}

// Create a brand-new session in MongoDB by sending a silent init chat
async function createSessionInDB(
  sid:    string,
  coinId: string,
  userId: string,
): Promise<void> {
  try {
    await apiClient.post("/agent/chat", {
      sessionId:   sid,
      coinId,
      userId,
      message:     "__init__",
      isAnalysing: true,
    });
  } catch { /* non-fatal */ }
}

async function deleteSessionApi(sid: string): Promise<void> {
  try { await apiClient.del(`/agent/session/${sid}`); } catch { /* ignore */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMs(v: string | number): number {
  if (typeof v === "string") return new Date(v).getTime();
  return v > 1e12 ? v : v * 1000;
}

function rawToItem(
  s: RawSession,
  preview?: { lastMsg: string; emotion?: AgentEmotion },
): SessionListItem {
  const msgs = s.messages ?? [];
  const last = msgs.filter(m => m.content !== "__init__").at(-1);
  return {
    sessionId:      s.sessionId,
    coinId:         s.coinId,
    updatedAt:      toMs(s.updatedAt),
    createdAt:      toMs(s.createdAt),
    messageCount:   msgs.filter(m => m.content !== "__init__").length,
    lastMessage:    preview?.lastMsg ?? last?.content?.slice(0, 80),
    currentEmotion: s.currentEmotion,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAgentSession(
  userId: string | null,
  coinId: string,
): UseAgentSessionReturn {
  const [sessionId,       setSessionId]       = useState<string | null>(null);
  const [isRestoring,     setIsRestoring]     = useState(true);
  const [sessions,        setSessions]        = useState<SessionListItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const previewsRef = useRef<
    Record<string, { lastMsg: string; emotion?: AgentEmotion; updatedAt: number }>
  >({});

  // ── Refresh sidebar from MongoDB ──────────────────────────────────────────
  const refreshSessionList = useCallback(async () => {
    if (!userId) return;
    setSessionsLoading(true);
    try {
      const raw = await fetchUserSessions(userId);
      setSessions(
        raw
          .map(s => rawToItem(s, previewsRef.current[s.sessionId]))
          .sort((a, b) => b.updatedAt - a.updatedAt)
      );
    } finally {
      setSessionsLoading(false);
    }
  }, [userId]);

  // ── Mount / userId change: restore from MongoDB ───────────────────────────
  // Flow:
  //   1. Fetch ALL sessions for this user from MongoDB
  //   2. If sessions exist → use the most recently updated one
  //      (or the one saved in localStorage if it's in the list)
  //   3. If no sessions exist → create a fresh one and seed it in MongoDB
  //   4. Populate the sidebar with all sessions
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      setIsRestoring(true);
      setSessions([]);
      setSessionId(null);

      if (!userId) {
        // Not logged in — transient in-memory session only
        if (!cancelled) {
          setSessionId(newSid());
          setIsRestoring(false);
        }
        return;
      }

      try {
        // ── Step 1: Fetch all sessions from MongoDB ───────────────────────
        const allSessions = await fetchUserSessions(userId);

        if (cancelled) return;

        if (allSessions.length > 0) {
          // ── Step 2: Pick the active session ──────────────────────────────
          // Prefer the one the user was last looking at (localStorage hint)
          // Fall back to the most recently updated one in MongoDB
          const lastActive = getLastActive(userId, coinId);
          const inList     = lastActive
            ? allSessions.find(s => s.sessionId === lastActive)
            : null;

          // Sort by updatedAt descending — most recent first
          const sorted = [...allSessions].sort(
            (a, b) => toMs(b.updatedAt) - toMs(a.updatedAt)
          );

          const active = inList ?? sorted[0];

          // Update localStorage to match what we actually picked
          setLastActive(userId, coinId, active.sessionId);

          if (!cancelled) {
            setSessionId(active.sessionId);
            setSessions(
              sorted.map(s => rawToItem(s, previewsRef.current[s.sessionId]))
            );
            setIsRestoring(false);
          }
        } else {
          // ── Step 3: No sessions yet — create first one ────────────────────
          const fresh = newSid();
          setLastActive(userId, coinId, fresh);

          // Seed in MongoDB immediately so it persists on refresh
          await createSessionInDB(fresh, coinId, userId);

          if (!cancelled) {
            setSessionId(fresh);
            setSessions([]);
            setIsRestoring(false);
          }
        }
      } catch {
        // Network error fallback — use a transient session
        if (!cancelled) {
          setSessionId(newSid());
          setIsRestoring(false);
        }
      }
    }

    restore();
    return () => { cancelled = true; };
  }, [userId, coinId]); // re-runs when userId changes (login/logout)

  // ── Start a new session ───────────────────────────────────────────────────
  const startNewSession = useCallback((): string => {
    const sid = newSid();

    if (userId) {
      setLastActive(userId, coinId, sid);
      // Seed in MongoDB in background
      createSessionInDB(sid, coinId, userId).then(() => {
        // Add to sidebar once created
        refreshSessionList();
      });
    }

    setSessionId(sid);
    return sid;
  }, [userId, coinId, refreshSessionList]);

  // ── Switch to an existing session ─────────────────────────────────────────
  const switchToSession = useCallback((sid: string) => {
    if (userId) setLastActive(userId, coinId, sid);
    setSessionId(sid);
  }, [userId, coinId]);

  // ── Delete a session ──────────────────────────────────────────────────────
  const deleteSession = useCallback(async (sid: string) => {
    await deleteSessionApi(sid);

    // Remove from sidebar immediately
    setSessions(prev => {
      const remaining = prev.filter(s => s.sessionId !== sid);

      // If deleting the active session, switch to most recent remaining
      if (sid === sessionId) {
        const next = remaining[0] ?? null;
        if (next) {
          if (userId) setLastActive(userId, coinId, next.sessionId);
          setSessionId(next.sessionId);
        } else {
          // No more sessions — create a fresh one
          const fresh = newSid();
          if (userId) {
            setLastActive(userId, coinId, fresh);
            createSessionInDB(fresh, coinId, userId);
          }
          setSessionId(fresh);
        }
      }

      return remaining;
    });

    // Clear localStorage hint if it pointed to the deleted session
    if (userId) {
      const last = getLastActive(userId, coinId);
      if (last === sid) clearLastActive(userId, coinId);
    }
  }, [userId, coinId, sessionId]);

  // ── Update sidebar preview optimistically after a message ────────────────
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

      // New session not yet in list — prepend it
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
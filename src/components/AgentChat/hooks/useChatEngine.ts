"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiClient } from "@/services/api.client";
import { API_URL, tokenStore } from "@/services/api.client";
import type { ToolResult } from "@/components/AgentToolCards";
import type { AnalysisReport } from "@/components/ReportBubble";

// ── Emotion types (mirrors old AgentChat) ────────────────────────────────────
export type EmotionType = "happy" | "depressed" | "nervous" | "frustrated" | "shocked" | "thinking";

export interface AgentEmotion {
  emotion:   EmotionType;
  intensity: "low" | "medium" | "high";
  reason:    string;
  asset:     string;
  message:   string;
}

export const MOOD: Record<EmotionType, {
  accent: string; softBg: string; textColor: string; label: string; emoji: string;
}> = {
  happy:      { accent: "#00e5a0", softBg: "rgba(0,229,160,0.08)",   textColor: "#00e5a0", label: "Feeling good",     emoji: "😊" },
  depressed:  { accent: "#36b6ff", softBg: "rgba(54,182,255,0.08)",  textColor: "#60a5fa", label: "A bit down",       emoji: "😔" },
  nervous:    { accent: "#ffb020", softBg: "rgba(255,176,32,0.08)",  textColor: "#ffb020", label: "A little nervous", emoji: "😬" },
  frustrated: { accent: "#ff5572", softBg: "rgba(255,85,114,0.08)",  textColor: "#ff5572", label: "Frustrated",       emoji: "😤" },
  shocked:    { accent: "#a78bfa", softBg: "rgba(167,139,250,0.08)", textColor: "#a78bfa", label: "Shocked",          emoji: "😲" },
  thinking:   { accent: "#94a3b8", softBg: "rgba(148,163,184,0.06)", textColor: "#94a3b8", label: "Thinking…",        emoji: "🤔" },
};

// ── Message & session types ───────────────────────────────────────────────────
export interface ChatMessage {
  id:           string;
  role:         "user" | "agent";
  content:      string;
  emotion?:     AgentEmotion;
  ts:           number;
  toolResult?:  ToolResult;
  toolLoading?: boolean;
  report?:      AnalysisReport;
  isStreaming?: boolean;
}

export interface SessionListItem {
  sessionId:      string;
  coinId:         string;
  updatedAt:      number;
  lastMessage?:   string;
  currentEmotion?: AgentEmotion;
  messageCount?:  number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useChatEngine({ coinId, userId }: { coinId: string; userId: string | null }) {
  const router        = useRouter();
  const params        = useParams<{ sessionId?: string }>();
  const activeSessionId = params?.sessionId ?? null;

  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [emotion,        setEmotion]        = useState<AgentEmotion | null>(null);
  const [sessions,       setSessions]       = useState<SessionListItem[]>([]);
  const [isRestoring,    setIsRestoring]    = useState(false);
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [suggestAnalysis,setSuggestAnalysis]= useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Derived mood ─────────────────────────────────────────────────────────
  const mood = emotion ? MOOD[emotion.emotion] : MOOD.thinking;

  // ── Start new session ─────────────────────────────────────────────────────
  const startNewSession = useCallback(async () => {
    try {
      setIsRestoring(true);
      setError(null);
      const res = await apiClient.post<{ sessionId: string }>("/agent/session/create", { coinId });
      router.push(`/agent/${coinId}/${res.sessionId}`);
    } catch {
      setError("Failed to create a new session. Please try again.");
    } finally {
      setIsRestoring(false);
    }
  }, [coinId, router]);

  // ── Switch session ────────────────────────────────────────────────────────
  const switchToSession = useCallback((sid: string) => {
    router.push(`/agent/${coinId}/${sid}`);
  }, [coinId, router]);

  // ── Load session on URL change ────────────────────────────────────────────
  useEffect(() => {
    if (!activeSessionId) return;
    let isMounted = true;

    const loadSession = async () => {
      setIsRestoring(true);
      setError(null);
      try {
        const data = await apiClient.get<{ messages: ChatMessage[]; currentEmotion: AgentEmotion }>(
          `/agent/session/${activeSessionId}`
        );
        if (!isMounted) return;
        // Filter out __init__ messages from old sessions
        const real = (data.messages ?? []).filter(m => m.content !== "__init__");
        setMessages(real);
        setEmotion(data.currentEmotion ?? null);
      } catch {
        if (isMounted) setError("Failed to load chat history.");
      } finally {
        if (isMounted) setIsRestoring(false);
      }
    };

    loadSession();
    return () => { isMounted = false; };
  }, [activeSessionId]);

  // ── Load session list ─────────────────────────────────────────────────────
  const refreshSessionList = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await apiClient.get<SessionListItem[]>("/agent/sessions");
      setSessions(data ?? []);
    } catch { /* non-critical */ }
  }, [userId]);

  useEffect(() => {
    if (userId) refreshSessionList();
  }, [userId, refreshSessionList]);

  // ── Optimistic sidebar update ─────────────────────────────────────────────
  const markSessionUpdated = useCallback((sid: string, lastMsg: string, emo?: AgentEmotion) => {
    setSessions(prev => {
      const now    = Date.now();
      const exists = prev.find(s => s.sessionId === sid);
      if (exists) {
        return prev
          .map(s => s.sessionId === sid
            ? { ...s, updatedAt: now, lastMessage: lastMsg.slice(0, 80), currentEmotion: emo ?? s.currentEmotion, messageCount: (s.messageCount ?? 0) + 1 }
            : s
          )
          .sort((a, b) => b.updatedAt - a.updatedAt);
      }
      return [{ sessionId: sid, coinId, updatedAt: now, lastMessage: lastMsg.slice(0, 80), currentEmotion: emo, messageCount: 1 }, ...prev];
    });
  }, [coinId]);

  // ── Send message (streaming) ──────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isGenerating || !activeSessionId) return;

    const userMsgId  = `usr_${Date.now()}`;
    const agentMsgId = `agt_${Date.now()}`;

    setMessages(prev => [
      ...prev,
      { id: userMsgId,  role: "user",  content: text, ts: Date.now() },
      { id: agentMsgId, role: "agent", content: "",   ts: Date.now() + 1, isStreaming: true },
    ]);

    setIsGenerating(true);
    setError(null);
    setSuggestAnalysis(false);

    abortControllerRef.current = new AbortController();

    try {
      // ── Direct fetch bypasses Next.js rewrite (required for NDJSON streaming) ──
      const response = await fetch(`${API_URL}/api/agent/chat/stream`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${tokenStore.access ?? ""}`,
        },
        body:   JSON.stringify({ sessionId: activeSessionId, message: text, coinId }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok)   throw new Error(`Server error: ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader  = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let streamedContent = "";
      let finalEmotion:  AgentEmotion | undefined;
      let finalToolCall: ToolResult   | undefined;
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (!value) continue;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          let data: any;
          try { data = JSON.parse(line); } catch { continue; }

          if (data.type === "text_delta") {
            streamedContent += data.text;
            setMessages(prev => prev.map(m =>
              m.id === agentMsgId ? { ...m, content: streamedContent } : m
            ));
          }

          if (data.type === "emotion_update") {
            finalEmotion = data.emotion as AgentEmotion;
            setEmotion(data.emotion);
          }

          if (data.type === "suggest_analysis") {
            setSuggestAnalysis(true);
          }

          if (data.type === "tool_execution") {
            finalToolCall = {
              type:     data.toolName,
              symbol:   data.symbol,
              data:     data.toolData,
            };
          }
        }
      }

      // Finalise message
      setMessages(prev => prev.map(m =>
        m.id === agentMsgId
          ? { ...m, content: streamedContent, isStreaming: false, toolResult: finalToolCall, emotion: finalEmotion }
          : m
      ));

      // Update sidebar optimistically
      if (activeSessionId && streamedContent) {
        markSessionUpdated(activeSessionId, streamedContent, finalEmotion);
      }

    } catch (err: any) {
      if (err.name === "AbortError") {
        // User stopped — mark message as done
        setMessages(prev => prev.map(m =>
          m.id === agentMsgId ? { ...m, isStreaming: false } : m
        ));
      } else {
        setError("The agent encountered a network error. Please try again.");
        setMessages(prev => prev.map(m =>
          m.id === agentMsgId ? { ...m, content: "⚠️ Connection interrupted.", isStreaming: false } : m
        ));
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [activeSessionId, coinId, isGenerating, markSessionUpdated]);

  // ── Stop generation ───────────────────────────────────────────────────────
  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
  }, []);

  return {
    activeSessionId,
    messages,
    emotion,
    mood,
    sessions,
    isRestoring,
    isGenerating,
    error,
    suggestAnalysis,
    setSuggestAnalysis,
    startNewSession,
    switchToSession,
    sendMessage,
    stopGeneration,
    markSessionUpdated,
    refreshSessionList,
    setMessages,
    setError,
  };
}
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { apiClient } from "@/services/api.client";
import { ReportBubble, type AnalysisReport } from "@/components/ReportBubble";
import { useAgentSession, type AgentEmotion, type SessionListItem } from "@/hooks/useAgentSession";

// ── Types ─────────────────────────────────────────────────────────────────────
type EmotionType = AgentEmotion["emotion"];

interface ChatMessage {
  role:     "user" | "agent";
  content:  string;
  emotion?: AgentEmotion;
  ts:       number;
  report?:  AnalysisReport;
}

interface ChatResponse {
  sessionId:       string;
  content:         string;
  emotion:         AgentEmotion;
  suggestAnalysis: boolean;
  suggestAlert:    boolean;
  history:         ChatMessage[];
  analysisReport?: AnalysisReport;
}

interface RunAnalysisResponse {
  analysis:    Record<string, any>;
  agentOutput: ChatResponse | null;
}

// ── Emotion palette ───────────────────────────────────────────────────────────
const MOOD: Record<EmotionType, {
  accent: string; softBg: string; textColor: string; label: string; emoji: string;
}> = {
  happy:      { accent: "#00e5a0", softBg: "rgba(0,229,160,0.08)",   textColor: "var(--up)",      label: "Feeling good!",    emoji: "😊" },
  depressed:  { accent: "#36b6ff", softBg: "rgba(54,182,255,0.08)",  textColor: "#60a5fa",         label: "A bit down...",    emoji: "😔" },
  nervous:    { accent: "#ffb020", softBg: "rgba(255,176,32,0.08)",  textColor: "var(--warn)",     label: "A little nervous", emoji: "😬" },
  frustrated: { accent: "#ff5572", softBg: "rgba(255,85,114,0.08)",  textColor: "var(--down)",     label: "Frustrated",       emoji: "😤" },
  shocked:    { accent: "#a78bfa", softBg: "rgba(167,139,250,0.08)", textColor: "var(--violet)",   label: "Shocked!",         emoji: "😲" },
  thinking:   { accent: "#94a3b8", softBg: "rgba(148,163,184,0.06)", textColor: "var(--ink-soft)", label: "Thinking...",      emoji: "🤔" },
};

const PROMPTS = [
  "How are you feeling about the market today?",
  "Should I buy right now?",
  "What risks should I be aware of?",
  "Is this a good time to sell?",
  "Run a full analysis for me",
];

function tLabel(t: number) {
  return new Date(t).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

function dateLabel(ms: number) {
  const diffDays = Math.floor((Date.now() - ms) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return new Date(ms).toLocaleDateString("en-GB", { weekday: "short" });
  return new Date(ms).toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots({ color }: { color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {[0, 1, 2].map(i => (
        <span key={i} className="animate-bounce" style={{
          width: 6, height: 6, borderRadius: "50%",
          background: color, display: "inline-block",
          animationDelay: `${i * 0.18}s`, animationDuration: "0.8s",
        }} />
      ))}
    </span>
  );
}

// ── Session sidebar ───────────────────────────────────────────────────────────
function SessionSidebar({
  sessions, currentSessionId, coinId, loading,
  emotion, onNewSession, onSwitch, onDelete, onRunAnalysis,
}: {
  sessions:          SessionListItem[];
  currentSessionId:  string | null;
  coinId:            string;
  loading:           boolean;
  emotion:           AgentEmotion | null;
  onNewSession:      () => void | Promise<void>;
  onSwitch:          (sid: string) => void;
  onDelete:          (sid: string) => Promise<void>;
  onRunAnalysis:     () => void;
}) {
  const mood = emotion ? MOOD[emotion.emotion] : MOOD.thinking;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId,  setConfirmId]  = useState<string | null>(null);
  const [imgErr, setImgErr] = useState(false);
  useEffect(() => setImgErr(false), [emotion?.asset]);

  async function handleDelete(sid: string) {
    setDeletingId(sid);
    await onDelete(sid);
    setDeletingId(null);
    setConfirmId(null);
  }

  // Group sessions by date
  const grouped: { label: string; items: SessionListItem[] }[] = [];
  let currentLabel = "";
  for (const s of sessions) {
    const lbl = dateLabel(s.updatedAt);
    if (lbl !== currentLabel) {
      grouped.push({ label: lbl, items: [] });
      currentLabel = lbl;
    }
    grouped[grouped.length - 1].items.push(s);
  }

  return (
    <div style={{
      width: 220, flexShrink: 0,
      display: "flex", flexDirection: "column",
      background: "rgb(4,11,20)",
      borderRight: "1px solid var(--border)",
    }}>
      {/* Mood accent strip */}
      <div style={{ height: 3, background: mood.accent, transition: "background 0.5s ease", flexShrink: 0 }} />

      {/* Avatar section */}
      <div style={{
        padding: "20px 16px 14px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        flexShrink: 0,
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%", overflow: "hidden",
          background: mood.softBg,
          boxShadow: `0 6px 24px ${mood.accent}28, 0 0 0 1px ${mood.accent}18`,
          transition: "box-shadow 0.5s ease, background 0.5s ease",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          {!imgErr && emotion?.asset ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={emotion.asset} alt={emotion.emotion}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={() => setImgErr(true)} />
          ) : (
            <span style={{ fontSize: 36, lineHeight: 1 }}>{mood.emoji}</span>
          )}
        </div>

        <span style={{
          padding: "3px 10px", borderRadius: 20,
          background: mood.softBg, color: mood.textColor,
          fontSize: 10, fontWeight: 600, fontFamily: "var(--font-display)",
          border: `1px solid ${mood.accent}30`,
        }}>
          {mood.label}
        </span>

        <p style={{
          fontSize: 10, color: "var(--ink-muted)", fontFamily: "var(--font-mono)",
          margin: 0, textAlign: "center",
        }}>
          Watching <span style={{ color: "var(--ink-soft)", fontWeight: 600 }}>{coinId.toUpperCase()}</span>
        </p>

        {emotion && (
          <div style={{
            width: "100%", padding: "8px 10px", borderRadius: 10,
            background: mood.softBg, border: `1px solid ${mood.accent}18`,
          }}>
            <p style={{
              fontSize: 10, lineHeight: 1.55, color: "var(--ink-soft)",
              fontFamily: "var(--font-mono)", margin: 0, fontStyle: "italic",
            }}>
              "{emotion.message.slice(0, 70)}{emotion.message.length > 70 ? "…" : ""}"
            </p>
          </div>
        )}

        {emotion && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, width: "100%" }}>
            <span style={{ fontSize: 9, color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
              intensity
            </span>
            <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
              {[1, 2, 3].map(n => (
                <div key={n} style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: (n === 1 || (n === 2 && (emotion.intensity === "medium" || emotion.intensity === "high")) || (n === 3 && emotion.intensity === "high"))
                    ? mood.accent : "var(--border-bright)",
                  transition: "background 0.3s ease",
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ padding: "12px 12px 8px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <button
          onClick={onNewSession} disabled={loading}
          style={{
            width: "100%", padding: "8px 0", borderRadius: 10,
            fontSize: 11, fontWeight: 600, fontFamily: "var(--font-display)",
            color: "var(--ink-soft)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            opacity: loading ? 0.5 : 1, transition: "all 0.15s ease",
          }}
          onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "var(--ink)"; } }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "var(--ink-soft)"; }}
        >
          <span style={{ fontSize: 13 }}>✦</span> New Chat
        </button>

        <button
          onClick={onRunAnalysis} disabled={loading}
          style={{
            width: "100%", padding: "8px 0", borderRadius: 10,
            fontSize: 11, fontWeight: 600, fontFamily: "var(--font-display)",
            color: loading ? "var(--ink-muted)" : "#020609",
            background: loading ? "rgb(12,24,42)" : mood.accent,
            border: "none", cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "0.02em", opacity: loading ? 0.6 : 1, transition: "all 0.25s ease",
          }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = loading ? "0.6" : "1"; }}
        >
          {loading ? "Working…" : "▶ Run Analysis"}
        </button>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px 16px", display: "flex", flexDirection: "column", gap: 0 }}>
        {sessions.length === 0 ? (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-faint)", textAlign: "center", marginTop: 12, letterSpacing: "0.06em" }}>
            No past sessions yet
          </p>
        ) : (
          grouped.map(group => (
            <div key={group.label}>
              <p style={{
                fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--ink-faint)",
                letterSpacing: "0.10em", textTransform: "uppercase",
                padding: "8px 6px 4px", margin: 0,
              }}>
                {group.label}
              </p>

              {group.items.map(s => {
                const isActive  = s.sessionId === currentSessionId;
                const emo       = s.currentEmotion;
                const m         = emo ? MOOD[emo.emotion] : MOOD.thinking;
                const isConfirming = confirmId === s.sessionId;

                return (
                  <div key={s.sessionId} style={{
                    borderRadius: 9,
                    background: isActive ? `${m.accent}12` : "transparent",
                    border: `1px solid ${isActive ? m.accent + "30" : "transparent"}`,
                    marginBottom: 2, transition: "all 0.15s ease", overflow: "hidden",
                  }}>
                    <button
                      onClick={() => { if (!isConfirming) onSwitch(s.sessionId); }}
                      style={{
                        width: "100%", padding: "8px 8px",
                        background: "transparent", border: "none",
                        cursor: "pointer", textAlign: "left",
                        display: "flex", alignItems: "flex-start", gap: 8,
                      }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>{m.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                          <span style={{
                            fontFamily: "var(--font-mono)", fontSize: 8, color: m.textColor,
                            fontWeight: 700, background: `${m.accent}14`,
                            padding: "1px 5px", borderRadius: 3, letterSpacing: "0.05em",
                          }}>
                            {s.coinId.toUpperCase()}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--ink-faint)", marginLeft: "auto" }}>
                            {s.messageCount}m
                          </span>
                        </div>
                        <p style={{
                          fontFamily: "var(--font-display)", fontSize: 10.5,
                          color: isActive ? "var(--ink)" : "var(--ink-muted)",
                          lineHeight: 1.45, margin: 0,
                          overflow: "hidden", textOverflow: "ellipsis",
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                          fontWeight: isActive ? 500 : 400,
                        }}>
                          {s.lastMessage ?? "New conversation"}
                        </p>
                      </div>
                    </button>

                    {/* Delete row */}
                    <div style={{ display: "flex", gap: 4, padding: "0 8px 6px" }}>
                      {isConfirming ? (
                        <>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,85,114,0.8)", flex: 1 }}>
                            Delete this chat?
                          </span>
                          <button
                            onClick={() => handleDelete(s.sessionId)}
                            disabled={deletingId === s.sessionId}
                            style={{
                              fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
                              color: "#ff5572", background: "rgba(255,85,114,0.12)",
                              border: "1px solid rgba(255,85,114,0.3)",
                              borderRadius: 5, padding: "2px 7px", cursor: "pointer",
                            }}
                          >
                            {deletingId === s.sessionId ? "…" : "Yes"}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            style={{
                              fontFamily: "var(--font-mono)", fontSize: 9,
                              color: "var(--ink-faint)", background: "transparent",
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: 5, padding: "2px 7px", cursor: "pointer",
                            }}
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmId(s.sessionId); }}
                          style={{
                            fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-faint)",
                            background: "transparent", border: "none", cursor: "pointer",
                            padding: "1px 4px", borderRadius: 4, marginLeft: "auto",
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ff5572"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-faint)"; }}
                          title="Delete chat"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg, cur }: { msg: ChatMessage; cur: AgentEmotion | null }) {
  const isUser = msg.role === "user";
  const emo    = msg.emotion ?? cur;
  const mood   = emo ? MOOD[emo.emotion] : MOOD.thinking;

  return (
    <div style={{ display: "flex", gap: 10, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-start" }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%", background: mood.softBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, flexShrink: 0, marginTop: 2,
        }}>
          {mood.emoji}
        </div>
      )}
      <div style={{
        display: "flex", flexDirection: "column", gap: 3,
        maxWidth: "80%",
        alignItems: isUser ? "flex-end" : "flex-start",
        width: msg.report ? "100%" : undefined,
      }}>
        <div style={{
          padding: "10px 14px", fontSize: 13, lineHeight: 1.65,
          fontFamily: "var(--font-display)", fontWeight: 400,
          ...(isUser ? {
            background: "rgb(12,24,42)", color: "var(--ink)",
            borderRadius: "18px 18px 4px 18px",
            border: "1px solid var(--border-bright)",
          } : {
            background: "rgb(8,18,32)", color: "var(--ink-soft)",
            borderRadius: "18px 18px 18px 4px",
            border: "1px solid var(--border)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }),
        }}>
          {msg.content}
        </div>
        {!isUser && msg.report && (
          <div style={{ width: "100%", marginTop: 6 }}>
            <ReportBubble report={msg.report} />
          </div>
        )}
        <span style={{ fontSize: 10, color: "var(--ink-faint)", fontFamily: "var(--font-mono)", padding: "0 4px" }}>
          {tLabel(msg.ts)}
        </span>
      </div>
    </div>
  );
}

// ── Restoring skeleton ────────────────────────────────────────────────────────
function RestoringScreen({ mood }: { mood: { accent: string; emoji: string; softBg: string } }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, opacity: 0.6 }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%", background: mood.softBg,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
        animation: "pulse 1.5s ease-in-out infinite",
      }}>
        {mood.emoji}
      </div>
      <p style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
        Restoring session…
      </p>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }`}</style>
    </div>
  );
}

// ── Main AgentChat ────────────────────────────────────────────────────────────
interface AgentChatProps {
  coinId?:  string;
  userId?:  string | null;
}

export function AgentChat({ coinId = "bitcoin", userId = null }: AgentChatProps) {
  const {
    sessionId,
    isRestoring,
    sessions,
    startNewSession,
    switchToSession,
    deleteSession,
    markSessionUpdated,
    refreshSessionList,
  } = useAgentSession(userId, coinId);

  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [emotion,     setEmotion]     = useState<AgentEmotion | null>(null);
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [showPrompts, setShowPrompts] = useState(true);

  const endRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevSid  = useRef<string | null>(null);
  const mood = emotion ? MOOD[emotion.emotion] : MOOD.thinking;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  // Load history whenever sessionId changes (restore on mount, or switch session)
  useEffect(() => {
    if (!sessionId || sessionId === prevSid.current) return;
    prevSid.current = sessionId;
    setMessages([]);
    setEmotion(null);
    setShowPrompts(true);

    apiClient.get<{ messages: ChatMessage[]; currentEmotion: AgentEmotion }>(`/agent/session/${sessionId}`)
      .then(data => {
        if (data?.messages?.length > 0) {
          // Filter out the silent __init__ seed messages used to create the DB doc
          const real = data.messages.filter(m => m.content !== "__init__");
          if (real.length > 0) {
            setMessages(real);
            setEmotion(data.currentEmotion ?? null);
            setShowPrompts(false);
          }
        }
      })
      .catch(() => { /* new session — nothing to restore */ });
  }, [sessionId]);

  useEffect(() => {
    if (!isRestoring && userId) refreshSessionList();
  }, [isRestoring, userId, refreshSessionList]);

  const handleNewSession = useCallback(async () => { await startNewSession(); }, [startNewSession]);
  const handleSwitch      = useCallback((sid: string) => { if (sid !== sessionId) switchToSession(sid); }, [sessionId, switchToSession]);
  const handleDelete      = useCallback(async (sid: string) => { await deleteSession(sid); }, [deleteSession]);

  const runAnalysis = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true); setShowPrompts(false); setError(null);

    try {
      const startRes = await apiClient.post<ChatResponse>("/agent/chat", {
        sessionId, message: "Running analysis...", coinId, isAnalysing: true,
        ...(userId ? { userId } : {}),
      });
      setEmotion(startRes.emotion);
      setMessages(startRes.history);
    } catch { /* non-fatal */ }

    try {
      const result = await apiClient.post<RunAnalysisResponse>(`/analysis/${coinId}/run`, { sessionId });
      const agentOut = result.agentOutput;
      if (agentOut) {
        setEmotion(agentOut.emotion);
        const history: ChatMessage[] = agentOut.history.map((m, i) =>
          (i === agentOut.history.length - 1 && m.role === "agent" && agentOut.analysisReport)
            ? { ...m, report: agentOut.analysisReport } : m
        );
        setMessages(history);
        const last = history[history.length - 1];
        if (last) markSessionUpdated(sessionId, last.content, agentOut.emotion);
      }
    } catch (e: any) {
      setError(e.message ?? "Analysis failed");
    } finally {
      setLoading(false); inputRef.current?.focus();
    }
  }, [sessionId, coinId, userId, markSessionUpdated]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading || !sessionId) return;
    const analysisKeywords = ["run analysis", "analyze", "analyse", "run it", "check market", "full analysis"];
    if (analysisKeywords.some(k => text.toLowerCase().includes(k))) { await runAnalysis(); return; }

    setMessages(p => [...p, { role: "user", content: text.trim(), ts: Date.now() }]);
    setInput(""); setLoading(true); setError(null); setShowPrompts(false);

    try {
      const res = await apiClient.post<ChatResponse>("/agent/chat", {
        sessionId, message: text.trim(), coinId,
        ...(userId ? { userId } : {}),
      });
      setEmotion(res.emotion);
      setMessages(res.history);
      markSessionUpdated(sessionId, res.content, res.emotion);
      if (res.suggestAnalysis) { await runAnalysis(); return; }
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
      setMessages(p => p.slice(0, -1));
    } finally {
      setLoading(false); inputRef.current?.focus();
    }
  }, [loading, sessionId, coinId, userId, runAnalysis, markSessionUpdated]);

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, background: "rgb(2,6,9)" }}>
      <SessionSidebar
        sessions={sessions} currentSessionId={sessionId} coinId={coinId}
        loading={loading} emotion={emotion}
        onNewSession={handleNewSession} onSwitch={handleSwitch}
        onDelete={handleDelete} onRunAnalysis={runAnalysis}
      />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{
          padding: "12px 20px", borderBottom: "1px solid var(--border)",
          background: "rgb(4,11,20)", display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: mood.accent, boxShadow: `0 0 0 3px ${mood.accent}20`, transition: "all 0.4s ease", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              {coinId.charAt(0).toUpperCase() + coinId.slice(1)} Agent
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {emotion && (
              <span style={{ padding: "3px 10px", borderRadius: 20, background: mood.softBg, color: mood.textColor, fontSize: 11, fontWeight: 500, fontFamily: "var(--font-display)", border: `1px solid ${mood.accent}25`, transition: "all 0.4s ease" }}>
                {mood.emoji} {mood.label}
              </span>
            )}
            {sessionId && (
              <span style={{ fontSize: 9, color: "var(--ink-faint)", fontFamily: "var(--font-mono)", padding: "2px 7px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {sessionId.slice(-8)}
              </span>
            )}
            <span style={{ fontSize: 11, color: "var(--ink-faint)", fontFamily: "var(--font-mono)" }}>{messages.length} msgs</span>
          </div>
        </div>

        {/* Messages area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 8px", display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
          {isRestoring && <RestoringScreen mood={mood} />}

          {!isRestoring && messages.length === 0 && !loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, textAlign: "center", opacity: 0.8 }}>
              <span style={{ fontSize: 48, lineHeight: 1 }}>{mood.emoji}</span>
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--ink)", margin: "0 0 6px" }}>Hey! I'm your market agent.</p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.6, maxWidth: 260, margin: 0 }}>
                  Ask me anything about {coinId.toUpperCase()} — I'll give you my honest take.
                </p>
              </div>
            </div>
          )}

          {!isRestoring && showPrompts && messages.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 2 }}>Try asking…</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {PROMPTS.map((p, i) => (
                  <button key={i} onClick={() => send(p)} style={{ textAlign: "left", padding: "10px 14px", borderRadius: 12, fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 400, color: "var(--ink-soft)", background: "rgb(8,18,32)", border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.15s ease", width: "100%", lineHeight: 1.4 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = mood.accent; (e.currentTarget as HTMLElement).style.color = "var(--ink)"; (e.currentTarget as HTMLElement).style.background = mood.softBg; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--ink-soft)"; (e.currentTarget as HTMLElement).style.background = "rgb(8,18,32)"; }}
                  >{p}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => <Bubble key={`${m.ts}-${i}`} msg={m} cur={emotion} />)}

          {loading && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: mood.softBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{mood.emoji}</div>
              <div style={{ padding: "12px 16px", background: "rgb(8,18,32)", border: "1px solid var(--border)", borderRadius: "18px 18px 18px 4px", boxShadow: "0 2px 8px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 6 }}>
                <TypingDots color={mood.accent} />
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 12, background: "var(--down-glass, rgba(255,85,114,0.07))", border: "1px solid var(--down-border, rgba(255,85,114,0.2))", fontSize: 13, color: "var(--down)", fontFamily: "var(--font-display)" }}>
              {error}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Quick chips */}
        {messages.length > 0 && (
          <div style={{ padding: "8px 20px 0", display: "flex", flexWrap: "wrap", gap: 6, background: "rgb(2,6,9)" }}>
            {["How are you?", "Run analysis", "Biggest risks?", "Buy or sell?"].map(p => (
              <button key={p} onClick={() => send(p)} disabled={loading}
                style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--ink-muted)", background: "rgb(8,18,32)", border: "1px solid var(--border)", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.15s ease", opacity: loading ? 0.5 : 1 }}
                onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.borderColor = mood.accent; (e.currentTarget as HTMLElement).style.color = "var(--ink)"; (e.currentTarget as HTMLElement).style.background = mood.softBg; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--ink-muted)"; (e.currentTarget as HTMLElement).style.background = "rgb(8,18,32)"; }}
              >{p}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ padding: "12px 16px 16px", background: "rgb(2,6,9)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: "rgb(8,18,32)", border: "1.5px solid var(--border)", borderRadius: 16, padding: "4px 4px 4px 16px", transition: "border-color 0.2s ease" }}>
            <textarea
              ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              onFocus={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = mood.accent; }}
              onBlur={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = "var(--border)"; }}
              disabled={loading || isRestoring}
              placeholder={isRestoring ? "Restoring session…" : `Ask about ${coinId}...`}
              rows={1}
              style={{ flex: 1, resize: "none", background: "transparent", padding: "10px 0", fontSize: 14, color: "var(--ink)", fontFamily: "var(--font-display)", outline: "none", minHeight: 42, maxHeight: 120, lineHeight: 1.5, border: "none" }}
              onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; }}
            />
            <button
              onClick={() => send(input)} disabled={!input.trim() || loading || isRestoring}
              style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: !input.trim() || loading || isRestoring ? "rgb(12,24,42)" : mood.accent, border: "none", cursor: !input.trim() || loading || isRestoring ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease", color: !input.trim() || loading || isRestoring ? "var(--ink-muted)" : "#020609", fontSize: 16, opacity: !input.trim() || loading || isRestoring ? 0.5 : 1 }}
              onMouseEnter={e => { if (input.trim() && !loading && !isRestoring) (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = !input.trim() || loading || isRestoring ? "0.5" : "1"; }}
            >↑</button>
          </div>
          <p style={{ marginTop: 6, fontSize: 10, color: "var(--ink-faint)", fontFamily: "var(--font-mono)", textAlign: "center" }}>
            ↵ send · shift+↵ new line
          </p>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { apiClient } from "@/services/api.client";
import { ReportBubble, type AnalysisReport } from "@/components/ReportBubble";

// ── Types ──────────────────────────────────────────────────────────────────
type EmotionType = "happy" | "depressed" | "nervous" | "frustrated" | "shocked" | "thinking";

interface AgentEmotion {
  emotion:   EmotionType;
  intensity: "low" | "medium" | "high";
  reason:    string;
  asset:     string;
  message:   string;
}


interface ChatMessage {
  role:    "user" | "agent";
  content: string;
  emotion?: AgentEmotion;
  ts:      number;
  report?: AnalysisReport;   // ← attached for rich rendering
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

// ── Emotion palette ──────────────────────────────────────────────────────────
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

function sid() { return `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function tLabel(t: number) {
  return new Date(t).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

// ── Typing dots ──────────────────────────────────────────────────────────────
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

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg, cur }: { msg: ChatMessage; cur: AgentEmotion | null }) {
  const isUser = msg.role === "user";
  const emo    = msg.emotion ?? cur;
  const mood   = emo ? MOOD[emo.emotion] : MOOD.thinking;

  return (
    <div style={{
      display: "flex",
      gap: 10,
      flexDirection: isUser ? "row-reverse" : "row",
      alignItems: "flex-start",
    }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: mood.softBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, flexShrink: 0, marginTop: 2,
        }}>
          {mood.emoji}
        </div>
      )}

      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        maxWidth: "80%",
        alignItems: isUser ? "flex-end" : "flex-start",
        width: msg.report ? "100%" : undefined,
      }}>
        {/* Text bubble */}
        <div style={{
          padding: "10px 14px",
          fontSize: 13,
          lineHeight: 1.65,
          fontFamily: "var(--font-display)",
          fontWeight: 400,
          ...(isUser
            ? {
                background: "rgb(12,24,42)",
                color: "var(--ink)",
                borderRadius: "18px 18px 4px 18px",
                border: "1px solid var(--border-bright)",
              }
            : {
                background: "rgb(8,18,32)",
                color: "var(--ink-soft)",
                borderRadius: "18px 18px 18px 4px",
                border: "1px solid var(--border)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }
          ),
        }}>
          {msg.content}
        </div>

        {/* Rich report card — only for agent messages that carry one */}
        {!isUser && msg.report && (
          <div style={{ width: "100%", marginTop: 6 }}>
            <ReportBubble report={msg.report} />
          </div>
        )}

        <span style={{
          fontSize: 10,
          color: "var(--ink-faint)",
          fontFamily: "var(--font-mono)",
          padding: "0 4px",
        }}>
          {tLabel(msg.ts)}
        </span>
      </div>
    </div>
  );
}

// ── Avatar panel ─────────────────────────────────────────────────────────────
function AvatarPanel({
  emotion, coinId, loading, onRunAnalysis,
}: {
  emotion: AgentEmotion | null;
  coinId: string;
  loading: boolean;
  onRunAnalysis: () => void;
}) {
  const mood = emotion ? MOOD[emotion.emotion] : MOOD.thinking;
  const [imgErr, setImgErr] = useState(false);
  useEffect(() => setImgErr(false), [emotion?.asset]);

  return (
    <div style={{
      width: 220,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      background: "rgb(4,11,20)",
      borderRight: "1px solid var(--border)",
      transition: "background 0.4s ease",
    }}>
      <div style={{ height: 3, background: mood.accent, transition: "background 0.5s ease", flexShrink: 0 }} />

      <div style={{
        padding: "24px 18px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        flex: 1,
      }}>
        <div style={{
          width: 116, height: 116, borderRadius: "50%",
          overflow: "hidden",
          background: mood.softBg,
          boxShadow: `0 8px 32px ${mood.accent}28, 0 0 0 1px ${mood.accent}18`,
          transition: "box-shadow 0.5s ease, background 0.5s ease",
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {!imgErr && emotion?.asset ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={emotion.asset}
              alt={emotion.emotion}
              style={{ width: "100%", height: "100%", objectFit: "cover", transition: "opacity 0.4s" }}
              onError={() => setImgErr(true)}
            />
          ) : (
            <span style={{ fontSize: 50, lineHeight: 1, userSelect: "none" }}>{mood.emoji}</span>
          )}
        </div>

        <span style={{
          display: "inline-block",
          padding: "4px 12px",
          borderRadius: 20,
          background: mood.softBg,
          color: mood.textColor,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: "var(--font-display)",
          transition: "all 0.4s ease",
          border: `1px solid ${mood.accent}30`,
        }}>
          {mood.label}
        </span>

        <p style={{
          fontSize: 11, color: "var(--ink-muted)", fontFamily: "var(--font-mono)",
          textAlign: "center", lineHeight: 1.4, margin: 0,
        }}>
          Watching <span style={{ color: "var(--ink-soft)", fontWeight: 600 }}>{coinId.toUpperCase()}</span>
        </p>

        {emotion && (
          <div style={{
            width: "100%", padding: "10px 12px", borderRadius: 12,
            background: mood.softBg, border: `1px solid ${mood.accent}20`,
            transition: "all 0.4s ease",
          }}>
            <p style={{
              fontSize: 11, lineHeight: 1.6, color: "var(--ink-soft)",
              fontFamily: "var(--font-mono)", margin: 0, fontStyle: "italic",
            }}>
              "{emotion.message}"
            </p>
          </div>
        )}

        {emotion && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
            <span style={{ fontSize: 10, color: "var(--ink-muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
              intensity
            </span>
            <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
              {[1, 2, 3].map(n => {
                const filled =
                  n === 1 ||
                  (n === 2 && (emotion.intensity === "medium" || emotion.intensity === "high")) ||
                  (n === 3 && emotion.intensity === "high");
                return (
                  <div key={n} style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: filled ? mood.accent : "var(--border-bright)",
                    transition: "background 0.3s ease",
                  }} />
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 16px 20px", flexShrink: 0 }}>
        <button
          onClick={onRunAnalysis}
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "var(--font-display)",
            color: loading ? "var(--ink-muted)" : "#020609",
            background: loading ? "rgb(12,24,42)" : mood.accent,
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.3s ease",
            letterSpacing: "0.02em",
            opacity: loading ? 0.6 : 1,
          }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = loading ? "0.6" : "1"; }}
        >
          {loading ? "Working..." : "▶ Run Analysis"}
        </button>
      </div>
    </div>
  );
}

// ── Main AgentChat ─────────────────────────────────────────────────────────────
export function AgentChat({ coinId = "bitcoin" }: { coinId?: string }) {
  const [sessionId]              = useState(sid);
  const [messages, setMessages]  = useState<ChatMessage[]>([]);
  const [emotion,  setEmotion]   = useState<AgentEmotion | null>(null);
  const [input,    setInput]     = useState("");
  const [loading,  setLoading]   = useState(false);
  const [error,    setError]     = useState<string | null>(null);
  const [showPrompts, setShowPrompts] = useState(true);

  const endRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mood = emotion ? MOOD[emotion.emotion] : MOOD.thinking;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setShowPrompts(false);
    setError(null);

    // 1. Notify agent analysis is starting (canned "thinking" message)
    try {
      const startRes = await apiClient.post<ChatResponse>("/agent/chat", {
        sessionId, message: "Running analysis...", coinId, isAnalysing: true,
      });
      setEmotion(startRes.emotion);
      setMessages(startRes.history);
    } catch { /* non-fatal */ }

    try {
      // 2. Run the actual analysis — returns { analysis, agentOutput }
      const result = await apiClient.post<RunAnalysisResponse>(`/analysis/${coinId}/run`, { sessionId });

      const agentOut = result.agentOutput;
      if (agentOut) {
        setEmotion(agentOut.emotion);

        // Attach the analysisReport to the last agent message so ReportBubble renders
        const history: ChatMessage[] = agentOut.history.map((m, i) => {
          if (i === agentOut.history.length - 1 && m.role === "agent" && agentOut.analysisReport) {
            return { ...m, report: agentOut.analysisReport };
          }
          return m;
        });
        setMessages(history);
      }
    } catch (e: any) {
      setError(e.message ?? "Analysis failed");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [sessionId, coinId]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const analysisKeywords = ["run analysis", "analyze", "analyse", "run it", "check market", "full analysis"];
    if (analysisKeywords.some(k => text.toLowerCase().includes(k))) {
      await runAnalysis();
      return;
    }

    setMessages(p => [...p, { role: "user", content: text.trim(), ts: Date.now() }]);
    setInput("");
    setLoading(true);
    setError(null);
    setShowPrompts(false);

    try {
      const res = await apiClient.post<ChatResponse>("/agent/chat", {
        sessionId, message: text.trim(), coinId,
      });
      setEmotion(res.emotion);
      setMessages(res.history);

      if (res.suggestAnalysis) {
        await runAnalysis();
        return;
      }
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
      setMessages(p => p.slice(0, -1));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, sessionId, coinId, runAnalysis]);

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, background: "rgb(2,6,9)" }}>

      {/* ── Left: avatar ─────────────────────────────────────────────── */}
      <AvatarPanel
        emotion={emotion}
        coinId={coinId}
        loading={loading}
        onRunAnalysis={runAnalysis}
      />

      {/* ── Right: chat ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          background: "rgb(4,11,20)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: mood.accent,
              boxShadow: `0 0 0 3px ${mood.accent}20`,
              transition: "all 0.4s ease",
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: "var(--font-display)",
              fontSize: 14, fontWeight: 600, color: "var(--ink)",
            }}>
              {coinId.charAt(0).toUpperCase() + coinId.slice(1)} Agent
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {emotion && (
              <span style={{
                padding: "3px 10px", borderRadius: 20,
                background: mood.softBg, color: mood.textColor,
                fontSize: 11, fontWeight: 500, fontFamily: "var(--font-display)",
                border: `1px solid ${mood.accent}25`, transition: "all 0.4s ease",
              }}>
                {mood.emoji} {mood.label}
              </span>
            )}
            <span style={{ fontSize: 11, color: "var(--ink-faint)", fontFamily: "var(--font-mono)" }}>
              {messages.length} messages
            </span>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: "auto",
          padding: "20px 20px 8px",
          display: "flex", flexDirection: "column", gap: 16,
          minHeight: 0,
        }}>

          {/* Empty / welcome */}
          {messages.length === 0 && !loading && (
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              height: "100%", gap: 12, textAlign: "center", opacity: 0.8,
            }}>
              <span style={{ fontSize: 48, lineHeight: 1 }}>{mood.emoji}</span>
              <div>
                <p style={{
                  fontFamily: "var(--font-display)", fontSize: 16,
                  fontWeight: 600, color: "var(--ink)", margin: "0 0 6px",
                }}>
                  Hey! I'm your market agent.
                </p>
                <p style={{
                  fontFamily: "var(--font-display)", fontSize: 13,
                  color: "var(--ink-muted)", lineHeight: 1.6,
                  maxWidth: 260, margin: 0,
                }}>
                  Ask me anything about {coinId.toUpperCase()} — I'll give you my honest take.
                </p>
              </div>
            </div>
          )}

          {/* Quick prompts */}
          {showPrompts && messages.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              <p style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: "var(--ink-muted)", fontWeight: 500,
                textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 2,
              }}>
                Try asking...
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => send(p)}
                    style={{
                      textAlign: "left", padding: "10px 14px",
                      borderRadius: 12, fontSize: 13,
                      fontFamily: "var(--font-display)", fontWeight: 400,
                      color: "var(--ink-soft)", background: "rgb(8,18,32)",
                      border: "1px solid var(--border)", cursor: "pointer",
                      transition: "all 0.15s ease", width: "100%", lineHeight: 1.4,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = mood.accent;
                      (e.currentTarget as HTMLElement).style.color = "var(--ink)";
                      (e.currentTarget as HTMLElement).style.background = mood.softBg;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                      (e.currentTarget as HTMLElement).style.color = "var(--ink-soft)";
                      (e.currentTarget as HTMLElement).style.background = "rgb(8,18,32)";
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((m, i) => (
            <Bubble key={`${m.ts}-${i}`} msg={m} cur={emotion} />
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: mood.softBg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, flexShrink: 0,
              }}>
                {mood.emoji}
              </div>
              <div style={{
                padding: "12px 16px",
                background: "rgb(8,18,32)",
                border: "1px solid var(--border)",
                borderRadius: "18px 18px 18px 4px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <TypingDots color={mood.accent} />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 12,
              background: "var(--down-glass, rgba(255,85,114,0.07))",
              border: "1px solid var(--down-border, rgba(255,85,114,0.2))",
              fontSize: 13, color: "var(--down)", fontFamily: "var(--font-display)",
            }}>
              {error}
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Quick chips */}
        {messages.length > 0 && (
          <div style={{
            padding: "8px 20px 0",
            display: "flex", flexWrap: "wrap", gap: 6,
            background: "rgb(2,6,9)",
          }}>
            {["How are you?", "Run analysis", "Biggest risks?", "Buy or sell?"].map(p => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={loading}
                style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 11,
                  fontFamily: "var(--font-display)", fontWeight: 500,
                  color: "var(--ink-muted)", background: "rgb(8,18,32)",
                  border: "1px solid var(--border)",
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                  opacity: loading ? 0.5 : 1,
                }}
                onMouseEnter={e => {
                  if (!loading) {
                    (e.currentTarget as HTMLElement).style.borderColor = mood.accent;
                    (e.currentTarget as HTMLElement).style.color = "var(--ink)";
                    (e.currentTarget as HTMLElement).style.background = mood.softBg;
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLElement).style.color = "var(--ink-muted)";
                  (e.currentTarget as HTMLElement).style.background = "rgb(8,18,32)";
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ padding: "12px 16px 16px", background: "rgb(2,6,9)", flexShrink: 0 }}>
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 8,
            background: "rgb(8,18,32)", border: "1.5px solid var(--border)",
            borderRadius: 16, padding: "4px 4px 4px 16px",
            transition: "border-color 0.2s ease",
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
              }}
              onFocus={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = mood.accent; }}
              onBlur={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = "var(--border)"; }}
              disabled={loading}
              placeholder={`Ask about ${coinId}...`}
              rows={1}
              style={{
                flex: 1, resize: "none", background: "transparent",
                padding: "10px 0", fontSize: 14, color: "var(--ink)",
                fontFamily: "var(--font-display)", outline: "none",
                minHeight: 42, maxHeight: 120, lineHeight: 1.5, border: "none",
              }}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                background: !input.trim() || loading ? "rgb(12,24,42)" : mood.accent,
                border: "none",
                cursor: !input.trim() || loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s ease",
                color: !input.trim() || loading ? "var(--ink-muted)" : "#020609",
                fontSize: 16,
                opacity: !input.trim() || loading ? 0.5 : 1,
              }}
              onMouseEnter={e => {
                if (input.trim() && !loading) (e.currentTarget as HTMLElement).style.opacity = "0.85";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.opacity = !input.trim() || loading ? "0.5" : "1";
              }}
            >
              ↑
            </button>
          </div>
          <p style={{
            marginTop: 6, fontSize: 10,
            color: "var(--ink-faint)", fontFamily: "var(--font-mono)", textAlign: "center",
          }}>
            ↵ send · shift+↵ new line
          </p>
        </div>
      </div>
    </div>
  );
}
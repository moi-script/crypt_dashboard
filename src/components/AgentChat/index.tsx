"use client";

import { useState } from "react";
import { ErrorBoundary }    from "react-error-boundary";
import { ChatSidebar }      from "./ChatSidebar";
import { ChatMessageList }  from "./ChatMessageList";
import { ChatInput }        from "./ChatInput";
import { ChatDashboard }    from "./ChatDashboard";
import { useChatEngine, type ToolName } from "./hooks/useChatEngine";

interface AgentChatProps {
  coinId?:  string;
  userId?:  string | null;
}

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#ff5572", padding: 24, textAlign: "center", gap: 12 }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, margin: 0 }}>Something went wrong in the Agent UI:</p>
      <pre style={{ fontSize: 12, background: "rgba(0,0,0,0.3)", padding: 14, borderRadius: 8, maxWidth: "100%", overflow: "auto" }}>
        {error.message}
      </pre>
      <button onClick={resetErrorBoundary}
        style={{ padding: "8px 18px", border: "1px solid rgba(255,85,114,0.3)", borderRadius: 8, background: "transparent", color: "#ff5572", fontSize: 12, fontFamily: "var(--font-mono)", cursor: "pointer" }}>
        Reload Interface
      </button>
    </div>
  );
}

const TOOL_CHIPS: { label: string; tool: ToolName; emoji: string }[] = [
  { label: "Analyse",      tool: "chart_analyze",     emoji: "📊" },
  { label: "Scan market",  tool: "intelligence_scan",  emoji: "🔍" },
  { label: "Order blocks", tool: "orderblocks_active", emoji: "🧱" },
  { label: "Primitives",   tool: "chart_primitives",   emoji: "⚗️" },
  { label: "Agent runs",   tool: "agent_runs",         emoji: "🤖" },
];

const QUICK_CHIPS = ["How are you?", "Biggest risks?", "Buy or sell?"];

export function AgentChat({ coinId = "bitcoin", userId = null }: AgentChatProps) {
  const [view,        setView]        = useState<"chat" | "dashboard">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const engine = useChatEngine({ coinId, userId });
  const { mood, emotion, isRestoring, isGenerating, dispatchToolChip, resolveClarification } = engine;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, overflow: "hidden", background: "rgb(2,6,9)" }}>
      {/* ── Global dark scrollbar for all scrollable areas in this subtree ── */}
      <style>{`
        @keyframes pulse { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
        @media (max-width: 640px) { .agent-mobile-menu { display: flex !important; } }

        /* Webkit scrollbar — applied globally within the agent shell */
        .agent-shell *::-webkit-scrollbar { width: 4px; height: 4px; }
        .agent-shell *::-webkit-scrollbar-track { background: transparent; }
        .agent-shell *::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 4px;
        }
        .agent-shell *::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.14);
        }
        .agent-shell *::-webkit-scrollbar-corner { background: transparent; }

        /* Firefox */
        .agent-shell * {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.08) transparent;
        }
      `}</style>

      <div className="agent-shell" style={{ display: "flex", width: "100%", height: "100%", minHeight: 0, overflow: "hidden" }}>

        {/* Sidebar */}
        <ChatSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          coinId={coinId}
          engine={{
            sessions:        engine.sessions,
            activeSessionId: engine.activeSessionId,
            emotion,
            mood,
            isGenerating:    engine.isGenerating,
            deleteSession:   engine.deleteSession, // ← add this
            startNewSession: engine.startNewSession,
            switchToSession: engine.switchToSession,
          }}
        />

        {/* Main panel */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header */}
          <div style={{
            padding: "13px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "rgb(4,11,20)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0, gap: 10,
            /* Ensure it sits above everything */
            position: "relative", zIndex: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => setSidebarOpen(v => !v)}
                className="agent-mobile-menu"
                style={{ display: "none", width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", alignItems: "center", justifyContent: "center", fontSize: 16, color: "rgba(255,255,255,0.6)", flexShrink: 0 }}
              >
                ☰
              </button>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: mood.accent, boxShadow: `0 0 0 3px ${mood.accent}20`, transition: "all 0.4s ease", flexShrink: 0 }} />
              <span style={{ fontFamily: "var(--font-display,sans-serif)", fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>
                {coinId.charAt(0).toUpperCase() + coinId.slice(1)} Agent
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ display: "flex", background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
                {(["chat", "dashboard"] as const).map(v => (
                  <button key={v} onClick={() => setView(v)} style={{
                    padding: "6px 13px", fontSize: 12, fontWeight: 600,
                    fontFamily: "var(--font-display,sans-serif)", border: "none", cursor: "pointer",
                    background: view === v ? mood.softBg : "transparent",
                    color: view === v ? mood.textColor : "rgba(255,255,255,0.3)",
                    transition: "all 0.15s ease",
                  }}>
                    {v === "chat" ? "Chat" : "Agent"}
                  </button>
                ))}
              </div>

              {emotion && view === "chat" && (
                <span style={{
                  padding: "4px 11px", borderRadius: 20, background: mood.softBg, color: mood.textColor,
                  fontSize: 12, fontWeight: 500, fontFamily: "var(--font-display,sans-serif)",
                  border: `1px solid ${mood.accent}25`, transition: "all 0.4s ease",
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  {mood.emoji} {mood.label}
                </span>
              )}

              {isRestoring && (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-mono)", animation: "pulse 1.5s ease-in-out infinite" }}>
                  Connecting…
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
            <div style={{ flex: 1, overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" }}>

              {view === "dashboard" ? (
                <ChatDashboard engine={engine} accentColor={mood.accent} />
              ) : (
                /* Chat view — column: [scrolling messages] + [sticky chips] + [sticky input] */
                <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>

                  {/* Scrolling message area — flex: 1, overflows internally */}
                  <ChatMessageList
                    engine={{
                      messages:             engine.messages,
                      isGenerating:         engine.isGenerating,
                      error:                engine.error,
                      emotion,
                      mood,
                      coinId,
                      resolveClarification,
                    }}
                  />

                  {/* ── Sticky chip bar + input ── flexShrink: 0 keeps them pinned */}
                  <div style={{ flexShrink: 0, background: "rgb(2,6,9)" }}>

                    {/* Chip bar — only when conversation has started */}
                    {engine.messages.length > 0 && (
                      <div style={{
                        padding: "8px 16px 4px",
                        display: "flex", flexWrap: "wrap", gap: 6,
                        borderTop: "1px solid rgba(255,255,255,0.04)",
                      }}>
                        {/* Quick conversation chips */}
                        {QUICK_CHIPS.map(p => (
                          <button
                            key={p}
                            onClick={() => engine.sendMessage(p)}
                            disabled={isGenerating}
                            style={{
                              padding: "5px 12px", borderRadius: 20, fontSize: 12,
                              fontFamily: "var(--font-display,sans-serif)", fontWeight: 500,
                              color: "rgba(255,255,255,0.45)", background: "rgb(8,18,32)",
                              border: "1px solid rgba(255,255,255,0.07)",
                              cursor: isGenerating ? "not-allowed" : "pointer",
                              opacity: isGenerating ? 0.4 : 1, transition: "all 0.15s ease",
                            }}
                            onMouseEnter={e => { if (!isGenerating) { (e.currentTarget as HTMLElement).style.borderColor = mood.accent; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"; } }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
                          >
                            {p}
                          </button>
                        ))}

                        {/* Tool dispatch chips */}
                        {TOOL_CHIPS.map(chip => (
                          <button
                            key={chip.tool}
                            onClick={() => dispatchToolChip(chip.tool)}
                            disabled={isGenerating}
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              padding: "5px 12px", borderRadius: 20, fontSize: 12,
                              fontFamily: "var(--font-display,sans-serif)", fontWeight: 600,
                              color: mood.textColor, background: mood.softBg,
                              border: `1px solid ${mood.accent}30`,
                              cursor: isGenerating ? "not-allowed" : "pointer",
                              opacity: isGenerating ? 0.4 : 1, transition: "all 0.15s ease",
                            }}
                            onMouseEnter={e => { if (!isGenerating) { (e.currentTarget as HTMLElement).style.opacity = "0.7"; } }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = isGenerating ? "0.4" : "1"; }}
                          >
                            <span>{chip.emoji}</span> {chip.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Input — always at the bottom */}
                    <ChatInput
                      engine={{
                        sendMessage:     engine.sendMessage,
                        stopGeneration:  engine.stopGeneration,
                        isGenerating:    engine.isGenerating,
                        activeSessionId: engine.activeSessionId,
                        emotion,
                        mood,
                        coinId,
                        messages:        engine.messages,
                        setMessages:     engine.setMessages,
                      }}
                    />
                  </div>

                </div>
              )}
            </div>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
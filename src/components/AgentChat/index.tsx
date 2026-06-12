"use client";

import { useState } from "react";
import { ErrorBoundary }    from "react-error-boundary";
import { ChatSidebar }      from "./ChatSidebar";
import { ChatMessageList }  from "./ChatMessageList";
import { ChatInput }        from "./ChatInput";
import { ChatDashboard }    from "./ChatDashboard";
import { useChatEngine }    from "./hooks/useChatEngine";

interface AgentChatProps {
  coinId?:  string;
  userId?:  string | null;
}

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-red-400 p-6 text-center">
      <p className="font-mono text-sm mb-2">Something went wrong in the Agent UI:</p>
      <pre className="text-xs bg-black/30 p-4 rounded-md mb-4 max-w-full overflow-auto">
        {error.message}
      </pre>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors text-xs font-mono"
      >
        Reload Interface
      </button>
    </div>
  );
}

export function AgentChat({ coinId = "bitcoin", userId = null }: AgentChatProps) {
  const [view,        setView]        = useState<"chat" | "dashboard">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const engine = useChatEngine({ coinId, userId });
  const { mood, emotion, isRestoring } = engine;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, background: "rgb(2,6,9)" }}>
      <style>{`
        @keyframes pulse { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
        @media (max-width: 640px) { .agent-mobile-menu { display: flex !important; } }
      `}</style>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="sm:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setSidebarOpen(false)}
        />
      )}

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
          startNewSession: engine.startNewSession,
          switchToSession: engine.switchToSession,
        }}
      />

      {/* Main panel */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{
          padding: "13px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgb(4,11,20)",
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0, gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="agent-mobile-menu"
              style={{
                display: "none",
                width: 36, height: 36, borderRadius: 8,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                cursor: "pointer", alignItems: "center", justifyContent: "center",
                fontSize: 16, color: "rgba(255,255,255,0.6)", flexShrink: 0,
              }}
            >
              ☰
            </button>

            {/* Mood dot */}
            <div style={{
              width: 9, height: 9, borderRadius: "50%",
              background: mood.accent,
              boxShadow: `0 0 0 3px ${mood.accent}20`,
              transition: "all 0.4s ease", flexShrink: 0,
            }} />

            <span style={{
              fontFamily: "var(--font-display,sans-serif)",
              fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.88)",
            }}>
              {coinId.charAt(0).toUpperCase() + coinId.slice(1)} Agent
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* View toggle */}
            <div style={{
              display: "flex", background: "rgb(8,18,32)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, overflow: "hidden",
            }}>
              {(["chat", "dashboard"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: "6px 13px", fontSize: 12, fontWeight: 600,
                    fontFamily: "var(--font-display,sans-serif)",
                    border: "none", cursor: "pointer",
                    background: view === v ? mood.softBg : "transparent",
                    color: view === v ? mood.textColor : "rgba(255,255,255,0.3)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {v === "chat" ? "Chat" : "Agent"}
                </button>
              ))}
            </div>

            {/* Emotion badge */}
            {emotion && view === "chat" && (
              <span style={{
                padding: "4px 11px", borderRadius: 20,
                background: mood.softBg, color: mood.textColor,
                fontSize: 12, fontWeight: 500,
                fontFamily: "var(--font-display,sans-serif)",
                border: `1px solid ${mood.accent}25`,
                transition: "all 0.4s ease",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {mood.emoji} {mood.label}
              </span>
            )}

            {/* Restoring indicator */}
            {isRestoring && (
              <span style={{
                fontSize: 11, color: "rgba(255,255,255,0.35)",
                fontFamily: "var(--font-mono)", animation: "pulse 1.5s ease-in-out infinite",
              }}>
                Connecting…
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {view === "dashboard" ? (
              <ChatDashboard engine={engine} accentColor={mood.accent} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                {/* Message list */}
                <ChatMessageList
                  engine={{
                    messages:    engine.messages,
                    isGenerating: engine.isGenerating,
                    error:       engine.error,
                    emotion,
                    mood,
                    coinId,
                  }}
                />

                {/* Input */}
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
            )}
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
}
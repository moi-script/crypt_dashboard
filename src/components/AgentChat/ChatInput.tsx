"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { type ToolResult } from "@/components/AgentToolCards";
import { MOOD, type AgentEmotion, type ChatMessage } from "./hooks/useChatEngine";

interface ChatInputProps {
  engine: {
    sendMessage:      (text: string) => Promise<void>;
    stopGeneration:   () => void;
    isGenerating:     boolean;
    activeSessionId:  string | null;
    emotion:          AgentEmotion | null;
    mood:             { accent: string; softBg: string; textColor: string; emoji: string };
    coinId?:          string;
    messages:         ChatMessage[];
    setMessages:      React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  };
}

const TOOL_CHIPS: { label: string; type: ToolResult["type"] }[] = [
  { label: "📊 Analyse",      type: "chart_analyze"      },
  { label: "🔍 Scan market",  type: "intelligence_scan"  },
  { label: "🧱 Order blocks", type: "orderblocks_active" },
  { label: "⚗️ Primitives",  type: "chart_primitives"   },
];

const QUICK_CHIPS = [
  "How are you?",
  "Run analysis",
  "Biggest risks?",
  "Buy or sell?",
];

export function ChatInput({ engine }: ChatInputProps) {
  const [text,    setText]    = useState("");
  const textareaRef           = useRef<HTMLTextAreaElement>(null);
  const { mood, isGenerating, activeSessionId, emotion, messages } = engine;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  const handleSubmit = () => {
    if (!text.trim() || isGenerating || !activeSessionId) return;
    engine.sendMessage(text);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleToolChip = (type: ToolResult["type"]) => {
    const ts = Date.now();
    const label = TOOL_CHIPS.find(c => c.type === type)?.label ?? type;
    engine.setMessages(prev => [...prev, {
      id: `tool_${ts}`,
      role: "agent",
      content: `Fetching ${label.replace(/^\S+\s*/, "")}…`,
      ts,
      emotion: emotion ?? undefined,
      toolLoading: true,
    }]);
    // We can't do the actual fetch here without apiClient — the parent handles it
    // Emit a synthetic message the parent can detect; or just send as chat
    engine.sendMessage(`__tool__:${type}`);
  };

  const canSend = text.trim() && !isGenerating && activeSessionId;
  const hasMessages = messages.length > 0;

  return (
    <div style={{ padding: "12px 16px 18px", background: "rgb(2,6,9)", flexShrink: 0 }}>

      {/* Quick chips — shown once messages exist */}
      {hasMessages && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {QUICK_CHIPS.map(p => (
            <button
              key={p}
              onClick={() => engine.sendMessage(p)}
              disabled={isGenerating}
              style={{
                padding: "5px 13px", borderRadius: 20, fontSize: 12,
                fontFamily: "var(--font-display,sans-serif)",
                fontWeight: 500, color: "rgba(255,255,255,0.5)",
                background: "rgb(8,18,32)",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: isGenerating ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
                opacity: isGenerating ? 0.5 : 1,
              }}
              onMouseEnter={e => {
                if (!isGenerating) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = mood.accent;
                  el.style.color = "rgba(255,255,255,0.85)";
                  el.style.background = mood.softBg;
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "rgba(255,255,255,0.08)";
                el.style.color = "rgba(255,255,255,0.5)";
                el.style.background = "rgb(8,18,32)";
              }}
            >
              {p}
            </button>
          ))}

          {/* Suggested prompts — shown only when no messages */}
          {!hasMessages && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["Scan market for BTC cascades", "Analyze Ethereum order blocks", "What is the current market regime?"].map(p => (
                <button
                  key={p}
                  onClick={() => engine.sendMessage(p)}
                  style={{
                    padding: "5px 13px", borderRadius: 20, fontSize: 12,
                    fontFamily: "var(--font-display,sans-serif)",
                    fontWeight: 500, color: mood.textColor,
                    background: mood.softBg,
                    border: `1px solid ${mood.accent}35`,
                    cursor: "pointer", transition: "all 0.15s ease",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main input box */}
      <div
        style={{
          display: "flex", alignItems: "flex-end", gap: 8,
          background: "rgb(8,18,32)",
          border: "1.5px solid rgba(255,255,255,0.09)",
          borderRadius: 16, padding: "6px 6px 6px 18px",
          transition: "border-color 0.2s ease",
        }}
        onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = mood.accent; }}
        onBlurCapture={e  => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)"; }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!activeSessionId || isGenerating}
          placeholder={activeSessionId ? `Ask about ${engine.coinId ?? "crypto"}…` : "Start a new session to chat."}
          rows={1}
          style={{
            flex: 1, resize: "none", background: "transparent",
            padding: "10px 0", fontSize: 15,
            color: "rgba(255,255,255,0.88)",
            fontFamily: "var(--font-display,sans-serif)",
            outline: "none", minHeight: 44, maxHeight: 140,
            lineHeight: 1.55, border: "none",
            opacity: (!activeSessionId || isGenerating) ? 0.5 : 1,
          }}
          onInput={e => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
          }}
        />

        {/* Send / Stop button */}
        {isGenerating ? (
          <button
            onClick={engine.stopGeneration}
            style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: "rgba(255,85,114,0.15)", border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "#ff5572", transition: "all 0.2s ease",
            }}
            title="Stop generating"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canSend}
            style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: canSend ? mood.accent : "rgb(12,24,42)",
              border: "none", cursor: canSend ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: canSend ? "#020609" : "rgba(255,255,255,0.25)",
              fontSize: 18, opacity: canSend ? 1 : 0.5,
              transition: "all 0.2s ease",
            }}
            title="Send"
          >
            ↑
          </button>
        )}
      </div>

      <p style={{ marginTop: 7, fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-mono)", textAlign: "center" }}>
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
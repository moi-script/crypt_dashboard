"use client";

import { useEffect, useRef } from "react";
import { AgentToolCard } from "../AgentToolCards";
import { ReportBubble }  from "../ReportBubble";
import { MOOD, type ChatMessage, type AgentEmotion } from "./hooks/useChatEngine";

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots({ color }: { color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      {[0, 1, 2].map(i => (
        <span key={i} className="animate-bounce" style={{
          width: 7, height: 7, borderRadius: "50%",
          background: color, display: "inline-block",
          animationDelay: `${i * 0.18}s`, animationDuration: "0.8s",
        }} />
      ))}
    </span>
  );
}

function tLabel(t: number) {
  return new Date(t).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

// ── Individual bubble ─────────────────────────────────────────────────────────
function Bubble({ msg, currentEmotion }: { msg: ChatMessage; currentEmotion: AgentEmotion | null }) {
  const isUser = msg.role === "user";
  const emo    = msg.emotion ?? currentEmotion;
  const mood   = emo ? MOOD[emo.emotion] : MOOD.thinking;

  return (
    <div style={{ display: "flex", gap: 10, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-start" }}>
      {/* Agent avatar */}
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: mood.softBg,
          border: `1px solid ${mood.accent}22`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, marginTop: 2, overflow: "hidden",
        }}>
          {emo?.asset ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={emo.asset}
              alt={emo.emotion}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={e => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.display = "none";
                const parent = el.parentElement;
                if (parent) parent.textContent = mood.emoji;
              }}
            />
          ) : (
            <span style={{ fontSize: 16 }}>{mood.emoji}</span>
          )}
        </div>
      )}

      <div style={{
        display: "flex", flexDirection: "column", gap: 4,
        maxWidth: "78%",
        alignItems: isUser ? "flex-end" : "flex-start",
        width: (msg.report || msg.toolResult) ? "100%" : undefined,
      }}>
        {/* Text bubble */}
        {(msg.content || msg.isStreaming) && (
          <div style={{
            padding: "12px 16px",
            fontSize: 14,
            lineHeight: 1.7,
            fontFamily: "var(--font-display,sans-serif)",
            ...(isUser ? {
              background: "rgb(14,28,48)",
              color: "rgba(255,255,255,0.88)",
              borderRadius: "18px 18px 4px 18px",
              border: "1px solid rgba(255,255,255,0.12)",
            } : {
              background: "rgb(8,18,32)",
              color: "rgba(255,255,255,0.72)",
              borderRadius: "18px 18px 18px 4px",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            }),
          }}>
            {msg.content.split("\n").map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
            {msg.isStreaming && (
              <span
                className="inline-block ml-1 align-middle"
                style={{ width: 6, height: 14, background: mood.accent, animation: "pulse 1s ease-in-out infinite" }}
              />
            )}
          </div>
        )}

        {/* Tool loading state */}
        {!isUser && msg.toolLoading && (
          <div style={{
            marginTop: 6, padding: "10px 14px", borderRadius: 10,
            background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{
              display: "inline-block", width: 12, height: 12,
              border: `2px solid ${mood.softBg}`, borderTopColor: mood.accent,
              borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0,
            }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
              Fetching data…
            </span>
          </div>
        )}

        {/* Tool result card */}
        {!isUser && msg.toolResult && (
          <div style={{ width: "100%", marginTop: 6 }}>
            <AgentToolCard result={msg.toolResult} accentColor={mood.accent} />
          </div>
        )}

        {/* Analysis report */}
        {!isUser && msg.report && (
          <div style={{ width: "100%", marginTop: 6 }}>
            <ReportBubble report={msg.report} />
          </div>
        )}

        {/* Timestamp + emotion label */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, color: "rgba(255,255,255,0.25)",
          fontFamily: "var(--font-mono)",
          padding: "0 4px",
          flexDirection: isUser ? "row-reverse" : "row",
        }}>
          <span>{tLabel(msg.ts)}</span>
          {!isUser && emo && (
            <span style={{ color: mood.textColor, opacity: 0.7 }}>
              {mood.emoji} {mood.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface ChatMessageListProps {
  engine: {
    messages:    ChatMessage[];
    isGenerating: boolean;
    error:       string | null;
    emotion:     AgentEmotion | null;
    mood:        { accent: string; emoji: string; softBg: string };
    coinId?:     string;
  };
}

const PROMPTS = [
  "How are you feeling about the market today?",
  "Should I buy right now?",
  "What risks should I be aware of?",
  "Is this a good time to sell?",
  "Run a full analysis for me",
];

export function ChatMessageList({ engine }: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [engine.messages, engine.isGenerating]);

  const { messages, isGenerating, error, emotion, mood } = engine;
  const isEmpty = messages.length === 0 && !isGenerating;

  return (
    <div
      ref={scrollRef}
      style={{ flex: 1, overflowY: "auto", padding: "24px 20px 8px", display: "flex", flexDirection: "column", gap: 18, minHeight: 0 }}
    >
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>

      {/* Empty state */}
      {isEmpty && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14, textAlign: "center" }}>
          <span style={{ fontSize: 52, lineHeight: 1 }}>{mood.emoji}</span>
          <div>
            <p style={{ fontFamily: "var(--font-display,sans-serif)", fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 8px" }}>
              Hey! I'm your market agent.
            </p>
            <p style={{ fontFamily: "var(--font-display,sans-serif)", fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, maxWidth: 280, margin: 0 }}>
              Ask me anything about {engine.coinId?.toUpperCase() ?? "crypto"} — I'll give you my honest take.
            </p>
          </div>
        </div>
      )}

      {/* Message list */}
      {messages.map((msg, i) => (
        <Bubble key={`${msg.id ?? msg.ts}-${i}`} msg={msg} currentEmotion={emotion} />
      ))}

      {/* Generating indicator */}
      {isGenerating && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: mood.softBg, border: `1px solid ${mood.accent}22`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, flexShrink: 0,
          }}>
            {mood.emoji}
          </div>
          <div style={{
            padding: "12px 18px", background: "rgb(8,18,32)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "18px 18px 18px 4px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <TypingDots color={mood.accent} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 12,
          background: "rgba(255,85,114,0.07)", border: "1px solid rgba(255,85,114,0.2)",
          fontSize: 14, color: "#ff5572",
          fontFamily: "var(--font-display,sans-serif)", lineHeight: 1.5,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <span>{error}</span>
          <button
            onClick={() => window.location.reload()}
            style={{ fontSize: 11, color: "#ff5572", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}
          >
            RELOAD
          </button>
        </div>
      )}

      <div id="chat-scroll-anchor" />
    </div>
  );
}
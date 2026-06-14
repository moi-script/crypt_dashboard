"use client";

import { useEffect, useRef } from "react";
import { AgentToolCard } from "../AgentToolCards";
import { ReportBubble }  from "../ReportBubble";
import { MOOD, type ChatMessage, type AgentEmotion, type ClarificationOption, type PendingToolIntent } from "./hooks/useChatEngine";

function tLabel(t: number) {
  return new Date(t).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

function ClarificationPanel({
  msgId, question, options, toolIntent, accentColor, onPick,
}: {
  msgId: string; question: string; options: ClarificationOption[];
  toolIntent: PendingToolIntent; accentColor: string;
  onPick: (msgId: string, intent: PendingToolIntent, field: "symbol" | "coinId" | "timeframe", value: string) => void;
}) {
  const field: "symbol" | "coinId" | "timeframe" =
    !toolIntent.symbol ? "symbol" : !toolIntent.coinId ? "coinId" : "timeframe";

  return (
    <div style={{ marginTop: 8, padding: "14px 16px", borderRadius: 14, background: "rgb(8,18,32)", border: `1px solid ${accentColor}25` }}>
      <p style={{ fontFamily: "var(--font-display,sans-serif)", fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "0 0 10px", lineHeight: 1.5 }}>
        {question}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onPick(msgId, toolIntent, field, opt.value)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "7px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
              fontFamily: "var(--font-display,sans-serif)",
              color: accentColor, background: `${accentColor}12`,
              border: `1px solid ${accentColor}35`, cursor: "pointer", transition: "all 0.15s ease",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${accentColor}22`; (e.currentTarget as HTMLElement).style.borderColor = accentColor; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${accentColor}12`; (e.currentTarget as HTMLElement).style.borderColor = `${accentColor}35`; }}
          >
            {opt.emoji && <span style={{ fontSize: 14 }}>{opt.emoji}</span>}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({
  msg, currentEmotion, onClarificationPick,
}: {
  msg: ChatMessage; currentEmotion: AgentEmotion | null;
  onClarificationPick: (msgId: string, intent: PendingToolIntent, field: "symbol" | "coinId" | "timeframe", value: string) => void;
}) {
  const isUser = msg.role === "user";
  const emo    = msg.emotion ?? currentEmotion;
  const mood   = emo ? MOOD[emo.emotion] : MOOD.thinking;

  return (
    <div style={{ display: "flex", gap: 10, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-start" }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: "50%", background: mood.softBg,
          border: `1px solid ${mood.accent}22`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, marginTop: 2, overflow: "hidden",
        }}>
          {emo?.asset ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={emo.asset} alt={emo.emotion}
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
        width: (msg.report || msg.toolResult || msg.clarification) ? "100%" : undefined,
      }}>
        {(msg.content || msg.isStreaming) && (
          <div style={{
            padding: "12px 16px", fontSize: 14, lineHeight: 1.7,
            fontFamily: "var(--font-display,sans-serif)",
            ...(isUser ? {
              background: "rgb(14,28,48)", color: "rgba(255,255,255,0.88)",
              borderRadius: "18px 18px 4px 18px", border: "1px solid rgba(255,255,255,0.12)",
            } : {
              background: "rgb(8,18,32)", color: "rgba(255,255,255,0.72)",
              borderRadius: "18px 18px 18px 4px", border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            }),
          }}>
            {msg.content.split("\n").map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
            {msg.isStreaming && (
              <span className="inline-block ml-1 align-middle"
                style={{ width: 6, height: 14, background: mood.accent, animation: "pulse 1s ease-in-out infinite" }}
              />
            )}
          </div>
        )}

        {!isUser && msg.clarification && (
          <ClarificationPanel
            msgId={msg.id} question={msg.clarification.question}
            options={msg.clarification.options} toolIntent={msg.clarification.toolIntent}
            accentColor={mood.accent} onPick={onClarificationPick}
          />
        )}

        {!isUser && msg.toolLoading && !msg.clarification && (
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

        {!isUser && msg.toolResult && (
          <div style={{ width: "100%", marginTop: 6 }}>
            <AgentToolCard result={msg.toolResult} accentColor={mood.accent} />
          </div>
        )}

        {!isUser && msg.report && (
          <div style={{ width: "100%", marginTop: 6 }}>
            <ReportBubble report={msg.report} />
          </div>
        )}

        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, color: "rgba(255,255,255,0.25)",
          fontFamily: "var(--font-mono)", padding: "0 4px",
          flexDirection: isUser ? "row-reverse" : "row",
        }}>
          <span>{tLabel(msg.ts)}</span>
          {!isUser && emo && (
            <span style={{ color: mood.textColor, opacity: 0.7 }}>{mood.emoji} {mood.label}</span>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChatMessageListProps {
  engine: {
    messages:     ChatMessage[];
    isGenerating: boolean;
    error:        string | null;
    emotion:      AgentEmotion | null;
    mood:         { accent: string; emoji: string; softBg: string };
    coinId?:      string;
    resolveClarification: (msgId: string, intent: PendingToolIntent, field: "symbol" | "coinId" | "timeframe", value: string) => void;
  };
}

export function ChatMessageList({ engine }: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [engine.messages, engine.isGenerating]);

  const { messages, error, emotion, mood } = engine;
  const isEmpty = messages.length === 0;

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1, overflowY: "auto",
        padding: "24px 20px 8px",
        display: "flex", flexDirection: "column", gap: 18, minHeight: 0,
        /* Dark thin scrollbar */
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.08) transparent",
      }}
    >
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }

        /* Dark scrollbar — webkit */
        .agent-msg-list::-webkit-scrollbar { width: 4px; }
        .agent-msg-list::-webkit-scrollbar-track { background: transparent; }
        .agent-msg-list::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 4px;
        }
        .agent-msg-list::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.15);
        }
      `}</style>

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

      {messages.map((msg, i) => (
        <Bubble
          key={`${msg.id ?? msg.ts}-${i}`}
          msg={msg}
          currentEmotion={emotion}
          onClarificationPick={engine.resolveClarification}
        />
      ))}

      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 12,
          background: "rgba(255,85,114,0.07)", border: "1px solid rgba(255,85,114,0.2)",
          fontSize: 14, color: "#ff5572",
          fontFamily: "var(--font-display,sans-serif)", lineHeight: 1.5,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <span>{error}</span>
          <button onClick={() => window.location.reload()}
            style={{ fontSize: 11, color: "#ff5572", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}>
            RELOAD
          </button>
        </div>
      )}

      <div id="chat-scroll-anchor" />
    </div>
  );
}
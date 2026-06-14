"use client";

import { useState, useEffect } from "react";
import { MOOD, type SessionListItem, type AgentEmotion } from "./hooks/useChatEngine";

function dateLabel(ms: number) {
  const diffDays = Math.floor((Date.now() - ms) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return new Date(ms).toLocaleDateString("en-GB", { weekday: "short" });
  return new Date(ms).toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

interface ChatSidebarProps {
  isOpen:  boolean;
  onClose: () => void;
  coinId:  string;
  engine: {
    sessions:         SessionListItem[];
    activeSessionId:  string | null;
    emotion:          AgentEmotion | null;
    mood:             { accent: string; softBg: string; textColor: string; label: string; emoji: string };
    isGenerating:     boolean;
    deleteSession: (sid: string) => Promise<void>;
    startNewSession:  () => void;
    switchToSession:  (id: string) => void;
  };
}

export function ChatSidebar({ isOpen, onClose, coinId, engine }: ChatSidebarProps) {
  const { sessions, activeSessionId, emotion, mood, isGenerating, startNewSession, switchToSession } = engine;
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => setImgErr(false), [emotion?.asset]);

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
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.6)" }}
          className="sm:hidden"
        />
      )}

      <style>{`
        @media (max-width: 640px) {
          .agent-sidebar {
            position: fixed !important;
            left: 0 !important; top: 0 !important; bottom: 0 !important;
            z-index: 50;
            transform: translateX(-100%);
            transition: transform 0.25s ease !important;
            width: 80vw !important; max-width: 300px !important;
          }
          .agent-sidebar.open { transform: translateX(0); }
        }
      `}</style>

      <div
        className={`agent-sidebar${isOpen ? " open" : ""}`}
        style={{
          width: 240, flexShrink: 0,
          display: "flex", flexDirection: "column",
          background: "rgb(4,11,20)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          transition: "transform 0.25s ease",
        }}
      >
        {/* Mood accent strip */}
        <div style={{ height: 3, background: mood.accent, transition: "background 0.5s ease", flexShrink: 0 }} />

        {/* Avatar + emotion section */}
        <div style={{
          padding: "22px 18px 16px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          flexShrink: 0,
        }}>
          {/* Avatar circle */}
          <div style={{
            width: 84, height: 84, borderRadius: "50%", overflow: "hidden",
            background: mood.softBg,
            boxShadow: `0 6px 28px ${mood.accent}28, 0 0 0 1px ${mood.accent}18`,
            transition: "box-shadow 0.5s ease",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            {!imgErr && emotion?.asset ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={emotion.asset}
                alt={emotion.emotion}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={() => setImgErr(true)}
              />
            ) : (
              <span style={{ fontSize: 38, lineHeight: 1 }}>{mood.emoji}</span>
            )}
          </div>

          {/* Mood badge */}
          <span style={{
            padding: "4px 12px", borderRadius: 20,
            background: mood.softBg, color: mood.textColor,
            fontSize: 12, fontWeight: 600, fontFamily: "var(--font-display,sans-serif)",
            border: `1px solid ${mood.accent}30`,
          }}>
            {mood.label}
          </span>

          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-display,sans-serif)", margin: 0, textAlign: "center" }}>
            Watching <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{coinId.toUpperCase()}</span>
          </p>

          {/* Emotion message quote */}
          {emotion && (
            <div style={{
              width: "100%", padding: "9px 11px", borderRadius: 10,
              background: mood.softBg, border: `1px solid ${mood.accent}18`,
            }}>
              <p style={{
                fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.55)",
                fontFamily: "var(--font-display,sans-serif)", margin: 0, fontStyle: "italic",
              }}>
                "{emotion.message.slice(0, 70)}{emotion.message.length > 70 ? "…" : ""}"
              </p>
            </div>
          )}

          {/* Intensity dots */}
          {emotion && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-display,sans-serif)" }}>Intensity</span>
              <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
                {[1, 2, 3].map(n => (
                  <div key={n} style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: (
                      n === 1 ||
                      (n === 2 && (emotion.intensity === "medium" || emotion.intensity === "high")) ||
                      (n === 3 && emotion.intensity === "high")
                    ) ? mood.accent : "rgba(255,255,255,0.12)",
                    transition: "background 0.3s ease",
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ padding: "14px 14px 10px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 7 }}>
          <button
            onClick={() => { startNewSession(); onClose(); }}
            disabled={isGenerating}
            style={{
              width: "100%", padding: "10px 0", borderRadius: 10,
              fontSize: 13, fontWeight: 600, fontFamily: "var(--font-display,sans-serif)",
              color: "rgba(255,255,255,0.65)",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              cursor: isGenerating ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              opacity: isGenerating ? 0.5 : 1, transition: "all 0.15s ease",
            }}
          >
            <span style={{ fontSize: 14 }}>✦</span> New Chat
          </button>
        </div>

        {/* Session list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 10px 16px", display: "flex", flexDirection: "column", gap: 0 }}>
          {sessions.length === 0 ? (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 16, fontFamily: "var(--font-display,sans-serif)" }}>
              No past sessions yet
            </p>
          ) : (
            grouped.map(group => (
              <div key={group.label}>
                <p style={{
                  fontSize: 11, color: "rgba(255,255,255,0.28)",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  padding: "10px 6px 4px", margin: 0,
                  fontFamily: "var(--font-display,sans-serif)",
                }}>
                  {group.label}
                </p>

                {group.items.map(s => {
                  const isActive = s.sessionId === activeSessionId;
                  const emo      = s.currentEmotion;
                  const m        = emo ? MOOD[emo.emotion] : MOOD.thinking;

                  return (
                    <div
                      key={s.sessionId}
                      style={{
                        borderRadius: 10,
                        background: isActive ? `${m.accent}12` : "transparent",
                        border: `1px solid ${isActive ? m.accent + "30" : "transparent"}`,
                        marginBottom: 3, transition: "all 0.15s ease", overflow: "hidden",
                      }}
                    >
                      <button
                        onClick={() => { switchToSession(s.sessionId); onClose(); }}
                        style={{
                          width: "100%", padding: "10px 10px",
                          background: "transparent", border: "none",
                          cursor: "pointer", textAlign: "left",
                          display: "flex", alignItems: "flex-start", gap: 9,
                        }}
                      >
                        {/* Session emotion image or emoji */}
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%", overflow: "hidden",
                          background: m.softBg, border: `1px solid ${m.accent}22`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, marginTop: 1, fontSize: 12,
                        }}>
                          {emo?.asset ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={emo.asset}
                              alt={emo.emotion}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            m.emoji
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                            <span style={{
                              fontSize: 11, color: m.textColor, fontWeight: 600,
                              background: `${m.accent}14`, padding: "1px 6px",
                              borderRadius: 4, letterSpacing: "0.03em",
                            }}>
                              {s.coinId.toUpperCase()}
                            </span>
                            {s.messageCount !== undefined && (
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginLeft: "auto" }}>
                                {s.messageCount}m
                              </span>
                            )}
                          </div>
                          <p style={{
                            fontFamily: "var(--font-display,sans-serif)", fontSize: 12,
                            color: isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)",
                            lineHeight: 1.45, margin: 0,
                            overflow: "hidden", textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            fontWeight: isActive ? 500 : 400,
                          }}>
                            {s.lastMessage ?? "New conversation"}
                          </p>
                        </div>
                      </button>

                       <button
    onClick={async (e) => {
      e.stopPropagation();
      if (confirm("Delete this session?")) {
        await engine.deleteSession(s.sessionId);
      }
    }}
    style={{
      flexShrink: 0, width: 24, height: 24, marginRight: 4,
      background: "transparent", border: "none", cursor: "pointer",
      color: "rgba(255,255,255,0.25)", fontSize: 14,
    }}
    title="Delete session"
  >
    ×
  </button>


                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {/* <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5a0", opacity: 0.6, animation: "pulse 2s ease-in-out infinite" }} />
            Conversation
          </div>
        </div> */}
      </div>
    </>
  );
}
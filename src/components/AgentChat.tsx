"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { apiClient } from "@/services/api.client";
import { clsx } from "@/lib/format";

// ── Types ─────────────────────────────────────────────────────────────────────

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
}

interface ChatResponse {
  sessionId:       string;
  content:         string;
  emotion:         AgentEmotion;
  suggestAnalysis: boolean;
  suggestAlert:    boolean;
  history:         ChatMessage[];
}

// ── Emotion config ────────────────────────────────────────────────────────────

const EMOTION_CONFIG: Record<EmotionType, {
  color:     string;
  glow:      string;
  border:    string;
  label:     string;
  bgPulse:   string;
  scanline:  string;
}> = {
  happy: {
    color:    "#00e08a",
    glow:     "rgba(0,224,138,0.4)",
    border:   "rgba(0,224,138,0.6)",
    label:    "HAPPY",
    bgPulse:  "rgba(0,224,138,0.05)",
    scanline: "rgba(0,224,138,0.03)",
  },
  depressed: {
    color:    "#36b6ff",
    glow:     "rgba(54,182,255,0.3)",
    border:   "rgba(54,182,255,0.5)",
    label:    "DEPRESSED",
    bgPulse:  "rgba(54,182,255,0.04)",
    scanline: "rgba(54,182,255,0.03)",
  },
  nervous: {
    color:    "#ffb020",
    glow:     "rgba(255,176,32,0.35)",
    border:   "rgba(255,176,32,0.55)",
    label:    "NERVOUS",
    bgPulse:  "rgba(255,176,32,0.05)",
    scanline: "rgba(255,176,32,0.03)",
  },
  frustrated: {
    color:    "#ff4d5e",
    glow:     "rgba(255,77,94,0.4)",
    border:   "rgba(255,77,94,0.6)",
    label:    "FRUSTRATED",
    bgPulse:  "rgba(255,77,94,0.05)",
    scanline: "rgba(255,77,94,0.03)",
  },
  shocked: {
    color:    "#b388ff",
    glow:     "rgba(179,136,255,0.45)",
    border:   "rgba(179,136,255,0.65)",
    label:    "SHOCKED",
    bgPulse:  "rgba(179,136,255,0.06)",
    scanline: "rgba(179,136,255,0.03)",
  },
  thinking: {
    color:    "#6b7785",
    glow:     "rgba(107,119,133,0.3)",
    border:   "rgba(107,119,133,0.5)",
    label:    "THINKING",
    bgPulse:  "rgba(107,119,133,0.04)",
    scanline: "rgba(107,119,133,0.02)",
  },
};

// ── Quick prompt suggestions ──────────────────────────────────────────────────

const QUICK_PROMPTS = [
  "How are you feeling about the market today?",
  "Should I buy Bitcoin right now?",
  "What's your analysis on Ethereum?",
  "Is this a good time to sell?",
  "What are the biggest risks right now?",
  "Run a full analysis for me",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full animate-bounce"
          style={{
            backgroundColor: color,
            animationDelay: `${i * 0.15}s`,
            animationDuration: "0.8s",
          }}
        />
      ))}
    </span>
  );
}

// ── Emotion avatar panel ──────────────────────────────────────────────────────

function EmotionAvatar({
  emotion,
  coinId,
}: {
  emotion: AgentEmotion | null;
  coinId:  string;
}) {
  const cfg = emotion ? EMOTION_CONFIG[emotion.emotion] : EMOTION_CONFIG.thinking;
  const [imgError, setImgError] = useState(false);

  // Reset error when emotion changes
  useEffect(() => setImgError(false), [emotion?.asset]);

  return (
    <div className="flex flex-col gap-3">

      {/* Avatar frame */}
      <div
        className="relative overflow-hidden"
        style={{
          border: `1px solid ${cfg.border}`,
          boxShadow: `0 0 24px ${cfg.glow}, inset 0 0 24px ${cfg.bgPulse}`,
        }}
      >
        {/* Scanline overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              ${cfg.scanline} 0px,
              ${cfg.scanline} 1px,
              transparent 1px,
              transparent 3px
            )`,
          }}
        />

        {/* Corner brackets */}
        {["tl","tr","bl","br"].map((pos) => (
          <span
            key={pos}
            className="absolute z-20 h-3 w-3"
            style={{
              top:    pos.startsWith("t") ? 6  : "auto",
              bottom: pos.startsWith("b") ? 6  : "auto",
              left:   pos.endsWith("l")   ? 6  : "auto",
              right:  pos.endsWith("r")   ? 6  : "auto",
              borderTop:    pos.startsWith("t") ? `1px solid ${cfg.color}` : "none",
              borderBottom: pos.startsWith("b") ? `1px solid ${cfg.color}` : "none",
              borderLeft:   pos.endsWith("l")   ? `1px solid ${cfg.color}` : "none",
              borderRight:  pos.endsWith("r")   ? `1px solid ${cfg.color}` : "none",
            }}
          />
        ))}

        {/* Emotion image */}
        <div className="relative aspect-square w-full bg-void overflow-hidden">
          {!imgError && emotion?.asset ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={emotion.asset}
              alt={emotion.emotion}
              className="h-full w-full object-cover transition-opacity duration-500"
              onError={() => setImgError(true)}
            />
          ) : (
            /* Placeholder when no image / error */
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-2"
              style={{ background: `radial-gradient(circle at center, ${cfg.bgPulse} 0%, transparent 70%)` }}
            >
              <span className="font-mono text-5xl select-none" style={{ color: cfg.color, filter: `drop-shadow(0 0 12px ${cfg.glow})` }}>
                {emotion?.emotion === "happy"      ? "◉" :
                 emotion?.emotion === "depressed"  ? "◎" :
                 emotion?.emotion === "nervous"    ? "◈" :
                 emotion?.emotion === "frustrated" ? "◆" :
                 emotion?.emotion === "shocked"    ? "◇" :
                                                    "◌"}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.3em]" style={{ color: cfg.color, opacity: 0.6 }}>
                {emotion?.emotion ?? "idle"}
              </span>
            </div>
          )}
        </div>

        {/* Emotion label bar */}
        <div
          className="px-3 py-1.5 flex items-center justify-between"
          style={{ background: `linear-gradient(90deg, ${cfg.bgPulse} 0%, transparent 100%)`, borderTop: `1px solid ${cfg.border}` }}
        >
          <span className="font-mono text-[9px] uppercase tracking-[0.25em]" style={{ color: cfg.color }}>
            ● {cfg.label}
          </span>
          {emotion && (
            <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: cfg.color, opacity: 0.5 }}>
              {emotion.intensity}
            </span>
          )}
        </div>
      </div>

      {/* Status panel */}
      <div
        className="p-3 space-y-2"
        style={{ border: `1px solid ${cfg.border}`, background: `${cfg.bgPulse}` }}
      >
        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
          Agent // {coinId.toUpperCase()}
        </div>
        {emotion ? (
          <>
            <p className="font-mono text-[11px] leading-relaxed" style={{ color: cfg.color }}>
              "{emotion.message}"
            </p>
            <div className="font-mono text-[9px] text-faint leading-relaxed">
              {emotion.reason}
            </div>
          </>
        ) : (
          <p className="font-mono text-[11px] text-muted">
            Initialising agent...
          </p>
        )}
      </div>

      {/* Intensity meter */}
      {emotion && (
        <div className="space-y-1">
          <div className="flex justify-between font-mono text-[9px] uppercase tracking-wider text-faint">
            <span>Intensity</span>
            <span style={{ color: cfg.color }}>{emotion.intensity.toUpperCase()}</span>
          </div>
          <div className="h-1 w-full bg-void overflow-hidden" style={{ border: `1px solid ${cfg.border}` }}>
            <div
              className="h-full transition-all duration-700"
              style={{
                width: emotion.intensity === "low" ? "33%" : emotion.intensity === "medium" ? "66%" : "100%",
                background: `linear-gradient(90deg, ${cfg.color}88, ${cfg.color})`,
                boxShadow: `0 0 8px ${cfg.glow}`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  emotion,
}: {
  message: ChatMessage;
  emotion: AgentEmotion | null;
}) {
  const isUser  = message.role === "user";
  const msgEmo  = message.emotion ?? emotion;
  const cfg     = msgEmo ? EMOTION_CONFIG[msgEmo.emotion] : EMOTION_CONFIG.thinking;

  return (
    <div className={clsx("flex gap-3 group", isUser && "flex-row-reverse")}>

      {/* Role indicator */}
      <div className="flex-shrink-0 mt-1">
        {isUser ? (
          <div className="h-6 w-6 grid place-items-center border border-line bg-elev font-mono text-[8px] uppercase tracking-wider text-muted">
            YOU
          </div>
        ) : (
          <div
            className="h-6 w-6 grid place-items-center font-mono text-[8px]"
            style={{ border: `1px solid ${cfg.border}`, color: cfg.color, background: cfg.bgPulse }}
          >
            AI
          </div>
        )}
      </div>

      {/* Bubble */}
      <div className={clsx("flex-1 space-y-1", isUser && "items-end flex flex-col")}>
        <div
          className={clsx(
            "inline-block max-w-[85%] px-3 py-2.5 font-mono text-[12px] leading-relaxed",
            isUser
              ? "bg-elev border border-line text-ink"
              : "text-ink-soft",
          )}
          style={!isUser ? {
            border:     `1px solid ${cfg.border}`,
            background: cfg.bgPulse,
            boxShadow:  `0 0 12px ${cfg.glow}20`,
          } : {}}
        >
          {/* Agent emotion tag */}
          {!isUser && message.emotion && (
            <div
              className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.2em]"
              style={{ color: cfg.color, opacity: 0.7 }}
            >
              [{EMOTION_CONFIG[message.emotion.emotion].label}]
            </div>
          )}
          {message.content}
        </div>

        {/* Timestamp */}
        <div className="font-mono text-[9px] text-faint px-1">
          {timeLabel(message.ts)}
        </div>
      </div>
    </div>
  );
}

// ── Main Agent Chat component ─────────────────────────────────────────────────

export function AgentChat({ coinId = "bitcoin" }: { coinId?: string }) {
  const [sessionId]    = useState(() => generateSessionId());
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [emotion,   setEmotion]   = useState<AgentEmotion | null>(null);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [showPrompts, setShowPrompts] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  const cfg = emotion ? EMOTION_CONFIG[emotion.emotion] : EMOTION_CONFIG.thinking;

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      role:    "user",
      content: text.trim(),
      ts:      Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);
    setShowPrompts(false);

    try {
      const res = await apiClient.post<ChatResponse>("/agent/chat", {
        sessionId,
        message: text.trim(),
        coinId,
      });

      setEmotion(res.emotion);
      setMessages(res.history);

      // If analysis suggested, add a system-style hint
      if (res.suggestAnalysis) {
        setMessages(prev => [
          ...prev,
          {
            role:    "agent",
            content: "💡 Tip: I can run a full technical analysis on this coin. Just say 'run analysis' or click the button below.",
            emotion: res.emotion,
            ts:      Date.now() + 1,
          },
        ]);
      }
    } catch (err: any) {
      setError(err.message ?? "Connection failed");
      // Remove optimistic user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, sessionId, coinId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const runAnalysis = async () => {
    try {
      setLoading(true);
      // Notify agent we're analysing
      await apiClient.post("/agent/chat", {
        sessionId,
        message:     "Running analysis now...",
        coinId,
        isAnalysing: true,
      });
      // Trigger actual analysis
      await apiClient.post(`/analysis/${coinId}/run`, { sessionId });
      // Fetch updated response
      const res = await apiClient.post<ChatResponse>("/agent/chat", {
        sessionId,
        message: "Analysis complete. What did you find?",
        coinId,
      });
      setEmotion(res.emotion);
      setMessages(res.history);
    } catch (err: any) {
      setError(err.message ?? "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 overflow-hidden"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
    >

      {/* ── LEFT — Emotion avatar ─────────────────────────────────────────── */}
      <div
        className="w-52 flex-shrink-0 flex flex-col gap-0 border-r overflow-y-auto"
        style={{
          borderColor: cfg.border,
          background:  `linear-gradient(180deg, #0a0e14 0%, #0d1117 100%)`,
        }}
      >
        {/* Header */}
        <div
          className="px-3 py-2 flex items-center gap-2 border-b"
          style={{ borderColor: cfg.border, background: cfg.bgPulse }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }}
          />
          <span className="font-mono text-[9px] uppercase tracking-[0.25em]" style={{ color: cfg.color }}>
            Agent Status
          </span>
        </div>

        <div className="p-3 flex-1">
          <EmotionAvatar emotion={emotion} coinId={coinId} />
        </div>

        {/* Run analysis button */}
        <div className="p-3 border-t" style={{ borderColor: cfg.border }}>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="w-full py-2 font-mono text-[9px] uppercase tracking-[0.2em] transition-all disabled:opacity-40"
            style={{
              border:     `1px solid ${cfg.border}`,
              color:      cfg.color,
              background: cfg.bgPulse,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 12px ${cfg.glow}`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            {loading ? "Processing..." : "▶ Run Analysis"}
          </button>
        </div>
      </div>

      {/* ── RIGHT — Chat area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 bg-bg">

        {/* Chat header */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
          style={{ borderColor: cfg.border, background: `linear-gradient(90deg, ${cfg.bgPulse}, transparent)` }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full" style={{ background: cfg.color, boxShadow: `0 0 4px ${cfg.color}` }} />
              <span className="h-1 w-1 rounded-full bg-line" />
              <span className="h-1 w-1 rounded-full bg-line" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              AGENT // {coinId.toUpperCase()} TERMINAL
            </span>
          </div>
          <div className="flex items-center gap-2">
            {emotion && (
              <span
                className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 border"
                style={{ color: cfg.color, borderColor: cfg.border, background: cfg.bgPulse }}
              >
                {cfg.label}
              </span>
            )}
            <span className="font-mono text-[9px] text-faint">
              {messages.length} msg{messages.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

          {/* Welcome / empty state */}
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
              <div className="text-center space-y-2">
                <div
                  className="font-mono text-xs uppercase tracking-[0.3em] mb-1"
                  style={{ color: cfg.color }}
                >
                  ◈ Agent Online
                </div>
                <p className="font-mono text-[11px] text-muted max-w-xs text-center leading-relaxed">
                  I analyse market conditions and respond based on how the data makes me feel.
                  Ask me anything about {coinId.toUpperCase()}.
                </p>
              </div>

              {/* Decorative line */}
              <div className="w-16 h-px" style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)` }} />
            </div>
          )}

          {/* Quick prompts — shown until first message */}
          {showPrompts && messages.length === 0 && (
            <div className="space-y-2">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint px-1 mb-3">
                // Suggested prompts
              </div>
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  className="w-full text-left px-3 py-2 font-mono text-[11px] text-muted transition-all group"
                  style={{ border: "1px solid rgba(107,119,133,0.2)" }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = cfg.border;
                    (e.currentTarget as HTMLButtonElement).style.color = cfg.color;
                    (e.currentTarget as HTMLButtonElement).style.background = cfg.bgPulse;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(107,119,133,0.2)";
                    (e.currentTarget as HTMLButtonElement).style.color = "";
                    (e.currentTarget as HTMLButtonElement).style.background = "";
                  }}
                >
                  <span className="text-faint mr-2">{String(i + 1).padStart(2, "0")}.</span>
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => (
            <MessageBubble key={`${msg.ts}-${i}`} message={msg} emotion={emotion} />
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-3">
              <div
                className="h-6 w-6 grid place-items-center font-mono text-[8px] flex-shrink-0 mt-1"
                style={{ border: `1px solid ${cfg.border}`, color: cfg.color, background: cfg.bgPulse }}
              >
                AI
              </div>
              <div
                className="px-3 py-2.5 inline-flex items-center gap-2"
                style={{ border: `1px solid ${cfg.border}`, background: cfg.bgPulse }}
              >
                <span className="font-mono text-[10px]" style={{ color: cfg.color, opacity: 0.6 }}>
                  thinking
                </span>
                <TypingDots color={cfg.color} />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-2 border border-down/40 bg-down/5 font-mono text-[11px] text-down">
              ✕ {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input area ──────────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 border-t p-3 space-y-2"
          style={{ borderColor: cfg.border, background: `linear-gradient(0deg, ${cfg.bgPulse}, transparent)` }}
        >
          {/* Quick re-prompts after conversation starts */}
          {messages.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {["How are you?", "Run analysis", "What's the risk?", "Buy or sell?"].map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  disabled={loading}
                  className="px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-faint transition-all disabled:opacity-30"
                  style={{ border: "1px solid rgba(107,119,133,0.2)" }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = cfg.border;
                    (e.currentTarget as HTMLButtonElement).style.color = cfg.color;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(107,119,133,0.2)";
                    (e.currentTarget as HTMLButtonElement).style.color = "";
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Text input */}
          <div
            className="flex gap-2 items-end"
            style={{
              border:     `1px solid ${cfg.border}`,
              boxShadow:  `0 0 8px ${cfg.glow}20`,
              background: "rgba(10,14,20,0.8)",
            }}
          >
            <div className="flex-shrink-0 px-3 py-2.5 font-mono text-[10px]" style={{ color: cfg.color, opacity: 0.5 }}>
              $
            </div>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder={`Message the agent about ${coinId}...`}
              rows={1}
              className="flex-1 resize-none bg-transparent py-2.5 pr-2 font-mono text-[12px] text-ink outline-none placeholder:text-faint disabled:opacity-50"
              style={{
                minHeight: "40px",
                maxHeight: "120px",
                overflow:  "hidden",
              }}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider transition-all disabled:opacity-30"
              style={{ color: cfg.color }}
              onMouseEnter={e => {
                if (!e.currentTarget.disabled) {
                  (e.currentTarget as HTMLButtonElement).style.background = cfg.bgPulse;
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "";
              }}
            >
              SEND ↵
            </button>
          </div>

          <div className="flex justify-between font-mono text-[9px] text-faint px-1">
            <span>↵ send · shift+↵ newline</span>
            <span style={{ color: cfg.color, opacity: 0.5 }}>
              session: {sessionId.slice(-8)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
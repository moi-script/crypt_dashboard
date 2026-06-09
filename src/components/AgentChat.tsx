"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { apiClient } from "@/services/api.client";
import { ReportBubble, type AnalysisReport } from "@/components/ReportBubble";
import { useAgentSession, type AgentEmotion, type SessionListItem } from "@/hooks/useAgentSession";
import {
  agentService,
  type AgentRun,
  type AgentRunStats,
  type AgentConfig,
  type Position,
  type DailyPnl,
  type PnlSummary,
  type Opportunity,
} from "@/services/agent.service.frontend";

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
  happy:      { accent: "#00e5a0", softBg: "rgba(0,229,160,0.08)",   textColor: "#00e5a0",      label: "Feeling good",     emoji: "😊" },
  depressed:  { accent: "#36b6ff", softBg: "rgba(54,182,255,0.08)",  textColor: "#60a5fa",       label: "A bit down",       emoji: "😔" },
  nervous:    { accent: "#ffb020", softBg: "rgba(255,176,32,0.08)",  textColor: "#ffb020",       label: "A little nervous", emoji: "😬" },
  frustrated: { accent: "#ff5572", softBg: "rgba(255,85,114,0.08)",  textColor: "#ff5572",       label: "Frustrated",       emoji: "😤" },
  shocked:    { accent: "#a78bfa", softBg: "rgba(167,139,250,0.08)", textColor: "#a78bfa",       label: "Shocked",          emoji: "😲" },
  thinking:   { accent: "#94a3b8", softBg: "rgba(148,163,184,0.06)", textColor: "#94a3b8",       label: "Thinking…",        emoji: "🤔" },
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

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; bg: string; label: string }> = {
    completed:        { color: "#00e5a0", bg: "rgba(0,229,160,0.12)",   label: "Done"     },
    running:          { color: "#36b6ff", bg: "rgba(54,182,255,0.12)",  label: "Running"  },
    failed:           { color: "#ff5572", bg: "rgba(255,85,114,0.12)",  label: "Failed"   },
    blocked:          { color: "#ffb020", bg: "rgba(255,176,32,0.12)",  label: "Blocked"  },
    pending_approval: { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", label: "Pending"  },
  };
  const s = cfg[status] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.08)", label: status };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      color: s.color, background: s.bg,
      padding: "3px 8px", borderRadius: 6,
      flexShrink: 0, letterSpacing: "0.02em",
    }}>
      {s.label}
    </span>
  );
}

// ── Intent badge ──────────────────────────────────────────────────────────────
function IntentBadge({ type }: { type: string }) {
  const cfg: Record<string, { color: string; label: string }> = {
    propose_trade: { color: "#00e5a0", label: "Trade"   },
    set_alert:     { color: "#36b6ff", label: "Alert"   },
    rebalance:     { color: "#a78bfa", label: "Rebal"   },
    no_action:     { color: "#94a3b8", label: "Hold"    },
  };
  const c = cfg[type] ?? { color: "#94a3b8", label: type };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      color: c.color, border: `1px solid ${c.color}40`,
      padding: "2px 7px", borderRadius: 5, flexShrink: 0,
    }}>
      {c.label}
    </span>
  );
}

// ── Agent Dashboard panel ─────────────────────────────────────────────────────
type DashTab = "runs" | "positions" | "opportunities" | "config";

function AgentDashboard({ accentColor }: { accentColor: string }) {
  const [tab,          setTab]          = useState<DashTab>("runs");
  const [runs,         setRuns]         = useState<AgentRun[]>([]);
  const [stats,        setStats]        = useState<AgentRunStats | null>(null);
  const [config,       setConfig]       = useState<AgentConfig | null>(null);
  const [schedulerOn,  setSchedulerOn]  = useState(false);
  const [positions,    setPositions]    = useState<Position[]>([]);
  const [pnlSummary,   setPnlSummary]   = useState<PnlSummary | null>(null);
  const [dailyPnl,     setDailyPnl]     = useState<DailyPnl | null>(null);
  const [opps,         setOpps]         = useState<Opportunity[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [toggling,     setToggling]     = useState(false);
  const [triggering,   setTriggering]   = useState(false);
  const [expandedRun,  setExpandedRun]  = useState<string | null>(null);

  const load = useCallback(async (t: DashTab) => {
    setLoading(true);
    try {
      if (t === "runs") {
        const [r, s] = await Promise.all([
          agentService.listRuns({ limit: 20 }),
          agentService.getStats(),
        ]);
        setRuns(r.runs); setStats(s);
      } else if (t === "positions") {
        const [pos, daily, summary] = await Promise.all([
          agentService.listPositions({ limit: 30 }),
          agentService.getDailyPnl(),
          agentService.getPnlSummary(),
        ]);
        setPositions(pos.positions); setDailyPnl(daily); setPnlSummary(summary);
      } else if (t === "opportunities") {
        const o = await agentService.listOpportunities({ limit: 30 });
        setOpps(o.opportunities);
      } else if (t === "config") {
        const c = await agentService.getConfig();
        setConfig(c.config); setSchedulerOn(c.schedulerActive);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const handleToggle = async () => {
    if (!config) return;
    setToggling(true);
    try {
      const res = await agentService.updateConfig({ enabled: !config.enabled });
      setConfig(res.config);
    } catch { /* ignore */ } finally { setToggling(false); }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await agentService.triggerRun(true);
      await load("runs");
      setTab("runs");
    } catch { /* ignore */ } finally { setTriggering(false); }
  };

  const DASH_TABS: { id: DashTab; label: string }[] = [
    { id: "runs",          label: "Runs"     },
    { id: "positions",     label: "Positions"},
    { id: "opportunities", label: "Signals"  },
    { id: "config",        label: "Config"   },
  ];

  const pnlColor = (v: number) => v >= 0 ? "#00e5a0" : "#ff5572";

  const emptyMsg = (msg: string) => (
    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", margin: "24px 0", fontFamily: "var(--font-display)" }}>
      {msg}
    </p>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "rgb(2,6,9)" }}>

      {/* Sub-tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgb(4,11,20)", flexShrink: 0 }}>
        {DASH_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: "1 1 0", padding: "12px 4px", fontSize: 12,
            fontFamily: "var(--font-display)", fontWeight: 600,
            background: "transparent", border: "none",
            borderBottom: tab === t.id ? `2px solid ${accentColor}` : "2px solid transparent",
            color: tab === t.id ? accentColor : "rgba(255,255,255,0.35)",
            cursor: "pointer", transition: "all 0.15s ease",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

        {/* ── RUNS TAB ──────────────────────────────────────────────────── */}
        {tab === "runs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {stats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {[
                  { label: "Total",    val: stats.total,     color: "rgba(255,255,255,0.7)" },
                  { label: "Done",     val: stats.completed, color: "#00e5a0"               },
                  { label: "Last 24h", val: stats.last24h,   color: accentColor             },
                  { label: "Failed",   val: stats.failed,    color: "#ff5572"               },
                  { label: "Blocked",  val: stats.blocked,   color: "#ffb020"               },
                  { label: "Pending",  val: stats.pending,   color: "#a78bfa"               },
                ].map(s => (
                  <div key={s.label} style={{
                    padding: "12px 8px", borderRadius: 10,
                    background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.08)",
                    textAlign: "center",
                  }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: s.color, margin: "0 0 3px", fontFamily: "var(--font-display)" }}>{s.val}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0, letterSpacing: "0.04em" }}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {stats && Object.keys(stats.intentBreakdown).length > 0 && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 10px" }}>
                  Intent Breakdown
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {Object.entries(stats.intentBreakdown).map(([intent, count]) => {
                    const total = Object.values(stats.intentBreakdown).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={intent} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <IntentBadge type={intent} />
                        <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", width: `${pct}%`,
                            background: intent === "propose_trade" ? "#00e5a0" : intent === "no_action" ? "#94a3b8" : accentColor,
                            borderRadius: 3,
                          }} />
                        </div>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", flexShrink: 0, minWidth: 20, textAlign: "right" }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={handleTrigger} disabled={triggering || loading}
              style={{
                width: "100%", padding: "11px 0", borderRadius: 10,
                fontSize: 13, fontWeight: 600, fontFamily: "var(--font-display)",
                color: triggering ? "rgba(255,255,255,0.35)" : "#020609",
                background: triggering ? "rgb(12,24,42)" : accentColor,
                border: "none", cursor: triggering ? "not-allowed" : "pointer",
                opacity: triggering ? 0.6 : 1, transition: "all 0.2s ease",
              }}>
              {triggering ? "Running…" : "▶ Run One Tick"}
            </button>

            {loading && runs.length === 0 && emptyMsg("Loading…")}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {runs.map(run => {
                const isOpen = expandedRun === run.runId;
                const hasDecision = !!run.decision;
                return (
                  <div key={run.runId} style={{
                    borderRadius: 10, overflow: "hidden",
                    border: `1px solid ${isOpen ? accentColor + "30" : "rgba(255,255,255,0.07)"}`,
                    background: isOpen ? `${accentColor}06` : "rgb(8,18,32)",
                    transition: "all 0.15s ease",
                  }}>
                    <button onClick={() => setExpandedRun(isOpen ? null : run.runId)}
                      style={{
                        width: "100%", padding: "12px 14px", background: "transparent",
                        border: "none", cursor: "pointer", textAlign: "left",
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                      <StatusBadge status={run.status} />
                      {hasDecision && <IntentBadge type={run.decision!.intent.type} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 11, color: "rgba(255,255,255,0.35)",
                          margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          fontFamily: "var(--font-mono)",
                        }}>
                          {run.runId}
                        </p>
                      </div>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0, fontFamily: "var(--font-mono)" }}>
                        {new Date(run.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: "0 14px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ display: "flex", gap: 6, marginBottom: 10, marginTop: 12, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", padding: "3px 8px", borderRadius: 6 }}>
                            {run.strategy}
                          </span>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", padding: "3px 8px", borderRadius: 6 }}>
                            {run.mode}
                          </span>
                        </div>
                        {run.decision && (
                          <>
                            <p style={{ fontFamily: "var(--font-display)", fontSize: 13, lineHeight: 1.65, color: "rgba(255,255,255,0.5)", margin: "0 0 8px" }}>
                              {run.decision.reasoning?.slice(0, 160)}{(run.decision.reasoning?.length ?? 0) > 160 ? "…" : ""}
                            </p>
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                              {run.decision.toolCallTrace.map((t, i) => (
                                <span key={i} style={{ fontSize: 11, color: accentColor, background: `${accentColor}10`, border: `1px solid ${accentColor}20`, padding: "2px 6px", borderRadius: 5 }}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                        {run.executionResult && (
                          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <p style={{ fontSize: 12, color: run.executionResult.status === "filled" ? "#00e5a0" : "#ff5572", margin: 0, fontFamily: "var(--font-mono)" }}>
                              {run.executionResult.status}
                              {run.executionResult.filledAmountUsd !== undefined && ` · $${run.executionResult.filledAmountUsd.toFixed(2)}`}
                            </p>
                            {run.executionResult.riskRejectionReason && (
                              <p style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "#ffb020", margin: "5px 0 0" }}>
                                ⚠ {run.executionResult.riskRejectionReason}
                              </p>
                            )}
                          </div>
                        )}
                        {run.errorMessage && (
                          <p style={{ fontSize: 12, color: "#ff5572", margin: "10px 0 0", fontFamily: "var(--font-display)" }}>✕ {run.errorMessage}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {!loading && runs.length === 0 && emptyMsg("No runs yet — trigger a tick to start.")}
            </div>
          </div>
        )}

        {/* ── POSITIONS TAB ─────────────────────────────────────────── */}
        {tab === "positions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {pnlSummary && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Total PnL",  val: `${pnlSummary.totalPnlUsd >= 0 ? "+" : ""}$${pnlSummary.totalPnlUsd.toFixed(2)}`, color: pnlColor(pnlSummary.totalPnlUsd) },
                  { label: "Win Rate",   val: pnlSummary.winRate !== null ? `${pnlSummary.winRate}%` : "—",                        color: "rgba(255,255,255,0.7)" },
                  { label: "Open",       val: String(pnlSummary.openPositions),                                                     color: accentColor },
                  { label: "Trades",     val: String(pnlSummary.totalTrades),                                                       color: "rgba(255,255,255,0.7)" },
                  { label: "Avg Win",    val: `$${pnlSummary.avgWinUsd.toFixed(2)}`,                                                color: "#00e5a0" },
                  { label: "Avg Loss",   val: `$${Math.abs(pnlSummary.avgLossUsd).toFixed(2)}`,                                     color: "#ff5572" },
                ].map(s => (
                  <div key={s.label} style={{ padding: "12px 10px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
                    <p style={{ fontSize: 18, fontWeight: 700, color: s.color, margin: "0 0 3px", fontFamily: "var(--font-display)" }}>{s.val}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {dailyPnl && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em", textTransform: "uppercase", margin: "0 0 4px" }}>Today</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color: pnlColor(dailyPnl.totalPnlUsd), margin: 0, fontFamily: "var(--font-display)" }}>
                    {dailyPnl.totalPnlUsd >= 0 ? "+" : ""}${dailyPnl.totalPnlUsd.toFixed(2)}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 3px" }}>
                    {dailyPnl.winCount}W / {dailyPnl.lossCount}L
                  </p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                    {dailyPnl.tradeCount} trades
                  </p>
                </div>
              </div>
            )}

            {loading && positions.length === 0 && emptyMsg("Loading…")}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {positions.map(pos => {
                const pnl = pos.realizedPnlUsd;
                return (
                  <div key={pos.positionId} style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: "rgb(8,18,32)", border: `1px solid ${pos.isOpen ? accentColor + "25" : "rgba(255,255,255,0.07)"}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-display)" }}>
                        {pos.tokenIn} → {pos.tokenOut}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: pos.isOpen ? accentColor : "rgba(255,255,255,0.3)",
                        background: pos.isOpen ? `${accentColor}12` : "rgba(255,255,255,0.04)",
                        padding: "2px 7px", borderRadius: 5, marginLeft: "auto",
                      }}>
                        {pos.isOpen ? "Open" : "Closed"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono)" }}>
                        Entry ${pos.entryAmountUsd.toFixed(2)} @ ${pos.entryPrice.toFixed(4)}
                      </span>
                      {pnl !== undefined && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: pnlColor(pnl), marginLeft: "auto", fontFamily: "var(--font-display)" }}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(4)}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", margin: "6px 0 0", fontFamily: "var(--font-mono)" }}>
                      {pos.strategy} · {new Date(pos.entryAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                );
              })}
              {!loading && positions.length === 0 && emptyMsg("No positions yet — run the agent loop first.")}
            </div>
          </div>
        )}

        {/* ── OPPORTUNITIES TAB ─────────────────────────────────────── */}
        {tab === "opportunities" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {loading && opps.length === 0 && emptyMsg("Loading…")}
            {opps.map(opp => {
              const typeColors: Record<string, string> = {
                yield_anomaly:   "#00e5a0",
                price_spike:     "#ffb020",
                volume_spike:    "#36b6ff",
                airdrop_signal:  "#a78bfa",
                sentiment_shift: "#f472b6",
              };
              const col = typeColors[opp.type] ?? "#94a3b8";
              return (
                <div key={opp.opportunityId} style={{ padding: "13px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: `1px solid ${col}22` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {opp.title}
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: col, background: `${col}12`, border: `1px solid ${col}25`, padding: "2px 7px", borderRadius: 5 }}>
                        {opp.type.replace("_", " ")}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ height: 4, borderRadius: 3, width: 44, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${opp.score}%`, background: `linear-gradient(90deg, ${col}66, ${col})`, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, color: col, fontWeight: 700 }}>{opp.score}</span>
                      </div>
                    </div>
                  </div>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.45)", margin: "0 0 8px" }}>{opp.detail}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {opp.protocol && (
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: 5 }}>
                        {opp.protocol}
                      </span>
                    )}
                    {opp.chain && (
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: 5 }}>
                        {opp.chain}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
                      {opp.acted ? "✓ acted" : "• unacted"}
                    </span>
                  </div>
                </div>
              );
            })}
            {!loading && opps.length === 0 && emptyMsg("No active signals — agent will populate these on next tick.")}
          </div>
        )}

        {/* ── CONFIG TAB ────────────────────────────────────────────── */}
        {tab === "config" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {loading && !config && emptyMsg("Loading…")}
            {config && (
              <>
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgb(8,18,32)", border: `1px solid ${config.enabled ? "#00e5a030" : "rgba(255,255,255,0.07)"}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 4px" }}>Agent Loop</p>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
                        {config.enabled ? `Active · fires every ${config.loopIntervalMs / 1000}s` : "Halted"}
                      </p>
                    </div>
                    <button onClick={handleToggle} disabled={toggling}
                      style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "var(--font-display)", cursor: toggling ? "not-allowed" : "pointer", border: "none", transition: "all 0.2s ease", background: config.enabled ? "rgba(255,85,114,0.15)" : "rgba(0,229,160,0.15)", color: config.enabled ? "#ff5572" : "#00e5a0", opacity: toggling ? 0.6 : 1 }}>
                      {toggling ? "…" : config.enabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>

                {[
                  { label: "Mode",            val: config.mode.toUpperCase() },
                  { label: "Interval",        val: `${config.loopIntervalMs / 1000}s` },
                  { label: "Max Trade",       val: `$${config.maxTradeUsd}` },
                  { label: "Manual Approval", val: config.requireManualApproval ? "Yes" : "No" },
                  { label: "Scheduler",       val: schedulerOn ? "Running" : "Stopped" },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-display)" }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", fontFamily: "var(--font-mono)" }}>{row.val}</span>
                  </div>
                ))}

                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 10px" }}>Strategies</p>
                  {Object.entries(config.strategies).map(([name, active]) => (
                    <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-display)" }}>{name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: active ? "#00e5a0" : "rgba(255,255,255,0.25)", background: active ? "rgba(0,229,160,0.10)" : "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 5 }}>
                        {active ? "On" : "Off"}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 10px" }}>Watchlist</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {config.watchlist.map(coin => (
                      <span key={coin} style={{ fontSize: 12, fontWeight: 600, color: accentColor, background: `${accentColor}10`, border: `1px solid ${accentColor}25`, padding: "3px 9px", borderRadius: 5 }}>
                        {coin}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Session sidebar ───────────────────────────────────────────────────────────
function SessionSidebar({
  sessions, currentSessionId, coinId, loading,
  emotion, onNewSession, onSwitch, onDelete, onRunAnalysis, isOpen, onClose,
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
  isOpen:            boolean;
  onClose:           () => void;
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
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            display: "none",
            position: "fixed", inset: 0, zIndex: 40,
            background: "rgba(0,0,0,0.6)",
          }}
          className="sidebar-backdrop"
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
            width: 80vw !important;
            max-width: 300px !important;
          }
          .agent-sidebar.open {
            transform: translateX(0);
          }
          .sidebar-backdrop {
            display: block !important;
          }
        }
      `}</style>

      <div className={`agent-sidebar${isOpen ? " open" : ""}`} style={{
        width: 240, flexShrink: 0,
        display: "flex", flexDirection: "column",
        background: "rgb(4,11,20)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        transition: "transform 0.25s ease",
      }}>
        {/* Mood accent strip */}
        <div style={{ height: 3, background: mood.accent, transition: "background 0.5s ease", flexShrink: 0 }} />

        {/* Avatar section */}
        <div style={{
          padding: "22px 18px 16px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          flexShrink: 0,
        }}>
          <div style={{
            width: 84, height: 84, borderRadius: "50%", overflow: "hidden",
            background: mood.softBg,
            boxShadow: `0 6px 28px ${mood.accent}28, 0 0 0 1px ${mood.accent}18`,
            transition: "box-shadow 0.5s ease",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            {!imgErr && emotion?.asset ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={emotion.asset} alt={emotion.emotion}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={() => setImgErr(true)} />
            ) : (
              <span style={{ fontSize: 38, lineHeight: 1 }}>{mood.emoji}</span>
            )}
          </div>

          <span style={{
            padding: "4px 12px", borderRadius: 20,
            background: mood.softBg, color: mood.textColor,
            fontSize: 12, fontWeight: 600, fontFamily: "var(--font-display)",
            border: `1px solid ${mood.accent}30`,
          }}>
            {mood.label}
          </span>

          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-display)", margin: 0, textAlign: "center" }}>
            Watching <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{coinId.toUpperCase()}</span>
          </p>

          {emotion && (
            <div style={{ width: "100%", padding: "9px 11px", borderRadius: 10, background: mood.softBg, border: `1px solid ${mood.accent}18` }}>
              <p style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-display)", margin: 0, fontStyle: "italic" }}>
                "{emotion.message.slice(0, 70)}{emotion.message.length > 70 ? "…" : ""}"
              </p>
            </div>
          )}

          {emotion && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-display)" }}>Intensity</span>
              <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
                {[1, 2, 3].map(n => (
                  <div key={n} style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: (n === 1 || (n === 2 && (emotion.intensity === "medium" || emotion.intensity === "high")) || (n === 3 && emotion.intensity === "high"))
                      ? mood.accent : "rgba(255,255,255,0.12)",
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
            onClick={onNewSession} disabled={loading}
            style={{
              width: "100%", padding: "10px 0", borderRadius: 10,
              fontSize: 13, fontWeight: 600, fontFamily: "var(--font-display)",
              color: "rgba(255,255,255,0.65)",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              opacity: loading ? 0.5 : 1, transition: "all 0.15s ease",
            }}
            onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"; } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)"; }}
          >
            <span style={{ fontSize: 14 }}>✦</span> New Chat
          </button>

          <button
            onClick={onRunAnalysis} disabled={loading}
            style={{
              width: "100%", padding: "10px 0", borderRadius: 10,
              fontSize: 13, fontWeight: 600, fontFamily: "var(--font-display)",
              color: loading ? "rgba(255,255,255,0.3)" : "#020609",
              background: loading ? "rgb(12,24,42)" : mood.accent,
              border: "none", cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1, transition: "all 0.25s ease",
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = loading ? "0.6" : "1"; }}
          >
            {loading ? "Working…" : "▶ Run Analysis"}
          </button>
        </div>

        {/* Session list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 10px 16px", display: "flex", flexDirection: "column", gap: 0 }}>
          {sessions.length === 0 ? (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 16, fontFamily: "var(--font-display)" }}>
              No past sessions yet
            </p>
          ) : (
            grouped.map(group => (
              <div key={group.label}>
                <p style={{
                  fontSize: 11, color: "rgba(255,255,255,0.28)",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  padding: "10px 6px 4px", margin: 0, fontFamily: "var(--font-display)",
                }}>
                  {group.label}
                </p>

                {group.items.map(s => {
                  const isActive     = s.sessionId === currentSessionId;
                  const emo          = s.currentEmotion;
                  const m            = emo ? MOOD[emo.emotion] : MOOD.thinking;
                  const isConfirming = confirmId === s.sessionId;

                  return (
                    <div key={s.sessionId} style={{
                      borderRadius: 10,
                      background: isActive ? `${m.accent}12` : "transparent",
                      border: `1px solid ${isActive ? m.accent + "30" : "transparent"}`,
                      marginBottom: 3, transition: "all 0.15s ease", overflow: "hidden",
                    }}>
                      <button
                        onClick={() => { if (!isConfirming) { onSwitch(s.sessionId); onClose(); } }}
                        style={{ width: "100%", padding: "10px 10px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 9 }}
                        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{m.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                            <span style={{ fontSize: 11, color: m.textColor, fontWeight: 600, background: `${m.accent}14`, padding: "1px 6px", borderRadius: 4, letterSpacing: "0.03em" }}>
                              {s.coinId.toUpperCase()}
                            </span>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginLeft: "auto" }}>
                              {s.messageCount}m
                            </span>
                          </div>
                          <p style={{
                            fontFamily: "var(--font-display)", fontSize: 12,
                            color: isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)",
                            lineHeight: 1.45, margin: 0,
                            overflow: "hidden", textOverflow: "ellipsis",
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                            fontWeight: isActive ? 500 : 400,
                          }}>
                            {s.lastMessage ?? "New conversation"}
                          </p>
                        </div>
                      </button>

                      <div style={{ display: "flex", gap: 4, padding: "0 10px 7px" }}>
                        {isConfirming ? (
                          <>
                            <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "rgba(255,85,114,0.8)", flex: 1 }}>Delete this chat?</span>
                            <button onClick={() => handleDelete(s.sessionId)} disabled={deletingId === s.sessionId} style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 600, color: "#ff5572", background: "rgba(255,85,114,0.12)", border: "1px solid rgba(255,85,114,0.3)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
                              {deletingId === s.sessionId ? "…" : "Yes"}
                            </button>
                            <button onClick={() => setConfirmId(null)} style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "rgba(255,255,255,0.35)", background: "transparent", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
                              No
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmId(s.sessionId); }}
                            style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", background: "transparent", border: "none", cursor: "pointer", padding: "2px 5px", borderRadius: 5, marginLeft: "auto" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ff5572"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.25)"; }}
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
    </>
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
          width: 32, height: 32, borderRadius: "50%", background: mood.softBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0, marginTop: 2,
          border: `1px solid ${mood.accent}22`,
        }}>
          {mood.emoji}
        </div>
      )}
      <div style={{
        display: "flex", flexDirection: "column", gap: 4,
        maxWidth: "78%",
        alignItems: isUser ? "flex-end" : "flex-start",
        width: msg.report ? "100%" : undefined,
      }}>
        <div style={{
          padding: "12px 16px",
          fontSize: 15,
          lineHeight: 1.7,
          fontFamily: "var(--font-display)", fontWeight: 400,
          ...(isUser ? {
            background: "rgb(14,28,48)", color: "rgba(255,255,255,0.88)",
            borderRadius: "18px 18px 4px 18px",
            border: "1px solid rgba(255,255,255,0.12)",
          } : {
            background: "rgb(8,18,32)", color: "rgba(255,255,255,0.72)",
            borderRadius: "18px 18px 18px 4px",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          }),
        }}>
          {msg.content}
        </div>
        {!isUser && msg.report && (
          <div style={{ width: "100%", marginTop: 6 }}>
            <ReportBubble report={msg.report} />
          </div>
        )}
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)", padding: "0 4px" }}>
          {tLabel(msg.ts)}
        </span>
      </div>
    </div>
  );
}

// ── Restoring skeleton ────────────────────────────────────────────────────────
function RestoringScreen({ mood }: { mood: { accent: string; emoji: string; softBg: string } }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, opacity: 0.6 }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%", background: mood.softBg,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
        animation: "pulse 1.5s ease-in-out infinite",
      }}>
        {mood.emoji}
      </div>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>
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
  const [view,        setView]        = useState<"chat" | "dashboard">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const endRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevSid  = useRef<string | null>(null);
  const mood = emotion ? MOOD[emotion.emotion] : MOOD.thinking;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  useEffect(() => {
    if (!sessionId || sessionId === prevSid.current) return;
    prevSid.current = sessionId;
    setMessages([]);
    setEmotion(null);
    setShowPrompts(true);

    apiClient.get<{ messages: ChatMessage[]; currentEmotion: AgentEmotion }>(`/agent/session/${sessionId}`)
      .then(data => {
        if (data?.messages?.length > 0) {
          const real = data.messages.filter(m => m.content !== "__init__");
          if (real.length > 0) {
            setMessages(real);
            setEmotion(data.currentEmotion ?? null);
            setShowPrompts(false);
          }
        }
      })
      .catch(() => { });
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
    } catch { }

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
      <style>{`
        @media (max-width: 640px) {
          .agent-main-header { padding: 10px 14px !important; }
          .agent-messages-area { padding: 16px 14px 8px !important; }
          .agent-input-wrap { padding: 10px 12px 14px !important; }
        }
      `}</style>

      <SessionSidebar
        sessions={sessions} currentSessionId={sessionId} coinId={coinId}
        loading={loading} emotion={emotion}
        onNewSession={handleNewSession} onSwitch={handleSwitch}
        onDelete={handleDelete} onRunAnalysis={runAnalysis}
        isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
      />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div className="agent-main-header" style={{
          padding: "13px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgb(4,11,20)", display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0, gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="mobile-menu-btn"
              style={{
                display: "none",
                width: 36, height: 36, borderRadius: 8,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                cursor: "pointer", alignItems: "center", justifyContent: "center",
                fontSize: 16, color: "rgba(255,255,255,0.6)",
                flexShrink: 0,
              }}
            >
              ☰
            </button>
            <style>{`@media (max-width: 640px) { .mobile-menu-btn { display: flex !important; } }`}</style>

            <div style={{ width: 9, height: 9, borderRadius: "50%", background: mood.accent, boxShadow: `0 0 0 3px ${mood.accent}20`, transition: "all 0.4s ease", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>
              {coinId.charAt(0).toUpperCase() + coinId.slice(1)} Agent
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* View toggle */}
            <div style={{ display: "flex", background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
              {(["chat", "dashboard"] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: "6px 13px", fontSize: 12, fontWeight: 600,
                  fontFamily: "var(--font-display)", border: "none", cursor: "pointer",
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
                fontSize: 12, fontWeight: 500, fontFamily: "var(--font-display)",
                border: `1px solid ${mood.accent}25`, transition: "all 0.4s ease",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {mood.emoji} {mood.label}
              </span>
            )}
          </div>
        </div>

        {/* Main content — chat or dashboard */}
        {view === "dashboard" ? (
          <div style={{ flex: 1, minHeight: 0 }}>
            <AgentDashboard accentColor={mood.accent} />
          </div>
        ) : (
          <>
            {/* Messages area */}
            <div className="agent-messages-area" style={{ flex: 1, overflowY: "auto", padding: "24px 20px 8px", display: "flex", flexDirection: "column", gap: 18, minHeight: 0 }}>
              {isRestoring && <RestoringScreen mood={mood} />}

              {!isRestoring && messages.length === 0 && !loading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14, textAlign: "center" }}>
                  <span style={{ fontSize: 52, lineHeight: 1 }}>{mood.emoji}</span>
                  <div>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 8px" }}>
                      Hey! I'm your market agent.
                    </p>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, maxWidth: 280, margin: 0 }}>
                      Ask me anything about {coinId.toUpperCase()} — I'll give you my honest take.
                    </p>
                  </div>
                </div>
              )}

              {!isRestoring && showPrompts && messages.length === 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                    Try asking…
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {PROMPTS.map((p, i) => (
                      <button key={i} onClick={() => send(p)} style={{
                        textAlign: "left", padding: "12px 16px", borderRadius: 12,
                        fontSize: 14, fontFamily: "var(--font-display)", fontWeight: 400,
                        color: "rgba(255,255,255,0.55)", background: "rgb(8,18,32)",
                        border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer",
                        transition: "all 0.15s ease", width: "100%", lineHeight: 1.5,
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = mood.accent; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"; (e.currentTarget as HTMLElement).style.background = mood.softBg; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; (e.currentTarget as HTMLElement).style.background = "rgb(8,18,32)"; }}
                      >{p}</button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => <Bubble key={`${m.ts}-${i}`} msg={m} cur={emotion} />)}

              {loading && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: mood.softBg, border: `1px solid ${mood.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{mood.emoji}</div>
                  <div style={{ padding: "12px 18px", background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px 18px 18px 4px", boxShadow: "0 2px 10px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 6 }}>
                    <TypingDots color={mood.accent} />
                  </div>
                </div>
              )}

              {error && (
                <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,85,114,0.07)", border: "1px solid rgba(255,85,114,0.2)", fontSize: 14, color: "#ff5572", fontFamily: "var(--font-display)", lineHeight: 1.5 }}>
                  {error}
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Quick chips */}
            {messages.length > 0 && (
              <div style={{ padding: "8px 20px 0", display: "flex", flexWrap: "wrap", gap: 7, background: "rgb(2,6,9)" }}>
                {["How are you?", "Run analysis", "Biggest risks?", "Buy or sell?"].map(p => (
                  <button key={p} onClick={() => send(p)} disabled={loading}
                    style={{
                      padding: "6px 14px", borderRadius: 20, fontSize: 13, fontFamily: "var(--font-display)",
                      fontWeight: 500, color: "rgba(255,255,255,0.5)", background: "rgb(8,18,32)",
                      border: "1px solid rgba(255,255,255,0.08)", cursor: loading ? "not-allowed" : "pointer",
                      transition: "all 0.15s ease", opacity: loading ? 0.5 : 1,
                    }}
                    onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.borderColor = mood.accent; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"; (e.currentTarget as HTMLElement).style.background = mood.softBg; } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"; (e.currentTarget as HTMLElement).style.background = "rgb(8,18,32)"; }}
                  >{p}</button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="agent-input-wrap" style={{ padding: "12px 16px 18px", background: "rgb(2,6,9)", flexShrink: 0 }}>
              <div style={{
                display: "flex", alignItems: "flex-end", gap: 8,
                background: "rgb(8,18,32)", border: "1.5px solid rgba(255,255,255,0.09)",
                borderRadius: 16, padding: "6px 6px 6px 18px", transition: "border-color 0.2s ease",
              }}>
                <textarea
                  ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  onFocus={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = mood.accent; }}
                  onBlur={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)"; }}
                  disabled={loading || isRestoring}
                  placeholder={isRestoring ? "Restoring session…" : `Ask about ${coinId}...`}
                  rows={1}
                  style={{
                    flex: 1, resize: "none", background: "transparent",
                    padding: "10px 0", fontSize: 15, color: "rgba(255,255,255,0.88)",
                    fontFamily: "var(--font-display)", outline: "none",
                    minHeight: 44, maxHeight: 140, lineHeight: 1.55, border: "none",
                  }}
                  onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 140)}px`; }}
                />
                <button
                  onClick={() => send(input)} disabled={!input.trim() || loading || isRestoring}
                  style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: !input.trim() || loading || isRestoring ? "rgb(12,24,42)" : mood.accent,
                    border: "none", cursor: !input.trim() || loading || isRestoring ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s ease",
                    color: !input.trim() || loading || isRestoring ? "rgba(255,255,255,0.25)" : "#020609",
                    fontSize: 18, opacity: !input.trim() || loading || isRestoring ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (input.trim() && !loading && !isRestoring) (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = !input.trim() || loading || isRestoring ? "0.5" : "1"; }}
                >↑</button>
              </div>
              <p style={{ marginTop: 7, fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-mono)", textAlign: "center" }}>
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
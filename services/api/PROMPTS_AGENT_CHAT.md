
// "use client";

// import { useState, useRef, useEffect, useCallback } from "react";
// import { apiClient } from "@/services/api.client";
// import { ReportBubble, type AnalysisReport } from "@/components/ReportBubble";
// import { useAgentSession, type AgentEmotion, type SessionListItem } from "@/hooks/useAgentSession";
// import {
//   agentService,
//   type AgentRun,
//   type AgentRunStats,
//   type AgentConfig,
//   type Position,
//   type DailyPnl,
//   type PnlSummary,
//   type Opportunity,
// } from "@/services/agent.service.frontend";
// import { PaperWalletDashboard } from "@/components/PaperWalletDashboard";
// import { AgentToolCard, parseToolIntent, type ToolResult } from "@/components/AgentToolCards";
// // ── Types ─────────────────────────────────────────────────────────────────────
// type EmotionType = AgentEmotion["emotion"];

// interface ChatMessage {
//   role:          "user" | "agent";
//   content:       string;
//   emotion?:      AgentEmotion;
//   ts:            number;
//   report?:       AnalysisReport;
//   toolResult?:   ToolResult;
//   toolLoading?:  boolean;
// }

// interface ChatResponse {
//   sessionId:       string;
//   content:         string;
//   emotion:         AgentEmotion;
//   suggestAnalysis: boolean;
//   suggestAlert:    boolean;
//   history:         ChatMessage[];
//   analysisReport?: AnalysisReport;
// }

// interface RunAnalysisResponse {
//   analysis:    Record<string, any>;
//   agentOutput: ChatResponse | null;
// }

// // ── Emotion palette ───────────────────────────────────────────────────────────
// const MOOD: Record<EmotionType, {
//   accent: string; softBg: string; textColor: string; label: string; emoji: string;
// }> = {
//   happy:      { accent: "#00e5a0", softBg: "rgba(0,229,160,0.08)",   textColor: "#00e5a0",      label: "Feeling good",     emoji: "😊" },
//   depressed:  { accent: "#36b6ff", softBg: "rgba(54,182,255,0.08)",  textColor: "#60a5fa",       label: "A bit down",       emoji: "😔" },
//   nervous:    { accent: "#ffb020", softBg: "rgba(255,176,32,0.08)",  textColor: "#ffb020",       label: "A little nervous", emoji: "😬" },
//   frustrated: { accent: "#ff5572", softBg: "rgba(255,85,114,0.08)",  textColor: "#ff5572",       label: "Frustrated",       emoji: "😤" },
//   shocked:    { accent: "#a78bfa", softBg: "rgba(167,139,250,0.08)", textColor: "#a78bfa",       label: "Shocked",          emoji: "😲" },
//   thinking:   { accent: "#94a3b8", softBg: "rgba(148,163,184,0.06)", textColor: "#94a3b8",       label: "Thinking…",        emoji: "🤔" },
// };

// const PROMPTS = [
//   "How are you feeling about the market today?",
//   "Should I buy right now?",
//   "What risks should I be aware of?",
//   "Is this a good time to sell?",
//   "Run a full analysis for me",
// ];

// function tLabel(t: number) {
//   return new Date(t).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" });
// }

// function dateLabel(ms: number) {
//   const diffDays = Math.floor((Date.now() - ms) / 86400000);
//   if (diffDays === 0) return "Today";
//   if (diffDays === 1) return "Yesterday";
//   if (diffDays < 7) return new Date(ms).toLocaleDateString("en-GB", { weekday: "short" });
//   return new Date(ms).toLocaleDateString("en-GB", { month: "short", day: "numeric" });
// }

// // ── Typing dots ───────────────────────────────────────────────────────────────
// function TypingDots({ color }: { color: string }) {
//   return (
//     <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
//       {[0, 1, 2].map(i => (
//         <span key={i} className="animate-bounce" style={{
//           width: 7, height: 7, borderRadius: "50%",
//           background: color, display: "inline-block",
//           animationDelay: `${i * 0.18}s`, animationDuration: "0.8s",
//         }} />
//       ))}
//     </span>
//   );
// }

// // ── Status badge ─────────────────────────────────────────────────────────────
// function StatusBadge({ status }: { status: string }) {
//   const cfg: Record<string, { color: string; bg: string; label: string }> = {
//     completed:        { color: "#00e5a0", bg: "rgba(0,229,160,0.12)",   label: "Done"     },
//     running:          { color: "#36b6ff", bg: "rgba(54,182,255,0.12)",  label: "Running"  },
//     failed:           { color: "#ff5572", bg: "rgba(255,85,114,0.12)",  label: "Failed"   },
//     blocked:          { color: "#ffb020", bg: "rgba(255,176,32,0.12)",  label: "Blocked"  },
//     pending_approval: { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", label: "Pending"  },
//   };
//   const s = cfg[status] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.08)", label: status };
//   return (
//     <span style={{
//       fontSize: 11, fontWeight: 600,
//       color: s.color, background: s.bg,
//       padding: "3px 8px", borderRadius: 6,
//       flexShrink: 0, letterSpacing: "0.02em",
//     }}>
//       {s.label}
//     </span>
//   );
// }

// // ── Intent badge ──────────────────────────────────────────────────────────────
// function IntentBadge({ type }: { type: string }) {
//   const cfg: Record<string, { color: string; label: string }> = {
//     propose_trade: { color: "#00e5a0", label: "Trade"   },
//     set_alert:     { color: "#36b6ff", label: "Alert"   },
//     rebalance:     { color: "#a78bfa", label: "Rebal"   },
//     no_action:     { color: "#94a3b8", label: "Hold"    },
//   };
//   const c = cfg[type] ?? { color: "#94a3b8", label: type };
//   return (
//     <span style={{
//       fontSize: 11, fontWeight: 600,
//       color: c.color, border: `1px solid ${c.color}40`,
//       padding: "2px 7px", borderRadius: 5, flexShrink: 0,
//     }}>
//       {c.label}
//     </span>
//   );
// }

// // ── Agent Dashboard panel ─────────────────────────────────────────────────────
// // type DashTab = "runs" | "positions" | "opportunities" | "config";
// type DashTab = "runs" | "positions" | "opportunities" | "config" | "wallet";
// function AgentDashboard({ accentColor }: { accentColor: string }) {
//   const [tab,          setTab]          = useState<DashTab>("runs");
//   const [runs,         setRuns]         = useState<AgentRun[]>([]);
//   const [stats,        setStats]        = useState<AgentRunStats | null>(null);
//   const [config,       setConfig]       = useState<AgentConfig | null>(null);
//   const [schedulerOn,  setSchedulerOn]  = useState(false);
//   const [positions,    setPositions]    = useState<Position[]>([]);
//   const [pnlSummary,   setPnlSummary]   = useState<PnlSummary | null>(null);
//   const [dailyPnl,     setDailyPnl]     = useState<DailyPnl | null>(null);
//   const [opps,         setOpps]         = useState<Opportunity[]>([]);
//   const [loading,      setLoading]      = useState(false);
//   const [toggling,     setToggling]     = useState(false);
//   const [triggering,   setTriggering]   = useState(false);
//   const [expandedRun,  setExpandedRun]  = useState<string | null>(null);

//   const load = useCallback(async (t: DashTab) => {
//     setLoading(true);
//     try {
//       if (t === "runs") {
//         const [r, s] = await Promise.all([
//           agentService.listRuns({ limit: 20 }),
//           agentService.getStats(),
//         ]);
//         setRuns(r.runs); setStats(s);
//       } else if (t === "positions") {
//         const [pos, daily, summary] = await Promise.all([
//           agentService.listPositions({ limit: 30 }),
//           agentService.getDailyPnl(),
//           agentService.getPnlSummary(),
//         ]);
//         setPositions(pos.positions); setDailyPnl(daily); setPnlSummary(summary);
//       } else if (t === "opportunities") {
//         const o = await agentService.listOpportunities({ limit: 30 });
//         setOpps(o.opportunities);
//       } else if (t === "config") {
//         const c = await agentService.getConfig();
//         setConfig(c.config); setSchedulerOn(c.schedulerActive);
//       }
//     } catch { /* ignore */ } finally { setLoading(false); }
//   }, []);

//   useEffect(() => { load(tab); }, [tab, load]);

//   const handleToggle = async () => {
//     if (!config) return;
//     setToggling(true);
//     try {
//       const res = await agentService.updateConfig({ enabled: !config.enabled });
//       setConfig(res.config);
//     } catch { /* ignore */ } finally { setToggling(false); }
//   };

//   const handleTrigger = async () => {
//     setTriggering(true);
//     try {
//       await agentService.triggerRun(true);
//       await load("runs");
//       setTab("runs");
//     } catch { /* ignore */ } finally { setTriggering(false); }
//   };

// const DASH_TABS: { id: DashTab; label: string }[] = [
//   { id: "runs",          label: "Runs"     },
//   { id: "positions",     label: "Positions"},
//   { id: "opportunities", label: "Signals"  },
//   { id: "config",        label: "Config"   },
//   { id: "wallet",        label: "Wallet"   }, // ← add this
// ];
//   const pnlColor = (v: number) => v >= 0 ? "#00e5a0" : "#ff5572";

//   const emptyMsg = (msg: string) => (
//     <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", margin: "24px 0", fontFamily: "var(--font-display)" }}>
//       {msg}
//     </p>
//   );

//   return (
//     <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "rgb(2,6,9)" }}>

//       {/* Sub-tabs */}
//       <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgb(4,11,20)", flexShrink: 0 }}>
//         {DASH_TABS.map(t => (
//           <button key={t.id} onClick={() => setTab(t.id)} style={{
//             flex: "1 1 0", padding: "12px 4px", fontSize: 12,
//             fontFamily: "var(--font-display)", fontWeight: 600,
//             background: "transparent", border: "none",
//             borderBottom: tab === t.id ? `2px solid ${accentColor}` : "2px solid transparent",
//             color: tab === t.id ? accentColor : "rgba(255,255,255,0.35)",
//             cursor: "pointer", transition: "all 0.15s ease",
//           }}>{t.label}</button>
//         ))}
//       </div>

//       <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

//         {/* ── RUNS TAB ──────────────────────────────────────────────────── */}
//         {tab === "runs" && (
//           <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
//             {stats && (
//               <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
//                 {[
//                   { label: "Total",    val: stats.total,     color: "rgba(255,255,255,0.7)" },
//                   { label: "Done",     val: stats.completed, color: "#00e5a0"               },
//                   { label: "Last 24h", val: stats.last24h,   color: accentColor             },
//                   { label: "Failed",   val: stats.failed,    color: "#ff5572"               },
//                   { label: "Blocked",  val: stats.blocked,   color: "#ffb020"               },
//                   { label: "Pending",  val: stats.pending,   color: "#a78bfa"               },
//                 ].map(s => (
//                   <div key={s.label} style={{
//                     padding: "12px 8px", borderRadius: 10,
//                     background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.08)",
//                     textAlign: "center",
//                   }}>
//                     <p style={{ fontSize: 20, fontWeight: 700, color: s.color, margin: "0 0 3px", fontFamily: "var(--font-display)" }}>{s.val}</p>
//                     <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0, letterSpacing: "0.04em" }}>{s.label}</p>
//                   </div>
//                 ))}
//               </div>
//             )}

//             {stats && Object.keys(stats.intentBreakdown).length > 0 && (
//               <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
//                 <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 10px" }}>
//                   Intent Breakdown
//                 </p>
//                 <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
//                   {Object.entries(stats.intentBreakdown).map(([intent, count]) => {
//                     const total = Object.values(stats.intentBreakdown).reduce((a, b) => a + b, 0);
//                     const pct = total > 0 ? (count / total) * 100 : 0;
//                     return (
//                       <div key={intent} style={{ display: "flex", alignItems: "center", gap: 10 }}>
//                         <IntentBadge type={intent} />
//                         <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
//                           <div style={{
//                             height: "100%", width: `${pct}%`,
//                             background: intent === "propose_trade" ? "#00e5a0" : intent === "no_action" ? "#94a3b8" : accentColor,
//                             borderRadius: 3,
//                           }} />
//                         </div>
//                         <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", flexShrink: 0, minWidth: 20, textAlign: "right" }}>{count}</span>
//                       </div>
//                     );
//                   })}
//                 </div>
//               </div>
//             )}

//             <button onClick={handleTrigger} disabled={triggering || loading}
//               style={{
//                 width: "100%", padding: "11px 0", borderRadius: 10,
//                 fontSize: 13, fontWeight: 600, fontFamily: "var(--font-display)",
//                 color: triggering ? "rgba(255,255,255,0.35)" : "#020609",
//                 background: triggering ? "rgb(12,24,42)" : accentColor,
//                 border: "none", cursor: triggering ? "not-allowed" : "pointer",
//                 opacity: triggering ? 0.6 : 1, transition: "all 0.2s ease",
//               }}>
//               {triggering ? "Running…" : "▶ Run One Tick"}
//             </button>

//             {loading && runs.length === 0 && emptyMsg("Loading…")}
//             <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//               {runs.map(run => {
//                 const isOpen = expandedRun === run.runId;
//                 const hasDecision = !!run.decision;
//                 return (
//                   <div key={run.runId} style={{
//                     borderRadius: 10, overflow: "hidden",
//                     border: `1px solid ${isOpen ? accentColor + "30" : "rgba(255,255,255,0.07)"}`,
//                     background: isOpen ? `${accentColor}06` : "rgb(8,18,32)",
//                     transition: "all 0.15s ease",
//                   }}>
//                     <button onClick={() => setExpandedRun(isOpen ? null : run.runId)}
//                       style={{
//                         width: "100%", padding: "12px 14px", background: "transparent",
//                         border: "none", cursor: "pointer", textAlign: "left",
//                         display: "flex", alignItems: "center", gap: 8,
//                       }}>
//                       <StatusBadge status={run.status} />
//                       {hasDecision && <IntentBadge type={run.decision!.intent.type} />}
//                       <div style={{ flex: 1, minWidth: 0 }}>
//                         <p style={{
//                           fontSize: 11, color: "rgba(255,255,255,0.35)",
//                           margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
//                           fontFamily: "var(--font-mono)",
//                         }}>
//                           {run.runId}
//                         </p>
//                       </div>
//                       <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0, fontFamily: "var(--font-mono)" }}>
//                         {new Date(run.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
//                       </span>
//                     </button>
//                     {isOpen && (
//                       <div style={{ padding: "0 14px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
//                         <div style={{ display: "flex", gap: 6, marginBottom: 10, marginTop: 12, flexWrap: "wrap" }}>
//                           <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", padding: "3px 8px", borderRadius: 6 }}>
//                             {run.strategy}
//                           </span>
//                           <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", padding: "3px 8px", borderRadius: 6 }}>
//                             {run.mode}
//                           </span>
//                         </div>
//                         {run.decision && (
//                           <>
//                             <p style={{ fontFamily: "var(--font-display)", fontSize: 13, lineHeight: 1.65, color: "rgba(255,255,255,0.5)", margin: "0 0 8px" }}>
//                               {run.decision.reasoning?.slice(0, 160)}{(run.decision.reasoning?.length ?? 0) > 160 ? "…" : ""}
//                             </p>
//                             <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
//                               {run.decision.toolCallTrace.map((t, i) => (
//                                 <span key={i} style={{ fontSize: 11, color: accentColor, background: `${accentColor}10`, border: `1px solid ${accentColor}20`, padding: "2px 6px", borderRadius: 5 }}>
//                                   {t}
//                                 </span>
//                               ))}
//                             </div>
//                           </>
//                         )}
//                         {run.executionResult && (
//                           <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
//                             <p style={{ fontSize: 12, color: run.executionResult.status === "filled" ? "#00e5a0" : "#ff5572", margin: 0, fontFamily: "var(--font-mono)" }}>
//                               {run.executionResult.status}
//                               {run.executionResult.filledAmountUsd !== undefined && ` · $${run.executionResult.filledAmountUsd.toFixed(2)}`}
//                             </p>
//                             {run.executionResult.riskRejectionReason && (
//                               <p style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "#ffb020", margin: "5px 0 0" }}>
//                                 ⚠ {run.executionResult.riskRejectionReason}
//                               </p>
//                             )}
//                           </div>
//                         )}
//                         {run.errorMessage && (
//                           <p style={{ fontSize: 12, color: "#ff5572", margin: "10px 0 0", fontFamily: "var(--font-display)" }}>✕ {run.errorMessage}</p>
//                         )}
//                       </div>
//                     )}
//                   </div>
//                 );
//               })}
//               {!loading && runs.length === 0 && emptyMsg("No runs yet — trigger a tick to start.")}
//             </div>
//           </div>
//         )}

//         {/* ── POSITIONS TAB ─────────────────────────────────────────── */}
//         {tab === "positions" && (
//           <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
//             {pnlSummary && (
//               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
//                 {[
//                   { label: "Total PnL",  val: `${pnlSummary.totalPnlUsd >= 0 ? "+" : ""}$${pnlSummary.totalPnlUsd.toFixed(2)}`, color: pnlColor(pnlSummary.totalPnlUsd) },
//                   { label: "Win Rate",   val: pnlSummary.winRate !== null ? `${pnlSummary.winRate}%` : "—",                        color: "rgba(255,255,255,0.7)" },
//                   { label: "Open",       val: String(pnlSummary.openPositions),                                                     color: accentColor },
//                   { label: "Trades",     val: String(pnlSummary.totalTrades),                                                       color: "rgba(255,255,255,0.7)" },
//                   { label: "Avg Win",    val: `$${pnlSummary.avgWinUsd.toFixed(2)}`,                                                color: "#00e5a0" },
//                   { label: "Avg Loss",   val: `$${Math.abs(pnlSummary.avgLossUsd).toFixed(2)}`,                                     color: "#ff5572" },
//                 ].map(s => (
//                   <div key={s.label} style={{ padding: "12px 10px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
//                     <p style={{ fontSize: 18, fontWeight: 700, color: s.color, margin: "0 0 3px", fontFamily: "var(--font-display)" }}>{s.val}</p>
//                     <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0 }}>{s.label}</p>
//                   </div>
//                 ))}
//               </div>
//             )}

//             {dailyPnl && (
//               <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//                 <div>
//                   <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em", textTransform: "uppercase", margin: "0 0 4px" }}>Today</p>
//                   <p style={{ fontSize: 22, fontWeight: 700, color: pnlColor(dailyPnl.totalPnlUsd), margin: 0, fontFamily: "var(--font-display)" }}>
//                     {dailyPnl.totalPnlUsd >= 0 ? "+" : ""}${dailyPnl.totalPnlUsd.toFixed(2)}
//                   </p>
//                 </div>
//                 <div style={{ textAlign: "right" }}>
//                   <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 3px" }}>
//                     {dailyPnl.winCount}W / {dailyPnl.lossCount}L
//                   </p>
//                   <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
//                     {dailyPnl.tradeCount} trades
//                   </p>
//                 </div>
//               </div>
//             )}

//             {loading && positions.length === 0 && emptyMsg("Loading…")}
//             <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//               {positions.map(pos => {
//                 const pnl = pos.realizedPnlUsd;
//                 return (
//                   <div key={pos.positionId} style={{
//                     padding: "12px 14px", borderRadius: 10,
//                     background: "rgb(8,18,32)", border: `1px solid ${pos.isOpen ? accentColor + "25" : "rgba(255,255,255,0.07)"}`,
//                   }}>
//                     <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
//                       <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-display)" }}>
//                         {pos.tokenIn} → {pos.tokenOut}
//                       </span>
//                       <span style={{
//                         fontSize: 11, fontWeight: 600,
//                         color: pos.isOpen ? accentColor : "rgba(255,255,255,0.3)",
//                         background: pos.isOpen ? `${accentColor}12` : "rgba(255,255,255,0.04)",
//                         padding: "2px 7px", borderRadius: 5, marginLeft: "auto",
//                       }}>
//                         {pos.isOpen ? "Open" : "Closed"}
//                       </span>
//                     </div>
//                     <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
//                       <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono)" }}>
//                         Entry ${pos.entryAmountUsd.toFixed(2)} @ ${pos.entryPrice.toFixed(4)}
//                       </span>
//                       {pnl !== undefined && (
//                         <span style={{ fontSize: 13, fontWeight: 700, color: pnlColor(pnl), marginLeft: "auto", fontFamily: "var(--font-display)" }}>
//                           {pnl >= 0 ? "+" : ""}${pnl.toFixed(4)}
//                         </span>
//                       )}
//                     </div>
//                     <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", margin: "6px 0 0", fontFamily: "var(--font-mono)" }}>
//                       {pos.strategy} · {new Date(pos.entryAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
//                     </p>
//                   </div>
//                 );
//               })}
//               {!loading && positions.length === 0 && emptyMsg("No positions yet — run the agent loop first.")}
//             </div>
//           </div>
//         )}

//         {/* ── OPPORTUNITIES TAB ─────────────────────────────────────── */}
//         {tab === "opportunities" && (
//           <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
//             {loading && opps.length === 0 && emptyMsg("Loading…")}
//             {opps.map(opp => {
//               const typeColors: Record<string, string> = {
//                 yield_anomaly:   "#00e5a0",
//                 price_spike:     "#ffb020",
//                 volume_spike:    "#36b6ff",
//                 airdrop_signal:  "#a78bfa",
//                 sentiment_shift: "#f472b6",
//               };
//               const col = typeColors[opp.type] ?? "#94a3b8";
//               return (
//                 <div key={opp.opportunityId} style={{ padding: "13px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: `1px solid ${col}22` }}>
//                   <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
//                     <div style={{ flex: 1, minWidth: 0 }}>
//                       <p style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
//                         {opp.title}
//                       </p>
//                     </div>
//                     <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
//                       <span style={{ fontSize: 11, fontWeight: 600, color: col, background: `${col}12`, border: `1px solid ${col}25`, padding: "2px 7px", borderRadius: 5 }}>
//                         {opp.type.replace("_", " ")}
//                       </span>
//                       <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
//                         <div style={{ height: 4, borderRadius: 3, width: 44, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
//                           <div style={{ height: "100%", width: `${opp.score}%`, background: `linear-gradient(90deg, ${col}66, ${col})`, borderRadius: 3 }} />
//                         </div>
//                         <span style={{ fontSize: 12, color: col, fontWeight: 700 }}>{opp.score}</span>
//                       </div>
//                     </div>
//                   </div>
//                   <p style={{ fontFamily: "var(--font-display)", fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.45)", margin: "0 0 8px" }}>{opp.detail}</p>
//                   <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
//                     {opp.protocol && (
//                       <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: 5 }}>
//                         {opp.protocol}
//                       </span>
//                     )}
//                     {opp.chain && (
//                       <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: 5 }}>
//                         {opp.chain}
//                       </span>
//                     )}
//                     <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
//                       {opp.acted ? "✓ acted" : "• unacted"}
//                     </span>
//                   </div>
//                 </div>
//               );
//             })}
//             {!loading && opps.length === 0 && emptyMsg("No active signals — agent will populate these on next tick.")}
//           </div>
//         )}

//         {/* ── WALLET TAB ────────────────────────────────────────────── */}

//         {tab === "wallet" && (
//   <div style={{ margin: "-16px" }}>  {/* bleed to edges, dashboard handles own padding */}
//     <PaperWalletDashboard accentColor={accentColor} />
//   </div>
// )}

//         {/* ── CONFIG TAB ────────────────────────────────────────────── */}
//         {tab === "config" && (
//           <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
//             {loading && !config && emptyMsg("Loading…")}
//             {config && (
//               <>
//                 <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgb(8,18,32)", border: `1px solid ${config.enabled ? "#00e5a030" : "rgba(255,255,255,0.07)"}` }}>
//                   <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//                     <div>
//                       <p style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 4px" }}>Agent Loop</p>
//                       <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
//                         {config.enabled ? `Active · fires every ${config.loopIntervalMs / 1000}s` : "Halted"}
//                       </p>
//                     </div>
//                     <button onClick={handleToggle} disabled={toggling}
//                       style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "var(--font-display)", cursor: toggling ? "not-allowed" : "pointer", border: "none", transition: "all 0.2s ease", background: config.enabled ? "rgba(255,85,114,0.15)" : "rgba(0,229,160,0.15)", color: config.enabled ? "#ff5572" : "#00e5a0", opacity: toggling ? 0.6 : 1 }}>
//                       {toggling ? "…" : config.enabled ? "Disable" : "Enable"}
//                     </button>
//                   </div>
//                 </div>

//                 {[
//                   { label: "Mode",            val: config.mode.toUpperCase() },
//                   { label: "Interval",        val: `${config.loopIntervalMs / 1000}s` },
//                   { label: "Max Trade",       val: `$${config.maxTradeUsd}` },
//                   { label: "Manual Approval", val: config.requireManualApproval ? "Yes" : "No" },
//                   { label: "Scheduler",       val: schedulerOn ? "Running" : "Stopped" },
//                 ].map(row => (
//                   <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
//                     <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-display)" }}>{row.label}</span>
//                     <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", fontFamily: "var(--font-mono)" }}>{row.val}</span>
//                   </div>
//                 ))}

//                 <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
//                   <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 10px" }}>Strategies</p>
//                   {Object.entries(config.strategies).map(([name, active]) => (
//                     <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
//                       <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-display)" }}>{name}</span>
//                       <span style={{ fontSize: 12, fontWeight: 700, color: active ? "#00e5a0" : "rgba(255,255,255,0.25)", background: active ? "rgba(0,229,160,0.10)" : "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 5 }}>
//                         {active ? "On" : "Off"}
//                       </span>
//                     </div>
//                   ))}
//                 </div>

//                 <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
//                   <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 10px" }}>Watchlist</p>
//                   <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
//                     {config.watchlist.map(coin => (
//                       <span key={coin} style={{ fontSize: 12, fontWeight: 600, color: accentColor, background: `${accentColor}10`, border: `1px solid ${accentColor}25`, padding: "3px 9px", borderRadius: 5 }}>
//                         {coin}
//                       </span>
//                     ))}
//                   </div>
//                 </div>
//               </>
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// // ── Session sidebar ───────────────────────────────────────────────────────────
// function SessionSidebar({
//   sessions, currentSessionId, coinId, loading,
//   emotion, onNewSession, onSwitch, onDelete, onRunAnalysis, isOpen, onClose,
// }: {
//   sessions:          SessionListItem[];
//   currentSessionId:  string | null;
//   coinId:            string;
//   loading:           boolean;
//   emotion:           AgentEmotion | null;
//   onNewSession:      () => void | Promise<void>;
//   onSwitch:          (sid: string) => void;
//   onDelete:          (sid: string) => Promise<void>;
//   onRunAnalysis:     () => void;
//   isOpen:            boolean;
//   onClose:           () => void;
// }) {
//   const mood = emotion ? MOOD[emotion.emotion] : MOOD.thinking;
//   const [deletingId, setDeletingId] = useState<string | null>(null);
//   const [confirmId,  setConfirmId]  = useState<string | null>(null);
//   const [imgErr, setImgErr] = useState(false);
//   useEffect(() => setImgErr(false), [emotion?.asset]);

//   async function handleDelete(sid: string) {
//     setDeletingId(sid);
//     await onDelete(sid);
//     setDeletingId(null);
//     setConfirmId(null);
//   }

//   // Group sessions by date
//   const grouped: { label: string; items: SessionListItem[] }[] = [];
//   let currentLabel = "";
//   for (const s of sessions) {
//     const lbl = dateLabel(s.updatedAt);
//     if (lbl !== currentLabel) {
//       grouped.push({ label: lbl, items: [] });
//       currentLabel = lbl;
//     }
//     grouped[grouped.length - 1].items.push(s);
//   }

//   return (
//     <>
//       {/* Mobile overlay backdrop */}
//       {isOpen && (
//         <div
//           onClick={onClose}
//           style={{
//             display: "none",
//             position: "fixed", inset: 0, zIndex: 40,
//             background: "rgba(0,0,0,0.6)",
//           }}
//           className="sidebar-backdrop"
//         />
//       )}

//       <style>{`
//         @media (max-width: 640px) {
//           .agent-sidebar {
//             position: fixed !important;
//             left: 0 !important; top: 0 !important; bottom: 0 !important;
//             z-index: 50;
//             transform: translateX(-100%);
//             transition: transform 0.25s ease !important;
//             width: 80vw !important;
//             max-width: 300px !important;
//           }
//           .agent-sidebar.open {
//             transform: translateX(0);
//           }
//           .sidebar-backdrop {
//             display: block !important;
//           }
//         }
//       `}</style>

//       <div className={`agent-sidebar${isOpen ? " open" : ""}`} style={{
//         width: 240, flexShrink: 0,
//         display: "flex", flexDirection: "column",
//         background: "rgb(4,11,20)",
//         borderRight: "1px solid rgba(255,255,255,0.07)",
//         transition: "transform 0.25s ease",
//       }}>
//         {/* Mood accent strip */}
//         <div style={{ height: 3, background: mood.accent, transition: "background 0.5s ease", flexShrink: 0 }} />

//         {/* Avatar section */}
//         <div style={{
//           padding: "22px 18px 16px",
//           display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
//           borderBottom: "1px solid rgba(255,255,255,0.05)",
//           flexShrink: 0,
//         }}>
//           <div style={{
//             width: 84, height: 84, borderRadius: "50%", overflow: "hidden",
//             background: mood.softBg,
//             boxShadow: `0 6px 28px ${mood.accent}28, 0 0 0 1px ${mood.accent}18`,
//             transition: "box-shadow 0.5s ease",
//             display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
//           }}>
//             {!imgErr && emotion?.asset ? (
//               // eslint-disable-next-line @next/next/no-img-element
//               <img src={emotion.asset} alt={emotion.emotion}
//                 style={{ width: "100%", height: "100%", objectFit: "cover" }}
//                 onError={() => setImgErr(true)} />
//             ) : (
//               <span style={{ fontSize: 38, lineHeight: 1 }}>{mood.emoji}</span>
//             )}
//           </div>

//           <span style={{
//             padding: "4px 12px", borderRadius: 20,
//             background: mood.softBg, color: mood.textColor,
//             fontSize: 12, fontWeight: 600, fontFamily: "var(--font-display)",
//             border: `1px solid ${mood.accent}30`,
//           }}>
//             {mood.label}
//           </span>

//           <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-display)", margin: 0, textAlign: "center" }}>
//             Watching <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{coinId.toUpperCase()}</span>
//           </p>

//           {emotion && (
//             <div style={{ width: "100%", padding: "9px 11px", borderRadius: 10, background: mood.softBg, border: `1px solid ${mood.accent}18` }}>
//               <p style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-display)", margin: 0, fontStyle: "italic" }}>
//                 "{emotion.message.slice(0, 70)}{emotion.message.length > 70 ? "…" : ""}"
//               </p>
//             </div>
//           )}

//           {emotion && (
//             <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
//               <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-display)" }}>Intensity</span>
//               <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
//                 {[1, 2, 3].map(n => (
//                   <div key={n} style={{
//                     width: 8, height: 8, borderRadius: "50%",
//                     background: (n === 1 || (n === 2 && (emotion.intensity === "medium" || emotion.intensity === "high")) || (n === 3 && emotion.intensity === "high"))
//                       ? mood.accent : "rgba(255,255,255,0.12)",
//                     transition: "background 0.3s ease",
//                   }} />
//                 ))}
//               </div>
//             </div>
//           )}
//         </div>

//         {/* Action buttons */}
//         <div style={{ padding: "14px 14px 10px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 7 }}>
//           <button
//             onClick={onNewSession} disabled={loading}
//             style={{
//               width: "100%", padding: "10px 0", borderRadius: 10,
//               fontSize: 13, fontWeight: 600, fontFamily: "var(--font-display)",
//               color: "rgba(255,255,255,0.65)",
//               background: "rgba(255,255,255,0.05)",
//               border: "1px solid rgba(255,255,255,0.09)",
//               cursor: loading ? "not-allowed" : "pointer",
//               display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
//               opacity: loading ? 0.5 : 1, transition: "all 0.15s ease",
//             }}
//             onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"; } }}
//             onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)"; }}
//           >
//             <span style={{ fontSize: 14 }}>✦</span> New Chat
//           </button>

//           <button
//             onClick={onRunAnalysis} disabled={loading}
//             style={{
//               width: "100%", padding: "10px 0", borderRadius: 10,
//               fontSize: 13, fontWeight: 600, fontFamily: "var(--font-display)",
//               color: loading ? "rgba(255,255,255,0.3)" : "#020609",
//               background: loading ? "rgb(12,24,42)" : mood.accent,
//               border: "none", cursor: loading ? "not-allowed" : "pointer",
//               opacity: loading ? 0.6 : 1, transition: "all 0.25s ease",
//             }}
//             onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
//             onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = loading ? "0.6" : "1"; }}
//           >
//             {loading ? "Working…" : "▶ Run Analysis"}
//           </button>
//         </div>

//         {/* Session list */}
//         <div style={{ flex: 1, overflowY: "auto", padding: "4px 10px 16px", display: "flex", flexDirection: "column", gap: 0 }}>
//           {sessions.length === 0 ? (
//             <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 16, fontFamily: "var(--font-display)" }}>
//               No past sessions yet
//             </p>
//           ) : (
//             grouped.map(group => (
//               <div key={group.label}>
//                 <p style={{
//                   fontSize: 11, color: "rgba(255,255,255,0.28)",
//                   letterSpacing: "0.06em", textTransform: "uppercase",
//                   padding: "10px 6px 4px", margin: 0, fontFamily: "var(--font-display)",
//                 }}>
//                   {group.label}
//                 </p>

//                 {group.items.map(s => {
//                   const isActive     = s.sessionId === currentSessionId;
//                   const emo          = s.currentEmotion;
//                   const m            = emo ? MOOD[emo.emotion] : MOOD.thinking;
//                   const isConfirming = confirmId === s.sessionId;

//                   return (
//                     <div key={s.sessionId} style={{
//                       borderRadius: 10,
//                       background: isActive ? `${m.accent}12` : "transparent",
//                       border: `1px solid ${isActive ? m.accent + "30" : "transparent"}`,
//                       marginBottom: 3, transition: "all 0.15s ease", overflow: "hidden",
//                     }}>
//                       <button
//                         onClick={() => { if (!isConfirming) { onSwitch(s.sessionId); onClose(); } }}
//                         style={{ width: "100%", padding: "10px 10px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 9 }}
//                         onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
//                         onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
//                       >
//                         <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{m.emoji}</span>
//                         <div style={{ flex: 1, minWidth: 0 }}>
//                           <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
//                             <span style={{ fontSize: 11, color: m.textColor, fontWeight: 600, background: `${m.accent}14`, padding: "1px 6px", borderRadius: 4, letterSpacing: "0.03em" }}>
//                               {s.coinId.toUpperCase()}
//                             </span>
//                             <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginLeft: "auto" }}>
//                               {s.messageCount}m
//                             </span>
//                           </div>
//                           <p style={{
//                             fontFamily: "var(--font-display)", fontSize: 12,
//                             color: isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)",
//                             lineHeight: 1.45, margin: 0,
//                             overflow: "hidden", textOverflow: "ellipsis",
//                             display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
//                             fontWeight: isActive ? 500 : 400,
//                           }}>
//                             {s.lastMessage ?? "New conversation"}
//                           </p>
//                         </div>
//                       </button>

//                       <div style={{ display: "flex", gap: 4, padding: "0 10px 7px" }}>
//                         {isConfirming ? (
//                           <>
//                             <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "rgba(255,85,114,0.8)", flex: 1 }}>Delete this chat?</span>
//                             <button onClick={() => handleDelete(s.sessionId)} disabled={deletingId === s.sessionId} style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 600, color: "#ff5572", background: "rgba(255,85,114,0.12)", border: "1px solid rgba(255,85,114,0.3)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
//                               {deletingId === s.sessionId ? "…" : "Yes"}
//                             </button>
//                             <button onClick={() => setConfirmId(null)} style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "rgba(255,255,255,0.35)", background: "transparent", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
//                               No
//                             </button>
//                           </>
//                         ) : (
//                           <button
//                             onClick={e => { e.stopPropagation(); setConfirmId(s.sessionId); }}
//                             style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", background: "transparent", border: "none", cursor: "pointer", padding: "2px 5px", borderRadius: 5, marginLeft: "auto" }}
//                             onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ff5572"; }}
//                             onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.25)"; }}
//                             title="Delete chat"
//                           >
//                             ✕
//                           </button>
//                         )}
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             ))
//           )}
//         </div>
//       </div>
//     </>
//   );
// }

// // ── Message bubble ────────────────────────────────────────────────────────────
// function Bubble({ msg, cur }: { msg: ChatMessage; cur: AgentEmotion | null }) {
//   const isUser = msg.role === "user";
//   const emo    = msg.emotion ?? cur;
//   const mood   = emo ? MOOD[emo.emotion] : MOOD.thinking;

//   return (
//     <div style={{ display: "flex", gap: 10, flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-start" }}>
//       {!isUser && (
//         <div style={{
//           width: 32, height: 32, borderRadius: "50%", background: mood.softBg,
//           display: "flex", alignItems: "center", justifyContent: "center",
//           fontSize: 16, flexShrink: 0, marginTop: 2,
//           border: `1px solid ${mood.accent}22`,
//         }}>
//           {mood.emoji}
//         </div>
//       )}
//       <div style={{
//         display: "flex", flexDirection: "column", gap: 4,
//         maxWidth: "78%",
//         alignItems: isUser ? "flex-end" : "flex-start",
//         width: (msg.report || msg.toolResult) ? "100%" : undefined,
//       }}>
//         <div style={{
//           padding: "12px 16px",
//           fontSize: 15,
//           lineHeight: 1.7,
//           fontFamily: "var(--font-display)", fontWeight: 400,
//           ...(isUser ? {
//             background: "rgb(14,28,48)", color: "rgba(255,255,255,0.88)",
//             borderRadius: "18px 18px 4px 18px",
//             border: "1px solid rgba(255,255,255,0.12)",
//           } : {
//             background: "rgb(8,18,32)", color: "rgba(255,255,255,0.72)",
//             borderRadius: "18px 18px 18px 4px",
//             border: "1px solid rgba(255,255,255,0.07)",
//             boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
//           }),
//         }}>
//           {msg.content}
//         </div>
//         {!isUser && msg.report && (
//           <div style={{ width: "100%", marginTop: 6 }}>
//             <ReportBubble report={msg.report} />
//           </div>
//         )}
//         {!isUser && msg.toolLoading && (
//           <div style={{ marginTop: 6, padding: "10px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 8 }}>
//             <style>{`@keyframes ac-spin{to{transform:rotate(360deg)}}`}</style>
//             <span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${mood.softBg}`, borderTopColor: mood.accent, borderRadius: "50%", animation: "ac-spin 0.7s linear infinite", flexShrink: 0 }} />
//             <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Fetching data…</span>
//           </div>
//         )}
//         {!isUser && msg.toolResult && (
//           <div style={{ width: "100%", marginTop: 6 }}>
//             <AgentToolCard result={msg.toolResult} accentColor={mood.accent} />
//           </div>
//         )}
//         <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)", padding: "0 4px" }}>
//           {tLabel(msg.ts)}
//         </span>
//       </div>
//     </div>
//   );
// }

// // ── Restoring skeleton ────────────────────────────────────────────────────────
// function RestoringScreen({ mood }: { mood: { accent: string; emoji: string; softBg: string } }) {
//   return (
//     <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, opacity: 0.6 }}>
//       <div style={{
//         width: 56, height: 56, borderRadius: "50%", background: mood.softBg,
//         display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
//         animation: "pulse 1.5s ease-in-out infinite",
//       }}>
//         {mood.emoji}
//       </div>
//       <p style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>
//         Restoring session…
//       </p>
//       <style>{`@keyframes pulse { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }`}</style>
//     </div>
//   );
// }

// // ── Main AgentChat ────────────────────────────────────────────────────────────
// interface AgentChatProps {
//   coinId?:  string;
//   userId?:  string | null;
// }

// export function AgentChat({ coinId = "bitcoin", userId = null }: AgentChatProps) {
//   const {
//     sessionId,
//     isRestoring,
//     sessions,
//     startNewSession,
//     switchToSession,
//     deleteSession,
//     markSessionUpdated,
//     refreshSessionList,
//   } = useAgentSession(userId, coinId);

//   const [messages,    setMessages]    = useState<ChatMessage[]>([]);
//   const [emotion,     setEmotion]     = useState<AgentEmotion | null>(null);
//   const [input,       setInput]       = useState("");
//   const [loading,     setLoading]     = useState(false);
//   const [error,       setError]       = useState<string | null>(null);
//   const [showPrompts, setShowPrompts] = useState(true);
//   const [view,        setView]        = useState<"chat" | "dashboard">("chat");
//   const [sidebarOpen, setSidebarOpen] = useState(false);

//   const endRef   = useRef<HTMLDivElement>(null);
//   const inputRef = useRef<HTMLTextAreaElement>(null);
//   const prevSid  = useRef<string | null>(null);
//   const mood = emotion ? MOOD[emotion.emotion] : MOOD.thinking;

//   useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

//   useEffect(() => {
//     if (!sessionId || sessionId === prevSid.current) return;
//     prevSid.current = sessionId;
//     setMessages([]);
//     setEmotion(null);
//     setShowPrompts(true);

//     apiClient.get<{ messages: ChatMessage[]; currentEmotion: AgentEmotion }>(`/agent/session/${sessionId}`)
//       .then(data => {
//         if (data?.messages?.length > 0) {
//           const real = data.messages.filter(m => m.content !== "__init__");
//           if (real.length > 0) {
//             setMessages(real);
//             setEmotion(data.currentEmotion ?? null);
//             setShowPrompts(false);
//           }
//         }
//       })
//       .catch(() => { });
//   }, [sessionId]);

//   useEffect(() => {
//     if (!isRestoring && userId) refreshSessionList();
//   }, [isRestoring, userId, refreshSessionList]);

//   const handleNewSession = useCallback(async () => { await startNewSession(); }, [startNewSession]);
//   const handleSwitch      = useCallback((sid: string) => { if (sid !== sessionId) switchToSession(sid); }, [sessionId, switchToSession]);
//   const handleDelete      = useCallback(async (sid: string) => { await deleteSession(sid); }, [deleteSession]);

//   // ── Tool dispatch — calls backend APIs and attaches result to the message ──
//   const dispatchTool = useCallback(async (
//     intent: { type: ToolResult["type"]; symbol?: string },
//     agentMsgTs: number
//   ) => {
//     // Mark the agent message as loading a card
//     setMessages(prev => prev.map(m => m.ts === agentMsgTs ? { ...m, toolLoading: true } : m));
//     try {
//       let result: ToolResult | null = null;
//       // Derive symbol: prefer explicit, else derive from coinId prop
//       const sym = intent.symbol
//         ?? (coinId !== "bitcoin" ? coinId.toUpperCase().replace("USDT","") + "USDT" : "BTCUSDT");

//       switch (intent.type) {
//         case "chart_analyze": {
//           const res = await apiClient.post<any>(`/chart/analyze/${sym}`, {});
//           result = { type: "chart_analyze", symbol: sym, data: res.data };
//           break;
//         }
//         case "chart_primitives": {
//           const res = await apiClient.get<any>(`/chart/primitives/${sym}`);
//           result = { type: "chart_primitives", symbol: sym, data: res.data };
//           break;
//         }
//         case "intelligence_scan": {
//           const res = await apiClient.get<any>("/intelligence/scan");
//           result = { type: "intelligence_scan", data: res.data };
//           break;
//         }
//         case "intelligence_coin": {
//           const coinSym = sym.replace("USDT", "");
//           const res = await apiClient.get<any>(`/intelligence/coin/${coinSym}`);
//           result = { type: "intelligence_coin", symbol: coinSym, data: res.data };
//           break;
//         }
//         case "orderblocks_active": {
//           const res = await apiClient.get<any>(`/orderblocks/active/${sym}`);
//           result = { type: "orderblocks_active", symbol: sym, data: res.data };
//           break;
//         }
//         case "orderblocks_sync": {
//           const res = await apiClient.post<any>(`/orderblocks/sync/${sym}`, {});
//           result = { type: "orderblocks_sync", symbol: sym, data: res.data };
//           break;
//         }
//         case "agent_runs": {
//           const res = await apiClient.get<any>("/agent-runs?limit=10&status=completed");
//           result = { type: "agent_runs", data: res };
//           break;
//         }
//       }
//       if (result) {
//         setMessages(prev => prev.map(m =>
//           m.ts === agentMsgTs ? { ...m, toolLoading: false, toolResult: result! } : m
//         ));
//       }
//     } catch {
//       setMessages(prev => prev.map(m =>
//         m.ts === agentMsgTs ? { ...m, toolLoading: false } : m
//       ));
//     }
//   }, [coinId]);

//   const runAnalysis = useCallback(async () => {
//     if (!sessionId) return;
//     setLoading(true); setShowPrompts(false); setError(null);

//     try {
//       const startRes = await apiClient.post<ChatResponse>("/agent/chat", {
//         sessionId, message: "Running analysis...", coinId, isAnalysing: true,
//         ...(userId ? { userId } : {}),
//       });
//       setEmotion(startRes.emotion);
//       setMessages(startRes.history);
//     } catch { }

//     try {
//       const result = await apiClient.post<RunAnalysisResponse>(`/analysis/${coinId}/run`, { sessionId });
//       const agentOut = result.agentOutput;
//       if (agentOut) {
//         setEmotion(agentOut.emotion);
//         const history: ChatMessage[] = agentOut.history.map((m, i) =>
//           (i === agentOut.history.length - 1 && m.role === "agent" && agentOut.analysisReport)
//             ? { ...m, report: agentOut.analysisReport } : m
//         );
//         setMessages(history);
//         const last = history[history.length - 1];
//         if (last) {
//           markSessionUpdated(sessionId, last.content, agentOut.emotion);
//           // Auto-dispatch tool if agent signals intent
//           const intent = parseToolIntent(last.content);
//           if (intent) dispatchTool(intent, last.ts);
//         }
//       }
//     } catch (e: any) {
//       setError(e.message ?? "Analysis failed");
//     } finally {
//       setLoading(false); inputRef.current?.focus();
//     }
//   }, [sessionId, coinId, userId, markSessionUpdated]);

//   const send = useCallback(async (text: string) => {
//     if (!text.trim() || loading || !sessionId) return;
//     const analysisKeywords = ["run analysis", "analyze", "analyse", "run it", "check market", "full analysis"];
//     if (analysisKeywords.some(k => text.toLowerCase().includes(k))) { await runAnalysis(); return; }

//     setMessages(p => [...p, { role: "user", content: text.trim(), ts: Date.now() }]);
//     setInput(""); setLoading(true); setError(null); setShowPrompts(false);

//     try {
//       const res = await apiClient.post<ChatResponse>("/agent/chat", {
//         sessionId, message: text.trim(), coinId,
//         ...(userId ? { userId } : {}),
//       });
//       setEmotion(res.emotion);
//       setMessages(res.history);
//       markSessionUpdated(sessionId, res.content, res.emotion);
//       // Auto-dispatch tool if agent response signals a data intent
//       const lastMsg = res.history[res.history.length - 1];
//       if (lastMsg?.role === "agent") {
//         const intent = parseToolIntent(lastMsg.content);
//         if (intent) dispatchTool(intent, lastMsg.ts);
//       }
//       if (res.suggestAnalysis) { await runAnalysis(); return; }
//     } catch (e: any) {
//       setError(e.message ?? "Something went wrong");
//       setMessages(p => p.slice(0, -1));
//     } finally {
//       setLoading(false); inputRef.current?.focus();
//     }
//   }, [loading, sessionId, coinId, userId, runAnalysis, markSessionUpdated]);

//   return (
//     <div style={{ display: "flex", height: "100%", minHeight: 0, background: "rgb(2,6,9)" }}>
//       <style>{`
//         @media (max-width: 640px) {
//           .agent-main-header { padding: 10px 14px !important; }
//           .agent-messages-area { padding: 16px 14px 8px !important; }
//           .agent-input-wrap { padding: 10px 12px 14px !important; }
//         }
//       `}</style>

//       <SessionSidebar
//         sessions={sessions} currentSessionId={sessionId} coinId={coinId}
//         loading={loading} emotion={emotion}
//         onNewSession={handleNewSession} onSwitch={handleSwitch}
//         onDelete={handleDelete} onRunAnalysis={runAnalysis}
//         isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
//       />

//       <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

//         {/* Header */}
//         <div className="agent-main-header" style={{
//           padding: "13px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
//           background: "rgb(4,11,20)", display: "flex", alignItems: "center",
//           justifyContent: "space-between", flexShrink: 0, gap: 10,
//         }}>
//           <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//             {/* Mobile menu button */}
//             <button
//               onClick={() => setSidebarOpen(v => !v)}
//               className="mobile-menu-btn"
//               style={{
//                 display: "none",
//                 width: 36, height: 36, borderRadius: 8,
//                 background: "rgba(255,255,255,0.05)",
//                 border: "1px solid rgba(255,255,255,0.09)",
//                 cursor: "pointer", alignItems: "center", justifyContent: "center",
//                 fontSize: 16, color: "rgba(255,255,255,0.6)",
//                 flexShrink: 0,
//               }}
//             >
//               ☰
//             </button>
//             <style>{`@media (max-width: 640px) { .mobile-menu-btn { display: flex !important; } }`}</style>

//             <div style={{ width: 9, height: 9, borderRadius: "50%", background: mood.accent, boxShadow: `0 0 0 3px ${mood.accent}20`, transition: "all 0.4s ease", flexShrink: 0 }} />
//             <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>
//               {coinId.charAt(0).toUpperCase() + coinId.slice(1)} Agent
//             </span>
//           </div>

//           <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
//             {/* View toggle */}
//             <div style={{ display: "flex", background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
//               {(["chat", "dashboard"] as const).map(v => (
//                 <button key={v} onClick={() => setView(v)} style={{
//                   padding: "6px 13px", fontSize: 12, fontWeight: 600,
//                   fontFamily: "var(--font-display)", border: "none", cursor: "pointer",
//                   background: view === v ? mood.softBg : "transparent",
//                   color: view === v ? mood.textColor : "rgba(255,255,255,0.3)",
//                   transition: "all 0.15s ease",
//                 }}>
//                   {v === "chat" ? "Chat" : "Agent"}
//                 </button>
//               ))}
//             </div>

//             {emotion && view === "chat" && (
//               <span style={{
//                 padding: "4px 11px", borderRadius: 20, background: mood.softBg, color: mood.textColor,
//                 fontSize: 12, fontWeight: 500, fontFamily: "var(--font-display)",
//                 border: `1px solid ${mood.accent}25`, transition: "all 0.4s ease",
//                 display: "flex", alignItems: "center", gap: 5,
//               }}>
//                 {mood.emoji} {mood.label}
//               </span>
//             )}
//           </div>
//         </div>

//         {/* Main content — chat or dashboard */}
//         {view === "dashboard" ? (
//           <div style={{ flex: 1, minHeight: 0 }}>
//             <AgentDashboard accentColor={mood.accent} />
//           </div>
//         ) : (
//           <>
//             {/* Messages area */}
//             <div className="agent-messages-area" style={{ flex: 1, overflowY: "auto", padding: "24px 20px 8px", display: "flex", flexDirection: "column", gap: 18, minHeight: 0 }}>
//               {isRestoring && <RestoringScreen mood={mood} />}

//               {!isRestoring && messages.length === 0 && !loading && (
//                 <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14, textAlign: "center" }}>
//                   <span style={{ fontSize: 52, lineHeight: 1 }}>{mood.emoji}</span>
//                   <div>
//                     <p style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 8px" }}>
//                       Hey! I'm your market agent.
//                     </p>
//                     <p style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, maxWidth: 280, margin: 0 }}>
//                       Ask me anything about {coinId.toUpperCase()} — I'll give you my honest take.
//                     </p>
//                   </div>
//                 </div>
//               )}

//               {!isRestoring && showPrompts && messages.length === 0 && (
//                 <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
//                   <p style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
//                     Try asking…
//                   </p>
//                   <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
//                     {PROMPTS.map((p, i) => (
//                       <button key={i} onClick={() => send(p)} style={{
//                         textAlign: "left", padding: "12px 16px", borderRadius: 12,
//                         fontSize: 14, fontFamily: "var(--font-display)", fontWeight: 400,
//                         color: "rgba(255,255,255,0.55)", background: "rgb(8,18,32)",
//                         border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer",
//                         transition: "all 0.15s ease", width: "100%", lineHeight: 1.5,
//                       }}
//                         onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = mood.accent; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"; (e.currentTarget as HTMLElement).style.background = mood.softBg; }}
//                         onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; (e.currentTarget as HTMLElement).style.background = "rgb(8,18,32)"; }}
//                       >{p}</button>
//                     ))}
//                   </div>
//                 </div>
//               )}

//               {messages.map((m, i) => <Bubble key={`${m.ts}-${i}`} msg={m} cur={emotion} />)}

//               {loading && (
//                 <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
//                   <div style={{ width: 32, height: 32, borderRadius: "50%", background: mood.softBg, border: `1px solid ${mood.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{mood.emoji}</div>
//                   <div style={{ padding: "12px 18px", background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px 18px 18px 4px", boxShadow: "0 2px 10px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 6 }}>
//                     <TypingDots color={mood.accent} />
//                   </div>
//                 </div>
//               )}

//               {error && (
//                 <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,85,114,0.07)", border: "1px solid rgba(255,85,114,0.2)", fontSize: 14, color: "#ff5572", fontFamily: "var(--font-display)", lineHeight: 1.5 }}>
//                   {error}
//                 </div>
//               )}
//               <div ref={endRef} />
//             </div>

//             {/* Quick chips */}
//             {messages.length > 0 && (
//               <div style={{ padding: "8px 20px 0", display: "flex", flexWrap: "wrap", gap: 7, background: "rgb(2,6,9)" }}>
//                 {/* Conversation chips */}
//                 {["How are you?", "Run analysis", "Biggest risks?", "Buy or sell?"].map(p => (
//                   <button key={p} onClick={() => send(p)} disabled={loading}
//                     style={{
//                       padding: "6px 14px", borderRadius: 20, fontSize: 13, fontFamily: "var(--font-display)",
//                       fontWeight: 500, color: "rgba(255,255,255,0.5)", background: "rgb(8,18,32)",
//                       border: "1px solid rgba(255,255,255,0.08)", cursor: loading ? "not-allowed" : "pointer",
//                       transition: "all 0.15s ease", opacity: loading ? 0.5 : 1,
//                     }}
//                     onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.borderColor = mood.accent; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"; (e.currentTarget as HTMLElement).style.background = mood.softBg; } }}
//                     onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"; (e.currentTarget as HTMLElement).style.background = "rgb(8,18,32)"; }}
//                   >{p}</button>
//                 ))}
//                 {/* Tool dispatch chips — directly call backend, render card inline */}
//                 {([
//                   { label: "📊 Analyse",        type: "chart_analyze"     },
//                   { label: "🔍 Scan market",    type: "intelligence_scan" },
//                   { label: "🧱 Order blocks",   type: "orderblocks_active"},
//                   { label: "⚗️ Primitives",     type: "chart_primitives"  },
//                 ] as { label: string; type: ToolResult["type"] }[]).map(chip => (
//                   <button key={chip.label}
//                     disabled={loading}
//                     onClick={() => {
//                       const ts = Date.now();
//                       setMessages(prev => [...prev, {
//                         role: "agent",
//                         content: `Fetching ${chip.label.replace(/^\S+\s*/, "")}…`,
//                         ts,
//                         emotion: emotion ?? undefined,
//                         toolLoading: true,
//                       }]);
//                       setShowPrompts(false);
//                       dispatchTool({ type: chip.type }, ts);
//                     }}
//                     style={{
//                       padding: "6px 14px", borderRadius: 20, fontSize: 13, fontFamily: "var(--font-display)",
//                       fontWeight: 500, color: mood.textColor, background: mood.softBg,
//                       border: `1px solid ${mood.accent}35`, cursor: loading ? "not-allowed" : "pointer",
//                       transition: "all 0.15s ease", opacity: loading ? 0.5 : 1,
//                     }}
//                     onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
//                     onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = loading ? "0.5" : "1"; }}
//                   >{chip.label}</button>
//                 ))}
//               </div>
//             )}

//             {/* Input */}
//             <div className="agent-input-wrap" style={{ padding: "12px 16px 18px", background: "rgb(2,6,9)", flexShrink: 0 }}>
//               <div style={{
//                 display: "flex", alignItems: "flex-end", gap: 8,
//                 background: "rgb(8,18,32)", border: "1.5px solid rgba(255,255,255,0.09)",
//                 borderRadius: 16, padding: "6px 6px 6px 18px", transition: "border-color 0.2s ease",
//               }}>
//                 <textarea
//                   ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
//                   onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
//                   onFocus={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = mood.accent; }}
//                   onBlur={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)"; }}
//                   disabled={loading || isRestoring}
//                   placeholder={isRestoring ? "Restoring session…" : `Ask about ${coinId}...`}
//                   rows={1}
//                   style={{
//                     flex: 1, resize: "none", background: "transparent",
//                     padding: "10px 0", fontSize: 15, color: "rgba(255,255,255,0.88)",
//                     fontFamily: "var(--font-display)", outline: "none",
//                     minHeight: 44, maxHeight: 140, lineHeight: 1.55, border: "none",
//                   }}
//                   onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 140)}px`; }}
//                 />
//                 <button
//                   onClick={() => send(input)} disabled={!input.trim() || loading || isRestoring}
//                   style={{
//                     width: 42, height: 42, borderRadius: 12, flexShrink: 0,
//                     background: !input.trim() || loading || isRestoring ? "rgb(12,24,42)" : mood.accent,
//                     border: "none", cursor: !input.trim() || loading || isRestoring ? "not-allowed" : "pointer",
//                     display: "flex", alignItems: "center", justifyContent: "center",
//                     transition: "all 0.2s ease",
//                     color: !input.trim() || loading || isRestoring ? "rgba(255,255,255,0.25)" : "#020609",
//                     fontSize: 18, opacity: !input.trim() || loading || isRestoring ? 0.5 : 1,
//                   }}
//                   onMouseEnter={e => { if (input.trim() && !loading && !isRestoring) (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
//                   onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = !input.trim() || loading || isRestoring ? "0.5" : "1"; }}
//                 >↑</button>
//               </div>
//               <p style={{ marginTop: 7, fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-mono)", textAlign: "center" }}>
//                 Enter to send · Shift+Enter for new line
//               </p>
//             </div>
//           </>
//         )}
//       </div>
//     </div>
//   );
// }



"use client";

import { useState, useEffect, useRef } from "react";
import {
  TrendingUp,
  Zap,
  Waves,
  Newspaper,
  CandlestickChart,
  Search,
  Target,
  FlaskConical,
  Calculator,
  Scale,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ChevronDown,
  ChevronUp,
  BarChart3,
  LineChart,
  Brain,
  ShieldAlert,
  LayoutList,
  Coins,
  RefreshCw,
} from "lucide-react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SkillResult {
  name:    string;
  verdict: "bullish" | "bearish" | "neutral";
  score:   number;
  summary: string;
}

export interface ReasoningStep {
  step:      number;
  phase:     string;
  title:     string;
  detail:    string;
  score?:    number;
  decision?: string;
  weight?:   number;
}

export interface AnalysisReport {
  verdict:    string;
  score:      number;
  confidence: number;
  narrative:  string;
  keyPoints:  string[];
  risks:      string[];
  skillsUsed: string[];
  skills:     SkillResult[];
  reasoning:  ReasoningStep[];
  coinName:   string;
  symbol:     string;
  priceAtRun: number;
  runAt:      string;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const VM: Record<string, { label: string; color: string; bg: string; border: string; glow: string }> = {
  strong_buy:  { label: "STRONG BUY",  color: "#00e5a0", bg: "rgba(0,229,160,0.08)",   border: "rgba(0,229,160,0.22)",   glow: "rgba(0,229,160,0.15)"  },
  buy:         { label: "BUY",         color: "#4ade80", bg: "rgba(74,222,128,0.07)",   border: "rgba(74,222,128,0.18)",   glow: "rgba(74,222,128,0.10)" },
  neutral:     { label: "NEUTRAL",     color: "#94a3b8", bg: "rgba(148,163,184,0.06)",  border: "rgba(148,163,184,0.16)",  glow: "rgba(148,163,184,0.08)"},
  sell:        { label: "SELL",        color: "#fb923c", bg: "rgba(251,146,60,0.07)",   border: "rgba(251,146,60,0.18)",   glow: "rgba(251,146,60,0.10)" },
  strong_sell: { label: "STRONG SELL", color: "#ff5572", bg: "rgba(255,85,114,0.08)",   border: "rgba(255,85,114,0.22)",   glow: "rgba(255,85,114,0.15)" },
};

const SC: Record<string, string> = {
  bullish: "#00e5a0",
  bearish: "#ff5572",
  neutral: "#94a3b8",
};

const PHASE_COLOR: Record<string, string> = {
  context:         "#60a5fa",
  skill_selection: "#a78bfa",
  skill_result:    "#00e5a0",
  synthesis:       "#ffb020",
  verdict:         "#f472b6",
};

const SKILL_WEIGHTS: Record<string, number> = {
  trend: 0.30, momentum: 0.25, volatility: 0.20, sentiment: 0.15, pattern: 0.10,
  yield: 0.10, rotation: 0.10,
};

// ── Lucide icon maps (replaces emoji) ─────────────────────────────────────────
const SKILL_ICON_MAP: Record<string, React.ReactNode> = {
  trend:      <TrendingUp size={14} />,
  momentum:   <Zap size={14} />,
  volatility: <Waves size={14} />,
  sentiment:  <Newspaper size={14} />,
  pattern:    <CandlestickChart size={14} />,
  yield:      <Coins size={14} />,
  rotation:   <RefreshCw size={14} />,
};

const PHASE_ICON_MAP: Record<string, React.ReactNode> = {
  context:         <Search size={13} />,
  skill_selection: <Target size={13} />,
  skill_result:    <FlaskConical size={13} />,
  synthesis:       <Calculator size={13} />,
  verdict:         <Scale size={13} />,
};

const PHASE_LABELS: Record<string, string> = {
  context:         "Data Load",
  skill_selection: "Skill Select",
  skill_result:    "Skill Results",
  synthesis:       "Synthesis",
  verdict:         "Verdict",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function useAnimated(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal((target) * ease);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

// ── 1. SCORE GAUGE (unchanged) ────────────────────────────────────────────────
function ScoreGauge({ score, color }: { score: number; color: string }) {
  const animated = useAnimated(score, 1000);
  const cx = 90, cy = 90, r = 72;
  const toAngle = (s: number) => ((s + 100) / 200) * Math.PI;
  const toXY = (angle: number) => ({
    x: cx - r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  });
  const startAngle = 0;
  const endAngle   = Math.PI;
  const p1 = toXY(startAngle);
  const p2 = toXY(endAngle);
  const trackPath = `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;
  const fillAngle = toAngle(Math.max(-100, Math.min(100, animated)));
  const pFill = toXY(fillAngle);
  const large = fillAngle > Math.PI / 2 ? 1 : 0;
  const fillPath = `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${pFill.x} ${pFill.y}`;
  const needleEnd = toXY(fillAngle);
  const zones = [
    { label: "-100", angle: 0 },
    { label: "-50",  angle: Math.PI * 0.25 },
    { label: "0",    angle: Math.PI * 0.5  },
    { label: "+50",  angle: Math.PI * 0.75 },
    { label: "+100", angle: Math.PI        },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={180} height={110} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#ff5572" />
            <stop offset="50%"  stopColor="#ffb020" />
            <stop offset="100%" stopColor="#00e5a0" />
          </linearGradient>
          <filter id="glowF">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} strokeLinecap="round" />
        <path d={fillPath} fill="none" stroke="url(#gaugeGrad)" strokeWidth={10} strokeLinecap="round" />
        <path d={fillPath} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
          opacity={0.18} filter="url(#glowF)" />
        {zones.map(z => {
          const inner = { x: cx - (r - 14) * Math.cos(z.angle), y: cy - (r - 14) * Math.sin(z.angle) };
          const outer = { x: cx - (r + 2)  * Math.cos(z.angle), y: cy - (r + 2)  * Math.sin(z.angle) };
          const lbl   = { x: cx - (r + 16) * Math.cos(z.angle), y: cy - (r + 16) * Math.sin(z.angle) };
          return (
            <g key={z.label}>
              <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
              <text x={lbl.x} y={lbl.y} textAnchor="middle" dominantBaseline="middle"
                fontSize={10} fill="rgba(255,255,255,0.25)" fontFamily="monospace">
                {z.label}
              </text>
            </g>
          );
        })}
        <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y}
          stroke={color} strokeWidth={2.5} strokeLinecap="round" filter="url(#glowF)" />
        <circle cx={cx} cy={cy} r={5} fill={color} />
        <circle cx={cx} cy={cy} r={3} fill="rgb(6,14,26)" />
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize={24} fontWeight={700}
          fill={color} fontFamily="monospace">
          {animated >= 0 ? "+" : ""}{Math.round(animated)}
        </text>
        <text x={cx} y={cy + 30} textAnchor="middle" fontSize={12} fill="rgba(255,255,255,0.3)" fontFamily="monospace">
          SIGNAL SCORE
        </text>
      </svg>
    </div>
  );
}

// ── 2. RADAR → Horizontal Bar Chart ──────────────────────────────────────────
function SkillBarChart({ skills }: { skills: SkillResult[] }) {
  const labels  = skills.map(s => s.name.toUpperCase());
  const scores  = skills.map(s => s.score);
  const bgColors = skills.map(s =>
    s.verdict === "bullish" ? "rgba(0,229,160,0.75)"
    : s.verdict === "bearish" ? "rgba(255,85,114,0.75)"
    : "rgba(148,163,184,0.65)"
  );
  const borderColors = skills.map(s =>
    s.verdict === "bullish" ? "#00e5a0"
    : s.verdict === "bearish" ? "#ff5572"
    : "#94a3b8"
  );

  const data = {
    labels,
    datasets: [{
      label: "Score",
      data: scores,
      backgroundColor: bgColors,
      borderColor: borderColors,
      borderWidth: 1.5,
      borderRadius: 4,
      borderSkipped: false,
    }],
  };

  const options = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` Score: ${ctx.raw > 0 ? "+" : ""}${ctx.raw}`,
        },
        backgroundColor: "rgba(5,12,24,0.92)",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        titleColor: "#fff",
        bodyColor: "rgba(255,255,255,0.6)",
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        min: -100,
        max: 100,
        grid: {
          color: (ctx: any) =>
            ctx.tick.value === 0
              ? "rgba(255,255,255,0.18)"
              : "rgba(255,255,255,0.05)",
          lineWidth: (ctx: any) => ctx.tick.value === 0 ? 1.5 : 1,
        },
        ticks: {
          color: "rgba(255,255,255,0.3)",
          font: { family: "monospace", size: 12 },
          callback: (v: any) => `${v > 0 ? "+" : ""}${v}`,
          stepSize: 50,
        },
        border: { color: "rgba(255,255,255,0.08)" },
      },
     y: {
  grid: { display: false },
  ticks: {
    color: "rgba(255,255,255,0.5)",
    font: { family: "monospace", size: 12, weight: 700}, // <-- Error here
  },
  border: { color: "rgba(255,255,255,0.08)" },
},
    },
  };

  const height = Math.max(180, skills.length * 44 + 40);

  return (
    <div>
      <p style={{
        fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.28)",
        fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
        margin: "0 0 12px",
      }}>
        Skill Scores
      </p>
      <div style={{ position: "relative", width: "100%", height }}>
        <Bar data={data} options={options} />
      </div>
      {/* Custom legend */}
      <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
        {[
          { label: "Bullish", color: "#00e5a0" },
          { label: "Neutral", color: "#94a3b8" },
          { label: "Bearish", color: "#ff5572" },
        ].map(item => (
          <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{
              width: 10, height: 10, borderRadius: 2,
              background: item.color, flexShrink: 0,
            }} />
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
              {item.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── 3. SIGNAL WATERFALL → Grouped Bar Chart ───────────────────────────────────
function SignalWaterfall({ skills, finalScore }: { skills: SkillResult[]; finalScore: number }) {
  const contributions = skills.map(s => {
    const w = SKILL_WEIGHTS[s.name] ?? 0.1;
    return { ...s, weight: w, contrib: Math.round(s.score * w) };
  });

  const labels = contributions.map(c => c.name.toUpperCase());
  const rawScores = contributions.map(c => c.score);
  const contribs  = contributions.map(c => c.contrib);

  const barColor  = (val: number) =>
    val > 0 ? "rgba(0,229,160,0.75)" : val < 0 ? "rgba(255,85,114,0.75)" : "rgba(148,163,184,0.55)";
  const borderColor = (val: number) =>
    val > 0 ? "#00e5a0" : val < 0 ? "#ff5572" : "#94a3b8";

  const data = {
    labels,
    datasets: [
      {
        label: "Raw Score",
        data: rawScores,
        backgroundColor: rawScores.map(barColor),
        borderColor: rawScores.map(borderColor),
        borderWidth: 1.5,
        borderRadius: 3,
        borderSkipped: false,
        barPercentage: 0.5,
        categoryPercentage: 0.7,
      },
      {
        label: "Weighted Contrib",
        data: contribs,
        backgroundColor: contribs.map(v => barColor(v).replace("0.75", "0.45")),
        borderColor: contribs.map(borderColor),
        borderWidth: 1.5,
        borderRadius: 3,
        borderSkipped: false,
        barPercentage: 0.5,
        categoryPercentage: 0.7,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.raw > 0 ? "+" : ""}${ctx.raw}`,
        },
        backgroundColor: "rgba(5,12,24,0.92)",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        titleColor: "#fff",
        bodyColor: "rgba(255,255,255,0.6)",
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "rgba(255,255,255,0.45)",
          font: { family: "monospace", size: 11, weight: 700 },
        },
        border: { color: "rgba(255,255,255,0.08)" },
      },
      y: {
        min: -100,
        max: 100,
        grid: {
          color: (ctx: any) =>
            ctx.tick.value === 0
              ? "rgba(255,255,255,0.18)"
              : "rgba(255,255,255,0.05)",
          lineWidth: (ctx: any) => ctx.tick.value === 0 ? 1.5 : 1,
        },
        ticks: {
          color: "rgba(255,255,255,0.3)",
          font: { family: "monospace", size: 12 },
          callback: (v: any) => `${v > 0 ? "+" : ""}${v}`,
          stepSize: 50,
        },
        border: { color: "rgba(255,255,255,0.08)" },
      },
    },
  };

  return (
    <div>
      <p style={{
        fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.28)",
        fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
        margin: "0 0 10px",
      }}>
        Signal Contribution
      </p>
      <div style={{ position: "relative", width: "100%", height: 200 }}>
        <Bar data={data} options={options} />
      </div>
      {/* Custom legend + total */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 10, flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {[
            { label: "Raw score", opacity: "0.75" },
            { label: "Weighted contrib", opacity: "0.45" },
          ].map((item, i) => (
            <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{
                width: 10, height: 10, borderRadius: 2,
                background: `rgba(0,229,160,${item.opacity})`,
                border: "1.5px solid #00e5a0",
                flexShrink: 0,
              }} />
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                {item.label}
              </span>
            </span>
          ))}
        </div>
        <span style={{
          fontFamily: "monospace", fontSize: 13, fontWeight: 700,
          color: finalScore >= 0 ? "#00e5a0" : "#ff5572",
        }}>
          Total: {finalScore >= 0 ? "+" : ""}{finalScore}
        </span>
      </div>
    </div>
  );
}

// ── 4. CONFIDENCE → Doughnut Chart ────────────────────────────────────────────
function ConfidenceBreakdown({ skills, confidence, color }: {
  skills: SkillResult[]; confidence: number; color: string;
}) {
  const animated = useAnimated(confidence, 1100);

  const bullish = skills.filter(s => s.verdict === "bullish").length;
  const bearish = skills.filter(s => s.verdict === "bearish").length;
  const neutral = skills.filter(s => s.verdict === "neutral").length;
  const total   = skills.length || 1;

  const agreement = bullish === total ? "All skills agree"
    : bearish === total ? "All skills bearish"
    : bullish === 0 || bearish === 0 ? "Mostly aligned"
    : "Conflicting signals";
  const agreementColor = bullish === total ? "#00e5a0" : bearish === total ? "#ff5572" : "#ffb020";
  const AgreementIcon  = bullish === total ? CheckCircle2 : bearish === total ? XCircle : AlertTriangle;

  // Doughnut: consensus breakdown
  const doughnutData = {
    labels: ["Bullish", "Neutral", "Bearish"],
    datasets: [{
      data: [bullish, neutral, bearish],
      backgroundColor: ["rgba(0,229,160,0.8)", "rgba(148,163,184,0.7)", "rgba(255,85,114,0.8)"],
      borderColor: ["#00e5a0", "#94a3b8", "#ff5572"],
      borderWidth: 1.5,
      hoverOffset: 4,
    }],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${ctx.raw}/${total} skills`,
        },
        backgroundColor: "rgba(5,12,24,0.92)",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        titleColor: "#fff",
        bodyColor: "rgba(255,255,255,0.6)",
        padding: 10,
        cornerRadius: 8,
      },
    },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Confidence bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>
            CONFIDENCE
          </span>
          <span style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color }}>
            {Math.round(animated)}%
          </span>
        </div>
        <div style={{ position: "relative", height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{
            position: "absolute", inset: "0 auto 0 0",
            width: `${animated}%`,
            background: `linear-gradient(90deg, ${color}66, ${color})`,
            borderRadius: 8,
            transition: "width 1.1s ease",
          }} />
        </div>
      </div>

      {/* Doughnut + center label */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
          <Doughnut data={doughnutData} options={doughnutOptions} />
          {/* Center label */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>
              {bullish}
            </span>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>
              / {total}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          {[
            { label: "Bullish", val: bullish, color: "#00e5a0" },
            { label: "Neutral", val: neutral, color: "#94a3b8" },
            { label: "Bearish", val: bearish, color: "#ff5572" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0 }} />
              <span style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(255,255,255,0.45)", flex: 1 }}>
                {item.label}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: item.color }}>
                {item.val}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Agreement badge */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", borderRadius: 8,
        background: `${agreementColor}10`,
        border: `1px solid ${agreementColor}25`,
      }}>
        <AgreementIcon size={14} color={agreementColor} />
        <span style={{ fontFamily: "monospace", fontSize: 13, color: agreementColor, fontWeight: 600 }}>
          {agreement}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
          {bullish}/{total} skills bullish
        </span>
      </div>
    </div>
  );
}

// ── 5. PHASE TIMELINE (Lucide icons replacing emoji) ─────────────────────────
function PhaseTimeline({ reasoning }: { reasoning: ReasoningStep[] }) {
  const [openStep, setOpenStep] = useState<number | null>(null);

  const phaseOrder  = ["context", "skill_selection", "skill_result", "synthesis", "verdict"];

  const grouped = phaseOrder.map(ph => ({
    phase: ph,
    steps: reasoning.filter(r => r.phase === ph),
    color: PHASE_COLOR[ph] ?? "#94a3b8",
    icon:  PHASE_ICON_MAP[ph] ?? <Search size={13} />,
    label: PHASE_LABELS[ph] ?? ph,
  })).filter(g => g.steps.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {grouped.map((group, gi) => (
        <div key={group.phase} style={{ display: "flex", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: `${group.color}18`,
              border: `2px solid ${group.color}50`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: group.color, zIndex: 1,
            }}>
              {group.icon}
            </div>
            {gi < grouped.length - 1 && (
              <div style={{ flex: 1, width: 2, background: `${group.color}20`, minHeight: 16 }} />
            )}
          </div>

          <div style={{ flex: 1, paddingBottom: gi < grouped.length - 1 ? 16 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, height: 28 }}>
              <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: group.color, letterSpacing: "0.08em" }}>
                {group.label.toUpperCase()}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                {group.steps.length} step{group.steps.length > 1 ? "s" : ""}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {group.steps.map(step => {
                const isOpen = openStep === step.step;
                return (
                  <div key={step.step} style={{
                    borderRadius: 8, overflow: "hidden",
                    border: `1px solid ${isOpen ? group.color + "35" : "rgba(255,255,255,0.06)"}`,
                    background: isOpen ? `${group.color}06` : "rgba(255,255,255,0.015)",
                    transition: "all 0.2s ease",
                  }}>
                    <button
                      onClick={() => setOpenStep(isOpen ? null : step.step)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 10px", background: "transparent", border: "none",
                        cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-display, sans-serif)", fontSize: 13, fontWeight: 600,
                        color: isOpen ? group.color : "rgba(255,255,255,0.65)", flex: 1, transition: "color 0.2s ease" }}>
                        {step.title}
                      </span>
                      {step.score !== undefined && (
                        <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700,
                          color: step.score >= 0 ? "#00e5a0" : "#ff5572", flexShrink: 0 }}>
                          {step.score >= 0 ? "+" : ""}{step.score}
                        </span>
                      )}
                      <span style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0, display: "flex" }}>
                        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                    </button>

                    {isOpen && (
                      <div style={{ padding: "0 10px 10px" }}>
                        <p style={{ fontFamily: "var(--font-display, sans-serif)", fontSize: 13, lineHeight: 1.7,
                          color: "rgba(255,255,255,0.55)", margin: 0, whiteSpace: "pre-wrap" }}>
                          {step.detail}
                        </p>
                        {step.decision && (
                          <p style={{ fontFamily: "monospace", fontSize: 13, color: group.color,
                            margin: "6px 0 0", padding: "5px 8px", background: `${group.color}0c`,
                            borderRadius: 6, borderLeft: `2px solid ${group.color}50` }}>
                            → {step.decision}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 6. SKILL DETAIL CARDS (Lucide icons replacing emoji) ─────────────────────
function SkillCards({ skills }: { skills: SkillResult[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 80); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {skills.map((skill, i) => {
        const col    = SC[skill.verdict] ?? "#94a3b8";
        const icon   = SKILL_ICON_MAP[skill.name] ?? <BarChart3 size={14} />;
        const w      = SKILL_WEIGHTS[skill.name] ?? 0.1;
        const barPct = mounted ? ((skill.score + 100) / 200) * 100 : 0;
        const contrib = Math.round(skill.score * w);
        const isActive = active === skill.name;

        return (
          <div
            key={skill.name}
            onClick={() => setActive(isActive ? null : skill.name)}
            style={{
              borderRadius: 10,
              border: `1px solid ${isActive ? col + "45" : "rgba(255,255,255,0.07)"}`,
              background: isActive ? `${col}06` : "rgba(255,255,255,0.02)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: `${col}12`, border: `1px solid ${col}25`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: col,
              }}>
                {icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: col, letterSpacing: "0.08em" }}>
                    {skill.name.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                    color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em",
                    background: "rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: 4 }}>
                    {(w * 100).toFixed(0)}% WEIGHT
                  </span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${barPct}%`,
                    background: `linear-gradient(90deg, ${col}66, ${col})`,
                    borderRadius: 3,
                    transition: `width 0.8s cubic-bezier(0.34,1.56,0.64,1) ${i * 80}ms`,
                  }} />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: col, lineHeight: 1 }}>
                  {skill.score >= 0 ? "+" : ""}{skill.score}
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                  contrib {contrib >= 0 ? "+" : ""}{contrib}
                </span>
              </div>

              <span style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0, marginLeft: 2, display: "flex" }}>
                {isActive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            </div>

            {isActive && (
              <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${col}15` }}>
                <p style={{ fontFamily: "var(--font-display, sans-serif)", fontSize: 14, lineHeight: 1.7,
                  color: "rgba(255,255,255,0.6)", margin: "10px 0 0" }}>
                  {skill.summary}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 12, fontFamily: "monospace",
                    fontWeight: 700, color: col, background: `${col}14`, border: `1px solid ${col}25`,
                    letterSpacing: "0.06em" }}>
                    {skill.verdict.toUpperCase()}
                  </span>
                  <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 12, fontFamily: "monospace",
                    color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)" }}>
                    Score: {skill.score >= 0 ? "+" : ""}{skill.score} / 100
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 7. RISK PANEL (Lucide icons replacing emoji) ──────────────────────────────
function RiskPanel({ risks, keyPoints, color }: {
  risks: string[]; keyPoints: string[]; color: string;
}) {
  const severity = (r: string) => {
    if (r.toLowerCase().includes("high") || r.toLowerCase().includes("severe") || r.toLowerCase().includes("crash")) return 3;
    if (r.toLowerCase().includes("watch") || r.toLowerCase().includes("caution") || r.toLowerCase().includes("risk")) return 2;
    return 1;
  };

  const severityMeta = [
    { level: 1, label: "LOW",  color: "#94a3b8", bg: "rgba(148,163,184,0.08)", Icon: MinusCircle },
    { level: 2, label: "MED",  color: "#ffb020", bg: "rgba(255,176,32,0.08)",  Icon: AlertTriangle },
    { level: 3, label: "HIGH", color: "#ff5572", bg: "rgba(255,85,114,0.08)",  Icon: XCircle },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <p style={{ fontFamily: "monospace", fontSize: 12, color: "#ff5572", fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 8px",
          display: "flex", alignItems: "center", gap: 5 }}>
          <ShieldAlert size={11} color="#ff5572" /> Risk Factors
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {risks.map((r, i) => {
            const sev = severity(r);
            const sm  = severityMeta[sev - 1];
            return (
              <div key={i} style={{ display: "flex", gap: 10, padding: "9px 12px", borderRadius: 8,
                background: sm.bg, border: `1px solid ${sm.color}22`, alignItems: "flex-start" }}>
                <sm.Icon size={13} color={sm.color} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: sm.color,
                  background: `${sm.color}18`, padding: "2px 5px", borderRadius: 4,
                  letterSpacing: "0.06em", flexShrink: 0, marginTop: 1 }}>
                  {sm.label}
                </span>
                <span style={{ fontFamily: "var(--font-display, sans-serif)", fontSize: 14,
                  lineHeight: 1.65, color: "rgba(255,255,255,0.65)" }}>
                  {r}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p style={{ fontFamily: "monospace", fontSize: 12, color, fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 8px",
          display: "flex", alignItems: "center", gap: 5 }}>
          <CheckCircle2 size={11} color={color} /> Key Findings
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {keyPoints.map((pt, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 10px",
              borderRadius: 8, background: `${color}07`, border: `1px solid ${color}15` }}>
              <span style={{ color, flexShrink: 0, marginTop: 2, display: "flex" }}>
                <CheckCircle2 size={11} />
              </span>
              <span style={{ fontFamily: "var(--font-display, sans-serif)", fontSize: 14,
                lineHeight: 1.65, color: "rgba(255,255,255,0.65)" }}>
                {pt}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
type Tab = "overview" | "charts" | "skills" | "reasoning" | "risks";

export function ReportBubble({ report }: { report: AnalysisReport }) {
  const vm = VM[report.verdict] ?? VM.neutral;
  const [tab, setTab] = useState<Tab>("overview");

  const tabs: { id: Tab; label: string; Icon: React.ComponentType<any> }[] = [
    { id: "overview",  label: "Overview",  Icon: LayoutList   },
    { id: "charts",    label: "Charts",    Icon: BarChart3     },
    { id: "skills",    label: "Skills",    Icon: Zap           },
    { id: "reasoning", label: "Reasoning", Icon: Brain         },
    { id: "risks",     label: "Risks",     Icon: ShieldAlert   },
  ];

  return (
    <div style={{
      background: "rgb(5,12,24)",
      border: `1px solid ${vm.border}`,
      borderRadius: 16,
      overflow: "hidden",
      width: "100%",
      maxWidth: 580,
      boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px ${vm.border}, 0 0 60px ${vm.glow}`,
    }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 18px 14px", background: vm.bg, borderBottom: `1px solid ${vm.border}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flexShrink: 0 }}>
            <ScoreGauge score={report.score} color={vm.color} />
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 800,
                letterSpacing: "0.14em", color: vm.color, padding: "3px 10px", borderRadius: 6,
                background: `${vm.color}18`, border: `1px solid ${vm.color}35` }}>
                {vm.label}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(255,255,255,0.35)",
                padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)" }}>
                {report.confidence}% confidence
              </span>
            </div>

            <p style={{ fontFamily: "var(--font-display, sans-serif)", fontSize: 14, fontWeight: 700,
              color: "rgba(255,255,255,0.9)", margin: "0 0 3px" }}>
              {report.coinName}
              <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400, marginLeft: 6, fontSize: 14 }}>
                {report.symbol}
              </span>
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                ${report.priceAtRun.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
                {new Date(report.runAt).toLocaleString()}
              </span>
            </div>

            {/* Skill pills with Lucide icons */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
              {report.skills.map(s => (
                <span key={s.name} style={{
                  fontSize: 11, fontWeight: 600,
                  color: SC[s.verdict] ?? "#94a3b8",
                  background: `${SC[s.verdict] ?? "#94a3b8"}12`,
                  border: `1px solid ${SC[s.verdict] ?? "#94a3b8"}25`,
                  padding: "3px 8px", borderRadius: 5,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <span style={{ color: SC[s.verdict] ?? "#94a3b8", display: "flex" }}>
                    {SKILL_ICON_MAP[s.name] ?? <BarChart3 size={12} />}
                  </span>
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", background: "rgb(4,10,20)",
        borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: "0 0 auto", padding: "9px 14px", fontSize: 13,
              fontFamily: "var(--font-display, sans-serif)", fontWeight: 600,
              background: "transparent", border: "none",
              borderBottom: tab === t.id ? `2px solid ${vm.color}` : "2px solid transparent",
              color: tab === t.id ? vm.color : "rgba(255,255,255,0.28)",
              cursor: "pointer", transition: "all 0.15s ease",
              display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
            }}
          >
            <t.Icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}
      <div style={{ padding: "16px 18px", maxHeight: 500, overflowY: "auto" }}>

        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontFamily: "var(--font-display, sans-serif)", fontSize: 15, lineHeight: 1.8,
              color: "rgba(255,255,255,0.7)", margin: 0 }}>
              {report.narrative}
            </p>
            <ConfidenceBreakdown skills={report.skills} confidence={report.confidence} color={vm.color} />
          </div>
        )}

        {tab === "charts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <SkillBarChart skills={report.skills} />
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
            <SignalWaterfall skills={report.skills} finalScore={report.score} />
          </div>
        )}

        {tab === "skills" && <SkillCards skills={report.skills} />}

        {tab === "reasoning" && (
          <div>
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.28)",
              fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 14px" }}>
              {report.reasoning.length} Decision Steps
            </p>
            <PhaseTimeline reasoning={report.reasoning} />
          </div>
        )}

        {tab === "risks" && (
          <RiskPanel risks={report.risks} keyPoints={report.keyPoints} color={vm.color} />
        )}

      </div>
    </div>
  );
}

/**
 * agent.service.ts  (updated — richer analysis output + expanded system prompt)
 */

import {
  type AgentEmotion,
  type AgentChatSession,
  type AgentChatMessage,
  makeEmotion,
} from '../agents/emotion.types'

import {
  type MarketSnapshot,
  deriveEmotion,
  getEmotionState,
  setEmotionState,
  initEmotionState,
  EMOTION_COOLDOWN,
} from '../agents/emotion.state'

import { AgentSessionDoc, type IAgentSession } from '../models/agent.model'
import { AnalysisDoc } from '../models/analysis.model'
import { CoinGeckoService } from './coingecko.service'
import OpenAI from 'openai'

const cg = new CoinGeckoService()
const sessionCache = new Map<string, AgentChatSession>()

const apiKey = process.env.DEEPSEEK_API_KEY
if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set')

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey:  process.env.DEEPSEEK_API_KEY ?? '',
})

// ── Session helpers ───────────────────────────────────────────────────────────

async function loadOrCreateSession(
  sessionId: string,
  coinId:    string,
  userId?:   string,
): Promise<AgentChatSession> {
  if (sessionCache.has(sessionId)) return sessionCache.get(sessionId)!

  const existing = await AgentSessionDoc.findOne({ sessionId }).lean()

  if (existing) {
    const session: AgentChatSession = {
      sessionId:      existing.sessionId,
      coinId:         existing.coinId,
      messages:       existing.messages as AgentChatMessage[],
      currentEmotion: existing.currentEmotion as AgentEmotion,
      createdAt:      existing.createdAt.getTime(),
      updatedAt:      existing.updatedAt.getTime(),
    }
    initEmotionState(sessionId)
    setEmotionState(sessionId, {
      current:     existing.currentEmotion as AgentEmotion,
      lockedUntil: 0,
      turnCount:   existing.messages.filter(m => m.role === 'user').length,
    })
    sessionCache.set(sessionId, session)
    return session
  }

  const now     = Date.now()
  const emotion = makeEmotion('thinking', 'low', 'New session', "Hey! What's on your mind?")

  const session: AgentChatSession = {
    sessionId, coinId,
    messages:       [],
    currentEmotion: emotion,
    createdAt:      now,
    updatedAt:      now,
  }

  await AgentSessionDoc.create({
    sessionId, userId, coinId,
    messages:       [],
    currentEmotion: emotion,
    createdAt:      new Date(now),
    updatedAt:      new Date(now),
  })

  initEmotionState(sessionId)
  sessionCache.set(sessionId, session)
  return session
}

async function persistSession(session: AgentChatSession): Promise<void> {
  try {
    await AgentSessionDoc.updateOne(
      { sessionId: session.sessionId },
      {
        $set: {
          coinId:         session.coinId,
          messages:       session.messages.slice(-20),
          currentEmotion: session.currentEmotion,
          updatedAt:      new Date(),
        },
      },
      { upsert: true },
    )
    sessionCache.set(session.sessionId, session)
  } catch (err: any) {
    console.warn('[AgentService] Failed to persist session:', err.message)
  }
}

// ── Market snapshot ───────────────────────────────────────────────────────────

async function buildMarketSnapshot(
  coinId:       string,
  isAnalysing?: boolean,
): Promise<MarketSnapshot> {
  try {
    const [detail, lastAnalysis] = await Promise.all([
      cg.getCoinDetail(coinId, { marketData: true }),
      AnalysisDoc.findOne({ coinId }).sort({ runAt: -1 }).lean(),
    ])

    const change24h = detail.market_data?.price_change_percentage_24h ?? 0
    const change7d  = detail.market_data?.price_change_percentage_7d  ?? 0

    let lastAccurate: boolean | undefined
    if (lastAnalysis) {
      const verdict = lastAnalysis.verdict
      if (verdict === 'strong_buy' || verdict === 'buy') {
        lastAccurate = change24h > 1
      } else if (verdict === 'strong_sell' || verdict === 'sell') {
        lastAccurate = change24h < -1
      } else {
        lastAccurate = Math.abs(change24h) < 3
      }
    }

    const skillConflict = lastAnalysis
      ? (lastAnalysis.skills?.filter((s: any) => s.verdict === 'bullish').length > 0 &&
         lastAnalysis.skills?.filter((s: any) => s.verdict === 'bearish').length > 0)
      : false

    return {
      change24h, change7d,
      verdict:      lastAnalysis?.verdict,
      confidence:   lastAnalysis?.confidence,
      lastAccurate, isAnalysing, skillConflict,
    }
  } catch {
    return { change24h: 0, change7d: 0, isAnalysing }
  }
}

// ── JSON repair helpers ───────────────────────────────────────────────────────

function extractContent(raw: string): string | null {
  const match = raw.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/s)
  if (match) return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
  return null
}

function safeParseJSON(raw: string): {
  content:         string
  emotion?:        AgentEmotion
  suggestAnalysis?: boolean
  suggestAlert?:   boolean
} | null {
  let cleaned = raw.replace(/```json|```/g, '').trim()

  const start = cleaned.indexOf('{')
  const end   = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  cleaned = cleaned.slice(start, end + 1)

  cleaned = cleaned.replace(/("(?:[^"\\]|\\.)*")/gs, (m) =>
    m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
  )

  try { return JSON.parse(cleaned) } catch { /* continue */ }

  try {
    const fixed = cleaned.replace(/,\s*([}\]])/g, '$1')
    return JSON.parse(fixed)
  } catch { /* continue */ }

  const content = extractContent(cleaned)
  if (content) return { content }
  return null
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(
  emotion:      AgentEmotion,
  snapshot:     MarketSnapshot,
  coinId:       string,
  history:      AgentChatMessage[],
  lastAnalysis: any | null,
): string {
  const recentMsgs = history.slice(-5, -1).map(m =>
    `${m.role === 'user' ? 'User' : 'You'}: ${m.content.slice(0, 100)}`
  ).join('\n')

  const marketSummary = [
    `${coinId.toUpperCase()} 24h: ${snapshot.change24h.toFixed(2)}%`,
    lastAnalysis
      ? `Last verdict: ${lastAnalysis.verdict} (score ${lastAnalysis.score}, confidence ${lastAnalysis.confidence}%)`
      : 'No analysis yet',
    snapshot.lastAccurate === true  ? 'Last prediction: CORRECT' :
    snapshot.lastAccurate === false ? 'Last prediction: WRONG'   : '',
  ].filter(Boolean).join(' | ')

  // If the last analysis is recent (within 10 mins), inject its full data
  const analysisBlock = lastAnalysis && (Date.now() - new Date(lastAnalysis.runAt).getTime() < 10 * 60 * 1000)
    ? `\n=== FRESH ANALYSIS JUST RAN ===
Verdict: ${lastAnalysis.verdict.toUpperCase()} | Score: ${lastAnalysis.score}/100 | Confidence: ${lastAnalysis.confidence}%
Narrative: ${lastAnalysis.narrative}
Key Points: ${(lastAnalysis.keyPoints ?? []).map((k: string, i: number) => `${i+1}. ${k}`).join(' | ')}
Risks: ${(lastAnalysis.risks ?? []).slice(0,3).join(' | ')}
Skills: ${(lastAnalysis.skills ?? []).map((s: any) => `${s.name}=${s.verdict}(${s.score})`).join(', ')}
`
    : ''

  const personality: Record<string, string> = {
    happy:      'Enthusiastic and upbeat. Use exclamations. You can go up to 5 sentences.',
    depressed:  'Somber and cautious. You can be detailed but slightly pessimistic.',
    nervous:    'Hedge with "maybe" and "I think". Mention uncertainties.',
    frustrated: 'Blunt and self-critical about missed calls, but thorough.',
    shocked:    'Dramatic about market moves. Very expressive.',
    thinking:   'Methodical and deeply analytical. Walk through your reasoning.',
  }

  const sanitise = (s: string) => s.replace(/"/g, "'").replace(/\n/g, ' ').slice(0, 80)

  const template = {
    content: '__REPLY__',
    emotion: {
      emotion:   emotion.emotion,
      intensity: emotion.intensity,
      reason:    sanitise(emotion.reason),
      asset:     `/emotions/${emotion.emotion}.png`,
      message:   sanitise(emotion.message),
    },
    suggestAnalysis: false,
    suggestAlert:    false,
  }

  return `You are a crypto AI agent. Current mood: ${emotion.emotion.toUpperCase()}.
Personality: ${personality[emotion.emotion] ?? 'Neutral and helpful.'}
Market context: ${marketSummary}
${analysisBlock}
${recentMsgs ? `Recent conversation:\n${recentMsgs}\n` : ''}
INSTRUCTIONS:
- Reply in character with your mood. Up to 5 sentences — be substantive, not just a one-liner.
- If analysis data is present above, reference SPECIFIC numbers: the score, verdict, key points, and skill results.
- You're an analyst with personality — share your actual opinion about what the data means.
- After analysis, always mention: the verdict, the score, at least 2 key points, and 1-2 risks.
- Replace __REPLY__ with your response text only. Do NOT add literal newlines inside the content string. Use \\n if needed.
- Do NOT change any other field. Return the JSON exactly as structured below.
- Return ONLY the JSON object. No markdown, no explanation, nothing else.
- CRITICAL: If the user asks to run analysis, analyze, or check the market — set suggestAnalysis to true.

${JSON.stringify(template, null, 0)}`
}

// ── Canned responses for automated triggers ───────────────────────────────────

const ANALYSIS_CANNED: Record<string, string> = {
  happy:      "On it! Crunching the numbers now — feeling good about this one!",
  depressed:  "Running it... though I'm not sure it'll change much.",
  nervous:    "Okay, maybe I'll find something useful this time. Scanning now...",
  frustrated: "Running analysis again. Need to redeem myself after that last miss.",
  shocked:    "Analyzing NOW — with moves like these I have to know what's happening!",
  thinking:   "Initiating full analysis. Processing all available signals. Stand by.",
}

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ChatInput {
  sessionId:    string
  message:      string
  coinId?:      string
  userId?:      string
  isAnalysing?: boolean
}

export interface ChatOutput {
  sessionId:       string
  content:         string
  emotion:         AgentEmotion
  suggestAnalysis: boolean
  suggestAlert:    boolean
  history:         AgentChatMessage[]
  // ── new: attached analysis report for rich rendering ──
  analysisReport?: {
    verdict:     string
    score:       number
    confidence:  number
    narrative:   string
    keyPoints:   string[]
    risks:       string[]
    skillsUsed:  string[]
    skills:      { name: string; verdict: string; score: number; summary: string }[]
    reasoning:   { step: number; phase: string; title: string; detail: string; score?: number; decision?: string }[]
    coinName:    string
    symbol:      string
    priceAtRun:  number
    runAt:       string
  }
}

// ── Main service ──────────────────────────────────────────────────────────────

export class AgentService {

  async chat(input: ChatInput): Promise<ChatOutput> {
    const { sessionId, message, coinId = 'bitcoin', userId, isAnalysing } = input

    const session  = await loadOrCreateSession(sessionId, coinId, userId)
    const snapshot = await buildMarketSnapshot(coinId, isAnalysing)
    const emotion  = deriveEmotion(snapshot, sessionId)

    session.currentEmotion = emotion
    session.updatedAt      = Date.now()

    const emotionState = getEmotionState(sessionId) ?? initEmotionState(sessionId)
    emotionState.current     = emotion
    emotionState.lockedUntil = Date.now() + (EMOTION_COOLDOWN[emotion.emotion] ?? 0)
    emotionState.turnCount  += 1
    setEmotionState(sessionId, emotionState)

    let lastAnalysis = null
    try {
      lastAnalysis = await AnalysisDoc.findOne({ coinId }).sort({ runAt: -1 }).lean()
    } catch { /* ignore */ }

    session.messages.push({ role: 'user', content: message, ts: Date.now() })

    // ── Skip API call when analysis is running ────────────────────────────────
    if (isAnalysing) {
      const content = ANALYSIS_CANNED[emotion.emotion] ?? 'Running analysis, stand by...'
      session.messages.push({ role: 'agent', content, emotion, ts: Date.now() })
      if (session.messages.length > 20) session.messages = session.messages.slice(-20)
      persistSession(session).catch(() => {})
      return {
        sessionId, content, emotion,
        suggestAnalysis: false,
        suggestAlert:    false,
        history:         session.messages,
      }
    }

    // ── Normal chat — call DeepSeek ───────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(emotion, snapshot, coinId, session.messages, lastAnalysis)

    let content         = ''
    let responseEmotion = emotion
    let suggestAnalysis = false
    let suggestAlert    = false

    try {
      const completion = await deepseek.chat.completions.create({
        model:       'deepseek-v4-flash',
        max_tokens:  800,   // bumped from 600 to allow richer responses
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: message },
        ],
      })

      const raw = completion.choices?.[0]?.message?.content ?? ''
      console.log('[AgentService] finish_reason:', completion.choices?.[0]?.finish_reason)
      console.log('[AgentService] Raw:', raw)

      const parsed = safeParseJSON(raw)

      if (parsed?.content) {
        content         = parsed.content
        responseEmotion = (parsed.emotion as AgentEmotion) ?? emotion
        suggestAnalysis = parsed.suggestAnalysis ?? false
        suggestAlert    = parsed.suggestAlert    ?? false
        responseEmotion.asset = `/emotions/${responseEmotion.emotion}.png`
      } else {
        console.warn('[AgentService] JSON parse failed, using fallback')
        content = this.fallbackResponse(emotion, message)
      }

    } catch (err: any) {
      console.warn('[AgentService] Chat failed:', err.message)
      content = this.fallbackResponse(emotion, message)
    }

    session.messages.push({ role: 'agent', content, emotion: responseEmotion, ts: Date.now() })
    if (session.messages.length > 20) session.messages = session.messages.slice(-20)

    persistSession(session).catch(() => {})

    return {
      sessionId, content,
      emotion:         responseEmotion,
      suggestAnalysis, suggestAlert,
      history:         session.messages,
    }
  }

  // ── Notify session after analysis completes ───────────────────────────────
  // Now returns the full analysis object attached to the response

  async notifyAnalysisComplete(
    sessionId:  string,
    coinId:     string,
    verdict:    string,
    score:      number,
    confidence: number,
  ): Promise<ChatOutput> {
    const session = await loadOrCreateSession(sessionId, coinId)

    // Fetch the full analysis doc that was just saved
    const analysis = await AnalysisDoc.findOne({ coinId }).sort({ runAt: -1 }).lean()

    // Build a rich, in-character narrative from the analysis data
    const snapshot = await buildMarketSnapshot(coinId, false)
    const emotion  = deriveEmotion(snapshot, sessionId)

    // Compose a proper multi-sentence agent message with the full report
    const verdictEmoji: Record<string, string> = {
      strong_buy: '🚀', buy: '📈', neutral: '⚖️', sell: '📉', strong_sell: '💀',
    }
    const emoji = verdictEmoji[verdict] ?? '📊'

    let richContent = `${emoji} Analysis complete for ${analysis?.coinName ?? coinId.toUpperCase()}! `

    if (analysis) {
      richContent += `My verdict: **${verdict.replace('_', ' ').toUpperCase()}** with a score of ${score > 0 ? '+' : ''}${score}/100 at ${confidence}% confidence. `

      if (analysis.narrative) {
        richContent += `${analysis.narrative} `
      }

      if (analysis.keyPoints?.length) {
        richContent += `Key findings: ${analysis.keyPoints.slice(0, 3).join(' • ')}. `
      }

      if (analysis.risks?.length) {
        richContent += `Watch out for: ${analysis.risks.slice(0, 2).join('; ')}.`
      }
    } else {
      richContent += `Verdict: ${verdict.replace('_', ' ').toUpperCase()}, score ${score > 0 ? '+' : ''}${score}/100, confidence ${confidence}%.`
    }

    session.messages.push({
      role:    'agent',
      content: richContent,
      emotion: emotion,
      ts:      Date.now(),
    })

    if (session.messages.length > 20) session.messages = session.messages.slice(-20)
    await persistSession(session)

    // Build the analysisReport payload for rich frontend rendering
    const analysisReport = analysis ? {
      verdict:     analysis.verdict,
      score:       analysis.score,
      confidence:  analysis.confidence ?? 0,
      narrative:   analysis.narrative,
      keyPoints:   analysis.keyPoints ?? [],
      risks:       analysis.risks ?? [],
      skillsUsed:  analysis.skillsUsed ?? [],
      skills:      (analysis.skills ?? []).map((s: any) => ({
        name:    s.name,
        verdict: s.verdict,
        score:   s.score,
        summary: s.summary,
      })),
      reasoning: (analysis.reasoning ?? []).map((r: any) => ({
        step:     r.step,
        phase:    r.phase,
        title:    r.title,
        detail:   r.detail,
        score:    r.score,
        decision: r.decision,
      })),
      coinName:   analysis.coinName,
      symbol:     analysis.symbol,
      priceAtRun: analysis.priceAtRun ?? 0,
      runAt:      analysis.runAt instanceof Date ? analysis.runAt.toISOString() : String(analysis.runAt),
    } : undefined

    return {
      sessionId,
      content:         richContent,
      emotion,
      suggestAnalysis: false,
      suggestAlert:    false,
      history:         session.messages,
      analysisReport,
    }
  }

  // ── Session helpers ───────────────────────────────────────────────────────

  async getSession(sessionId: string): Promise<AgentChatSession | null> {
    if (sessionCache.has(sessionId)) return sessionCache.get(sessionId)!
    const doc = await AgentSessionDoc.findOne({ sessionId }).lean()
    if (!doc) return null
    return {
      sessionId:      doc.sessionId,
      coinId:         doc.coinId,
      messages:       doc.messages as AgentChatMessage[],
      currentEmotion: doc.currentEmotion as AgentEmotion,
      createdAt:      doc.createdAt.getTime(),
      updatedAt:      doc.updatedAt.getTime(),
    }
  }

  // Never returns 404 — creates the doc if missing (used by GET /api/agent/session/:id)
  async getOrCreateSession(
    sessionId: string,
    coinId:    string,
    userId?:   string,
  ): Promise<AgentChatSession> {
    if (sessionCache.has(sessionId)) return sessionCache.get(sessionId)!
    const doc = await AgentSessionDoc.findOne({ sessionId }).lean()
    if (doc) {
      const session: AgentChatSession = {
        sessionId:      doc.sessionId,
        coinId:         doc.coinId,
        messages:       doc.messages as AgentChatMessage[],
        currentEmotion: doc.currentEmotion as AgentEmotion,
        createdAt:      doc.createdAt.getTime(),
        updatedAt:      doc.updatedAt.getTime(),
      }
      sessionCache.set(sessionId, session)
      return session
    }
    // Document missing — upsert it now
    return loadOrCreateSession(sessionId, coinId, userId)
  }

  async getUserSessions(userId: string): Promise<IAgentSession[]> {
    return AgentSessionDoc.find({ userId }).sort({ updatedAt: -1 }).limit(10).lean()
  }

  async clearSession(sessionId: string): Promise<void> {
    sessionCache.delete(sessionId)
    await AgentSessionDoc.deleteOne({ sessionId })
  }

  // ── Fallback responses ────────────────────────────────────────────────────

  private fallbackResponse(emotion: AgentEmotion, message: string): string {
    const isGreeting = ['hi', 'hello', 'hey', 'how are you'].some(g =>
      message.toLowerCase().includes(g)
    )
    if (isGreeting) {
      const responses: Record<string, string> = {
        happy:      "Hey! Markets are looking great today! Really feeling good.",
        depressed:  "Hey... it's rough out there. I'm watching closely.",
        nervous:    "Oh hi! I'm on edge — signals are mixed everywhere.",
        frustrated: "Hey. Still processing that last miss, but I'm refocused.",
        shocked:    "Hey!! Did you see what just happened?! Wild.",
        thinking:   "Hey, one sec — still processing the data...",
      }
      return responses[emotion.emotion] ?? "Hey there!"
    }
    return `Feeling ${emotion.emotion} about the market. ${emotion.message}`
  }
}

import { Request, Response } from "express";
import { AgentSessionDoc } from "../models/agent.model";
import { AgentService }    from "../services/agent.service";
import { makeEmotion }     from "../agents/emotion.types";

const agentService = new AgentService();

export const agentController = {

  // ── 1. Clean Session Initialization ──────────────────────────────────────────
  // Replaces the old frontend hack of sending an " init " message.
  // Creates a bare session document and returns the sessionId to the client.

  async createSession(req: Request, res: Response) {
    try {
      const { coinId = "bitcoin" } = req.body;
      const userId = (req as any).user?.id ?? "anonymous";

      const sessionId = `sess_${coinId}_${Date.now()}`;

      await AgentSessionDoc.create({
        sessionId,
        userId,
        coinId,
        messages:       [],
        createdAt:      new Date(),
        updatedAt:      new Date(),
        currentEmotion: makeEmotion("thinking", "low", "New session", "Ready."),
      });

      return res.status(200).json({ sessionId });
    } catch (error) {
      console.error("[AgentController] Error creating session:", error);
      return res.status(500).json({ error: "Failed to create session" });
    }
  },

  // ── 2. Get Session ────────────────────────────────────────────────────────────
  // Returns the full session (messages + currentEmotion) for history restoration.

  async getSession(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const coinId = (req.query.coinId as string) ?? "bitcoin";
      const session = await agentService.getOrCreateSession(String(sessionId), coinId);
      return res.status(200).json(session);
    } catch (error) {
      console.error("[AgentController] Error fetching session:", error);
      return res.status(500).json({ error: "Failed to fetch session" });
    }
  },

  // ── 3. NDJSON Streaming Chat ──────────────────────────────────────────────────
  // Each chunk written to the response is a self-contained JSON line terminated
  // with \n so the frontend reader can parse them one-by-one.
  //
  // Chunk shapes the frontend expects (see useChatEngine.ts):
  //   { type: "text_delta",     text: string }
  //   { type: "emotion_update", emotion: AgentEmotion }
  //   { type: "tool_execution", toolName: string, symbol: string, toolData: any }
  //   { type: "done" }
  //   { type: "error",          message: string }

  async streamChat(req: Request, res: Response) {
    const { sessionId, message, coinId = "bitcoin" } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: "Missing sessionId or message" });
    }

    // Set NDJSON streaming headers before we write anything
    res.setHeader("Content-Type",     "application/x-ndjson");
    res.setHeader("Transfer-Encoding","chunked");
    res.setHeader("Connection",       "keep-alive");
    res.setHeader("Cache-Control",    "no-cache");

    // Convenience helper — keeps every write consistent
    const send = (payload: object) => res.write(JSON.stringify(payload) + "\n");

    try {
      // AgentService.chat() is the single source of truth for emotion + LLM logic.
      // It already handles: session loading, DeepSeek call, emotion derivation,
      // session persistence, and fallback responses.
      const output = await agentService.chat({
        sessionId,
        message,
        coinId,
        userId:      (req as any).user?.id,
        isAnalysing: req.body.isAnalysing ?? false,
      });

      // ── Stream the text content token-by-token ──────────────────────────────
      // AgentService returns the full string at once (DeepSeek non-streaming call).
      // We simulate a token stream here so the frontend cursor animation works.
      // Swap this block for a real streaming LLM call when you upgrade AgentService.

      const words = output.content.split(" ");
      for (const word of words) {
        send({ type: "text_delta", text: word + " " });
        // Tiny yield so Node doesn't hold the event loop
        await new Promise(r => setImmediate(r));
      }

      // ── Emit the final emotion state ────────────────────────────────────────
      send({ type: "emotion_update", emotion: output.emotion });

      // ── Emit the analysis report as a synthetic tool_execution chunk ────────
      // This is how the frontend's AgentToolCard receives structured data without
      // regex scraping. If no report is attached, this block is skipped.
      if (output.analysisReport) {
        send({
          type:     "tool_execution",
          toolName: "analysis_report",
          symbol:   output.analysisReport.symbol ?? coinId.toUpperCase(),
          toolData: output.analysisReport,
        });
      }

      // ── Suggest-analysis flag (frontend can show a "Run Analysis" button) ───
      if (output.suggestAnalysis) {
        send({ type: "suggest_analysis" });
      }

      send({ type: "done" });
      res.end();

    } catch (error: any) {
      console.error("[AgentController] Streaming error:", error);

      if (!res.headersSent) {
        return res.status(500).json({ error: "Internal server error during generation" });
      }

      send({ type: "error", message: "Stream interrupted: " + (error.message ?? "unknown") });
      res.end();
    }
  },

  // ── 4. Notify Analysis Complete ───────────────────────────────────────────────
  // Called by your analysis pipeline (agent-run job) once orchestration finishes.
  // Returns the full analysis report the frontend can render in the chat.

  async notifyAnalysisComplete(req: Request, res: Response) {
    try {
      const { sessionId, coinId, verdict, score, confidence } = req.body;

      if (!sessionId || !coinId || !verdict) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const output = await agentService.notifyAnalysisComplete(
        sessionId, coinId, verdict, score ?? 0, confidence ?? 0,
      );

      return res.status(200).json(output);
    } catch (error) {
      console.error("[AgentController] Error notifying analysis complete:", error);
      return res.status(500).json({ error: "Failed to notify analysis complete" });
    }
  },

  // ── 5. List User Sessions ─────────────────────────────────────────────────────

  async getUserSessions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const sessions = await agentService.getUserSessions(userId);
      return res.status(200).json(sessions);
    } catch (error) {
      console.error("[AgentController] Error fetching user sessions:", error);
      return res.status(500).json({ error: "Failed to fetch sessions" });
    }
  },

  // ── 6. Clear Session ──────────────────────────────────────────────────────────

  async clearSession(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      await agentService.clearSession(String(sessionId));
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("[AgentController] Error clearing session:", error);
      return res.status(500).json({ error: "Failed to clear session" });
    }
  },
};

import './config/env' // must be first — loads .env.local before any module reads process.env
import express from 'express'
import http from 'http'
import cors from 'cors'
import routes from './routes'
import { coinGeckoRouter } from './controllers/coingecko.controller'
import { errorHandler } from './middleware/errorHandler'
import { apiLimiter } from './middleware/rateLimit'
import { initWebSocket } from './websocket/wsServer'
import { connectDB } from './config/db'
import { connectRedis } from './config/redis'
import { connectSubscriber } from './websocket/redisSubscriber'
import morgan from 'morgan'
import paperWalletRoutes from './routes/paperWallet.routes'
import agentRunRoutes                          from './routes/agentRun.routes'
import positionRoutes                          from './routes/position.routes'
import { opportunityRouter }                   from './routes/position.routes'
import { startScheduler, isSchedulerRunning }  from './agents/loop/scheduler'
import agent from './routes/agent.routes';
// ── S03 routes ────────────────────────────────────────────────────────────────
import intelligenceRouter  from './routes/intelligence.routes'
import chartAnalysisRouter from './routes/chartAnalysis.routes'
import orderBlockRouter    from './routes/orderBlock.routes'
import coin from './routes/coin.routes';
// ── OHLCV ingest singleton (must be initialized after Redis connects) ─────────
import { ohlcvIngest } from './read/ingestion/ohlcv.ingest'

const app = express()
const server = http.createServer(app)

console.log('OpenRouter key loaded:', !!process.env.OPENROUTER_API_KEY)

const allowedOrigins = (process.env.WEB_URL ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())
app.use(morgan('dev'))

// ── Rate limiters ─────────────────────────────────────────────────────────────
app.use('/api/coins',         apiLimiter)
app.use('/api/alerts',        apiLimiter)
app.use('/api/news',          apiLimiter)
app.use('/api/portfolio',     apiLimiter)
app.use('/api/agent-runs',    apiLimiter)
app.use('/api/positions',     apiLimiter)
app.use('/api/opportunities', apiLimiter)
app.use('/api/intelligence',  apiLimiter)
app.use('/api/chart',         apiLimiter)
app.use('/api/orderblocks',   apiLimiter)
app.use(
  [
    '/api/simple', '/api/categories', '/api/exchanges', '/api/derivatives',
    '/api/nfts', '/api/trending', '/api/global', '/api/search', '/api/platforms',
    '/api/contract', '/api/exchange_rates', '/api/entities', '/api/treasury', '/api/ping',
  ],
  apiLimiter,
)

// ── Route mounts ──────────────────────────────────────────────────────────────
app.use('/api', coinGeckoRouter)
app.use('/api', routes)
app.use('/api/agent-runs',    agentRunRoutes)
app.use('/api/positions',     positionRoutes)
app.use('/api/opportunities', opportunityRouter)
app.use('/api/paper-wallet',  paperWalletRoutes)
app.use("/api/coins", coin);
app.use("/api/agent", agent);
// ── S03 route mounts ──────────────────────────────────────────────────────────
app.use('/api/intelligence',  intelligenceRouter)
app.use('/api/chart',         chartAnalysisRouter)
app.use('/api/orderblocks',   orderBlockRouter)

app.use(errorHandler)

initWebSocket(server)

async function start() {
  await connectDB()
  await connectRedis()
  await connectSubscriber()

  // Initialize OHLCV ingest Redis connection AFTER connectRedis() completes.
  // Without this, ohlcvIngest.redisClient is null and every Binance fetch
  // skips the cache, causing rate limit hits within minutes.
  try {
    await ohlcvIngest.init()
    console.log('OHLCV ingest Redis connected')
  } catch (err: any) {
    console.warn('[app] ohlcvIngest.init() failed — OHLCV will run without Redis cache:', err.message)
    // Non-fatal: the ingest still works, just without caching
  }

  // Guard: prevents double-start on hot-reload
  if (!isSchedulerRunning()) {
    startScheduler()
  }

  server.listen(4000, () => console.log('API ready on :4000'))
}

start().catch((err) => {
  console.error('Startup failed:', err)
  process.exit(1)
})

BASE_URL=http://localhost:4000
======================================================================
{{BASE_URL}}/api/agent-runs/config

{
    "config": {
        "enabled": false,
        "mode": "paper",
        "loopIntervalMs": 60000,
        "strategies": {
            "yieldHunter": true,
            "rebalance": false,
            "airdropWatch": false
        },
        "watchlist": [
            "bitcoin",
            "ethereum",
            "usd-coin",
            "tether"
        ],
        "maxTradeUsd": 100,
        "requireManualApproval": true
    },
    "schedulerActive": true,
    "keyPresence": {
        "hasBinanceKey": false,
        "hasPrivateKey": false,
        "hasOnchainRpc": false
    }
}


=========================================================================
{{BASE_URL}}/api/agent-runs/config

{
    "ok": true,
    "config": {
        "enabled": true,
        "mode": "paper",
        "loopIntervalMs": 60000,
        "strategies": {
            "yieldHunter": true,
            "rebalance": false,
            "airdropWatch": false
        },
        "watchlist": [
            "bitcoin",
            "ethereum",
            "usd-coin",
            "tether"
        ],
        "maxTradeUsd": 100,
        "requireManualApproval": true
    }
}


=========================================================================
{{BASE_URL}}/api/agent-runs/config


{
    "ok": true,
    "config": {
        "enabled": false,
        "mode": "paper",
        "loopIntervalMs": 60000,
        "strategies": {
            "yieldHunter": true,
            "rebalance": false,
            "airdropWatch": false
        },
        "watchlist": [
            "bitcoin",
            "ethereum",
            "usd-coin",
            "tether"
        ],
        "maxTradeUsd": 100,
        "requireManualApproval": true
    }
}
========================================================================
{{BASE_URL}}/api/chart/history/BTCUSDT

{
    "success": true,
    "data": [
        {
            "_id": "6a2b6a063f1203aa160cdbee",
            "symbol": "BTCUSDT",
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + HTF Resistance Rejection",
            "entry_zone": {
                "high": 63933.02,
                "low": 63239.43
            },
            "stop_loss": 64163.49,
            "take_profit_levels": [
                62205,
                61088.19,
                59315.455
            ],
            "risk_reward": 2.5,
            "confidence": 55,
            "invalidation": "Daily close above 64163.49 (Camarilla R3) invalidates the bearish bias",
            "framework_scores": {
                "SmartMoney": 70,
                "Wyckoff": 50,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 2,
            "risk_approved": true,
            "adjusted_confidence": 55,
            "adjusted_size_mult": 0.79,
            "risk_warnings": [
                "Reduced size to 79% due to confidence 55"
            ],
            "risk_rejection": null,
            "analyzed_at": "2026-06-12T02:08:06.594Z",
            "timeframes_used": [
                "1h",
                "4h",
                "1d"
            ],
            "btc_bias_at_time": null,
            "createdAt": "2026-06-12T02:08:06.604Z",
            "updatedAt": "2026-06-12T02:08:06.604Z",
            "__v": 0
        }
    ],
    "count": 1
}


==========================================================================
{{BASE_URL}}/api/chart/analyze/{{SYMBOL}}


{
    "success": true,
    "data": {
        "primitives_meta": {
            "symbol": "BTCUSDT",
            "timeframes_analyzed": [
                "1h",
                "4h",
                "1d"
            ],
            "generated_at": "2026-06-12T02:08:01.984Z",
            "token_count_estimate": 1119
        },
        "analysis": {
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + HTF Resistance Rejection",
            "entry_zone": {
                "high": 63933.02,
                "low": 63239.43
            },
            "stop_loss": 64163.49,
            "take_profit_levels": [
                62205,
                61088.19,
                59315.455
            ],
            "risk_reward": 2.5,
            "confidence": 55,
            "invalidation": "Daily close above 64163.49 (Camarilla R3) invalidates the bearish bias",
            "reasoning": "The 1D timeframe shows a bearish trend at resistance, overriding the neutral LTF bias. Price is near a strong resistance at 63933.02, with a 4H bearish order block (74092-73222) still unmitigated above. A bullish FVG (63239.43-63270) sits below, offering a short entry zone into the gap. The Wyckoff Phase B accumulation suggests range building, but the HTF bearish bias and proximity to resistance favor a short. The R:R is adequate at 2.5:1 targeting the strong support at 61088.19 and the range low.",
            "framework_scores": {
                "SmartMoney": 70,
                "Wyckoff": 50,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 2,
            "confluence_factors": [
                "HTF bearish trend at resistance (1D)",
                "Price at strong resistance level (63933.02, 3 touches)",
                "Unmitigated bearish order block above (4H)",
                "Bullish FVG below provides short entry zone"
            ]
        },
        "risk": {
            "approved": true,
            "adjusted_confidence": 55,
            "adjusted_size_mult": 0.79,
            "warnings": [
                "Reduced size to 79% due to confidence 55"
            ]
        }
    }
}
===========================================================================
{{BASE_URL}}/api/chart/analyze/{{SYMBOL}}

{
    "success": true,
    "data": {
        "primitives_meta": {
            "symbol": "BTCUSDT",
            "timeframes_analyzed": [
                "1h",
                "4h",
                "1d"
            ],
            "generated_at": "2026-06-12T02:10:05.635Z",
            "token_count_estimate": 1120
        },
        "analysis": {
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + FVG Confluence at Resistance",
            "entry_zone": {
                "high": 64048.57,
                "low": 63933.02
            },
            "stop_loss": 64497.97,
            "take_profit_levels": [
                63239.43,
                62205,
                61088.19
            ],
            "risk_reward": 2.1,
            "confidence": 65,
            "invalidation": "Daily close above 64497.97 (strong resistance) invalidates bearish thesis",
            "reasoning": "The 1D trend is bearish and overrides the neutral LTF bias. Price is at a strong resistance zone (63933-64048) with a bearish unmitigated Order Block above (73222-74092 on 4H) and multiple unfilled bearish FVGs below (64540-65251, 65860-66076). The HTF bearish bias combined with the resistance rejection and unfilled gaps to the downside provides a high-probability short entry. The Wyckoff Phase B accumulation is not yet confirmed with a Spring, so shorting into resistance aligns with the broader downtrend.",
            "framework_scores": {
                "SmartMoney": 85,
                "Wyckoff": 40,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 3,
            "confluence_factors": [
                "HTF bearish trend overrides LTF neutral",
                "Price at strong resistance (63933-64048)",
                "Unmitigated bearish Order Block above",
                "Unfilled bearish FVGs below"
            ]
        },
        "risk": {
            "approved": true,
            "adjusted_confidence": 65,
            "adjusted_size_mult": 0.93,
            "warnings": [
                "Reduced size to 93% due to confidence 65"
            ]
        }
    }
}




{
    "success": true,
    "data": [
        {
            "_id": "6a2b6a823f1203aa160cdbf1",
            "symbol": "BTCUSDT",
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + FVG Confluence at Resistance",
            "entry_zone": {
                "high": 64048.57,
                "low": 63933.02
            },
            "stop_loss": 64497.97,
            "take_profit_levels": [
                63239.43,
                62205,
                61088.19
            ],
            "risk_reward": 2.1,
            "confidence": 65,
            "invalidation": "Daily close above 64497.97 (strong resistance) invalidates bearish thesis",
            "framework_scores": {
                "SmartMoney": 85,
                "Wyckoff": 40,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 3,
            "risk_approved": true,
            "adjusted_confidence": 65,
            "adjusted_size_mult": 0.93,
            "risk_warnings": [
                "Reduced size to 93% due to confidence 65"
            ],
            "risk_rejection": null,
            "analyzed_at": "2026-06-12T02:10:10.442Z",
            "timeframes_used": [
                "1h",
                "4h",
                "1d"
            ],
            "btc_bias_at_time": null,
            "createdAt": "2026-06-12T02:10:10.445Z",
            "updatedAt": "2026-06-12T02:10:10.445Z",
            "__v": 0
        },
        {
            "_id": "6a2b6a063f1203aa160cdbee",
            "symbol": "BTCUSDT",
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + HTF Resistance Rejection",
            "entry_zone": {
                "high": 63933.02,
                "low": 63239.43
            },
            "stop_loss": 64163.49,
            "take_profit_levels": [
                62205,
                61088.19,
                59315.455
            ],
            "risk_reward": 2.5,
            "confidence": 55,
            "invalidation": "Daily close above 64163.49 (Camarilla R3) invalidates the bearish bias",
            "framework_scores": {
                "SmartMoney": 70,
                "Wyckoff": 50,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 2,
            "risk_approved": true,
            "adjusted_confidence": 55,
            "adjusted_size_mult": 0.79,
            "risk_warnings": [
                "Reduced size to 79% due to confidence 55"
            ],
            "risk_rejection": null,
            "analyzed_at": "2026-06-12T02:08:06.594Z",
            "timeframes_used": [
                "1h",
                "4h",
                "1d"
            ],
            "btc_bias_at_time": null,
            "createdAt": "2026-06-12T02:08:06.604Z",
            "updatedAt": "2026-06-12T02:08:06.604Z",
            "__v": 0
        }
    ],
    "count": 2
}

====================================================================
{{BASE_URL}}/api/chart/history/BTCUSDT?limit=10


{
    "success": true,
    "data": [
        {
            "_id": "6a2b6a823f1203aa160cdbf1",
            "symbol": "BTCUSDT",
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + FVG Confluence at Resistance",
            "entry_zone": {
                "high": 64048.57,
                "low": 63933.02
            },
            "stop_loss": 64497.97,
            "take_profit_levels": [
                63239.43,
                62205,
                61088.19
            ],
            "risk_reward": 2.1,
            "confidence": 65,
            "invalidation": "Daily close above 64497.97 (strong resistance) invalidates bearish thesis",
            "framework_scores": {
                "SmartMoney": 85,
                "Wyckoff": 40,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 3,
            "risk_approved": true,
            "adjusted_confidence": 65,
            "adjusted_size_mult": 0.93,
            "risk_warnings": [
                "Reduced size to 93% due to confidence 65"
            ],
            "risk_rejection": null,
            "analyzed_at": "2026-06-12T02:10:10.442Z",
            "timeframes_used": [
                "1h",
                "4h",
                "1d"
            ],
            "btc_bias_at_time": null,
            "createdAt": "2026-06-12T02:10:10.445Z",
            "updatedAt": "2026-06-12T02:10:10.445Z",
            "__v": 0
        },
        {
            "_id": "6a2b6a063f1203aa160cdbee",
            "symbol": "BTCUSDT",
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + HTF Resistance Rejection",
            "entry_zone": {
                "high": 63933.02,
                "low": 63239.43
            },
            "stop_loss": 64163.49,
            "take_profit_levels": [
                62205,
                61088.19,
                59315.455
            ],
            "risk_reward": 2.5,
            "confidence": 55,
            "invalidation": "Daily close above 64163.49 (Camarilla R3) invalidates the bearish bias",
            "framework_scores": {
                "SmartMoney": 70,
                "Wyckoff": 50,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 2,
            "risk_approved": true,
            "adjusted_confidence": 55,
            "adjusted_size_mult": 0.79,
            "risk_warnings": [
                "Reduced size to 79% due to confidence 55"
            ],
            "risk_rejection": null,
            "analyzed_at": "2026-06-12T02:08:06.594Z",
            "timeframes_used": [
                "1h",
                "4h",
                "1d"
            ],
            "btc_bias_at_time": null,
            "createdAt": "2026-06-12T02:08:06.604Z",
            "updatedAt": "2026-06-12T02:08:06.604Z",
            "__v": 0
        }
    ],
    "count": 2
}

===================================================================
{{BASE_URL}}/api/orderblocks/active/BTCUSDT

{
    "success": true,
    "data": [],
    "count": 0
}


// ============================================================
// orderBlock.schema.ts
// Mongoose schema for Order Block zones
// ✅ COMPLETE — do NOT regenerate
// Imported by: orderBlock.model.ts
// ============================================================

import { Schema } from 'mongoose';

const FairValueGapSubSchema = new Schema({
  high:      { type: Number, required: true },
  low:       { type: Number, required: true },
  timestamp: { type: Number, required: true },
  filled:    { type: Boolean, default: false },
  type:      { type: String, enum: ['bullish', 'bearish'], required: true },
}, { _id: false });

export const OrderBlockSchema = new Schema(
  {
    id:               { type: String, required: true, unique: true, index: true },
    symbol:           { type: String, required: true, index: true },
    type:             { type: String, enum: ['bullish', 'bearish'], required: true },
    high:             { type: Number, required: true },
    low:              { type: Number, required: true },
    origin_timestamp: { type: Number, required: true },
    timeframe:        { type: String, required: true, default: '4H' },
    status:           { type: String, enum: ['active', 'mitigated', 'broken'], default: 'active', index: true },
    strength:         { type: Number, min: 0, max: 100, default: 50 },
    associated_fvg:   { type: FairValueGapSubSchema, default: null },
    mitigated_at:     { type: Date, default: null },
  },
  {
    timestamps: true,   // adds createdAt, updatedAt
    collection: 'orderblocks',
  }
);

// Compound index: most common query pattern
OrderBlockSchema.index({ symbol: 1, status: 1, origin_timestamp: -1 });
OrderBlockSchema.index({ symbol: 1, low: 1, high: 1 }); // for price range queries


// chartAnalysis.types.ts

export interface OrderBlock {
  id: string;
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  origin_timestamp: number;
  timeframe: string;
  status: 'active' | 'mitigated' | 'broken';
  associated_fvg?: FairValueGap;
  strength: number; // 0-100
}


==================================================================

{{BASE_URL}}/api/orderblocks/sync/BTCUSDT

{
    "success": true,
    "data": [
        {
            "_id": "6a2b70ed3f1203aa160cdc0f",
            "id": "Ri5lwISrUnmmzA2SQj0x7",
            "symbol": "BTCUSDT",
            "type": "bearish",
            "high": 74092,
            "low": 73222,
            "origin_timestamp": 1780272000000,
            "timeframe": "4H",
            "status": "active",
            "strength": 70,
            "associated_fvg": {
                "high": 73222,
                "low": 73095.64,
                "timestamp": 1780300800000,
                "filled": false,
                "type": "bearish"
            },
            "mitigated_at": null,
            "__v": 0,
            "createdAt": "2026-06-12T02:37:33.240Z",
            "updatedAt": "2026-06-12T02:37:33.240Z"
        }
    ],
    "count": 1,
    "synced_at": "2026-06-12T02:37:33.243Z"
}


=======================================================================
{{BASE_URL}}/api/intelligence/scan


{
    "success": true,
    "data": {
        "scan_id": "cZxDiRYCFtFWvV2_Usv3i",
        "generated_at": "2026-06-12T03:02:35.228Z",
        "btc_context": {
            "regime": "ranging",
            "bias": "short",
            "signal_fired_at": "2026-06-12T02:57:59.835Z",
            "signal_type": "Bearish OB + FVG Confluence at Resistance",
            "bos_direction": "bearish",
            "bos_level": 64048.57,
            "dominance": {
                "btc_dominance": 52,
                "eth_dominance": 16,
                "others_dominance": 32,
                "btc_d_trend": "neutral",
                "market_phase": "mixed",
                "sector_leaders": []
            },
            "minutes_since_signal": 0
        },
        "dominance": {
            "btc_dominance": 52,
            "eth_dominance": 16,
            "others_dominance": 32,
            "btc_d_trend": "neutral",
            "market_phase": "mixed",
            "sector_leaders": []
        },
        "market_phase": "mixed",
        "coins": [
            {
                "coin": "AAVE",
                "symbol": "AAVEUSDT",
                "current_price": 64.49,
                "price_change_24h": 2.24,
                "cascade": {
                    "coin": "AAVE",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 6,
                    "window_remaining_minutes": 360,
                    "expected_move_pct": 4.5,
                    "historical_follow_rate": 0.8171
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF (1D) bearish bias overrides LTF neutral",
                    "Unfilled bearish FVG overhead (66.14-63.65)",
                    "BTC context bearish (Bearish OB + FVG Confluence)"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish FVG + HTF Resistance Rejection",
                    "entry_zone": {
                        "high": 64.23,
                        "low": 63.65
                    },
                    "stop_loss": 65.5,
                    "take_profit_levels": [
                        62.57,
                        60.33,
                        57.83
                    ],
                    "risk_reward": 2.1,
                    "confidence": 55,
                    "invalidation": "Price closes above 65.45 (1D key level) on the 4H timeframe",
                    "reasoning": "The HTF (1D) is bearish at resistance, overriding the LTF neutral consolidation. A large unfilled bearish FVG (66.14-63.65) remains below current price, acting as a magnet for a retracement. A confirmed bullish BOS at 64.05 suggests a temporary bounce, but the HTF bearish bias and the FVG overhead favor a short from the FVG zone. BTC context is also bearish, reducing overall confidence but adding confluence. The setup targets the FVG fill and then the strong support at 60.33.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 30,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF (1D) bearish bias overrides LTF neutral",
                        "Unfilled bearish FVG overhead (66.14-63.65)",
                        "BTC context bearish (Bearish OB + FVG Confluence)"
                    ]
                },
                "correlation": {
                    "coin": "AAVE",
                    "vs": "BTC",
                    "correlation_30d": 0.8171,
                    "beta_30d": 1.5,
                    "lag_hours": 3,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6226,
                "last_updated": "2026-06-12T03:02:35.228Z"
            },
            {
                "coin": "AVAX",
                "symbol": "AVAXUSDT",
                "current_price": 6.657,
                "price_change_24h": -0.16,
                "cascade": {
                    "coin": "AVAX",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 3,
                    "window_remaining_minutes": 180,
                    "expected_move_pct": 3.74,
                    "historical_follow_rate": 0.8046
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF (1D, 4H) bearish bias at resistance",
                    "Bullish BOS level (6.664) being retested as resistance after sweep",
                    "Unfilled bearish FVGs above price"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish FVG + BOS Retest + HTF Resistance Confluence",
                    "entry_zone": {
                        "high": 6.664,
                        "low": 6.62
                    },
                    "stop_loss": 6.707,
                    "take_profit_levels": [
                        6.497,
                        6.419,
                        6.301
                    ],
                    "risk_reward": 2.1,
                    "confidence": 65,
                    "invalidation": "Daily close above 6.707 (swing high) invalidates bearish structure",
                    "reasoning": "The 1D and 4H timeframes are bearish, with price at resistance near 6.6785. A confirmed bullish BOS at 6.664 has been swept by a sell-side liquidity sweep, and price is now retesting that level from below. Three unfilled bearish FVGs above (7.313, 7.567, 8.244) act as resistance magnets. The HTF bearish bias overrides the 1H neutral consolidation, and BTC context is also short, reducing confidence slightly but aligning the overall bearish bias. The entry zone targets a retest of the BOS level with a stop above the recent swing high.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 20,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF (1D, 4H) bearish bias at resistance",
                        "Bullish BOS level (6.664) being retested as resistance after sweep",
                        "Unfilled bearish FVGs above price"
                    ]
                },
                "correlation": {
                    "coin": "AVAX",
                    "vs": "BTC",
                    "correlation_30d": 0.8046,
                    "beta_30d": 1.247,
                    "lag_hours": 1.5,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6207,
                "last_updated": "2026-06-12T03:02:30.216Z"
            },
            {
                "coin": "ARB",
                "symbol": "ARBUSDT",
                "current_price": 0.0834,
                "price_change_24h": 1.09,
                "cascade": {
                    "coin": "ARB",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 4.58,
                    "historical_follow_rate": 0.7719
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "Unmitigated bullish order block (4H)",
                    "Confirmed bullish BOS",
                    "Buy-side liquidity sweep"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "neutral",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bullish OB + BOS Confluence at HTF Resistance",
                    "entry_zone": {
                        "high": 0.0786,
                        "low": 0.0756
                    },
                    "stop_loss": 0.0749,
                    "take_profit_levels": [
                        0.0802,
                        0.0825,
                        0.0861
                    ],
                    "risk_reward": 2.1,
                    "confidence": 45,
                    "invalidation": "Break below 0.0749 (below the OB low + 1 ATR) invalidates the bullish thesis",
                    "reasoning": "The primary framework is Smart Money. A confirmed bullish BOS at 0.0817 and a buy-side liquidity sweep at 0.0779 indicate institutional interest. An unmitigated bullish order block on the 4H (0.0786-0.0756) provides a clear entry zone. However, the HTF (1D) is bearish and overrides the LTF bullish signal, and BTC context is short, reducing confidence. The setup is a counter-trend bounce within a range, not a trend reversal.",
                    "framework_scores": {
                        "SmartMoney": 70,
                        "Wyckoff": 40,
                        "ElliottWave": 30,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "Unmitigated bullish order block (4H)",
                        "Confirmed bullish BOS",
                        "Buy-side liquidity sweep"
                    ]
                },
                "correlation": {
                    "coin": "ARB",
                    "vs": "BTC",
                    "correlation_30d": 0.7719,
                    "beta_30d": 1.527,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6158,
                "last_updated": "2026-06-12T03:02:31.673Z"
            },
            {
                "coin": "WIF",
                "symbol": "WIFUSDT",
                "current_price": 0.1571,
                "price_change_24h": -1.01,
                "cascade": {
                    "coin": "WIF",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 5.33,
                    "historical_follow_rate": 0.7403
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF bearish trend (1D) overrides LTF",
                    "Unfilled bearish FVG at 0.1607-0.1588",
                    "Strong resistance at 0.15996 with 5 touches",
                    "BTC short bias aligns"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish FVG + HTF Resistance Rejection",
                    "entry_zone": {
                        "high": 0.1607,
                        "low": 0.1588
                    },
                    "stop_loss": 0.1625,
                    "take_profit_levels": [
                        0.1549,
                        0.1486,
                        0.1446
                    ],
                    "risk_reward": 2.5,
                    "confidence": 65,
                    "invalidation": "Price closes above 0.1625 on the 4H timeframe",
                    "reasoning": "The HTF (1D) is bearish and overrides the LTF neutral bias, with 2/3 timeframes aligned bearish. A bearish FVG exists at 0.1607-0.1588, unfilled, and price is currently near the strong resistance at 0.15996. The bullish BOS at 0.1557 is recent but the HTF trend remains bearish, suggesting a retracement to fill the FVG before continuation lower. The BTC context is also short, reducing confidence by 20 points but still providing confluence. The setup targets the unmitigated bullish OB at 0.1486-0.1446 and the strong support at 0.1549.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 30,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF bearish trend (1D) overrides LTF",
                        "Unfilled bearish FVG at 0.1607-0.1588",
                        "Strong resistance at 0.15996 with 5 touches",
                        "BTC short bias aligns"
                    ]
                },
                "correlation": {
                    "coin": "WIF",
                    "vs": "BTC",
                    "correlation_30d": 0.7403,
                    "beta_30d": 1.778,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.611,
                "last_updated": "2026-06-12T03:02:32.514Z"
            },
            {
                "coin": "TAO",
                "symbol": "TAOUSDT",
                "current_price": 214.1,
                "price_change_24h": 1.18,
                "cascade": {
                    "coin": "TAO",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 4.54,
                    "historical_follow_rate": 0.7219
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "Unmitigated bullish OB (4H) at 197.7-203.4",
                    "Confirmed bullish BOS at 214.6",
                    "Buy-side liquidity sweep at 202.5"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "neutral",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bullish OB + BOS Confluence with HTF Bearish Conflict",
                    "entry_zone": {
                        "high": 203.4,
                        "low": 197.7
                    },
                    "stop_loss": 191.4,
                    "take_profit_levels": [
                        214.6,
                        223.5,
                        230.5
                    ],
                    "risk_reward": 2,
                    "confidence": 40,
                    "invalidation": "A 4H close below 197.7 (bullish OB low) invalidates the bullish thesis and confirms HTF bearish continuation.",
                    "reasoning": "The primary framework is Smart Money due to a confirmed bullish BOS at 214.6 and a recent buy-side liquidity sweep at 202.5, which cleared stops before the move up. A large unmitigated bullish Order Block (197.7-203.4) on the 4H provides a strong demand zone for a potential long entry. However, the HTF (1D) is bearish and overrides the LTF bullish signal, creating a significant conflict. The BTC context is also bearish, further reducing confidence. The setup is a counter-trend bounce within a larger downtrend, so risk must be tightly managed.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 20,
                        "ElliottWave": 10,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "Unmitigated bullish OB (4H) at 197.7-203.4",
                        "Confirmed bullish BOS at 214.6",
                        "Buy-side liquidity sweep at 202.5"
                    ]
                },
                "correlation": {
                    "coin": "TAO",
                    "vs": "BTC",
                    "correlation_30d": 0.7219,
                    "beta_30d": 1.514,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6083,
                "last_updated": "2026-06-12T03:02:31.467Z"
            },
            {
                "coin": "MAGIC",
                "symbol": "MAGICUSDT",
                "current_price": 0.0464,
                "price_change_24h": -1.28,
                "cascade": {
                    "coin": "MAGIC",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 4.16,
                    "historical_follow_rate": 0.7206
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF bearish trend (1D/4H) overrides LTF neutral",
                    "Price at 1D resistance (0.0467) + 0.382 Fib retracement",
                    "BTC short bias aligns with bearish setup"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish OB + FVG Confluence at Resistance",
                    "entry_zone": {
                        "high": 0.0467,
                        "low": 0.0464
                    },
                    "stop_loss": 0.0474,
                    "take_profit_levels": [
                        0.0458,
                        0.0452,
                        0.0448
                    ],
                    "risk_reward": 2,
                    "confidence": 55,
                    "invalidation": "Price breaks and closes above 0.0474 (swing high) with strong momentum",
                    "reasoning": "The HTF (1D/4H) is bearish and overrides the LTF neutral bias. A confirmed bullish BOS at 0.0464 has already occurred, but price is now approaching the 1D resistance at 0.0467, which aligns with the 0.382 Fibonacci retracement of the recent swing. The unmitigated bearish order block at 0.0659 and unfilled bearish FVGs above provide strong resistance overhead. BTC context is short, reinforcing the bearish bias. The setup targets a retracement back toward the 0.0448 liquidity sweep level.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 40,
                        "ElliottWave": 50,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF bearish trend (1D/4H) overrides LTF neutral",
                        "Price at 1D resistance (0.0467) + 0.382 Fib retracement",
                        "BTC short bias aligns with bearish setup"
                    ]
                },
                "correlation": {
                    "coin": "MAGIC",
                    "vs": "BTC",
                    "correlation_30d": 0.7206,
                    "beta_30d": 1.388,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6081,
                "last_updated": "2026-06-12T03:02:33.872Z"
            },
            {
                "coin": "APT",
                "symbol": "APTUSDT",
                "current_price": 0.65,
                "price_change_24h": -2.69,
                "cascade": {
                    "coin": "APT",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 4.75,
                    "historical_follow_rate": 0.7095
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF (1D) bearish trend overrides LTF neutral",
                    "Price near 0.786 Fibonacci retracement (0.6479) from the 0.607-0.659 swing",
                    "Unfilled bearish FVG overhead (0.673-0.677) acting as resistance",
                    "BTC context bearish (short bias, bearish BOS)"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Sell-Side Liquidity Sweep + Bearish FVG Overhead",
                    "entry_zone": {
                        "high": 0.6479,
                        "low": 0.643
                    },
                    "stop_loss": 0.6595,
                    "take_profit_levels": [
                        0.637,
                        0.623,
                        0.607
                    ],
                    "risk_reward": 2.24,
                    "confidence": 55,
                    "invalidation": "Price breaks and closes above 0.659 (swing high), invalidating the bearish structure.",
                    "reasoning": "The HTF (1D) is bearish and overrides the LTF neutral bias. A confirmed bullish BOS at 0.643 was preceded by a sell-side liquidity sweep at the same level, trapping shorts before the move up. However, price is now approaching the unfilled bearish FVG at 0.673-0.677 and the 0.786 Fibonacci retracement at 0.6479, which aligns with the 1H consolidation resistance. The Wyckoff Phase B accumulation suggests a potential spring near 0.61, but the current structure favors a short from the retracement zone into the FVG, targeting the support cluster at 0.637 and 0.623. BTC context is bearish, adding confluence.",
                    "framework_scores": {
                        "SmartMoney": 70,
                        "Wyckoff": 40,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF (1D) bearish trend overrides LTF neutral",
                        "Price near 0.786 Fibonacci retracement (0.6479) from the 0.607-0.659 swing",
                        "Unfilled bearish FVG overhead (0.673-0.677) acting as resistance",
                        "BTC context bearish (short bias, bearish BOS)"
                    ]
                },
                "correlation": {
                    "coin": "APT",
                    "vs": "BTC",
                    "correlation_30d": 0.7095,
                    "beta_30d": 1.582,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6064,
                "last_updated": "2026-06-12T03:02:34.736Z"
            },
            {
                "coin": "OP",
                "symbol": "OPUSDT",
                "current_price": 0.0962,
                "price_change_24h": -0.62,
                "cascade": {
                    "coin": "OP",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 5.12,
                    "historical_follow_rate": 0.7011
                },
                "confluence_score": 4,
                "confluence_factors": [
                    "HTF (1D/4H) bearish bias overrides LTF",
                    "Bearish BOS confirmed at 0.0929",
                    "Price at 0.786 Fibonacci retracement of the bearish swing",
                    "BTC context bearish with Bearish OB + FVG signal"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish BOS + Unmitigated Bearish OB + FVG Confluence",
                    "entry_zone": {
                        "high": 0.0965,
                        "low": 0.0959
                    },
                    "stop_loss": 0.0985,
                    "take_profit_levels": [
                        0.0929,
                        0.0918,
                        0.0887
                    ],
                    "risk_reward": 2.5,
                    "confidence": 65,
                    "invalidation": "Price breaks and closes above 0.0985 (above the bearish OB high and recent swing high)",
                    "reasoning": "The HTF (1D/4H) is bearish, overriding the LTF neutral consolidation. A confirmed bearish BOS at 0.0929 has been swept multiple times, indicating liquidity grabs. Price is now retracing into the 0.786 Fib level (0.09585) and a bearish FVG (0.1026-0.1002) remains unfilled above. The 4H bearish OB (0.1425-0.1407) is distant but reinforces the bearish structure. The entry zone targets the 1H resistance area near the 0.786 Fib and the 4H key level, offering a high-probability short with a tight stop above the recent swing high. BTC context is also bearish, adding confluence.",
                    "framework_scores": {
                        "SmartMoney": 85,
                        "Wyckoff": 40,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 4,
                    "confluence_factors": [
                        "HTF (1D/4H) bearish bias overrides LTF",
                        "Bearish BOS confirmed at 0.0929",
                        "Price at 0.786 Fibonacci retracement of the bearish swing",
                        "BTC context bearish with Bearish OB + FVG signal"
                    ]
                },
                "correlation": {
                    "coin": "OP",
                    "vs": "BTC",
                    "correlation_30d": 0.7011,
                    "beta_30d": 1.708,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6052,
                "last_updated": "2026-06-12T03:02:33.190Z"
            }
        ],
        "total_analyzed": 23,
        "windows_open": 20,
        "top_opportunities": [
            {
                "coin": "AAVE",
                "symbol": "AAVEUSDT",
                "current_price": 64.49,
                "price_change_24h": 2.24,
                "cascade": {
                    "coin": "AAVE",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 6,
                    "window_remaining_minutes": 360,
                    "expected_move_pct": 4.5,
                    "historical_follow_rate": 0.8171
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF (1D) bearish bias overrides LTF neutral",
                    "Unfilled bearish FVG overhead (66.14-63.65)",
                    "BTC context bearish (Bearish OB + FVG Confluence)"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish FVG + HTF Resistance Rejection",
                    "entry_zone": {
                        "high": 64.23,
                        "low": 63.65
                    },
                    "stop_loss": 65.5,
                    "take_profit_levels": [
                        62.57,
                        60.33,
                        57.83
                    ],
                    "risk_reward": 2.1,
                    "confidence": 55,
                    "invalidation": "Price closes above 65.45 (1D key level) on the 4H timeframe",
                    "reasoning": "The HTF (1D) is bearish at resistance, overriding the LTF neutral consolidation. A large unfilled bearish FVG (66.14-63.65) remains below current price, acting as a magnet for a retracement. A confirmed bullish BOS at 64.05 suggests a temporary bounce, but the HTF bearish bias and the FVG overhead favor a short from the FVG zone. BTC context is also bearish, reducing overall confidence but adding confluence. The setup targets the FVG fill and then the strong support at 60.33.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 30,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF (1D) bearish bias overrides LTF neutral",
                        "Unfilled bearish FVG overhead (66.14-63.65)",
                        "BTC context bearish (Bearish OB + FVG Confluence)"
                    ]
                },
                "correlation": {
                    "coin": "AAVE",
                    "vs": "BTC",
                    "correlation_30d": 0.8171,
                    "beta_30d": 1.5,
                    "lag_hours": 3,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6226,
                "last_updated": "2026-06-12T03:02:35.228Z"
            },
            {
                "coin": "AVAX",
                "symbol": "AVAXUSDT",
                "current_price": 6.657,
                "price_change_24h": -0.16,
                "cascade": {
                    "coin": "AVAX",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 3,
                    "window_remaining_minutes": 180,
                    "expected_move_pct": 3.74,
                    "historical_follow_rate": 0.8046
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF (1D, 4H) bearish bias at resistance",
                    "Bullish BOS level (6.664) being retested as resistance after sweep",
                    "Unfilled bearish FVGs above price"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish FVG + BOS Retest + HTF Resistance Confluence",
                    "entry_zone": {
                        "high": 6.664,
                        "low": 6.62
                    },
                    "stop_loss": 6.707,
                    "take_profit_levels": [
                        6.497,
                        6.419,
                        6.301
                    ],
                    "risk_reward": 2.1,
                    "confidence": 65,
                    "invalidation": "Daily close above 6.707 (swing high) invalidates bearish structure",
                    "reasoning": "The 1D and 4H timeframes are bearish, with price at resistance near 6.6785. A confirmed bullish BOS at 6.664 has been swept by a sell-side liquidity sweep, and price is now retesting that level from below. Three unfilled bearish FVGs above (7.313, 7.567, 8.244) act as resistance magnets. The HTF bearish bias overrides the 1H neutral consolidation, and BTC context is also short, reducing confidence slightly but aligning the overall bearish bias. The entry zone targets a retest of the BOS level with a stop above the recent swing high.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 20,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF (1D, 4H) bearish bias at resistance",
                        "Bullish BOS level (6.664) being retested as resistance after sweep",
                        "Unfilled bearish FVGs above price"
                    ]
                },
                "correlation": {
                    "coin": "AVAX",
                    "vs": "BTC",
                    "correlation_30d": 0.8046,
                    "beta_30d": 1.247,
                    "lag_hours": 1.5,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6207,
                "last_updated": "2026-06-12T03:02:30.216Z"
            },
            {
                "coin": "ARB",
                "symbol": "ARBUSDT",
                "current_price": 0.0834,
                "price_change_24h": 1.09,
                "cascade": {
                    "coin": "ARB",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 4.58,
                    "historical_follow_rate": 0.7719
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "Unmitigated bullish order block (4H)",
                    "Confirmed bullish BOS",
                    "Buy-side liquidity sweep"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "neutral",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bullish OB + BOS Confluence at HTF Resistance",
                    "entry_zone": {
                        "high": 0.0786,
                        "low": 0.0756
                    },
                    "stop_loss": 0.0749,
                    "take_profit_levels": [
                        0.0802,
                        0.0825,
                        0.0861
                    ],
                    "risk_reward": 2.1,
                    "confidence": 45,
                    "invalidation": "Break below 0.0749 (below the OB low + 1 ATR) invalidates the bullish thesis",
                    "reasoning": "The primary framework is Smart Money. A confirmed bullish BOS at 0.0817 and a buy-side liquidity sweep at 0.0779 indicate institutional interest. An unmitigated bullish order block on the 4H (0.0786-0.0756) provides a clear entry zone. However, the HTF (1D) is bearish and overrides the LTF bullish signal, and BTC context is short, reducing confidence. The setup is a counter-trend bounce within a range, not a trend reversal.",
                    "framework_scores": {
                        "SmartMoney": 70,
                        "Wyckoff": 40,
                        "ElliottWave": 30,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "Unmitigated bullish order block (4H)",
                        "Confirmed bullish BOS",
                        "Buy-side liquidity sweep"
                    ]
                },
                "correlation": {
                    "coin": "ARB",
                    "vs": "BTC",
                    "correlation_30d": 0.7719,
                    "beta_30d": 1.527,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6158,
                "last_updated": "2026-06-12T03:02:31.673Z"
            },
            {
                "coin": "WIF",
                "symbol": "WIFUSDT",
                "current_price": 0.1571,
                "price_change_24h": -1.01,
                "cascade": {
                    "coin": "WIF",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 5.33,
                    "historical_follow_rate": 0.7403
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF bearish trend (1D) overrides LTF",
                    "Unfilled bearish FVG at 0.1607-0.1588",
                    "Strong resistance at 0.15996 with 5 touches",
                    "BTC short bias aligns"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish FVG + HTF Resistance Rejection",
                    "entry_zone": {
                        "high": 0.1607,
                        "low": 0.1588
                    },
                    "stop_loss": 0.1625,
                    "take_profit_levels": [
                        0.1549,
                        0.1486,
                        0.1446
                    ],
                    "risk_reward": 2.5,
                    "confidence": 65,
                    "invalidation": "Price closes above 0.1625 on the 4H timeframe",
                    "reasoning": "The HTF (1D) is bearish and overrides the LTF neutral bias, with 2/3 timeframes aligned bearish. A bearish FVG exists at 0.1607-0.1588, unfilled, and price is currently near the strong resistance at 0.15996. The bullish BOS at 0.1557 is recent but the HTF trend remains bearish, suggesting a retracement to fill the FVG before continuation lower. The BTC context is also short, reducing confidence by 20 points but still providing confluence. The setup targets the unmitigated bullish OB at 0.1486-0.1446 and the strong support at 0.1549.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 30,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF bearish trend (1D) overrides LTF",
                        "Unfilled bearish FVG at 0.1607-0.1588",
                        "Strong resistance at 0.15996 with 5 touches",
                        "BTC short bias aligns"
                    ]
                },
                "correlation": {
                    "coin": "WIF",
                    "vs": "BTC",
                    "correlation_30d": 0.7403,
                    "beta_30d": 1.778,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.611,
                "last_updated": "2026-06-12T03:02:32.514Z"
            },
            {
                "coin": "TAO",
                "symbol": "TAOUSDT",
                "current_price": 214.1,
                "price_change_24h": 1.18,
                "cascade": {
                    "coin": "TAO",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 4.54,
                    "historical_follow_rate": 0.7219
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "Unmitigated bullish OB (4H) at 197.7-203.4",
                    "Confirmed bullish BOS at 214.6",
                    "Buy-side liquidity sweep at 202.5"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "neutral",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bullish OB + BOS Confluence with HTF Bearish Conflict",
                    "entry_zone": {
                        "high": 203.4,
                        "low": 197.7
                    },
                    "stop_loss": 191.4,
                    "take_profit_levels": [
                        214.6,
                        223.5,
                        230.5
                    ],
                    "risk_reward": 2,
                    "confidence": 40,
                    "invalidation": "A 4H close below 197.7 (bullish OB low) invalidates the bullish thesis and confirms HTF bearish continuation.",
                    "reasoning": "The primary framework is Smart Money due to a confirmed bullish BOS at 214.6 and a recent buy-side liquidity sweep at 202.5, which cleared stops before the move up. A large unmitigated bullish Order Block (197.7-203.4) on the 4H provides a strong demand zone for a potential long entry. However, the HTF (1D) is bearish and overrides the LTF bullish signal, creating a significant conflict. The BTC context is also bearish, further reducing confidence. The setup is a counter-trend bounce within a larger downtrend, so risk must be tightly managed.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 20,
                        "ElliottWave": 10,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "Unmitigated bullish OB (4H) at 197.7-203.4",
                        "Confirmed bullish BOS at 214.6",
                        "Buy-side liquidity sweep at 202.5"
                    ]
                },
                "correlation": {
                    "coin": "TAO",
                    "vs": "BTC",
                    "correlation_30d": 0.7219,
                    "beta_30d": 1.514,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6083,
                "last_updated": "2026-06-12T03:02:31.467Z"
            }
        ]
    },
    "cached": false
}



==============================================================
{{BASE_URL}}/api/intelligence/cascade


{
    "success": true,
    "data": {
        "scan_id": "cZxDiRYCFtFWvV2_Usv3i",
        "generated_at": "2026-06-12T03:02:35.228Z",
        "btc_signal": {
            "type": "Bearish OB + FVG Confluence at Resistance",
            "fired_at": "2026-06-12T02:57:59.835Z",
            "bias": "short"
        },
        "windows_open": 20,
        "coins": [
            {
                "symbol": "AAVE",
                "cascade_status": "window_open",
                "window_remaining_minutes": 360,
                "expected_move_pct": 4.5,
                "historical_follow_rate": 0.8171,
                "opportunity_score": 0.6226,
                "current_price": 64.49,
                "price_change_24h": 2.24
            },
            {
                "symbol": "AVAX",
                "cascade_status": "window_open",
                "window_remaining_minutes": 180,
                "expected_move_pct": 3.74,
                "historical_follow_rate": 0.8046,
                "opportunity_score": 0.6207,
                "current_price": 6.657,
                "price_change_24h": -0.16
            },
            {
                "symbol": "ARB",
                "cascade_status": "window_open",
                "window_remaining_minutes": 240,
                "expected_move_pct": 4.58,
                "historical_follow_rate": 0.7719,
                "opportunity_score": 0.6158,
                "current_price": 0.0834,
                "price_change_24h": 1.09
            },
            {
                "symbol": "WIF",
                "cascade_status": "window_open",
                "window_remaining_minutes": 240,
                "expected_move_pct": 5.33,
                "historical_follow_rate": 0.7403,
                "opportunity_score": 0.611,
                "current_price": 0.1571,
                "price_change_24h": -1.01
            },
            {
                "symbol": "TAO",
                "cascade_status": "window_open",
                "window_remaining_minutes": 240,
                "expected_move_pct": 4.54,
                "historical_follow_rate": 0.7219,
                "opportunity_score": 0.6083,
                "current_price": 214.1,
                "price_change_24h": 1.18
            },
            {
                "symbol": "MAGIC",
                "cascade_status": "window_open",
                "window_remaining_minutes": 240,
                "expected_move_pct": 4.16,
                "historical_follow_rate": 0.7206,
                "opportunity_score": 0.6081,
                "current_price": 0.0464,
                "price_change_24h": -1.28
            },
            {
                "symbol": "APT",
                "cascade_status": "window_open",
                "window_remaining_minutes": 240,
                "expected_move_pct": 4.75,
                "historical_follow_rate": 0.7095,
                "opportunity_score": 0.6064,
                "current_price": 0.65,
                "price_change_24h": -2.69
            },
            {
                "symbol": "OP",
                "cascade_status": "window_open",
                "window_remaining_minutes": 240,
                "expected_move_pct": 5.12,
                "historical_follow_rate": 0.7011,
                "opportunity_score": 0.6052,
                "current_price": 0.0962,
                "price_change_24h": -0.62
            }
        ]
    }
}


============================================================
{{BASE_URL}}/api/agent-runs?limit=10&status=completed



{
    "runs": [
        {
            "_id": "6a2b80133f1203aa160cdc43",
            "runId": "run-1PfLZD8oBo",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:42:11.053Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:42:11.056Z",
            "updatedAt": "2026-06-12T03:43:41.600Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:43:41.599Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Reached 5 read iterations without a clear signal."
                },
                "confidence": 90,
                "reasoning": "Reached 5 read iterations without a clear signal.",
                "toolCallTrace": [
                    "get_wallet_state",
                    "get_price",
                    "get_token_volume",
                    "get_token_volume",
                    "get_token_volume",
                    "get_yields",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "check_timeframe_alignment",
                    "check_timeframe_alignment",
                    "check_timeframe_alignment"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:43:41.598Z"
            }
        },
        {
            "_id": "6a2b7fd73f1203aa160cdc42",
            "runId": "run-J79bQ2fASo",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:41:11.051Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:41:11.052Z",
            "updatedAt": "2026-06-12T03:42:10.457Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:42:10.456Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "No compelling trade opportunity. Top pool (WHYPE-USDC 160% APY) is on Hyperliquid L1 with all reward APY — high bridging/contract risk and no data on WHYPE. Next best (WETH-USDC on Base, 83.65% APY, $97.8M TVL) is solid but ETH is in bearish HTF structure at resistance ($1,670) — entering a concentrated LP now risks IL from a potential ETH decline. No APY anomalies detected this cycle. Better to wait for clearer directional alignment or a yield anomaly signal."
                },
                "confidence": 90,
                "reasoning": "No compelling trade opportunity. Top pool (WHYPE-USDC 160% APY) is on Hyperliquid L1 with all reward APY — high bridging/contract risk and no data on WHYPE. Next best (WETH-USDC on Base, 83.65% APY, $97.8M TVL) is solid but ETH is in bearish HTF structure at resistance ($1,670) — entering a concentrated LP now risks IL from a potential ETH decline. No APY anomalies detected this cycle. Better to wait for clearer directional alignment or a yield anomaly signal.",
                "toolCallTrace": [
                    "get_price",
                    "get_wallet_state",
                    "get_token_volume",
                    "get_yields",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_price",
                    "no_action"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:42:10.456Z"
            }
        },
        {
            "_id": "6a2b7f233f1203aa160cdc40",
            "runId": "run-22lTTRmdC-",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:38:11.020Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:38:11.023Z",
            "updatedAt": "2026-06-12T03:39:32.528Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:39:32.528Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Reached 5 read iterations without a clear signal."
                },
                "confidence": 90,
                "reasoning": "Reached 5 read iterations without a clear signal.",
                "toolCallTrace": [
                    "get_wallet_state",
                    "get_price",
                    "get_token_volume",
                    "get_yields",
                    "get_price",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_confluence_zones",
                    "get_confluence_zones",
                    "get_yields"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:39:32.528Z"
            }
        },
        {
            "_id": "6a2b7e333f1203aa160cdc3d",
            "runId": "run-TK5-LXyRML",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:34:11.005Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:34:11.009Z",
            "updatedAt": "2026-06-12T03:35:20.557Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:35:20.556Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Market conditions are unfavorable for yield entry: BTC and ETH both show conflicted multi-timeframe bias with bearish HTF overriding neutral LTF (1W/1D bearish at resistance). No yield anomaly spikes detected this cycle. The top pool (nest-cl/Hyperliquid 160% APY) is on a niche chain with 100% reward-based yield — unsustainable. Uniswap-v3 WETH-USDC (83.65% APY, $97.8M TVL) is tempting but entering when ETH is at resistance ($1,695) with bearish weekly/daily structure risks impermanent loss. Best action: stay in USDC and wait for clearer conditions."
                },
                "confidence": 90,
                "reasoning": "Market conditions are unfavorable for yield entry: BTC and ETH both show conflicted multi-timeframe bias with bearish HTF overriding neutral LTF (1W/1D bearish at resistance). No yield anomaly spikes detected this cycle. The top pool (nest-cl/Hyperliquid 160% APY) is on a niche chain with 100% reward-based yield — unsustainable. Uniswap-v3 WETH-USDC (83.65% APY, $97.8M TVL) is tempting but entering when ETH is at resistance ($1,695) with bearish weekly/daily structure risks impermanent loss. Best action: stay in USDC and wait for clearer conditions.",
                "toolCallTrace": [
                    "get_wallet_state",
                    "get_price",
                    "get_token_volume",
                    "get_yields",
                    "get_yields",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "check_timeframe_alignment",
                    "check_timeframe_alignment",
                    "no_action"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:35:20.556Z"
            }
        },
        {
            "_id": "6a2b7dbb3f1203aa160cdc3c",
            "runId": "run-2EDcL5hLiF",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:32:11.001Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:32:11.004Z",
            "updatedAt": "2026-06-12T03:33:11.235Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:33:11.235Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Reached 5 read iterations without a clear signal."
                },
                "confidence": 90,
                "reasoning": "Reached 5 read iterations without a clear signal.",
                "toolCallTrace": [
                    "get_wallet_state",
                    "get_price",
                    "get_token_volume",
                    "get_yields",
                    "get_price",
                    "get_price",
                    "get_token_volume",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_yields",
                    "get_yields"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:33:11.235Z"
            }
        },
        {
            "_id": "6a2b7c8e3f1203aa160cdc35",
            "runId": "run-uGGoVojfEZ",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:27:10.959Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:27:10.963Z",
            "updatedAt": "2026-06-12T03:28:49.169Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:28:49.169Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Reached 5 read iterations without a clear signal."
                },
                "confidence": 90,
                "reasoning": "Reached 5 read iterations without a clear signal.",
                "toolCallTrace": [
                    "get_price",
                    "get_token_volume",
                    "get_wallet_state",
                    "get_price",
                    "get_yields",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_token_volume",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "check_timeframe_alignment",
                    "check_timeframe_alignment",
                    "check_timeframe_alignment",
                    "get_yields"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:28:49.168Z"
            }
        },
        {
            "_id": "6a2b7c163f1203aa160cdc33",
            "runId": "run-wcQYybXJ51",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:25:10.941Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:25:10.944Z",
            "updatedAt": "2026-06-12T03:26:10.995Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:26:10.995Z",
            "decision": {
                "intent": {
                    "type": "set_alert",
                    "rationale": "ETH breaking above $1750 would signal HTF bullish reversal, making the 83.65% APY uniswap-v3 WETH-USDC pool on Base ($97.8M TVL) a safer LP entry. Currently ETH is at $1,668 with bearish HTF overriding neutral LTF — waiting for alignment.",
                    "coinId": "ethereum",
                    "condition": "above",
                    "threshold": 1750
                },
                "confidence": 80,
                "reasoning": "ETH breaking above $1750 would signal HTF bullish reversal, making the 83.65% APY uniswap-v3 WETH-USDC pool on Base ($97.8M TVL) a safer LP entry. Currently ETH is at $1,668 with bearish HTF overriding neutral LTF — waiting for alignment.",
                "toolCallTrace": [
                    "get_price",
                    "get_token_volume",
                    "get_wallet_state",
                    "get_yields",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_token_volume",
                    "get_token_volume",
                    "get_token_volume",
                    "get_token_volume",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "set_alert"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:26:10.990Z"
            }
        },
        {
            "_id": "6a2b7bda3f1203aa160cdc31",
            "runId": "run-ceVUPXOc2y",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:24:10.942Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:24:10.944Z",
            "updatedAt": "2026-06-12T03:24:51.100Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:24:51.099Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Reached 5 read iterations without a clear signal."
                },
                "confidence": 90,
                "reasoning": "Reached 5 read iterations without a clear signal.",
                "toolCallTrace": [
                    "get_wallet_state",
                    "get_price",
                    "get_token_volume",
                    "get_yields",
                    "get_news_sentiment",
                    "get_price",
                    "get_price",
                    "get_token_volume",
                    "get_token_volume",
                    "get_full_htf_context",
                    "check_timeframe_alignment"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:24:51.098Z"
            }
        },
        {
            "_id": "6a2b7b263f1203aa160cdc2d",
            "runId": "run-W16XvQEZjJ",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:21:10.911Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:21:10.913Z",
            "updatedAt": "2026-06-12T03:22:23.049Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:22:23.049Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Market structure is conflicted — BTC and ETH both show HTF (1D/1W) bearish overriding LTF neutral signals, with no timeframe alignment. No APY anomalies detected this cycle. The top pool (WHYPE-USDC at 133%) is on a niche chain with low TVL ($7.5M) and illiquid token. The safest high-yield pool (Uniswap V3 WETH-USDC on Base, $97M TVL, 85.6% APY) carries impermanent loss risk in a bearish ETH environment. No compelling risk-adjusted opportunity warrants action right now."
                },
                "confidence": 90,
                "reasoning": "Market structure is conflicted — BTC and ETH both show HTF (1D/1W) bearish overriding LTF neutral signals, with no timeframe alignment. No APY anomalies detected this cycle. The top pool (WHYPE-USDC at 133%) is on a niche chain with low TVL ($7.5M) and illiquid token. The safest high-yield pool (Uniswap V3 WETH-USDC on Base, $97M TVL, 85.6% APY) carries impermanent loss risk in a bearish ETH environment. No compelling risk-adjusted opportunity warrants action right now.",
                "toolCallTrace": [
                    "get_wallet_state",
                    "get_price",
                    "get_token_volume",
                    "get_yields",
                    "get_yields",
                    "get_token_volume",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "check_timeframe_alignment",
                    "check_timeframe_alignment",
                    "no_action"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:22:23.049Z"
            }
        },
        {
            "_id": "6a2b7aae3f1203aa160cdc2c",
            "runId": "run-Nx8fDaRS_6",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:19:10.889Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:19:10.893Z",
            "updatedAt": "2026-06-12T03:20:12.029Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:20:12.028Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Reached 5 read iterations without a clear signal."
                },
                "confidence": 90,
                "reasoning": "Reached 5 read iterations without a clear signal.",
                "toolCallTrace": [
                    "get_price",
                    "get_token_volume",
                    "get_wallet_state",
                    "get_price",
                    "get_yields",
                    "get_token_volume",
                    "get_token_volume",
                    "get_token_volume",
                    "get_token_volume",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_yields"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:20:12.028Z"
            }
        }
    ],
    "total": 10
}

{{BASE_URL}}/api/agent-runs/:runId


{
    "_id": "6a2b7aae3f1203aa160cdc2c",
    "runId": "run-Nx8fDaRS_6",
    "strategy": "yieldHunter",
    "mode": "paper",
    "startedAt": "2026-06-12T03:19:10.889Z",
    "status": "completed",
    "contextSnapshot": "=== AGENT CONTEXT | 2026-06-12T03:19:13.555Z ===\nStrategy: yieldHunter\n\nWALLET (paper): USDC: $5000.00 | Total: $5000.00 | Today PnL: +$0.00 | Open positions: 0\n\n=== YIELD HUNTER — 2026-06-12T03:19:13.554Z ===\nScanned 334 USDC/stablecoin pools (TVL ≥ $5M)\n\nTOP 10 POOLS BY APY:\n  nest-cl/Hyperliquid L1 (WHYPE-USDC): 133.21% APY, TVL $7.5M\n  aerodrome-slipstream/Base (USDC-CBBTC): 112.1% APY, TVL $9.1M\n  uniswap-v3/Base (WETH-USDC): 85.64% APY, TVL $97.4M\n  gmtrade/Solana (XAU-USDC): 84.22% APY, TVL $6.3M\n  raydium-amm/Solana (WSOL-USDC): 80.2% APY, TVL $7.9M\n  uniswap-v4/Arbitrum (DORY-USDC): 79.6% APY, TVL $11.7M\n  aerodrome-slipstream/Base (WETH-USDC): 78.07% APY, TVL $8.2M\n  minswap-dex/Cardano (NIGHT-USDCX): 76.5% APY, TVL $5.8M\n  pharaoh-v3/Avalanche (USDT-USDC): 72.31% APY, TVL $11.0M\n  orca-dex/Solana (SOL-USDC): 54.46% APY, TVL $22.8M\n\nANOMALIES (APY spike > 5pt vs 7d avg):\n  None detected this cycle.",
    "createdAt": "2026-06-12T03:19:10.893Z",
    "updatedAt": "2026-06-12T03:20:12.029Z",
    "__v": 0,
    "completedAt": "2026-06-12T03:20:12.028Z",
    "decision": {
        "intent": {
            "type": "no_action",
            "rationale": "Reached 5 read iterations without a clear signal."
        },
        "confidence": 90,
        "reasoning": "Reached 5 read iterations without a clear signal.",
        "toolCallTrace": [
            "get_price",
            "get_token_volume",
            "get_wallet_state",
            "get_price",
            "get_yields",
            "get_token_volume",
            "get_token_volume",
            "get_token_volume",
            "get_token_volume",
            "get_news_sentiment",
            "get_news_sentiment",
            "get_news_sentiment",
            "get_full_htf_context",
            "get_full_htf_context",
            "get_full_htf_context",
            "get_yields"
        ]
    },
    "executionResult": {
        "status": "filled",
        "simulatedPnlUsd": 0,
        "executedAt": "2026-06-12T03:20:12.028Z"
    }
}

=================================================================

{{BASE_URL}}/api/agent-runs/trigger


response {
    "triggered": true,
    "waited": false
}




================================================

{{BASE_URL}}/api/opportunities



{
    "opportunities": [
        {
            "_id": "6a2b7d073f1203aa160cdc38",
            "opportunityId": "opp-run-y8yriZGZSI-afe2c8c8",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-y8yriZGZSI",
            "title": "nest-cl/Hyperliquid L1 APY spike: 160.02%",
            "detail": "WHYPE-USDC APY jumped 7.66pt above 7d avg (152.36%). TVL: $7.6M.",
            "asset": "WHYPE-USDC",
            "protocol": "nest-cl",
            "chain": "Hyperliquid L1",
            "score": 88,
            "acted": false,
            "detectedAt": "2026-06-12T03:29:11.318Z",
            "expiresAt": "2026-06-13T03:29:11.318Z",
            "metadata": {
                "pool": "afe2c8c8-2ab8-4f1b-abda-a8a12718c431",
                "protocol": "nest-cl",
                "chain": "Hyperliquid L1",
                "symbol": "WHYPE-USDC",
                "apyPct": 160.02,
                "tvlUsd": 7554342,
                "apyBase": null,
                "apyReward": 160.0246,
                "avg7dApyPct": 152.36,
                "spikePct": 7.66
            },
            "__v": 0,
            "createdAt": "2026-06-12T03:29:11.318Z",
            "updatedAt": "2026-06-12T03:29:11.318Z"
        },
        {
            "_id": "6a2b7c8f3f1203aa160cdc36",
            "opportunityId": "opp-run-uGGoVojfEZ-afe2c8c8",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-uGGoVojfEZ",
            "title": "nest-cl/Hyperliquid L1 APY spike: 160.02%",
            "detail": "WHYPE-USDC APY jumped 11.49pt above 7d avg (148.53%). TVL: $7.6M.",
            "asset": "WHYPE-USDC",
            "protocol": "nest-cl",
            "chain": "Hyperliquid L1",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T03:27:11.704Z",
            "expiresAt": "2026-06-13T03:27:11.704Z",
            "metadata": {
                "pool": "afe2c8c8-2ab8-4f1b-abda-a8a12718c431",
                "protocol": "nest-cl",
                "chain": "Hyperliquid L1",
                "symbol": "WHYPE-USDC",
                "apyPct": 160.02,
                "tvlUsd": 7554342,
                "apyBase": null,
                "apyReward": 160.0246,
                "avg7dApyPct": 148.53,
                "spikePct": 11.49
            },
            "__v": 0,
            "createdAt": "2026-06-12T03:27:11.706Z",
            "updatedAt": "2026-06-12T03:27:11.706Z"
        },
        {
            "_id": "6a2b7c173f1203aa160cdc34",
            "opportunityId": "opp-run-wcQYybXJ51-afe2c8c8",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-wcQYybXJ51",
            "title": "nest-cl/Hyperliquid L1 APY spike: 160.02%",
            "detail": "WHYPE-USDC APY jumped 15.32pt above 7d avg (144.7%). TVL: $7.6M.",
            "asset": "WHYPE-USDC",
            "protocol": "nest-cl",
            "chain": "Hyperliquid L1",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T03:25:11.682Z",
            "expiresAt": "2026-06-13T03:25:11.682Z",
            "metadata": {
                "pool": "afe2c8c8-2ab8-4f1b-abda-a8a12718c431",
                "protocol": "nest-cl",
                "chain": "Hyperliquid L1",
                "symbol": "WHYPE-USDC",
                "apyPct": 160.02,
                "tvlUsd": 7554342,
                "apyBase": null,
                "apyReward": 160.0246,
                "avg7dApyPct": 144.7,
                "spikePct": 15.32
            },
            "__v": 0,
            "createdAt": "2026-06-12T03:25:11.683Z",
            "updatedAt": "2026-06-12T03:25:11.683Z"
        },
        {
            "_id": "6a2b7bdb3f1203aa160cdc32",
            "opportunityId": "opp-run-ceVUPXOc2y-afe2c8c8",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-ceVUPXOc2y",
            "title": "nest-cl/Hyperliquid L1 APY spike: 160.02%",
            "detail": "WHYPE-USDC APY jumped 19.15pt above 7d avg (140.87%). TVL: $7.6M.",
            "asset": "WHYPE-USDC",
            "protocol": "nest-cl",
            "chain": "Hyperliquid L1",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T03:24:11.985Z",
            "expiresAt": "2026-06-13T03:24:11.985Z",
            "metadata": {
                "pool": "afe2c8c8-2ab8-4f1b-abda-a8a12718c431",
                "protocol": "nest-cl",
                "chain": "Hyperliquid L1",
                "symbol": "WHYPE-USDC",
                "apyPct": 160.02,
                "tvlUsd": 7554342,
                "apyBase": null,
                "apyReward": 160.0246,
                "avg7dApyPct": 140.87,
                "spikePct": 19.15
            },
            "__v": 0,
            "createdAt": "2026-06-12T03:24:11.986Z",
            "updatedAt": "2026-06-12T03:24:11.986Z"
        },
        {
            "_id": "6a2b7b9f3f1203aa160cdc2f",
            "opportunityId": "opp-run-55l0jCqAhI-afe2c8c8",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-55l0jCqAhI",
            "title": "nest-cl/Hyperliquid L1 APY spike: 160.02%",
            "detail": "WHYPE-USDC APY jumped 22.98pt above 7d avg (137.04%). TVL: $7.6M.",
            "asset": "WHYPE-USDC",
            "protocol": "nest-cl",
            "chain": "Hyperliquid L1",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T03:23:11.820Z",
            "expiresAt": "2026-06-13T03:23:11.819Z",
            "metadata": {
                "pool": "afe2c8c8-2ab8-4f1b-abda-a8a12718c431",
                "protocol": "nest-cl",
                "chain": "Hyperliquid L1",
                "symbol": "WHYPE-USDC",
                "apyPct": 160.02,
                "tvlUsd": 7554342,
                "apyBase": null,
                "apyReward": 160.0246,
                "avg7dApyPct": 137.04,
                "spikePct": 22.98
            },
            "__v": 0,
            "createdAt": "2026-06-12T03:23:11.822Z",
            "updatedAt": "2026-06-12T03:23:11.822Z"
        },
        {
            "_id": "6a2b6ef63f1203aa160cdc09",
            "opportunityId": "opp-run-_dv4pf_oOO-58990934",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-_dv4pf_oOO",
            "title": "pharaoh-v3/Avalanche APY spike: 72.31%",
            "detail": "USDT-USDC APY jumped 7.15pt above 7d avg (65.16%). TVL: $11.0M.",
            "asset": "USDT-USDC",
            "protocol": "pharaoh-v3",
            "chain": "Avalanche",
            "score": 86,
            "acted": false,
            "detectedAt": "2026-06-12T02:29:10.898Z",
            "expiresAt": "2026-06-13T02:29:10.898Z",
            "metadata": {
                "pool": "58990934-9fb1-45f2-8882-d493c4627768",
                "protocol": "pharaoh-v3",
                "chain": "Avalanche",
                "symbol": "USDT-USDC",
                "apyPct": 72.31,
                "tvlUsd": 10989987,
                "apyBase": 0,
                "apyReward": 72.3128,
                "avg7dApyPct": 65.16,
                "spikePct": 7.15
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:29:10.899Z",
            "updatedAt": "2026-06-12T02:29:10.899Z"
        },
        {
            "_id": "6a2b6ef63f1203aa160cdc0a",
            "opportunityId": "opp-run-_dv4pf_oOO-da292ed1",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-_dv4pf_oOO",
            "title": "fluid-dex/Ethereum APY spike: 33.67%",
            "detail": "USDC-ETH APY jumped 6.65pt above 7d avg (27.02%). TVL: $9.2M.",
            "asset": "USDC-ETH",
            "protocol": "fluid-dex",
            "chain": "Ethereum",
            "score": 83,
            "acted": false,
            "detectedAt": "2026-06-12T02:29:10.898Z",
            "expiresAt": "2026-06-13T02:29:10.898Z",
            "metadata": {
                "pool": "da292ed1-aff5-44e0-8e23-333a1c61ee7f",
                "protocol": "fluid-dex",
                "chain": "Ethereum",
                "symbol": "USDC-ETH",
                "apyPct": 33.67,
                "tvlUsd": 9186953,
                "apyBase": 33.67359,
                "apyReward": null,
                "avg7dApyPct": 27.02,
                "spikePct": 6.65
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:29:10.899Z",
            "updatedAt": "2026-06-12T02:29:10.899Z"
        },
        {
            "_id": "6a2b6eba3f1203aa160cdc06",
            "opportunityId": "opp-run-JhXiSdxCsh-58990934",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-JhXiSdxCsh",
            "title": "pharaoh-v3/Avalanche APY spike: 72.31%",
            "detail": "USDT-USDC APY jumped 10.73pt above 7d avg (61.58%). TVL: $11.0M.",
            "asset": "USDT-USDC",
            "protocol": "pharaoh-v3",
            "chain": "Avalanche",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:28:10.952Z",
            "expiresAt": "2026-06-13T02:28:10.952Z",
            "metadata": {
                "pool": "58990934-9fb1-45f2-8882-d493c4627768",
                "protocol": "pharaoh-v3",
                "chain": "Avalanche",
                "symbol": "USDT-USDC",
                "apyPct": 72.31,
                "tvlUsd": 10989987,
                "apyBase": 0,
                "apyReward": 72.3128,
                "avg7dApyPct": 61.58,
                "spikePct": 10.73
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:28:10.953Z",
            "updatedAt": "2026-06-12T02:28:10.953Z"
        },
        {
            "_id": "6a2b6eba3f1203aa160cdc07",
            "opportunityId": "opp-run-JhXiSdxCsh-da292ed1",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-JhXiSdxCsh",
            "title": "fluid-dex/Ethereum APY spike: 33.67%",
            "detail": "USDC-ETH APY jumped 9.97pt above 7d avg (23.7%). TVL: $9.2M.",
            "asset": "USDC-ETH",
            "protocol": "fluid-dex",
            "chain": "Ethereum",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:28:10.952Z",
            "expiresAt": "2026-06-13T02:28:10.952Z",
            "metadata": {
                "pool": "da292ed1-aff5-44e0-8e23-333a1c61ee7f",
                "protocol": "fluid-dex",
                "chain": "Ethereum",
                "symbol": "USDC-ETH",
                "apyPct": 33.67,
                "tvlUsd": 9186953,
                "apyBase": 33.67359,
                "apyReward": null,
                "avg7dApyPct": 23.7,
                "spikePct": 9.97
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:28:10.953Z",
            "updatedAt": "2026-06-12T02:28:10.953Z"
        },
        {
            "_id": "6a2b6e423f1203aa160cdc04",
            "opportunityId": "opp-run-lrKfFJfa2p-da292ed1",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-lrKfFJfa2p",
            "title": "fluid-dex/Ethereum APY spike: 33.67%",
            "detail": "USDC-ETH APY jumped 13.3pt above 7d avg (20.37%). TVL: $9.2M.",
            "asset": "USDC-ETH",
            "protocol": "fluid-dex",
            "chain": "Ethereum",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:26:10.958Z",
            "expiresAt": "2026-06-13T02:26:10.957Z",
            "metadata": {
                "pool": "da292ed1-aff5-44e0-8e23-333a1c61ee7f",
                "protocol": "fluid-dex",
                "chain": "Ethereum",
                "symbol": "USDC-ETH",
                "apyPct": 33.67,
                "tvlUsd": 9186953,
                "apyBase": 33.67359,
                "apyReward": null,
                "avg7dApyPct": 20.37,
                "spikePct": 13.3
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:26:10.960Z",
            "updatedAt": "2026-06-12T02:26:10.960Z"
        },
        {
            "_id": "6a2b6e423f1203aa160cdc03",
            "opportunityId": "opp-run-lrKfFJfa2p-58990934",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-lrKfFJfa2p",
            "title": "pharaoh-v3/Avalanche APY spike: 72.31%",
            "detail": "USDT-USDC APY jumped 14.3pt above 7d avg (58.01%). TVL: $11.0M.",
            "asset": "USDT-USDC",
            "protocol": "pharaoh-v3",
            "chain": "Avalanche",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:26:10.957Z",
            "expiresAt": "2026-06-13T02:26:10.957Z",
            "metadata": {
                "pool": "58990934-9fb1-45f2-8882-d493c4627768",
                "protocol": "pharaoh-v3",
                "chain": "Avalanche",
                "symbol": "USDT-USDC",
                "apyPct": 72.31,
                "tvlUsd": 10989987,
                "apyBase": 0,
                "apyReward": 72.3128,
                "avg7dApyPct": 58.01,
                "spikePct": 14.3
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:26:10.960Z",
            "updatedAt": "2026-06-12T02:26:10.960Z"
        },
        {
            "_id": "6a2b6e063f1203aa160cdbfe",
            "opportunityId": "opp-run-rxRp4W2hV5-58990934",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-rxRp4W2hV5",
            "title": "pharaoh-v3/Avalanche APY spike: 72.31%",
            "detail": "USDT-USDC APY jumped 17.88pt above 7d avg (54.43%). TVL: $11.0M.",
            "asset": "USDT-USDC",
            "protocol": "pharaoh-v3",
            "chain": "Avalanche",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:25:10.840Z",
            "expiresAt": "2026-06-13T02:25:10.840Z",
            "metadata": {
                "pool": "58990934-9fb1-45f2-8882-d493c4627768",
                "protocol": "pharaoh-v3",
                "chain": "Avalanche",
                "symbol": "USDT-USDC",
                "apyPct": 72.31,
                "tvlUsd": 10989987,
                "apyBase": 0,
                "apyReward": 72.3128,
                "avg7dApyPct": 54.43,
                "spikePct": 17.88
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:25:10.841Z",
            "updatedAt": "2026-06-12T02:25:10.841Z"
        },
        {
            "_id": "6a2b6e063f1203aa160cdbff",
            "opportunityId": "opp-run-rxRp4W2hV5-da292ed1",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-rxRp4W2hV5",
            "title": "fluid-dex/Ethereum APY spike: 33.67%",
            "detail": "USDC-ETH APY jumped 16.62pt above 7d avg (17.05%). TVL: $9.2M.",
            "asset": "USDC-ETH",
            "protocol": "fluid-dex",
            "chain": "Ethereum",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:25:10.840Z",
            "expiresAt": "2026-06-13T02:25:10.840Z",
            "metadata": {
                "pool": "da292ed1-aff5-44e0-8e23-333a1c61ee7f",
                "protocol": "fluid-dex",
                "chain": "Ethereum",
                "symbol": "USDC-ETH",
                "apyPct": 33.67,
                "tvlUsd": 9186953,
                "apyBase": 33.67359,
                "apyReward": null,
                "avg7dApyPct": 17.05,
                "spikePct": 16.62
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:25:10.842Z",
            "updatedAt": "2026-06-12T02:25:10.842Z"
        },
        {
            "_id": "6a2b6e063f1203aa160cdc00",
            "opportunityId": "opp-run-rxRp4W2hV5-10137e20",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-rxRp4W2hV5",
            "title": "aerodrome-slipstream/Base APY spike: 78.07%",
            "detail": "WETH-USDC APY jumped 5.69pt above 7d avg (72.38%). TVL: $8.2M.",
            "asset": "WETH-USDC",
            "protocol": "aerodrome-slipstream",
            "chain": "Base",
            "score": 78,
            "acted": false,
            "detectedAt": "2026-06-12T02:25:10.840Z",
            "expiresAt": "2026-06-13T02:25:10.840Z",
            "metadata": {
                "pool": "10137e20-efbc-4e15-a733-17ecb52c48e8",
                "protocol": "aerodrome-slipstream",
                "chain": "Base",
                "symbol": "WETH-USDC",
                "apyPct": 78.07,
                "tvlUsd": 8235880,
                "apyBase": 31.12621,
                "apyReward": 46.94078,
                "avg7dApyPct": 72.38,
                "spikePct": 5.69
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:25:10.842Z",
            "updatedAt": "2026-06-12T02:25:10.842Z"
        },
        {
            "_id": "6a2b6e063f1203aa160cdc01",
            "opportunityId": "opp-run-rxRp4W2hV5-b6b23226",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-rxRp4W2hV5",
            "title": "fluid-dex/Ethereum APY spike: 13.19%",
            "detail": "USDE-USDT APY jumped 5.55pt above 7d avg (7.64%). TVL: $6.0M.",
            "asset": "USDE-USDT",
            "protocol": "fluid-dex",
            "chain": "Ethereum",
            "score": 78,
            "acted": false,
            "detectedAt": "2026-06-12T02:25:10.840Z",
            "expiresAt": "2026-06-13T02:25:10.840Z",
            "metadata": {
                "pool": "b6b23226-90d9-4cf5-93b8-057a5364705f",
                "protocol": "fluid-dex",
                "chain": "Ethereum",
                "symbol": "USDE-USDT",
                "apyPct": 13.19,
                "tvlUsd": 5985013,
                "apyBase": 13.19386,
                "apyReward": null,
                "avg7dApyPct": 7.64,
                "spikePct": 5.55
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:25:10.842Z",
            "updatedAt": "2026-06-12T02:25:10.842Z"
        },
        {
            "_id": "6a2b6d923f1203aa160cdbf9",
            "opportunityId": "opp-run-hjQlR83-Jh-58990934",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-hjQlR83-Jh",
            "title": "pharaoh-v3/Avalanche APY spike: 72.31%",
            "detail": "USDT-USDC APY jumped 21.45pt above 7d avg (50.86%). TVL: $11.0M.",
            "asset": "USDT-USDC",
            "protocol": "pharaoh-v3",
            "chain": "Avalanche",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:23:14.235Z",
            "expiresAt": "2026-06-13T02:23:14.234Z",
            "metadata": {
                "pool": "58990934-9fb1-45f2-8882-d493c4627768",
                "protocol": "pharaoh-v3",
                "chain": "Avalanche",
                "symbol": "USDT-USDC",
                "apyPct": 72.31,
                "tvlUsd": 10989987,
                "apyBase": 0,
                "apyReward": 72.3128,
                "avg7dApyPct": 50.86,
                "spikePct": 21.45
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:23:14.236Z",
            "updatedAt": "2026-06-12T02:23:14.236Z"
        },
        {
            "_id": "6a2b6d923f1203aa160cdbfa",
            "opportunityId": "opp-run-hjQlR83-Jh-da292ed1",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-hjQlR83-Jh",
            "title": "fluid-dex/Ethereum APY spike: 33.67%",
            "detail": "USDC-ETH APY jumped 19.95pt above 7d avg (13.72%). TVL: $9.2M.",
            "asset": "USDC-ETH",
            "protocol": "fluid-dex",
            "chain": "Ethereum",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:23:14.235Z",
            "expiresAt": "2026-06-13T02:23:14.234Z",
            "metadata": {
                "pool": "da292ed1-aff5-44e0-8e23-333a1c61ee7f",
                "protocol": "fluid-dex",
                "chain": "Ethereum",
                "symbol": "USDC-ETH",
                "apyPct": 33.67,
                "tvlUsd": 9186953,
                "apyBase": 33.67359,
                "apyReward": null,
                "avg7dApyPct": 13.72,
                "spikePct": 19.95
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:23:14.236Z",
            "updatedAt": "2026-06-12T02:23:14.236Z"
        },
        {
            "_id": "6a2b6d923f1203aa160cdbfb",
            "opportunityId": "opp-run-hjQlR83-Jh-10137e20",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-hjQlR83-Jh",
            "title": "aerodrome-slipstream/Base APY spike: 78.07%",
            "detail": "WETH-USDC APY jumped 6.83pt above 7d avg (71.24%). TVL: $8.2M.",
            "asset": "WETH-USDC",
            "protocol": "aerodrome-slipstream",
            "chain": "Base",
            "score": 84,
            "acted": false,
            "detectedAt": "2026-06-12T02:23:14.235Z",
            "expiresAt": "2026-06-13T02:23:14.234Z",
            "metadata": {
                "pool": "10137e20-efbc-4e15-a733-17ecb52c48e8",
                "protocol": "aerodrome-slipstream",
                "chain": "Base",
                "symbol": "WETH-USDC",
                "apyPct": 78.07,
                "tvlUsd": 8235880,
                "apyBase": 31.12621,
                "apyReward": 46.94078,
                "avg7dApyPct": 71.24,
                "spikePct": 6.83
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:23:14.236Z",
            "updatedAt": "2026-06-12T02:23:14.236Z"
        },
        {
            "_id": "6a2b6d923f1203aa160cdbfc",
            "opportunityId": "opp-run-hjQlR83-Jh-b6b23226",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-hjQlR83-Jh",
            "title": "fluid-dex/Ethereum APY spike: 13.19%",
            "detail": "USDE-USDT APY jumped 6.66pt above 7d avg (6.53%). TVL: $6.0M.",
            "asset": "USDE-USDT",
            "protocol": "fluid-dex",
            "chain": "Ethereum",
            "score": 83,
            "acted": false,
            "detectedAt": "2026-06-12T02:23:14.235Z",
            "expiresAt": "2026-06-13T02:23:14.234Z",
            "metadata": {
                "pool": "b6b23226-90d9-4cf5-93b8-057a5364705f",
                "protocol": "fluid-dex",
                "chain": "Ethereum",
                "symbol": "USDE-USDT",
                "apyPct": 13.19,
                "tvlUsd": 5985013,
                "apyBase": 13.19386,
                "apyReward": null,
                "avg7dApyPct": 6.53,
                "spikePct": 6.66
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:23:14.236Z",
            "updatedAt": "2026-06-12T02:23:14.236Z"
        }
    ],
    "count": 19
}



===========================================================

{{BASE_URL}}/api/positions?status=open

{
    "positions": [],
    "count": 0
}



========================================================
{{BASE_URL}}/api/paper-wallet

{
    "_id": "6a297888f6e057d746bfcae5",
    "walletId": "paper-default",
    "mode": "paper",
    "balances": [
        {
            "symbol": "USDC",
            "amount": 5000,
            "valueUsd": 5000,
            "avgCostUsd": 1,
            "updatedAt": "2026-06-10T14:45:28.231Z"
        }
    ],
    "totalValueUsd": 5000,
    "initialUsd": 5000,
    "realizedPnlUsd": 0,
    "unrealizedPnlUsd": 0,
    "createdAt": "2026-06-10T14:45:28.236Z",
    "updatedAt": "2026-06-10T14:45:28.236Z",
    "__v": 0
}


=============================================================

{{BASE_URL}}/api/chart/primitives/SOLUSDT

{
    "success": true,
    "data": {
        "meta": {
            "symbol": "SOLUSDT",
            "timeframes_analyzed": [
                "1h",
                "4h",
                "1d"
            ],
            "generated_at": "2026-06-12T04:24:21.153Z",
            "token_count_estimate": 1201
        },
        "indicators": {
            "rsi_14": 59.4,
            "macd": {
                "value": 0.1135,
                "signal": -0.287,
                "histogram": 0.4005,
                "cross": "none"
            },
            "stoch": {
                "k": 92.72,
                "d": 91.86,
                "state": "overbought"
            },
            "adx": 8.91,
            "ichimoku": {
                "tenkan_sen": 64.88,
                "kijun_sen": 65.255,
                "senkou_a": 65.0675,
                "senkou_b": 67.115,
                "chikou_span": 67.05,
                "price_vs_cloud": "inside",
                "tk_cross": "none",
                "cloud_color": "red",
                "chikou_clear": true
            },
            "vwap": {
                "value": 79.0062,
                "upper_band_1": 89.8672,
                "lower_band_1": 68.1451,
                "upper_band_2": 100.7283,
                "lower_band_2": 57.284,
                "price_vs_vwap": "below"
            },
            "obv_trend": "flat",
            "cmf": 0.1349,
            "mfi": 58.47,
            "cci": 119.07,
            "atr_14": 1.3557,
            "bb": {
                "upper": 67.7898,
                "mid": 65.4045,
                "lower": 63.0192,
                "squeeze": false,
                "percent_b": 0.8449
            },
            "williams_r": -7.28
        },
        "structure": {
            "trend_htf": "bearish",
            "trend_ltf": "bullish",
            "key_levels": [
                {
                    "price": 65.135,
                    "type": "support",
                    "strength": "moderate",
                    "source": "previous_low",
                    "touches": 2
                },
                {
                    "price": 63.714999999999996,
                    "type": "support",
                    "strength": "strong",
                    "source": "previous_low",
                    "touches": 4
                },
                {
                    "price": 62.64333333333334,
                    "type": "support",
                    "strength": "strong",
                    "source": "previous_low",
                    "touches": 3
                },
                {
                    "price": 61.32,
                    "type": "support",
                    "strength": "weak",
                    "source": "previous_low",
                    "touches": 1
                },
                {
                    "price": 60.13,
                    "type": "support",
                    "strength": "weak",
                    "source": "previous_low",
                    "touches": 1
                }
            ],
            "vpoc": 84.85249999999999,
            "vah": 97.6125,
            "val": 68.9025,
            "pivot_points": {
                "standard": {
                    "method": "standard",
                    "pp": 66.92,
                    "r1": 67.42,
                    "r2": 67.8,
                    "r3": 68.3,
                    "s1": 66.54,
                    "s2": 66.04,
                    "s3": 65.66000000000001
                },
                "camarilla": {
                    "method": "camarilla",
                    "pp": 66.92,
                    "r1": 67.993304,
                    "r2": 68.066608,
                    "r3": 68.14,
                    "s1": 66.08669600000002,
                    "s2": 66.01339200000001,
                    "s3": 65.94000000000001
                }
            },
            "psychological_levels": [
                77,
                78,
                79,
                80,
                81,
                82
            ]
        },
        "smart_money": {
            "order_blocks": [
                {
                    "price_high": 63.66,
                    "price_low": 62.34,
                    "type": "bullish",
                    "status": "unmitigated",
                    "timeframe": "4H"
                }
            ],
            "fvgs": [
                {
                    "high": 66.36,
                    "low": 65.93,
                    "timestamp": 1781193600000,
                    "filled": false,
                    "type": "bullish"
                },
                {
                    "high": 64.77,
                    "low": 63.66,
                    "timestamp": 1781136000000,
                    "filled": false,
                    "type": "bullish"
                },
                {
                    "high": 73.24,
                    "low": 73.18,
                    "timestamp": 1780502400000,
                    "filled": false,
                    "type": "bearish"
                }
            ],
            "bos": {
                "direction": "bullish",
                "level": 65.77,
                "timestamp": 1781193600000,
                "type": "BOS",
                "confirmed": true
            },
            "choch": null,
            "liquidity_sweeps": [
                {
                    "level": 63.54,
                    "swept": true,
                    "timestamp": 1781121600000,
                    "candles_ago": 8,
                    "type": "buy_side"
                },
                {
                    "level": 65.7,
                    "swept": true,
                    "timestamp": 1780992000000,
                    "candles_ago": 17,
                    "type": "sell_side"
                },
                {
                    "level": 65.7,
                    "swept": true,
                    "timestamp": 1781006400000,
                    "candles_ago": 16,
                    "type": "sell_side"
                }
            ]
        },
        "fibonacci": {
            "swing_high": 67.42,
            "swing_low": 62.34,
            "swing_high_ts": 1781193600000,
            "swing_low_ts": 1781121600000,
            "direction": "bearish_retracement",
            "levels": {
                "0.236": 63.538880000000006,
                "0.382": 64.28056000000001,
                "0.5": 64.88,
                "0.618": 65.47944,
                "0.786": 66.33288
            },
            "extensions": {
                "1.272": 60.95824,
                "1.618": 59.20056,
                "2.618": 54.120560000000005
            },
            "current_price_near": "1"
        },
        "wyckoff": {
            "phase": "B",
            "last_event": "SC",
            "spring_confirmed": false,
            "utad_risk": false,
            "range_high": 79.8,
            "range_low": 60.13,
            "cause_count": 60,
            "volume_analysis": "neutral",
            "summary": "Wyckoff Accumulation Phase B. Range building after SC. Watch for Spring near 60.13. Range: 60.13 - 79.80."
        },
        "elliott": {
            "wave_count": "unknown",
            "pivots": [
                97,
                93.43,
                98.41,
                89.82,
                93.68,
                83.5,
                88,
                81.5,
                87.5,
                83.7,
                86.52,
                80,
                83.01,
                80.35,
                83.42,
                79.11,
                81.65,
                72.73,
                75.13,
                72.69,
                75.71,
                66.8,
                71.8,
                67.37,
                70.64,
                63.87,
                66.8,
                63.78,
                66.06,
                62.64,
                64.86,
                60.13,
                63.6,
                61.32,
                66.11,
                63.67,
                67.92,
                64.98,
                68.17,
                65.29,
                67.47,
                63.54,
                65.7,
                62.95,
                65.77,
                62.34,
                67.42
            ],
            "pivot_timestamps": [
                1778428800000,
                1778443200000,
                1778529600000,
                1778716800000,
                1778774400000,
                1779048000000,
                1779379200000,
                1779508800000,
                1779566400000,
                1779652800000,
                1779710400000,
                1779940800000,
                1779984000000,
                1780056000000,
                1780185600000,
                1780329600000,
                1780344000000,
                1780430400000,
                1780444800000,
                1780459200000,
                1780473600000,
                1780531200000,
                1780545600000,
                1780560000000,
                1780574400000,
                1780632000000,
                1780646400000,
                1780660800000,
                1780675200000,
                1780689600000,
                1780704000000,
                1780718400000,
                1780732800000,
                1780747200000,
                1780819200000,
                1780833600000,
                1780862400000,
                1780891200000,
                1780948800000,
                1780963200000,
                1780977600000,
                1781020800000,
                1781035200000,
                1781078400000,
                1781092800000,
                1781121600000,
                1781193600000
            ],
            "confidence": 0,
            "rules_passed": [],
            "rules_failed": [
                "No valid wave pattern found in recent pivots"
            ]
        },
        "harmonics": null,
        "mtfa": {
            "1D": {
                "bias": "bearish",
                "structure": "bearish at support",
                "key_level": 66.8,
                "at_level": true,
                "regime": "trending_down"
            },
            "4H": {
                "bias": "neutral",
                "structure": "consolidating at resistance",
                "key_level": 67.23,
                "at_level": true,
                "regime": "ranging"
            },
            "1H": {
                "bias": "bullish",
                "structure": "bullish at resistance",
                "key_level": 67.23,
                "at_level": true,
                "regime": "trending_up"
            },
            "overall_bias": "neutral",
            "htf_overrides_ltf": true,
            "confluence_note": "HTF (1D) is bearish — overrides LTF (1H) bullish signal. 1/3 timeframes aligned neutral."
        }
    }
}


=======================================================================
{{BASE_URL}}/api/chart/analyze/BTCUSDT

{
    "success": true,
    "data": {
        "primitives_meta": {
            "symbol": "BTCUSDT",
            "timeframes_analyzed": [
                "1h",
                "4h",
                "1d"
            ],
            "generated_at": "2026-06-12T04:25:42.175Z",
            "token_count_estimate": 1123
        },
        "analysis": {
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + Unfilled FVG + HTF Resistance Rejection",
            "entry_zone": {
                "high": 63933.02,
                "low": 63239.43
            },
            "stop_loss": 64160.42,
            "take_profit_levels": [
                62205,
                61088.19,
                59315.455
            ],
            "risk_reward": 3.2,
            "confidence": 65,
            "invalidation": "Daily close above 64497.97 (strong resistance) invalidates bearish thesis.",
            "reasoning": "The 1D trend is bearish and overrides the LTF neutral bias. Price is consolidating at a strong resistance level (63933) with a bearish 4H order block (74092-73222) still unmitigated above. Multiple unfilled bearish FVGs (65251-64540, 66076-65860) act as supply zones. The HTF bearish bias, proximity to resistance, and unfilled supply blocks create a high-probability short entry zone. The 3.2:1 R:R meets the SmartMoney minimum.",
            "framework_scores": {
                "SmartMoney": 85,
                "Wyckoff": 30,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 3,
            "confluence_factors": [
                "HTF (1D) bearish trend overrides LTF neutral",
                "Price at strong resistance (63933, 3 touches)",
                "Unmitigated bearish 4H order block above",
                "Unfilled bearish FVGs above price"
            ]
        },
        "risk": {
            "approved": true,
            "adjusted_confidence": 65,
            "adjusted_size_mult": 0.93,
            "warnings": [
                "Reduced size to 93% due to confidence 65"
            ]
        }
    }
}

==============================================================

{{BASE_URL}}/api/chart/primitives/BTCUSDT

{
    "success": true,
    "data": {
        "meta": {
            "symbol": "BTCUSDT",
            "timeframes_analyzed": [
                "1h",
                "4h",
                "1d"
            ],
            "generated_at": "2026-06-12T04:29:24.016Z",
            "token_count_estimate": 1124
        },
        "indicators": {
            "rsi_14": 60.98,
            "macd": {
                "value": 184.9243,
                "signal": -64.3463,
                "histogram": 249.2706,
                "cross": "none"
            },
            "stoch": {
                "k": 95.89,
                "d": 91.13,
                "state": "overbought"
            },
            "adx": 3.77,
            "ichimoku": {
                "tenkan_sen": 62518.63,
                "kijun_sen": 62477.5,
                "senkou_a": 62498.065,
                "senkou_b": 62752.045,
                "chikou_span": 63802.32,
                "price_vs_cloud": "above",
                "tk_cross": "none",
                "cloud_color": "red",
                "chikou_clear": true
            },
            "vwap": {
                "value": 70482.4109,
                "upper_band_1": 77756.4914,
                "lower_band_1": 63208.3304,
                "upper_band_2": 85030.5719,
                "lower_band_2": 55934.2499,
                "price_vs_vwap": "below"
            },
            "obv_trend": "rising",
            "cmf": 0.0893,
            "mfi": 57.6,
            "cci": 117.82,
            "atr_14": 873.06,
            "bb": {
                "upper": 64174.3306,
                "mid": 62496.684,
                "lower": 60819.0374,
                "squeeze": false,
                "percent_b": 0.8891
            },
            "williams_r": -4.11
        },
        "structure": {
            "trend_htf": "bearish",
            "trend_ltf": "consolidating",
            "key_levels": [
                {
                    "price": 62205,
                    "type": "support",
                    "strength": "weak",
                    "source": "previous_low",
                    "touches": 1
                },
                {
                    "price": 61088.19,
                    "type": "support",
                    "strength": "strong",
                    "source": "previous_low",
                    "touches": 3
                },
                {
                    "price": 59315.455,
                    "type": "support",
                    "strength": "moderate",
                    "source": "previous_low",
                    "touches": 2
                },
                {
                    "price": 63933.02,
                    "type": "resistance",
                    "strength": "weak",
                    "source": "previous_high",
                    "touches": 1
                },
                {
                    "price": 64497.97333333333,
                    "type": "resistance",
                    "strength": "strong",
                    "source": "previous_high",
                    "touches": 3
                }
            ],
            "vpoc": 77128.64270833334,
            "vah": 81992.89479166668,
            "val": 63508.736875,
            "pivot_points": {
                "standard": {
                    "method": "standard",
                    "pp": 63545.45333333334,
                    "r1": 63789.37666666668,
                    "r2": 64053.93333333334,
                    "r3": 64297.85666666668,
                    "s1": 63280.896666666675,
                    "s2": 63036.973333333335,
                    "s3": 62772.41666666667
                },
                "camarilla": {
                    "method": "camarilla",
                    "pp": 63545.45333333334,
                    "r1": 64075.656384,
                    "r2": 64118.012768,
                    "r3": 64160.420000000006,
                    "s1": 62973.983616,
                    "s2": 62931.627232,
                    "s3": 62889.219999999994
                }
            },
            "psychological_levels": [
                68000,
                69000,
                70000,
                71000,
                72000,
                73000
            ]
        },
        "smart_money": {
            "order_blocks": [
                {
                    "price_high": 74092,
                    "price_low": 73222,
                    "type": "bearish",
                    "status": "unmitigated",
                    "timeframe": "4H"
                }
            ],
            "fvgs": [
                {
                    "high": 63270,
                    "low": 63239.43,
                    "timestamp": 1781193600000,
                    "filled": false,
                    "type": "bullish"
                },
                {
                    "high": 65251,
                    "low": 64540.3,
                    "timestamp": 1780516800000,
                    "filled": false,
                    "type": "bearish"
                },
                {
                    "high": 66076,
                    "low": 65860,
                    "timestamp": 1780502400000,
                    "filled": false,
                    "type": "bearish"
                }
            ],
            "bos": {
                "direction": "bullish",
                "level": 62000,
                "timestamp": 1780862400000,
                "type": "BOS",
                "confirmed": true
            },
            "choch": null,
            "liquidity_sweeps": [
                {
                    "level": 62000,
                    "swept": true,
                    "timestamp": 1780992000000,
                    "candles_ago": 17,
                    "type": "sell_side"
                },
                {
                    "level": 62000,
                    "swept": true,
                    "timestamp": 1781092800000,
                    "candles_ago": 10,
                    "type": "sell_side"
                },
                {
                    "level": 62000,
                    "swept": true,
                    "timestamp": 1781107200000,
                    "candles_ago": 9,
                    "type": "sell_side"
                }
            ]
        },
        "fibonacci": {
            "swing_high": 64234.68,
            "swing_low": 59500,
            "swing_high_ts": 1780862400000,
            "swing_low_ts": 1780718400000,
            "direction": "bearish_retracement",
            "levels": {
                "0.236": 60617.38448,
                "0.382": 61308.64776,
                "0.5": 61867.34,
                "0.618": 62426.03224,
                "0.786": 63221.45848
            },
            "extensions": {
                "1.272": 58212.16704,
                "1.618": 56573.96776,
                "2.618": 51839.28776
            },
            "current_price_near": "1"
        },
        "wyckoff": {
            "phase": "B",
            "last_event": "SC",
            "spring_confirmed": false,
            "utad_risk": false,
            "range_high": 70172,
            "range_low": 59130.91,
            "cause_count": 60,
            "volume_analysis": "neutral",
            "summary": "Wyckoff Accumulation Phase B. Range building after SC. Watch for Spring near 59130.91. Range: 59130.91 - 70172.00."
        },
        "elliott": {
            "wave_count": "unknown",
            "pivots": [
                74289.6,
                78080,
                65426.34,
                67516,
                61383.56,
                64764.32,
                62205,
                64494.92,
                61126.01,
                63259.9,
                59130.91,
                62000,
                59500,
                64234.68,
                60755,
                63933.02
            ],
            "pivot_timestamps": [
                1779508800000,
                1779796800000,
                1780444800000,
                1780459200000,
                1780531200000,
                1780545600000,
                1780560000000,
                1780574400000,
                1780632000000,
                1780646400000,
                1780675200000,
                1780689600000,
                1780718400000,
                1780862400000,
                1781078400000,
                1781193600000
            ],
            "confidence": 0,
            "rules_passed": [],
            "rules_failed": [
                "No valid wave pattern found in recent pivots"
            ]
        },
        "harmonics": null,
        "mtfa": {
            "1D": {
                "bias": "bearish",
                "structure": "bearish at resistance",
                "key_level": 64048.56666666666,
                "at_level": true,
                "regime": "trending_down"
            },
            "4H": {
                "bias": "neutral",
                "structure": "consolidating at resistance",
                "key_level": 63933.02,
                "at_level": true,
                "regime": "ranging"
            },
            "1H": {
                "bias": "neutral",
                "structure": "consolidating at resistance",
                "key_level": 63933.02,
                "at_level": true,
                "regime": "ranging"
            },
            "overall_bias": "conflicted",
            "htf_overrides_ltf": true,
            "confluence_note": "HTF (1D) is bearish — overrides LTF (1H) neutral signal. Mixed signals across timeframes — reduce size or wait for alignment."
        }
    }
}



==============================================================


{{BASE_URL}}/api/chart/primitives/SOLUSDT

{
    "success": true,
    "data": {
        "meta": {
            "symbol": "SOLUSDT",
            "timeframes_analyzed": [
                "1h",
                "4h",
                "1d"
            ],
            "generated_at": "2026-06-12T04:30:34.476Z",
            "token_count_estimate": 1209
        },
        "indicators": {
            "rsi_14": 59.63,
            "macd": {
                "value": 0.1183,
                "signal": -0.2861,
                "histogram": 0.4044,
                "cross": "none"
            },
            "stoch": {
                "k": 93.9,
                "d": 92.26,
                "state": "overbought"
            },
            "adx": 8.91,
            "ichimoku": {
                "tenkan_sen": 64.88,
                "kijun_sen": 65.255,
                "senkou_a": 65.0675,
                "senkou_b": 67.115,
                "chikou_span": 67.11,
                "price_vs_cloud": "inside",
                "tk_cross": "none",
                "cloud_color": "red",
                "chikou_clear": true
            },
            "vwap": {
                "value": 79.005,
                "upper_band_1": 89.8662,
                "lower_band_1": 68.1439,
                "upper_band_2": 100.7274,
                "lower_band_2": 57.2827,
                "price_vs_vwap": "below"
            },
            "obv_trend": "flat",
            "cmf": 0.1361,
            "mfi": 58.53,
            "cci": 120.89,
            "atr_14": 1.3579,
            "bb": {
                "upper": 67.8012,
                "mid": 65.4075,
                "lower": 63.0138,
                "squeeze": false,
                "percent_b": 0.8556
            },
            "williams_r": -6.1
        },
        "structure": {
            "trend_htf": "bearish",
            "trend_ltf": "bullish",
            "key_levels": [
                {
                    "price": 67.08500000000001,
                    "type": "support",
                    "strength": "moderate",
                    "source": "previous_low",
                    "touches": 2
                },
                {
                    "price": 65.135,
                    "type": "support",
                    "strength": "moderate",
                    "source": "previous_low",
                    "touches": 2
                },
                {
                    "price": 63.714999999999996,
                    "type": "support",
                    "strength": "strong",
                    "source": "previous_low",
                    "touches": 4
                },
                {
                    "price": 62.64333333333334,
                    "type": "support",
                    "strength": "strong",
                    "source": "previous_low",
                    "touches": 3
                },
                {
                    "price": 61.32,
                    "type": "support",
                    "strength": "weak",
                    "source": "previous_low",
                    "touches": 1
                }
            ],
            "vpoc": 84.85249999999999,
            "vah": 97.6125,
            "val": 68.9025,
            "pivot_points": {
                "standard": {
                    "method": "standard",
                    "pp": 66.92,
                    "r1": 67.42,
                    "r2": 67.8,
                    "r3": 68.3,
                    "s1": 66.54,
                    "s2": 66.04,
                    "s3": 65.66000000000001
                },
                "camarilla": {
                    "method": "camarilla",
                    "pp": 66.92,
                    "r1": 67.993304,
                    "r2": 68.066608,
                    "r3": 68.14,
                    "s1": 66.08669600000002,
                    "s2": 66.01339200000001,
                    "s3": 65.94000000000001
                }
            },
            "psychological_levels": [
                77,
                78,
                79,
                80,
                81,
                82
            ]
        },
        "smart_money": {
            "order_blocks": [
                {
                    "price_high": 63.66,
                    "price_low": 62.34,
                    "type": "bullish",
                    "status": "unmitigated",
                    "timeframe": "4H"
                }
            ],
            "fvgs": [
                {
                    "high": 66.36,
                    "low": 65.93,
                    "timestamp": 1781193600000,
                    "filled": false,
                    "type": "bullish"
                },
                {
                    "high": 64.77,
                    "low": 63.66,
                    "timestamp": 1781136000000,
                    "filled": false,
                    "type": "bullish"
                },
                {
                    "high": 73.24,
                    "low": 73.18,
                    "timestamp": 1780502400000,
                    "filled": false,
                    "type": "bearish"
                }
            ],
            "bos": {
                "direction": "bullish",
                "level": 65.77,
                "timestamp": 1781193600000,
                "type": "BOS",
                "confirmed": true
            },
            "choch": null,
            "liquidity_sweeps": [
                {
                    "level": 63.54,
                    "swept": true,
                    "timestamp": 1781121600000,
                    "candles_ago": 8,
                    "type": "buy_side"
                },
                {
                    "level": 65.7,
                    "swept": true,
                    "timestamp": 1780992000000,
                    "candles_ago": 17,
                    "type": "sell_side"
                },
                {
                    "level": 65.7,
                    "swept": true,
                    "timestamp": 1781006400000,
                    "candles_ago": 16,
                    "type": "sell_side"
                }
            ]
        },
        "fibonacci": {
            "swing_high": 67.42,
            "swing_low": 62.34,
            "swing_high_ts": 1781193600000,
            "swing_low_ts": 1781121600000,
            "direction": "bearish_retracement",
            "levels": {
                "0.236": 63.538880000000006,
                "0.382": 64.28056000000001,
                "0.5": 64.88,
                "0.618": 65.47944,
                "0.786": 66.33288
            },
            "extensions": {
                "1.272": 60.95824,
                "1.618": 59.20056,
                "2.618": 54.120560000000005
            },
            "current_price_near": "1"
        },
        "wyckoff": {
            "phase": "B",
            "last_event": "SC",
            "spring_confirmed": false,
            "utad_risk": false,
            "range_high": 79.8,
            "range_low": 60.13,
            "cause_count": 60,
            "volume_analysis": "neutral",
            "summary": "Wyckoff Accumulation Phase B. Range building after SC. Watch for Spring near 60.13. Range: 60.13 - 79.80."
        },
        "elliott": {
            "wave_count": "unknown",
            "pivots": [
                97,
                93.43,
                98.41,
                89.82,
                93.68,
                83.5,
                88,
                81.5,
                87.5,
                83.7,
                86.52,
                80,
                83.01,
                80.35,
                83.42,
                79.11,
                81.65,
                72.73,
                75.13,
                72.69,
                75.71,
                66.8,
                71.8,
                67.37,
                70.64,
                63.87,
                66.8,
                63.78,
                66.06,
                62.64,
                64.86,
                60.13,
                63.6,
                61.32,
                66.11,
                63.67,
                67.92,
                64.98,
                68.17,
                65.29,
                67.47,
                63.54,
                65.7,
                62.95,
                65.77,
                62.34,
                67.42
            ],
            "pivot_timestamps": [
                1778428800000,
                1778443200000,
                1778529600000,
                1778716800000,
                1778774400000,
                1779048000000,
                1779379200000,
                1779508800000,
                1779566400000,
                1779652800000,
                1779710400000,
                1779940800000,
                1779984000000,
                1780056000000,
                1780185600000,
                1780329600000,
                1780344000000,
                1780430400000,
                1780444800000,
                1780459200000,
                1780473600000,
                1780531200000,
                1780545600000,
                1780560000000,
                1780574400000,
                1780632000000,
                1780646400000,
                1780660800000,
                1780675200000,
                1780689600000,
                1780704000000,
                1780718400000,
                1780732800000,
                1780747200000,
                1780819200000,
                1780833600000,
                1780862400000,
                1780891200000,
                1780948800000,
                1780963200000,
                1780977600000,
                1781020800000,
                1781035200000,
                1781078400000,
                1781092800000,
                1781121600000,
                1781193600000
            ],
            "confidence": 0,
            "rules_passed": [],
            "rules_failed": [
                "No valid wave pattern found in recent pivots"
            ]
        },
        "harmonics": null,
        "mtfa": {
            "1D": {
                "bias": "bearish",
                "structure": "bearish at support",
                "key_level": 66.8,
                "at_level": true,
                "regime": "trending_down"
            },
            "4H": {
                "bias": "neutral",
                "structure": "consolidating at support",
                "key_level": 67.08500000000001,
                "at_level": true,
                "regime": "ranging"
            },
            "1H": {
                "bias": "bullish",
                "structure": "bullish at support",
                "key_level": 67.08500000000001,
                "at_level": true,
                "regime": "trending_up"
            },
            "overall_bias": "neutral",
            "htf_overrides_ltf": true,
            "confluence_note": "HTF (1D) is bearish — overrides LTF (1H) bullish signal. 1/3 timeframes aligned neutral."
        }
    }
}


{{BASE_URL}}/api/agent-runs?limit=1&status=completed



{
    "runs": [
        {
            "_id": "6a2b82a73f1203aa160cdc4b",
            "runId": "run-NT2LiM-e59",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:53:11.139Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:53:11.143Z",
            "updatedAt": "2026-06-12T03:54:15.976Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:54:15.976Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "No anomalies detected in yield pools this cycle (APY spikes vs 7d avg = none). Market structure is bearish/conflicted across BTC, ETH, and SOL — not ideal for volatile LP pairs where IL could erode yield. The safest high-APY option (USDT-USDC on Avalanche at 59.42% APY, $11M TVL) requires a deposit action not available via swap tools. Holding $5,000 USDC is already the optimal position for yield hunting — no swap needed. Waiting for a yield anomaly or clearer market direction is the prudent call."
                },
                "confidence": 90,
                "reasoning": "No anomalies detected in yield pools this cycle (APY spikes vs 7d avg = none). Market structure is bearish/conflicted across BTC, ETH, and SOL — not ideal for volatile LP pairs where IL could erode yield. The safest high-APY option (USDT-USDC on Avalanche at 59.42% APY, $11M TVL) requires a deposit action not available via swap tools. Holding $5,000 USDC is already the optimal position for yield hunting — no swap needed. Waiting for a yield anomaly or clearer market direction is the prudent call.",
                "toolCallTrace": [
                    "get_wallet_state",
                    "get_price",
                    "get_token_volume",
                    "get_yields",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_yields",
                    "no_action"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:54:15.975Z"
            }
        }
    ],
    "total": 1
}



===================================================================


{{BASE_URL}}/api/agent-runs/:runId


{
    "_id": "6a2b82a73f1203aa160cdc4b",
    "runId": "run-NT2LiM-e59",
    "strategy": "yieldHunter",
    "mode": "paper",
    "startedAt": "2026-06-12T03:53:11.139Z",
    "status": "completed",
    "contextSnapshot": "=== AGENT CONTEXT | 2026-06-12T03:53:11.754Z ===\nStrategy: yieldHunter\n\nWALLET (paper): USDC: $5000.00 | Total: $5000.00 | Today PnL: +$0.00 | Open positions: 0\n\n=== YIELD HUNTER — 2026-06-12T03:53:11.753Z ===\nScanned 334 USDC/stablecoin pools (TVL ≥ $5M)\n\nTOP 10 POOLS BY APY:\n  nest-cl/Hyperliquid L1 (WHYPE-USDC): 160.02% APY, TVL $7.6M\n  aerodrome-slipstream/Base (USDC-CBBTC): 110.53% APY, TVL $9.1M\n  gmtrade/Solana (XAU-USDC): 84.22% APY, TVL $6.3M\n  uniswap-v3/Base (WETH-USDC): 83.65% APY, TVL $97.8M\n  raydium-amm/Solana (WSOL-USDC): 78.36% APY, TVL $7.9M\n  minswap-dex/Cardano (NIGHT-USDCX): 76.59% APY, TVL $5.8M\n  uniswap-v4/Arbitrum (DORY-USDC): 76.22% APY, TVL $11.6M\n  aerodrome-slipstream/Base (WETH-USDC): 68.67% APY, TVL $8.4M\n  pharaoh-v3/Avalanche (USDT-USDC): 59.42% APY, TVL $11.0M\n  orca-dex/Solana (SOL-USDC): 52.73% APY, TVL $23.0M\n\nANOMALIES (APY spike > 5pt vs 7d avg):\n  None detected this cycle.",
    "createdAt": "2026-06-12T03:53:11.143Z",
    "updatedAt": "2026-06-12T03:54:15.976Z",
    "__v": 0,
    "completedAt": "2026-06-12T03:54:15.976Z",
    "decision": {
        "intent": {
            "type": "no_action",
            "rationale": "No anomalies detected in yield pools this cycle (APY spikes vs 7d avg = none). Market structure is bearish/conflicted across BTC, ETH, and SOL — not ideal for volatile LP pairs where IL could erode yield. The safest high-APY option (USDT-USDC on Avalanche at 59.42% APY, $11M TVL) requires a deposit action not available via swap tools. Holding $5,000 USDC is already the optimal position for yield hunting — no swap needed. Waiting for a yield anomaly or clearer market direction is the prudent call."
        },
        "confidence": 90,
        "reasoning": "No anomalies detected in yield pools this cycle (APY spikes vs 7d avg = none). Market structure is bearish/conflicted across BTC, ETH, and SOL — not ideal for volatile LP pairs where IL could erode yield. The safest high-APY option (USDT-USDC on Avalanche at 59.42% APY, $11M TVL) requires a deposit action not available via swap tools. Holding $5,000 USDC is already the optimal position for yield hunting — no swap needed. Waiting for a yield anomaly or clearer market direction is the prudent call.",
        "toolCallTrace": [
            "get_wallet_state",
            "get_price",
            "get_token_volume",
            "get_yields",
            "get_news_sentiment",
            "get_news_sentiment",
            "get_full_htf_context",
            "get_full_htf_context",
            "get_full_htf_context",
            "get_yields",
            "no_action"
        ]
    },
    "executionResult": {
        "status": "filled",
        "simulatedPnlUsd": 0,
        "executedAt": "2026-06-12T03:54:15.975Z"
    }
}

==============================================================


{{BASE_URL}}/api/agent-runs/trigger1

{
    "triggered": true,
    "waited": false
}

=======================================================================

very good, now lets talk about agent capabilities,  compare to my previous agentchat here also with report card.  i wanted to integrate that into this, also the agent mode is not connected to agent chat it seems,  

import { Router } from "express";
import { agentController } from "../controllers/agent.controller";

// import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// ── Session Management ────────────────────────────────────────────────────────

// POST /api/agent/session/create
// Frontend: apiClient.post("/api/agent/session/create", { coinId })
// Creates a clean DB session and returns { sessionId }
router.post("/session/create", agentController.createSession);

// GET /api/agent/session/:sessionId
// Frontend: apiClient.get(`/api/agent/session/${activeSessionId}`)
// Returns { messages, currentEmotion } for history restoration on page load
router.get("/session/:sessionId", agentController.getSession);

// DELETE /api/agent/session/:sessionId
// Frontend: called when user clears a session from the sidebar
router.delete("/session/:sessionId", agentController.clearSession);

// GET /api/agent/sessions
// Frontend: fetches the session list shown in ChatSidebar
router.get("/sessions", agentController.getUserSessions);

// ── Chat ──────────────────────────────────────────────────────────────────────

// POST /api/agent/chat/stream
// Frontend: native fetch() in useChatEngine.sendMessage()
// Streams NDJSON chunks: text_delta | emotion_update | tool_execution | done | error
router.post("/chat/stream", agentController.streamChat);

// ── Analysis Pipeline Callback ────────────────────────────────────────────────

// POST /api/agent/analysis-complete
// Called by your agent-run job after orchestrate() finishes.
// Returns the full ChatOutput including analysisReport for rich rendering.
router.post("/analysis-complete", agentController.notifyAnalysisComplete);

export default router;

 this is the backend when talk about agent,   you can read in the app.ts all contains the majority of market analysis, using the json output, it contains the response body wehn triggered  some api, also the argument body needed is in the collection you created it was a test, now all requirements are satisfied you wil merge the chat itself into triggering api from the app.ts, also the problem about the body from api request should be generated by asking the user itself for more info, like claude style it will clarify the user first, by showing an options, someting like that 
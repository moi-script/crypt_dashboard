"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/services/api.client";
import { useAuth } from "@/controllers/useAuth";
import { PaperWalletDashboard } from "../PaperWalletDashboard";
import type { ChatMessage } from "./hooks/useChatEngine";

// ── Types (mirrors agent.service.frontend.ts) ─────────────────────────────────
interface AgentRun {
  runId:       string;
  strategy:    string;
  mode:        string;
  startedAt:   string;
  completedAt?: string;
  status:      string;
  decision?: {
    intent:        { type: string; rationale?: string };
    confidence:    number;
    reasoning:     string;
    toolCallTrace: string[];
  };
  executionResult?: {
    status:           string;
    filledAmountUsd?: number;
    simulatedPnlUsd?: number;
    executedAt:       string;
    riskRejectionReason?: string;
  };
}

interface AgentConfig {
  enabled:               boolean;
  mode:                  string;
  loopIntervalMs:        number;
  strategies:            Record<string, boolean>;
  watchlist:             string[];
  maxTradeUsd:           number;
  requireManualApproval: boolean;
}

interface AgentRunStats {
  total:           number;
  completed:       number;
  failed:          number;
  blocked:         number;
  pending:         number;
  last24h:         number;
  intentBreakdown: Record<string, number>;
}

interface Position {
  positionId:      string;
  status?:         "pending" | "open" | "closed" | "cancelled";
  tokenIn:         string;
  tokenOut:        string;
  entryAmountUsd:  number;
  entryPrice?:     number;
  isOpen:          boolean;
  realizedPnlUsd?: number;
  strategy:        string;
  entryAt:         string;
  mode:            string;
  stopLossPrice?:   number;
  takeProfitPrice?: number;
  entryZoneLow?:    number;
  entryZoneHigh?:   number;
  entryExpiresAt?:  string;
  framework?:       string;
  confidence?:      number;
}

interface PnlSummary {
  totalPnlUsd:   number;
  totalTrades:   number;
  openPositions: number;
  wins:          number;
  losses:        number;
  winRate:       number | null;
  avgWinUsd:     number;
  avgLossUsd:    number;
}

interface Opportunity {
  opportunityId: string;
  type:          string;
  title:         string;
  detail:        string;
  asset:         string;
  protocol?:     string;
  chain?:        string;
  score:         number;
  acted:         boolean;
  detectedAt:    string;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; bg: string }> = {
    completed:        { color: "#00e5a0", bg: "rgba(0,229,160,0.12)"   },
    running:          { color: "#36b6ff", bg: "rgba(54,182,255,0.12)"  },
    failed:           { color: "#ff5572", bg: "rgba(255,85,114,0.12)"  },
    blocked:          { color: "#ffb020", bg: "rgba(255,176,32,0.12)"  },
    pending_approval: { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  };
  const s = cfg[status] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.08)" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, padding: "3px 8px", borderRadius: 6, flexShrink: 0, letterSpacing: "0.04em" }}>
      {status.replace("_", " ").toUpperCase()}
    </span>
  );
}

function IntentBadge({ type }: { type: string }) {
  const cfg: Record<string, string> = {
    propose_trade: "#00e5a0",
    set_alert:     "#36b6ff",
    rebalance:     "#a78bfa",
    no_action:     "#94a3b8",
  };
  const color = cfg[type] ?? "#94a3b8";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, border: `1px solid ${color}40`, padding: "2px 7px", borderRadius: 5, flexShrink: 0 }}>
      {type.replace("_", " ").toUpperCase()}
    </span>
  );
}

function EmptyMsg({ msg }: { msg: string }) {
  return (
    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", margin: "24px 0", fontFamily: "var(--font-display,sans-serif)" }}>
      {msg}
    </p>
  );
}

// ── RUNS TAB ─────────────────────────────────────────────────────────────────

function RunsTab({ accentColor }: { accentColor: string }) {
  const [runs,       setRuns]       = useState<AgentRun[]>([]);
  const [stats,      setStats]      = useState<AgentRunStats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [expanded,   setExpanded]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        apiClient.get<{ runs: AgentRun[]; total: number }>("/agent-runs?limit=20"),
        apiClient.get<AgentRunStats>("/agent-runs/stats"),
      ]);
      setRuns(r.runs ?? []);
      setStats(s);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const trigger = async () => {
    setTriggering(true);
    try {
      await apiClient.post("/agent-runs/trigger", {});
      await load();
    } catch { /* ignore */ } finally { setTriggering(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Stats grid */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
          {[
            { label: "Total",    val: stats.total,     color: "rgba(255,255,255,0.7)" },
            { label: "Done",     val: stats.completed, color: "#00e5a0"               },
            { label: "24h",      val: stats.last24h,   color: accentColor             },
            { label: "Failed",   val: stats.failed,    color: "#ff5572"               },
            { label: "Blocked",  val: stats.blocked,   color: "#ffb020"               },
            { label: "Pending",  val: stats.pending,   color: "#a78bfa"               },
          ].map(s => (
            <div key={s.label} style={{ padding: "10px 6px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: s.color, margin: "0 0 2px", fontFamily: "var(--font-mono)" }}>{s.val}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0, letterSpacing: "0.05em", textTransform: "uppercase" }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Intent breakdown */}
      {stats && Object.keys(stats.intentBreakdown).length > 0 && (
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px", fontFamily: "var(--font-mono)" }}>Intent Breakdown</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {Object.entries(stats.intentBreakdown).map(([intent, count]) => {
              const total = Object.values(stats.intentBreakdown).reduce((a, b) => a + b, 0);
              const pct   = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={intent} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IntentBadge type={intent} />
                  <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: intent === "propose_trade" ? "#00e5a0" : accentColor, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", flexShrink: 0, minWidth: 18, textAlign: "right", fontFamily: "var(--font-mono)" }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={trigger}
        disabled={triggering || loading}
        style={{
          width: "100%", padding: "10px 0", borderRadius: 10,
          fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display,sans-serif)",
          color: triggering ? "rgba(255,255,255,0.3)" : "#020609",
          background: triggering ? "rgb(12,24,42)" : accentColor,
          border: "none", cursor: triggering ? "not-allowed" : "pointer",
          opacity: triggering ? 0.6 : 1, transition: "all 0.2s ease",
        }}
      >
        {triggering ? "Running…" : "▶  Run One Tick"}
      </button>

      {/* Run list */}
      {loading && runs.length === 0 && <EmptyMsg msg="Loading…" />}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {runs.map(run => {
          const isOpen = expanded === run.runId;
          return (
            <div key={run.runId} style={{
              borderRadius: 10, overflow: "hidden",
              border: `1px solid ${isOpen ? accentColor + "30" : "rgba(255,255,255,0.07)"}`,
              background: isOpen ? `${accentColor}06` : "rgb(8,18,32)",
            }}>
              <button
                onClick={() => setExpanded(isOpen ? null : run.runId)}
                style={{ width: "100%", padding: "11px 12px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 7 }}
              >
                <StatusBadge status={run.status} />
                {run.decision && <IntentBadge type={run.decision.intent.type} />}
                <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {run.runId}
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", flexShrink: 0, fontFamily: "var(--font-mono)" }}>
                  {new Date(run.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </button>

              {isOpen && run.decision && (
                <div style={{ padding: "0 12px 12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <p style={{ fontFamily: "var(--font-display,sans-serif)", fontSize: 13, lineHeight: 1.65, color: "rgba(255,255,255,0.5)", margin: "10px 0 8px" }}>
                    {run.decision.reasoning?.slice(0, 200)}{(run.decision.reasoning?.length ?? 0) > 200 ? "…" : ""}
                  </p>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {run.decision.toolCallTrace.map((t, i) => (
                      <span key={i} style={{ fontSize: 11, color: accentColor, background: `${accentColor}10`, border: `1px solid ${accentColor}20`, padding: "2px 6px", borderRadius: 5 }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  {run.executionResult && (
                    <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p style={{ fontSize: 12, color: run.executionResult.status === "filled" ? "#00e5a0" : "#ff5572", margin: 0, fontFamily: "var(--font-mono)" }}>
                        {run.executionResult.status}
                        {run.executionResult.simulatedPnlUsd !== undefined && ` · PnL $${run.executionResult.simulatedPnlUsd.toFixed(2)}`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!loading && runs.length === 0 && <EmptyMsg msg="No runs yet — trigger a tick to start." />}
      </div>
    </div>
  );
}

// ── CONFIG TAB ────────────────────────────────────────────────────────────────

function ConfigTab({ accentColor }: { accentColor: string }) {
  const [config,      setConfig]      = useState<AgentConfig | null>(null);
  const [schedulerOn, setSchedulerOn] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [toggling,    setToggling]    = useState(false);
  const { user } = useAuth();
  const [walletUsd, setWalletUsd] = useState<number | null>(null);

  useEffect(() => {
    apiClient.get<{ config: AgentConfig; schedulerActive: boolean }>("/agent-runs/config")
      .then(d => { setConfig(d.config); setSchedulerOn(d.schedulerActive); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apiClient.get<{ totalValueUsd: number }>("/paper-wallet")
      .then(w => setWalletUsd(w.totalValueUsd))
      .catch(() => {});
  }, []);

  const toggle = async () => {
    if (!config) return;
    setToggling(true);
    try {
      const res = await apiClient.put<{ ok: boolean; config: AgentConfig }>("/agent-runs/config", { enabled: !config.enabled });
      setConfig(res.config);
    } catch { /* ignore */ } finally { setToggling(false); }
  };

  if (loading) return <EmptyMsg msg="Loading…" />;
  if (!config) return <EmptyMsg msg="Could not load config." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Wallet binding */}
      <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 6px", fontFamily: "var(--font-mono)" }}>Paper Wallet</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
            Attached to {user?.email ?? "your account"}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: accentColor, fontFamily: "var(--font-mono)" }}>
            {walletUsd != null ? `$${walletUsd.toFixed(2)}` : "—"}
          </span>
        </div>
      </div>

      {/* Loop toggle */}
      <div style={{ padding: "14px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: `1px solid ${config.enabled ? "#00e5a030" : "rgba(255,255,255,0.07)"}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontFamily: "var(--font-display,sans-serif)", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 3px" }}>Agent Loop</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
              {config.enabled ? `Active · every ${config.loopIntervalMs / 1000}s` : "Halted"}
            </p>
          </div>
          <button onClick={toggle} disabled={toggling} style={{
            padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
            fontFamily: "var(--font-display,sans-serif)", cursor: toggling ? "not-allowed" : "pointer",
            border: "none", transition: "all 0.2s ease",
            background: config.enabled ? "rgba(255,85,114,0.15)" : "rgba(0,229,160,0.15)",
            color: config.enabled ? "#ff5572" : "#00e5a0",
            opacity: toggling ? 0.6 : 1,
          }}>
            {toggling ? "…" : config.enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>

      {/* Config rows */}
      {[
        { label: "Mode",            val: config.mode.toUpperCase()                           },
        { label: "Max Trade",       val: `$${config.maxTradeUsd}`                            },
        { label: "Manual Approval", val: config.requireManualApproval ? "Required" : "Auto" },
        { label: "Scheduler",       val: schedulerOn ? "Running" : "Stopped"                },
      ].map(row => (
        <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-display,sans-serif)" }}>{row.label}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)", fontFamily: "var(--font-mono)" }}>{row.val}</span>
        </div>
      ))}

      {/* Strategies */}
      <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px", fontFamily: "var(--font-mono)" }}>Strategies</p>
        {Object.entries(config.strategies).map(([name, active]) => (
          <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-display,sans-serif)" }}>{name}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: active ? "#00e5a0" : "rgba(255,255,255,0.2)", background: active ? "rgba(0,229,160,0.10)" : "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 5 }}>
              {active ? "On" : "Off"}
            </span>
          </div>
        ))}
      </div>

      {/* Watchlist */}
      <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px", fontFamily: "var(--font-mono)" }}>Watchlist</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {config.watchlist.map(coin => (
            <span key={coin} style={{ fontSize: 12, fontWeight: 700, color: accentColor, background: `${accentColor}10`, border: `1px solid ${accentColor}25`, padding: "3px 9px", borderRadius: 5 }}>
              {coin}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── POSITIONS TAB ─────────────────────────────────────────────────────────────

function PositionsTab({ accentColor }: { accentColor: string }) {
  const [positions,  setPositions]  = useState<Position[]>([]);
  const [pnl,        setPnl]        = useState<PnlSummary | null>(null);
  const [loading,    setLoading]    = useState(true);
  const pnlColor = (v: number) => v >= 0 ? "#00e5a0" : "#ff5572";

  useEffect(() => {
    Promise.all([
      apiClient.get<{ positions: Position[]; count: number }>("/positions?limit=30"),
      apiClient.get<PnlSummary>("/positions/pnl/summary"),
    ])
      .then(([pos, summary]) => { setPositions(pos.positions ?? []); setPnl(summary); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {pnl && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          {[
            { label: "Total PnL",  val: `${pnl.totalPnlUsd >= 0 ? "+" : ""}$${pnl.totalPnlUsd.toFixed(2)}`, color: pnlColor(pnl.totalPnlUsd) },
            { label: "Win Rate",   val: pnl.winRate !== null ? `${pnl.winRate}%` : "—",                        color: "rgba(255,255,255,0.7)" },
            { label: "Open",       val: String(pnl.openPositions),                                              color: accentColor },
            { label: "Trades",     val: String(pnl.totalTrades),                                                color: "rgba(255,255,255,0.7)" },
          ].map(s => (
            <div key={s.label} style={{ padding: "10px 8px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: s.color, margin: "0 0 2px", fontFamily: "var(--font-mono)" }}>{s.val}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading && positions.length === 0 && <EmptyMsg msg="Loading…" />}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {positions.map(pos => {
          const status = pos.status ?? (pos.isOpen ? "open" : "closed");
          const badge = {
            pending:   { label: "Pending", color: "#ffb020" },
            open:      { label: "Open",     color: accentColor },
            closed:    { label: "Closed",   color: "rgba(255,255,255,0.25)" },
            cancelled: { label: "Cancelled", color: "#ff5572" },
          }[status];
          const isPending = status === "pending";
          return (
          <div key={pos.positionId} style={{ padding: "11px 12px", borderRadius: 10, background: "rgb(8,18,32)", border: `1px solid ${status === "open" ? accentColor + "25" : isPending ? "#ffb02033" : "rgba(255,255,255,0.07)"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-display,sans-serif)" }}>
                {pos.tokenIn} → {pos.tokenOut}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: badge.color, background: `${badge.color}1f`, padding: "2px 7px", borderRadius: 5, marginLeft: "auto" }}>
                {badge.label}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono)" }}>
                {isPending
                  ? `$${pos.entryAmountUsd.toFixed(2)} · limit${pos.entryZoneLow !== undefined && pos.entryZoneHigh !== undefined ? ` @ $${pos.entryZoneLow.toFixed(2)}–$${pos.entryZoneHigh.toFixed(2)}` : ""}`
                  : `$${pos.entryAmountUsd.toFixed(2)}${pos.entryPrice !== undefined ? ` @ $${pos.entryPrice.toFixed(4)}` : ""}`}
              </span>
              {isPending && pos.entryExpiresAt && (
                <span style={{ fontSize: 11, color: "#ffb020", fontFamily: "var(--font-mono)" }}>
                  expires {new Date(pos.entryExpiresAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                </span>
              )}
              {pos.realizedPnlUsd !== undefined && (
                <span style={{ fontSize: 13, fontWeight: 700, color: pnlColor(pos.realizedPnlUsd), marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
                  {pos.realizedPnlUsd >= 0 ? "+" : ""}${pos.realizedPnlUsd.toFixed(4)}
                </span>
              )}
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "5px 0 0", fontFamily: "var(--font-mono)" }}>
              {pos.strategy}{pos.framework ? ` · ${pos.framework}` : ""}{pos.confidence !== undefined ? ` · ${pos.confidence}% conf` : ""} · {new Date(pos.entryAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
            </p>
            {(pos.stopLossPrice !== undefined || pos.takeProfitPrice !== undefined) && (
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "3px 0 0", fontFamily: "var(--font-mono)" }}>
                {pos.stopLossPrice !== undefined && <span style={{ color: "#ff5572" }}>SL ${pos.stopLossPrice.toFixed(2)}</span>}
                {pos.stopLossPrice !== undefined && pos.takeProfitPrice !== undefined && "  ·  "}
                {pos.takeProfitPrice !== undefined && <span style={{ color: "#00e5a0" }}>TP ${pos.takeProfitPrice.toFixed(2)}</span>}
              </p>
            )}
          </div>
          );
        })}
        {!loading && positions.length === 0 && <EmptyMsg msg="No positions yet — run the agent loop first." />}
      </div>
    </div>
  );
}

// ── SIGNALS TAB ───────────────────────────────────────────────────────────────

function SignalsTab({ accentColor }: { accentColor: string }) {
  const [opps,    setOpps]    = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<{ opportunities: Opportunity[]; count: number }>("/opportunities?limit=30")
      .then(d => setOpps(d.opportunities ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const typeColor: Record<string, string> = {
    yield_anomaly:   "#00e5a0",
    price_spike:     "#ffb020",
    volume_spike:    "#36b6ff",
    airdrop_signal:  "#a78bfa",
    sentiment_shift: "#f472b6",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {loading && opps.length === 0 && <EmptyMsg msg="Loading…" />}
      {opps.map(opp => {
        const col = typeColor[opp.type] ?? "#94a3b8";
        return (
          <div key={opp.opportunityId} style={{ padding: "12px 12px", borderRadius: 10, background: "rgb(8,18,32)", border: `1px solid ${col}22` }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <p style={{ fontFamily: "var(--font-display,sans-serif)", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: 0, flex: 1, lineHeight: 1.4 }}>
                {opp.title}
              </p>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: col, background: `${col}12`, border: `1px solid ${col}25`, padding: "2px 6px", borderRadius: 4 }}>
                  {opp.type.replace("_", " ").toUpperCase()}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: col, fontFamily: "var(--font-mono)" }}>{opp.score}</span>
              </div>
            </div>
            <p style={{ fontFamily: "var(--font-display,sans-serif)", fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.45)", margin: "0 0 6px" }}>{opp.detail}</p>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
              {opp.protocol && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>{opp.protocol}</span>}
              {opp.chain    && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>{opp.chain}</span>}
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>
                {opp.acted ? "✓ acted" : "• unacted"}
              </span>
            </div>
          </div>
        );
      })}
      {!loading && opps.length === 0 && <EmptyMsg msg="No active signals — agent will populate these on next tick." />}
    </div>
  );
}

// ── Main ChatDashboard ────────────────────────────────────────────────────────

type DashTab = "runs" | "positions" | "signals" | "config" | "wallet";

interface ChatDashboardProps {
  engine: {
    activeSessionId: string | null;
    messages:        ChatMessage[];
  };
  accentColor?: string;
}

export function ChatDashboard({ engine, accentColor = "#00d4ff" }: ChatDashboardProps) {
  const [tab, setTab] = useState<DashTab>("runs");

  const aiMessageCount = engine.messages.filter(m => m.role === "agent").length;
  const toolExecutions = engine.messages.filter(m => m.toolResult).length;

  if (!engine.activeSessionId) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: 13, fontFamily: "var(--font-mono)", padding: 24, textAlign: "center" }}>
        Initialize a Terminal Session to view analytics.
      </div>
    );
  }

  const TABS: { id: DashTab; label: string }[] = [
    { id: "runs",      label: "Runs"      },
    { id: "positions", label: "Positions" },
    { id: "signals",   label: "Signals"   },
    { id: "config",    label: "Config"    },
    { id: "wallet",    label: "Wallet"    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>

      {/* Session header stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(4,9,20,0.9)", flexShrink: 0 }}>
        {[
          { label: "Session",        val: engine.activeSessionId.split("-")[0] },
          { label: "AI Responses",   val: String(aiMessageCount)               },
          { label: "Tools Executed", val: String(toolExecutions)               },
        ].map(s => (
          <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 8px", textAlign: "center", border: "1px solid rgba(255,255,255,0.05)" }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>{s.label}</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", margin: 0, fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", background: "rgb(4,11,20)", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: "1 1 0", padding: "10px 4px", fontSize: 12, fontFamily: "var(--font-display,sans-serif)", fontWeight: 700,
            background: "transparent", border: "none",
            borderBottom: tab === t.id ? `2px solid ${accentColor}` : "2px solid transparent",
            color: tab === t.id ? accentColor : "rgba(255,255,255,0.3)",
            cursor: "pointer", transition: "all 0.15s ease", whiteSpace: "nowrap",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 24px" }}>
        {tab === "runs"      && <RunsTab      accentColor={accentColor} />}
        {tab === "positions" && <PositionsTab accentColor={accentColor} />}
        {tab === "signals"   && <SignalsTab   accentColor={accentColor} />}
        {tab === "config"    && <ConfigTab    accentColor={accentColor} />}
        {tab === "wallet"    && (
          <div style={{ margin: "-14px" }}>
            <PaperWalletDashboard />
          </div>
        )}
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/services/api.client";
import { useAuth } from "@/controllers/useAuth";
import { PaperWalletDashboard } from "../PaperWalletDashboard";
import type { ChatMessage } from "./hooks/useChatEngine";
import { MiniChart }        from "@/components/AgentChart/MiniChart";
import { PriceSparkline }  from "@/components/AgentChart/PriceSparkline";
import {
  listApprovals as fetchApprovals,
  approveRun as doApprove,
  rejectRun  as doReject,
  coinAnalysisService,
  seedDemoData,
} from "@/services/agent.service.frontend";
import type { ApprovalRun, CoinAnalysisRun, StrategyCard, StrategyFramework } from "@/services/agent.service.frontend";

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
  selectedCoin?:         string;
  maxTradeUsd:           number;
  requireManualApproval: boolean;
  allowShorts?:          boolean;
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
  exitPrice?:      number;
  exitAt?:         string;
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
  framework?:          string;
  confidence?:         number;
  trailingStopPct?:    number;
  highWaterMarkPrice?: number;
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

const COIN_OPTIONS = ["BTC", "ETH", "SOL", "BNB", "AVAX", "ARB", "AAVE"] as const;
type CoinOption = typeof COIN_OPTIONS[number];

const SYMBOL_TO_COINGECKO: Record<CoinOption, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
  AVAX: "avalanche-2", ARB: "arbitrum", AAVE: "aave",
};
const COINGECKO_TO_SYMBOL: Partial<Record<string, CoinOption>> = {
  bitcoin: "BTC", ethereum: "ETH", solana: "SOL", binancecoin: "BNB",
  "avalanche-2": "AVAX", arbitrum: "ARB", aave: "AAVE",
};

function RunsTab({ accentColor }: { accentColor: string }) {
  const [runs,        setRuns]        = useState<AgentRun[]>([]);
  const [stats,       setStats]       = useState<AgentRunStats | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [approvals,   setApprovals]   = useState<ApprovalRun[]>([]);
  const [approving,   setApproving]   = useState<string | null>(null);
  // Proposals are null until the current session triggers a run
  const [selectedCoin,setSelectedCoin]= useState<string>("BTC");
  const [agentEnabled,setAgentEnabled]= useState<boolean | null>(null);
  const [latestRun,   setLatestRun]   = useState<CoinAnalysisRun | null>(null);
  const [approvalPrices, setApprovalPrices] = useState<Record<string, number>>({});

  const displayRun = latestRun;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s, a, cfg, latest] = await Promise.all([
        apiClient.get<{ runs: AgentRun[]; total: number }>("/agent-runs?limit=20"),
        apiClient.get<AgentRunStats>("/agent-runs/stats"),
        fetchApprovals(),
        apiClient.get<{ config: AgentConfig }>("/agent-runs/config"),
        coinAnalysisService.getLatest().catch(() => null),
      ]);
      setRuns(r.runs ?? []);
      setStats(s);
      setApprovals(a);
      const savedCoin =
        cfg.config.selectedCoin ??
        COINGECKO_TO_SYMBOL[cfg.config.watchlist?.[0] ?? ""] ??
        "BTC";
      setSelectedCoin((COIN_OPTIONS as readonly string[]).includes(savedCoin) ? savedCoin : "BTC");
      setAgentEnabled(cfg.config.enabled);
      if (latest) setLatestRun(latest);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fetch live prices for pending approval entry zones (re-validation)
  useEffect(() => {
    if (!approvals.length) return;
    const symbols = approvals.map(ap => ap.chartSnapshot?.binanceSymbol).filter(Boolean) as string[];
    if (!symbols.length) return;
    const fetchPrices = async () => {
      const prices: Record<string, number> = {};
      await Promise.all(symbols.map(async sym => {
        try {
          const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`);
          const d = await r.json() as { price: string };
          const p = parseFloat(d.price);
          if (isFinite(p) && p > 0) prices[sym] = p;
        } catch {}
      }));
      setApprovalPrices(prices);
    };
    fetchPrices();
    const id = setInterval(fetchPrices, 30_000);
    return () => clearInterval(id);
  }, [approvals]);

  // Keep agentEnabled in sync if user toggles it from the Config tab
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const cfg = await apiClient.get<{ config: AgentConfig }>("/agent-runs/config");
        setAgentEnabled(cfg.config.enabled);
      } catch { /* ignore */ }
    }, 15_000);
    return () => clearInterval(id);
  }, []);


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Loop status banner ── */}
      {agentEnabled !== null && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "8px 12px", borderRadius: 10,
          color:      agentEnabled ? "#00e5a0" : "#ffb020",
          background: agentEnabled ? "#00e5a010" : "#ffb02010",
          border:     `1px solid ${agentEnabled ? "#00e5a025" : "#ffb02025"}` }}>
          {agentEnabled
            ? `⬤ Agent loop active — auto-analysing ${selectedCoin} on schedule.`
            : "⊘ Agent loop is halted — enable it in the Config tab to start auto-analysis."}
        </div>
      )}

      {/* ── Trade proposals — shown when a run exists or is in progress ── */}
      {displayRun && (
        <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "rgb(4,10,18)" }}>
          {(() => {
            const signalCards = displayRun.strategyCards?.filter(c => c.signal) ?? [];
            const longCount  = signalCards.filter(c => c.signal?.bias === "long").length;
            const shortCount = signalCards.filter(c => c.signal?.bias === "short").length;
            const confluenceCount = Math.max(longCount, shortCount);
            const confluenceBias  = longCount >= shortCount ? "LONG" : "SHORT";
            return (
              <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Trade Proposals
                </span>
                {displayRun && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: displayRun.status === "pending_approval" ? "#a78bfa" : displayRun.status === "completed" || displayRun.status === "auto_executed" ? "#00e5a0" : accentColor }}>
                    {displayRun.symbol} · {displayRun.status.replace(/_/g, " ")}
                  </span>
                )}
                {displayRun.status === "running" && !displayRun.strategyCards?.length && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: accentColor }}>
                    Analysing {displayRun.symbol ?? selectedCoin} across 4 strategies…
                  </span>
                )}
                {confluenceCount >= 2 && (
                  <span style={{
                    marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 800,
                    color: confluenceBias === "LONG" ? "#00e5a0" : "#ff5572",
                    background: (confluenceBias === "LONG" ? "#00e5a0" : "#ff5572") + "18",
                    border: `1px solid ${(confluenceBias === "LONG" ? "#00e5a0" : "#ff5572")}35`,
                    padding: "3px 10px", borderRadius: 20, letterSpacing: "0.06em",
                  }}>
                    ⬡ {confluenceCount}× CONFLUENCE · {confluenceBias}
                  </span>
                )}
              </div>
            );
          })()}

          <div style={{ padding: "12px 14px" }}>
            {/* Parallel strategy skeletons while running */}
            {displayRun.status === "running" && !displayRun.strategyCards?.length && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {(["SmartMoney", "Wyckoff", "ElliottWave", "Harmonic"] as const).map((fw, i) => (
                  <div key={fw} style={{ borderRadius: 10, border: `1px solid ${FW_COLOR[fw]}22`, background: "rgb(6,14,22)", overflow: "hidden" }}>
                    <div style={{ padding: "8px 11px", background: `${FW_COLOR[fw]}0d`, borderBottom: `1px solid ${FW_COLOR[fw]}18`, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800, color: FW_COLOR[fw] }}>{fw}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.25)", animation: `pulse ${1.2 + i * 0.15}s ease-in-out infinite` }}>running…</span>
                    </div>
                    <div style={{ height: 130, background: "rgb(8,18,32)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[0,1,2].map(j => (
                          <div key={j} style={{ width: 4, height: 16, borderRadius: 2, background: FW_COLOR[fw] + "60", animation: `pulse ${0.8 + j * 0.15}s ease-in-out infinite` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pending approval banner */}
            {displayRun && displayRun.status === "pending_approval" && !displayRun.autoMode && (
              <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: "#a78bfa10", border: "1px solid #a78bfa30", fontFamily: "var(--font-mono)", fontSize: 10, color: "#a78bfa" }}>
                ⚠ Proposals ready — approve or reject each strategy card below.
              </div>
            )}

            {/* 4 proposal cards */}
            {displayRun && displayRun.strategyCards.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {displayRun.strategyCards.map(card => (
                  <ProposalCard
                    key={card.framework}
                    card={card}
                    runId={displayRun.coinAnalysisRunId}
                    autoMode={displayRun.autoMode}
                    accentColor={accentColor}
                    onAction={load}
                  />
                ))}
              </div>
            )}

            {/* Footer meta */}
            {displayRun && displayRun.strategyCards.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", gap: 12, fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.2)", flexWrap: "wrap" }}>
                <span>Run: {displayRun.coinAnalysisRunId.slice(0, 12)}…</span>
                <span>news: {displayRun.newsArticlesUsed.length} sources</span>
                {displayRun.completedAt && <span>completed: {new Date(displayRun.completedAt).toLocaleTimeString()}</span>}
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* ── Pending Approval ────────────────────────────────────────── */}
      {approvals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 10, color: "#a78bfa", letterSpacing: "0.08em", textTransform: "uppercase", margin: "4px 0 2px", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
            Pending Approval ({approvals.length})
          </p>
          {approvals.map(ap => {
            const intent   = ap.decision?.intent;
            const isActing = approving === ap.runId;

            // Stale signal warning
            const signalAgeMs = Date.now() - new Date(ap.startedAt).getTime();
            const signalAgeH  = signalAgeMs / 3_600_000;
            const isStale     = signalAgeH > 2;
            const isDanger    = signalAgeH > 6;
            const ageLabel    = signalAgeH >= 1 ? `${signalAgeH.toFixed(0)}h` : `${Math.round(signalAgeMs / 60_000)}m`;

            // Live price zone re-validation
            const bSym          = ap.chartSnapshot?.binanceSymbol;
            const liveApPrice   = bSym ? approvalPrices[bSym] : undefined;
            const zoneLow       = ap.chartSnapshot?.entryZone?.low;
            const zoneHigh      = ap.chartSnapshot?.entryZone?.high;
            const priceAboveZone = liveApPrice && zoneHigh && liveApPrice > zoneHigh * 1.03;
            const priceBelowZone = liveApPrice && zoneLow  && liveApPrice < zoneLow  * 0.97;
            const priceInZone    = liveApPrice && zoneLow && zoneHigh && liveApPrice >= zoneLow && liveApPrice <= zoneHigh;
            const pricePctFromZone = liveApPrice && zoneHigh && zoneLow
              ? liveApPrice > zoneHigh ? ((liveApPrice - zoneHigh) / zoneHigh * 100) : liveApPrice < zoneLow ? ((zoneLow - liveApPrice) / zoneLow * 100) : 0
              : null;

            // R:R ratio from snapshot levels
            const rrApproval = ap.chartSnapshot ? (() => {
              const entry  = (ap.chartSnapshot.entryZone.low + ap.chartSnapshot.entryZone.high) / 2;
              const risk   = entry - ap.chartSnapshot.stopLoss;
              const reward = (ap.chartSnapshot.takeProfitLevels[0] ?? 0) - entry;
              return risk > 0 && reward > 0 ? (reward / risk) : null;
            })() : null;

            // Position sizing — risk in $ from SL distance
            const riskUsdApproval = ap.chartSnapshot && intent?.amountUsd ? (() => {
              const entry  = (ap.chartSnapshot.entryZone.low + ap.chartSnapshot.entryZone.high) / 2;
              const riskPt = entry > 0 ? (entry - ap.chartSnapshot.stopLoss) / entry : 0;
              return { riskPct: riskPt * 100, riskUsd: riskPt * intent.amountUsd };
            })() : null;

            return (
              <div key={ap.runId} style={{
                borderRadius: 10, background: "rgb(8,18,32)",
                border: "1px solid rgba(167,139,250,0.25)",
                overflow: "hidden",
              }}>
                {/* Card header */}
                <div style={{ padding: "11px 12px 8px", display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <StatusBadge status="pending_approval" />
                  {intent && <IntentBadge type={intent.type} />}
                  {intent?.tokenOut && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono)" }}>
                      {intent.tokenOut}/USDC
                    </span>
                  )}
                  {intent?.amountUsd && (
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-mono)" }}>
                      ${intent.amountUsd}
                    </span>
                  )}
                  {/* R:R badge */}
                  {rrApproval !== null && (
                    <span style={{
                      fontSize: 11, fontWeight: 800, fontFamily: "var(--font-mono)",
                      color: rrApproval >= 2 ? "#00e5a0" : rrApproval >= 1 ? "#ffb020" : "#ff5572",
                      background: (rrApproval >= 2 ? "#00e5a0" : rrApproval >= 1 ? "#ffb020" : "#ff5572") + "12",
                      border: `1px solid ${(rrApproval >= 2 ? "#00e5a0" : rrApproval >= 1 ? "#ffb020" : "#ff5572")}30`,
                      padding: "2px 8px", borderRadius: 5,
                    }}>
                      R:R 1:{rrApproval.toFixed(1)}
                    </span>
                  )}
                  {ap.decision?.confidence != null && (
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
                      {ap.decision.confidence}% conf
                    </span>
                  )}
                </div>

                {/* SL · TP summary + framework + risk sizing */}
                {ap.chartSnapshot && (
                  <div style={{ padding: "0 12px 8px", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#ff5572", fontFamily: "var(--font-mono)" }}>
                      SL {ap.chartSnapshot.stopLoss.toLocaleString()}
                    </span>
                    {ap.chartSnapshot.takeProfitLevels.slice(0, 2).map((tp, i) => (
                      <span key={i} style={{ fontSize: 11, color: "#00e5a0", fontFamily: "var(--font-mono)" }}>
                        TP{i + 1} {tp.toLocaleString()}
                      </span>
                    ))}
                    <span style={{ fontSize: 10, color: "#a78bfa", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>
                      {ap.chartSnapshot.framework}
                    </span>
                    {riskUsdApproval && (
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.3)" }}>
                        risking ${riskUsdApproval.riskUsd.toFixed(2)} · {riskUsdApproval.riskPct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                )}

                {/* Interactive chart — 1D default, click to expand */}
                {ap.chartSnapshot && (
                  <div style={{ padding: "0 12px 10px" }}>
                    <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.3)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                      <span>{ap.chartSnapshot.binanceSymbol} · 1D</span>
                      <span style={{ color: "rgba(255,255,255,0.2)" }}>click to expand</span>
                    </div>
                    <MiniChart snapshot={ap.chartSnapshot} defaultTimeframe="1d" />
                  </div>
                )}

                {/* Live price zone re-validation */}
                {liveApPrice && (
                  <div style={{ margin: "0 12px 8px", padding: "6px 10px", borderRadius: 7,
                    background: priceInZone ? "#00e5a010" : (priceAboveZone || priceBelowZone) ? "#ff557210" : "#ffffff08",
                    border: `1px solid ${priceInZone ? "#00e5a030" : (priceAboveZone || priceBelowZone) ? "#ff557230" : "#ffffff12"}` }}>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: priceInZone ? "#00e5a0" : (priceAboveZone || priceBelowZone) ? "#ff5572" : "rgba(255,255,255,0.4)" }}>
                      {priceInZone
                        ? `✓ Price $${liveApPrice.toLocaleString()} is in entry zone — ready to fill`
                        : priceAboveZone
                        ? `⚠ Price $${liveApPrice.toLocaleString()} is ${pricePctFromZone?.toFixed(1)}% above zone — limit order may never fill`
                        : priceBelowZone
                        ? `✗ Price $${liveApPrice.toLocaleString()} broke ${pricePctFromZone?.toFixed(1)}% below zone — entry thesis likely invalidated`
                        : `Live $${liveApPrice.toLocaleString()} · near zone`}
                    </span>
                  </div>
                )}

                {/* Stale signal warning */}
                {isStale && (
                  <div style={{ margin: "0 12px 8px", padding: "6px 10px", borderRadius: 7, background: isDanger ? "#ff557210" : "#ffb02010", border: `1px solid ${isDanger ? "#ff557230" : "#ffb02030"}` }}>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: isDanger ? "#ff5572" : "#ffb020" }}>
                      ⚠ Signal {ageLabel} old{isDanger ? " — entry zone likely invalidated, verify price before approving" : " — price may have moved from entry zone"}
                    </span>
                  </div>
                )}

                {/* Net R:R (after fees + slippage) */}
                {rrApproval !== null && (
                  (() => {
                    const entry    = ap.chartSnapshot ? (ap.chartSnapshot.entryZone.low + ap.chartSnapshot.entryZone.high) / 2 : 0;
                    const sl       = ap.chartSnapshot?.stopLoss ?? 0;
                    const tp       = ap.chartSnapshot?.takeProfitLevels[0] ?? 0;
                    const friction = 0.0025;  // 0.1% entry fee + 0.1% exit fee + 0.05% slippage
                    const rawRisk  = entry > 0 ? (entry - sl) / entry : 0;
                    const rawRew   = entry > 0 ? (tp - entry) / entry  : 0;
                    const netRew   = rawRew - friction;
                    const netRisk  = rawRisk + friction;
                    const netRr    = netRisk > 0 ? netRew / netRisk : 0;
                    const netOk    = netRr >= 1.5;
                    return (
                      <div style={{ margin: "0 12px 8px", padding: "5px 10px", borderRadius: 7,
                        background: netOk ? "#00e5a008" : "#ff557210",
                        border: `1px solid ${netOk ? "#00e5a025" : "#ff557230"}` }}>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: netOk ? "#00e5a0" : "#ff5572" }}>
                          Net R:R after fees: <b>{netRr.toFixed(2)}</b>
                          {!netOk && " — below 1.5 minimum, edge is thin after fees"}
                        </span>
                      </div>
                    );
                  })()
                )}

                {/* Approve / Reject buttons */}
                <div style={{ display: "flex", gap: 6, padding: "0 12px 12px" }}>
                  <button
                    disabled={isActing || isDanger}
                    onClick={async () => {
                      setApproving(ap.runId);
                      try { await doApprove(ap.runId); await load(); }
                      catch { /* ignore */ }
                      finally { setApproving(null); }
                    }}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                      fontSize: 12, fontWeight: 700, cursor: (isActing || isDanger) ? "not-allowed" : "pointer",
                      background: isDanger ? "rgba(255,255,255,0.06)" : isActing ? "rgba(0,229,160,0.2)" : "#00e5a0",
                      color: isDanger ? "rgba(255,255,255,0.2)" : isActing ? "rgba(255,255,255,0.3)" : "#020609",
                      fontFamily: "var(--font-display,sans-serif)", transition: "all 0.15s ease",
                    }}
                  >{isActing ? "Processing…" : isDanger ? "Expired — Reject" : "✓ Approve"}</button>
                  <button
                    disabled={isActing}
                    onClick={async () => {
                      setApproving(ap.runId);
                      try { await doReject(ap.runId); await load(); }
                      catch { /* ignore */ }
                      finally { setApproving(null); }
                    }}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid rgba(255,85,114,0.4)",
                      fontSize: 12, fontWeight: 700, cursor: isActing ? "not-allowed" : "pointer",
                      background: "transparent", color: isActing ? "rgba(255,255,255,0.2)" : "#ff5572",
                      fontFamily: "var(--font-display,sans-serif)", transition: "all 0.15s ease",
                    }}
                  >✕ Reject</button>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Run list */}
      {loading && runs.length === 0 && <EmptyMsg msg="Loading…" />}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {runs.map(run => {
          const isOpen = expanded === run.runId;
          const dur = run.completedAt
            ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
            : null;
          const conf = run.decision?.confidence;
          const execOk = run.executionResult?.status === "filled";
          const pnl = run.executionResult?.simulatedPnlUsd;

          return (
            <div key={run.runId} style={{
              borderRadius: 12, overflow: "hidden",
              border: `1px solid ${isOpen ? accentColor + "35" : "rgba(255,255,255,0.07)"}`,
              background: isOpen ? `${accentColor}06` : "rgb(6,14,22)",
              transition: "border-color 0.15s",
            }}>
              {/* ── Collapsed header ── */}
              <button
                onClick={() => setExpanded(isOpen ? null : run.runId)}
                style={{ width: "100%", padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                {/* Row 1: badges + win/loss + time + chevron */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <StatusBadge status={run.status} />
                  {run.decision && <IntentBadge type={run.decision.intent.type} />}
                  {/* WIN / LOSS badge */}
                  {execOk && pnl !== undefined && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, fontFamily: "var(--font-mono)",
                      color: pnl >= 0 ? "#00e5a0" : "#ff5572",
                      background: (pnl >= 0 ? "#00e5a0" : "#ff5572") + "18",
                      border: `1px solid ${(pnl >= 0 ? "#00e5a0" : "#ff5572")}35`,
                      padding: "2px 8px", borderRadius: 20,
                    }}>
                      {pnl >= 0 ? "WIN" : "LOSS"} {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                    </span>
                  )}
                  {/* No-action reason chip */}
                  {run.decision?.intent.type === "no_action" && run.decision.intent.rationale && (
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.04)", padding: "2px 7px", borderRadius: 5, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {run.decision.intent.rationale.slice(0, 50)}
                    </span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                    {new Date(run.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    {dur !== null && <span style={{ color: "rgba(255,255,255,0.15)" }}> · {dur}s</span>}
                  </span>
                  <span style={{ fontSize: 10, color: isOpen ? accentColor : "rgba(255,255,255,0.2)", transition: "color 0.15s", flexShrink: 0 }}>
                    {isOpen ? "▴" : "▾"}
                  </span>
                </div>
                {/* Row 2: strategy · confidence · reasoning preview */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: 4 }}>
                    {run.strategy}
                  </span>
                  {conf !== undefined && (
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: conf >= 70 ? "#00e5a0" : conf >= 40 ? "#ffb020" : "#ff5572", background: "rgba(255,255,255,0.04)", padding: "2px 7px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)" }}>
                      {conf}% conf
                    </span>
                  )}
                  {run.executionResult && (
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: execOk ? "#00e5a0" : "#ff5572" }}>
                      {execOk ? "✓ filled" : "✗ " + run.executionResult.status}
                      {pnl !== undefined && <span style={{ color: pnl >= 0 ? "#00e5a0" : "#ff5572" }}> · ${pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}</span>}
                    </span>
                  )}
                  {!isOpen && run.decision?.reasoning && (
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-display,sans-serif)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                      {run.decision.reasoning.slice(0, 80)}{run.decision.reasoning.length > 80 ? "…" : ""}
                    </span>
                  )}
                </div>
              </button>

              {/* ── Expanded detail ── */}
              {isOpen && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>

                  {/* Reasoning */}
                  {run.decision?.reasoning && (
                    <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <p style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Reasoning</p>
                      <p style={{ fontSize: 12, fontFamily: "var(--font-display,sans-serif)", lineHeight: 1.7, color: "rgba(255,255,255,0.55)", margin: 0 }}>
                        {run.decision.reasoning}
                      </p>
                      {run.decision.intent.rationale && (
                        <p style={{ fontSize: 11, fontFamily: "var(--font-display,sans-serif)", lineHeight: 1.6, color: "rgba(255,255,255,0.35)", margin: "8px 0 0", fontStyle: "italic" }}>
                          {run.decision.intent.rationale}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Tool call timeline */}
                  {run.decision?.toolCallTrace && run.decision.toolCallTrace.length > 0 && (
                    <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <p style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
                        Tool Calls · {run.decision.toolCallTrace.length}
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {run.decision.toolCallTrace.map((t, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.2)", width: 16, textAlign: "right", flexShrink: 0 }}>
                              {i + 1}
                            </span>
                            <div style={{ width: 1, alignSelf: "stretch", background: i < run.decision!.toolCallTrace.length - 1 ? "rgba(255,255,255,0.08)" : "transparent" }} />
                            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: accentColor, background: `${accentColor}0d`, border: `1px solid ${accentColor}20`, padding: "3px 9px", borderRadius: 5 }}>
                              {t}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Execution result */}
                  {run.executionResult && (
                    <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <p style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Execution</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        {[
                          { label: "Status",  val: run.executionResult.status,     color: execOk ? "#00e5a0" : "#ff5572" },
                          { label: "PnL",     val: pnl !== undefined ? `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` : "—", color: pnl !== undefined ? (pnl >= 0 ? "#00e5a0" : "#ff5572") : "rgba(255,255,255,0.4)" },
                          { label: "Filled",  val: run.executionResult.filledAmountUsd !== undefined ? `$${run.executionResult.filledAmountUsd.toFixed(2)}` : "—", color: "rgba(255,255,255,0.6)" },
                          { label: "At",      val: run.executionResult.executedAt ? new Date(run.executionResult.executedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—", color: "rgba(255,255,255,0.4)" },
                        ].map(cell => (
                          <div key={cell.label} style={{ padding: "7px 10px", borderRadius: 7, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <p style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 3px" }}>{cell.label}</p>
                            <p style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 700, color: cell.color, margin: 0 }}>{cell.val}</p>
                          </div>
                        ))}
                      </div>
                      {run.executionResult.riskRejectionReason && (
                        <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#ff5572", margin: "8px 0 0", padding: "6px 10px", borderRadius: 6, background: "#ff55720a", border: "1px solid #ff557220" }}>
                          ⚠ {run.executionResult.riskRejectionReason}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Meta footer */}
                  <div style={{ padding: "8px 14px", display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.18)" }}>id: {run.runId}</span>
                    <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.18)" }}>mode: {run.mode}</span>
                    {dur !== null && <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.18)" }}>duration: {dur}s</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!loading && runs.length === 0 && <EmptyMsg msg="No runs yet — enable the agent loop in Config." />}
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
  const [walletUsd,   setWalletUsd]   = useState<number | null>(null);
  const [saving,      setSaving]      = useState(false);

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
    const enabling = !config.enabled;
    try {
      const res = await apiClient.put<{ ok: boolean; config: AgentConfig }>("/agent-runs/config", { enabled: enabling });
      setConfig(res.config);
      // Auto-trigger an immediate analysis run when the loop is first enabled
      if (enabling) {
        const coin =
          config.selectedCoin ??
          COINGECKO_TO_SYMBOL[config.watchlist?.[0] ?? ""] ??
          "BTC";
        coinAnalysisService.trigger(coin).catch(() => {});
      }
    } catch { /* ignore */ } finally { setToggling(false); }
  };

  const [savingApproval, setSavingApproval] = useState(false);
  const toggleAutoTrade = async () => {
    if (!config) return;
    setSavingApproval(true);
    try {
      const res = await apiClient.put<{ ok: boolean; config: AgentConfig }>("/agent-runs/config", { requireManualApproval: !config.requireManualApproval });
      setConfig(res.config);
    } catch { /* ignore */ } finally { setSavingApproval(false); }
  };

  const [savingShorts, setSavingShorts] = useState(false);
  const toggleShorts = async () => {
    if (!config) return;
    setSavingShorts(true);
    try {
      const res = await apiClient.put<{ ok: boolean; config: AgentConfig }>("/agent-runs/config", { allowShorts: !config.allowShorts });
      setConfig(res.config);
    } catch { /* ignore */ } finally { setSavingShorts(false); }
  };

  const saveCoin = async (coin: string) => {
    setSaving(true);
    try {
      const res = await apiClient.put<{ ok: boolean; config: AgentConfig }>("/agent-runs/config", {
        selectedCoin: coin,
        watchlist: [SYMBOL_TO_COINGECKO[coin as CoinOption] ?? coin.toLowerCase()],
      });
      setConfig(res.config);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const [seeding,   setSeeding]   = useState(false);
  const [seedDone,  setSeedDone]  = useState<Record<string, number> | null>(null);
  const runSeed = async () => {
    setSeeding(true); setSeedDone(null);
    try {
      const { seeded } = await seedDemoData();
      setSeedDone(seeded);
    } catch { /* ignore */ } finally { setSeeding(false); }
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

      {/* Auto-Trade toggle */}
      {(autoOn => (
          <div style={{ padding: "14px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: `1px solid ${autoOn ? "#00e5a030" : "rgba(255,255,255,0.07)"}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ paddingRight: 12 }}>
                <p style={{ fontFamily: "var(--font-display,sans-serif)", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 3px" }}>Auto-Trade</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
                  {autoOn ? "Proposed trades execute automatically" : "Proposed trades wait for manual approval"}
                </p>
              </div>
              <button onClick={toggleAutoTrade} disabled={savingApproval} style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                fontFamily: "var(--font-display,sans-serif)", cursor: savingApproval ? "not-allowed" : "pointer",
                border: "none", transition: "all 0.2s ease",
                background: autoOn ? "rgba(0,229,160,0.15)" : "rgba(255,255,255,0.06)",
                color: autoOn ? "#00e5a0" : "rgba(255,255,255,0.55)",
                opacity: savingApproval ? 0.6 : 1,
              }}>
                {savingApproval ? "…" : autoOn ? "On" : "Off"}
              </button>
            </div>
          </div>
      ))(!config.requireManualApproval)}

      {/* Allow Shorts toggle */}
      {(shortsOn => (
        <div style={{ padding: "14px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: `1px solid ${shortsOn ? "#ff557230" : "rgba(255,255,255,0.07)"}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ paddingRight: 12 }}>
              <p style={{ fontFamily: "var(--font-display,sans-serif)", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 3px" }}>Short Positions</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
                {shortsOn
                  ? "Short signals will execute — requires margin/perp trading"
                  : "Long-only mode · short signals are skipped"}
              </p>
            </div>
            <button onClick={toggleShorts} disabled={savingShorts} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              fontFamily: "var(--font-display,sans-serif)", cursor: savingShorts ? "not-allowed" : "pointer",
              border: "none", transition: "all 0.2s ease",
              background: shortsOn ? "rgba(255,85,114,0.18)" : "rgba(255,255,255,0.06)",
              color: shortsOn ? "#ff5572" : "rgba(255,255,255,0.4)",
              opacity: savingShorts ? 0.6 : 1,
            }}>
              {savingShorts ? "…" : shortsOn ? "Enabled" : "Disabled"}
            </button>
          </div>
        </div>
      ))(!!config.allowShorts)}

      {/* Config rows */}
      {[
        { label: "Mode",            val: config.mode.toUpperCase()           },
        { label: "Max Trade",       val: `$${config.maxTradeUsd}`            },
        { label: "Scheduler",       val: schedulerOn ? "Running" : "Stopped" },
      ].map(row => (
        <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-display,sans-serif)" }}>{row.label}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)", fontFamily: "var(--font-mono)" }}>{row.val}</span>
        </div>
      ))}

      {/* Analysis coin picker */}
      <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: `1px solid ${accentColor}25` }}>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px", fontFamily: "var(--font-mono)" }}>
          Analysis Coin — agent loop focuses here
        </p>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["BTC", "ETH", "SOL", "BNB", "AVAX", "ARB", "AAVE"].map(c => {
            const currentCoin =
              config.selectedCoin ??
              COINGECKO_TO_SYMBOL[config.watchlist?.[0] ?? ""] ??
              "BTC";
            const selected = currentCoin === c;
            return (
              <button key={c} onClick={() => saveCoin(c)} disabled={saving}
                style={{ padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, transition: "all 0.15s",
                  background: selected ? accentColor : "rgba(255,255,255,0.06)",
                  color: selected ? "rgb(2,6,9)" : "rgba(255,255,255,0.45)" }}>
                {c}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", margin: "8px 0 0", fontFamily: "var(--font-mono)" }}>
          Current: <span style={{ color: accentColor }}>{config.selectedCoin ?? COINGECKO_TO_SYMBOL[config.watchlist?.[0] ?? ""] ?? "BTC"}</span>
          {" · "}4 strategies run in parallel (SmartMoney, Wyckoff, ElliottWave, Harmonic)
        </p>
      </div>

      {/* Strategies */}
      <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px", fontFamily: "var(--font-mono)" }}>Strategies</p>
        {Object.entries(config.strategies).map(([name, active]) => (
          <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-display,sans-serif)" }}>{name}</span>
              {name === "chartSignal" && (
                <span style={{ marginLeft: 7, fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)" }}>→ 4-framework parallel analysis</span>
              )}
            </div>
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

      {/* Demo data seed */}
      <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(167,139,250,0.2)" }}>
        <p style={{ fontSize: 10, color: "#a78bfa", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 6px", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
          Demo Mode
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0 0 10px", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
          Seeds your account with realistic mock data — open/closed positions, pending approvals
          with sparkline charts, 3× ETH confluence run, RAG memories, and yield opportunities.
          Safe to re-run; previous demo data is cleared first.
        </p>
        <button
          onClick={runSeed}
          disabled={seeding}
          style={{
            width: "100%", padding: "9px 0", borderRadius: 8, border: "1px solid rgba(167,139,250,0.4)",
            background: seeding ? "rgba(167,139,250,0.08)" : "rgba(167,139,250,0.12)",
            color: seeding ? "rgba(255,255,255,0.3)" : "#a78bfa",
            fontSize: 12, fontWeight: 700, cursor: seeding ? "not-allowed" : "pointer",
            fontFamily: "var(--font-display,sans-serif)", transition: "all 0.15s",
          }}
        >
          {seeding ? "Seeding…" : "⬡ Load Demo Data"}
        </button>
        {seedDone && (
          <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 7, background: "rgba(0,229,160,0.06)", border: "1px solid rgba(0,229,160,0.2)" }}>
            <p style={{ fontSize: 10, color: "#00e5a0", margin: 0, fontFamily: "var(--font-mono)", fontWeight: 700 }}>✓ Demo data loaded — switch tabs to explore</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", marginTop: 5 }}>
              {Object.entries(seedDone).map(([k, v]) => (
                <span key={k} style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-mono)" }}>
                  {k}: <span style={{ color: "#00e5a0" }}>{v}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Build a ChartSnapshot from position fields for MiniChart ──────────────────

function positionSnapshot(pos: Position) {
  if (!pos.stopLossPrice || !pos.takeProfitPrice) return null;
  const zoneAvg = ((pos.entryZoneLow ?? 0) + (pos.entryZoneHigh ?? 0)) / 2;
  const mid = pos.entryPrice ?? (zoneAvg > 0 ? zoneAvg : pos.stopLossPrice * 1.02);
  return {
    symbol:           pos.tokenOut,
    binanceSymbol:    `${pos.tokenOut}USDT`,
    framework:        pos.framework ?? "chartSignal",
    snapshotAt:       pos.entryAt,
    entryZone:        { low: pos.entryZoneLow ?? mid * 0.997, high: pos.entryZoneHigh ?? mid },
    stopLoss:         pos.stopLossPrice,
    takeProfitLevels: [pos.takeProfitPrice],
    confidence:       pos.confidence ?? 0,
    overlays:         { supportResistance: [], trendlines: [] },
  } as import("@/services/agent.service.frontend").ChartSnapshot;
}

// ── POSITIONS TAB ─────────────────────────────────────────────────────────────

function PositionsTab({ accentColor }: { accentColor: string }) {
  const [positions,      setPositions]      = useState<Position[]>([]);
  const [pnl,            setPnl]            = useState<PnlSummary | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [livePrices,     setLivePrices]     = useState<Record<string, number>>({});
  const [fundingRates,   setFundingRates]   = useState<Record<string, number>>({});
  const [trailInputs,    setTrailInputs]    = useState<Record<string, string>>({});
  const [updatingSl,     setUpdatingSl]     = useState<Record<string, boolean>>({});
  const [partialExiting, setPartialExiting] = useState<Record<string, boolean>>({});
  const [closingPos,     setClosingPos]     = useState<Record<string, boolean>>({});
  const pnlColor = (v: number) => v >= 0 ? "#00e5a0" : "#ff5572";

  const reloadPositions = useCallback(async () => {
    try {
      const [pos, summary] = await Promise.all([
        apiClient.get<{ positions: Position[]; count: number }>("/positions?limit=30"),
        apiClient.get<PnlSummary>("/positions/pnl/summary"),
      ]);
      setPositions(pos.positions ?? []);
      setPnl(summary);
    } catch {}
  }, []);

  useEffect(() => {
    reloadPositions().finally(() => setLoading(false));
  }, [reloadPositions]);

  // Live price feed — poll Binance for every open position symbol every 10s
  useEffect(() => {
    const openSymbols = [...new Set(
      positions.filter(p => (p.status ?? (p.isOpen ? "open" : "closed")) === "open" && p.entryPrice).map(p => p.tokenOut)
    )];
    if (!openSymbols.length) return;
    const fetchPrices = async () => {
      const prices: Record<string, number> = {};
      await Promise.all(openSymbols.map(async sym => {
        try {
          const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}USDT`);
          const d = await r.json() as { price: string };
          const p = parseFloat(d.price);
          if (isFinite(p) && p > 0) prices[sym] = p;
        } catch {}
      }));
      setLivePrices(prices);
    };
    fetchPrices();
    const id = setInterval(fetchPrices, 10_000);
    return () => clearInterval(id);
  }, [positions]);

  // Funding rate fetch — Binance perp market context for open positions
  useEffect(() => {
    const syms = [...new Set(positions.filter(p => p.isOpen).map(p => p.tokenOut))];
    if (!syms.length) return;
    const fetch = async () => {
      const rates: Record<string, number> = {};
      await Promise.all(syms.map(async sym => {
        try {
          const r = await window.fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}USDT`);
          if (!r.ok) return;
          const d = await r.json() as { lastFundingRate: string };
          rates[sym] = parseFloat(d.lastFundingRate) * 100;
        } catch {}
      }));
      setFundingRates(rates);
    };
    fetch();
    const id = setInterval(fetch, 60_000);
    return () => clearInterval(id);
  }, [positions]);

  // Portfolio heat — total open notional + at-risk $ from SL distance
  const portfolioHeat = (() => {
    const open = positions.filter(p => p.isOpen);
    let totalNotional = 0, totalAtRisk = 0;
    for (const p of open) {
      totalNotional += p.entryAmountUsd;
      if (p.stopLossPrice && p.entryPrice && p.entryPrice > p.stopLossPrice) {
        totalAtRisk += p.entryAmountUsd * ((p.entryPrice - p.stopLossPrice) / p.entryPrice);
      }
    }
    return { totalNotional, totalAtRisk, posCount: open.length };
  })();

  // BTC benchmark — compare agent P&L % to holding BTC over same window
  const [btcBenchmark, setBtcBenchmark] = useState<{ btcReturnPct: number; agentReturnPct: number; firstTradeDate: string } | null>(null);
  useEffect(() => {
    const closed = positions.filter(p => p.status === "closed" && p.entryAt);
    if (!closed.length) return;
    const firstTrade = closed.slice().sort((a, b) => new Date(a.entryAt).getTime() - new Date(b.entryAt).getTime())[0];
    const firstDate  = new Date(firstTrade.entryAt);
    const startTs    = Math.floor(firstDate.getTime() / 1000);
    const endTs      = Math.floor(Date.now() / 1000);
    const INITIAL    = 10_000;
    const totalPnl   = closed.reduce((s, p) => s + (p.realizedPnlUsd ?? 0), 0);
    const agentReturnPct = totalPnl / INITIAL * 100;
    fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime=${startTs * 1000}&limit=1`)
      .then(r => r.json())
      .then((klines: number[][]) => {
        if (!klines?.length) return;
        const btcStart = parseFloat(String(klines[0][1])); // open of first candle
        return fetch(`https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT`)
          .then(r => r.json())
          .then((d: { price: string }) => {
            const btcNow = parseFloat(d.price);
            const btcReturnPct = btcStart > 0 ? (btcNow - btcStart) / btcStart * 100 : 0;
            setBtcBenchmark({ btcReturnPct, agentReturnPct, firstTradeDate: firstDate.toLocaleDateString() });
          });
      }).catch(() => {});
  }, [positions]);

  // Advanced stats: E(V), Profit Factor, Sharpe, Kelly
  const advancedStats = (() => {
    const closed = positions.filter(p => p.status === "closed" && p.realizedPnlUsd !== undefined);
    if (!closed.length) return null;
    const wins   = closed.filter(p => (p.realizedPnlUsd ?? 0) > 0);
    const losses = closed.filter(p => (p.realizedPnlUsd ?? 0) < 0);
    const grossWin  = wins.reduce((s, p)  => s + (p.realizedPnlUsd ?? 0), 0);
    const grossLoss = losses.reduce((s, p) => s + (p.realizedPnlUsd ?? 0), 0);
    const avgWin   = wins.length   > 0 ? grossWin  / wins.length  : 0;
    const avgLoss  = losses.length > 0 ? Math.abs(grossLoss / losses.length) : 0;
    const winRate  = closed.length > 0 ? wins.length / closed.length : 0;
    const ev       = winRate * avgWin - (1 - winRate) * avgLoss;
    const pf       = grossLoss < 0 ? grossWin / Math.abs(grossLoss) : null;
    // Kelly criterion: f* = W - (1-W)/R  where R = avgWin/avgLoss
    const rr     = avgLoss > 0 ? avgWin / avgLoss : 0;
    const kelly  = rr > 0 ? winRate - (1 - winRate) / rr : null;
    // Simple Sharpe: mean PnL / std dev of PnL per trade
    const pnls     = closed.map(p => p.realizedPnlUsd ?? 0);
    const mean     = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    const variance = pnls.reduce((a, b) => a + (b - mean) ** 2, 0) / pnls.length;
    const sharpe   = variance > 0 ? mean / Math.sqrt(variance) : null;
    return { ev, pf, sharpe, kelly };
  })();

  // Confidence calibration: group closed positions by confidence bucket → win rate
  const confCalibration = (() => {
    const closed = positions.filter(p => p.status === "closed" && p.confidence !== undefined);
    if (closed.length < 3) return null;
    const buckets: Record<string, {wins: number; total: number}> = { "50-64": {wins:0,total:0}, "65-74": {wins:0,total:0}, "75-84": {wins:0,total:0}, "85+": {wins:0,total:0} };
    for (const p of closed) {
      const c = p.confidence!;
      const key = c >= 85 ? "85+" : c >= 75 ? "75-84" : c >= 65 ? "65-74" : "50-64";
      buckets[key].total++;
      if ((p.realizedPnlUsd ?? 0) > 0) buckets[key].wins++;
    }
    return Object.entries(buckets).filter(([, v]) => v.total > 0).map(([range, v]) => ({
      range, winRate: Math.round(v.wins / v.total * 100), total: v.total,
    }));
  })();

  // Strategy performance breakdown by framework
  const strategyPerf = (() => {
    const closed = positions.filter(p => p.status === "closed" && p.framework);
    const byFw: Record<string, { wins: number; losses: number; totalPnl: number }> = {};
    for (const p of closed) {
      const fw = p.framework!;
      if (!byFw[fw]) byFw[fw] = { wins: 0, losses: 0, totalPnl: 0 };
      const v = p.realizedPnlUsd ?? 0;
      byFw[fw].totalPnl += v;
      if (v > 0) byFw[fw].wins++; else byFw[fw].losses++;
    }
    return Object.entries(byFw).map(([fw, s]) => ({
      framework: fw, ...s,
      winRate: s.wins + s.losses > 0 ? Math.round(s.wins / (s.wins + s.losses) * 100) : 0,
    })).sort((a, b) => b.totalPnl - a.totalPnl);
  })();

  // Per-coin P&L breakdown
  const coinPerf = (() => {
    const closed = positions.filter(p => p.status === "closed");
    const byCoin: Record<string, { wins: number; losses: number; totalPnl: number; trades: number }> = {};
    for (const p of closed) {
      const coin = p.tokenOut;
      if (!byCoin[coin]) byCoin[coin] = { wins: 0, losses: 0, totalPnl: 0, trades: 0 };
      const v = p.realizedPnlUsd ?? 0;
      byCoin[coin].totalPnl += v;
      byCoin[coin].trades++;
      if (v > 0) byCoin[coin].wins++; else byCoin[coin].losses++;
    }
    return Object.entries(byCoin)
      .map(([coin, s]) => ({ coin, ...s, winRate: s.trades > 0 ? Math.round(s.wins / s.trades * 100) : 0 }))
      .sort((a, b) => b.totalPnl - a.totalPnl);
  })();

  // Drawdown / risk stats from closed position history
  const riskStats = (() => {
    const closed = positions
      .filter(p => p.status === "closed" && p.realizedPnlUsd !== undefined)
      .sort((a, b) => new Date(a.exitAt ?? a.entryAt).getTime() - new Date(b.exitAt ?? b.entryAt).getTime());
    let peak = 0, equity = 0, maxDrawdown = 0, maxDrawdownPct = 0, worstLoss = 0, streak = 0, maxStreak = 0;
    for (const p of closed) {
      const v = p.realizedPnlUsd ?? 0;
      equity += v;
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? peak - equity : 0;
      const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
      if (dd > maxDrawdown) { maxDrawdown = dd; maxDrawdownPct = ddPct; }
      if (v < 0) { streak++; if (streak > maxStreak) maxStreak = streak; if (v < worstLoss) worstLoss = v; }
      else streak = 0;
    }
    return { maxDrawdown, maxDrawdownPct, worstLoss, maxStreak };
  })();

  const moveToBreakeven = async (pos: Position) => {
    if (!pos.entryPrice) return;
    setUpdatingSl(prev => ({ ...prev, [pos.positionId]: true }));
    try { await apiClient.patch(`/positions/${pos.positionId}`, { stopLossPrice: pos.entryPrice }); await reloadPositions(); }
    catch {} finally { setUpdatingSl(prev => ({ ...prev, [pos.positionId]: false })); }
  };

  // Server-side trailing stop — stores pct in DB; monitor ratchets SL as price rises
  const applyTrailing = async (pos: Position) => {
    const pct = parseFloat(trailInputs[pos.positionId] ?? "");
    const cur = livePrices[pos.tokenOut];
    if (!isFinite(pct) || pct <= 0 || pct > 20) return;
    setUpdatingSl(prev => ({ ...prev, [pos.positionId]: true }));
    try {
      // Set initial SL from current price + store trailingStopPct for server monitor
      const updates: Record<string, number> = { trailingStopPct: pct };
      if (cur) updates.stopLossPrice = parseFloat((cur * (1 - pct / 100)).toFixed(2));
      await apiClient.patch(`/positions/${pos.positionId}`, updates);
      await reloadPositions();
    }
    catch {} finally { setUpdatingSl(prev => ({ ...prev, [pos.positionId]: false })); }
  };

  const partialExit = async (pos: Position, pct: number) => {
    setPartialExiting(prev => ({ ...prev, [pos.positionId]: true }));
    try { await apiClient.post(`/positions/${pos.positionId}/partial-exit`, { exitPercent: pct }); await reloadPositions(); }
    catch {} finally { setPartialExiting(prev => ({ ...prev, [pos.positionId]: false })); }
  };

  const closeAtMarket = async (pos: Position) => {
    if (!window.confirm(`Close ${pos.tokenOut} position at market? This cannot be undone.`)) return;
    setClosingPos(prev => ({ ...prev, [pos.positionId]: true }));
    try { await apiClient.post(`/positions/${pos.positionId}/close`, {}); await reloadPositions(); }
    catch {} finally { setClosingPos(prev => ({ ...prev, [pos.positionId]: false })); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {pnl && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
            {[
              { label: "Total PnL", val: `${pnl.totalPnlUsd >= 0 ? "+" : ""}$${pnl.totalPnlUsd.toFixed(2)}`, color: pnlColor(pnl.totalPnlUsd) },
              { label: "Win Rate",  val: pnl.winRate !== null ? `${pnl.winRate}%` : "—",                        color: "rgba(255,255,255,0.7)" },
              { label: "Open",      val: String(pnl.openPositions),                                              color: accentColor },
              { label: "Trades",    val: String(pnl.totalTrades),                                                color: "rgba(255,255,255,0.7)" },
            ].map(s => (
              <div key={s.label} style={{ padding: "10px 8px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: s.color, margin: "0 0 2px", fontFamily: "var(--font-mono)" }}>{s.val}</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
              </div>
            ))}
          </div>
          {/* Portfolio heat — open exposure */}
          {portfolioHeat.posCount > 0 && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: `1px solid ${portfolioHeat.totalAtRisk > 50 ? "rgba(255,85,114,0.2)" : "rgba(255,176,32,0.15)"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>Portfolio Heat · {portfolioHeat.posCount} Open</span>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, color: portfolioHeat.totalAtRisk > 50 ? "#ff5572" : "#ffb020" }}>
                  ${portfolioHeat.totalAtRisk.toFixed(2)} at risk
                </span>
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.35)" }}>
                  Notional <span style={{ color: "rgba(255,255,255,0.65)" }}>${portfolioHeat.totalNotional.toFixed(2)}</span>
                </span>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.35)" }}>
                  Max simultaneous loss <span style={{ color: "#ff5572" }}>-${portfolioHeat.totalAtRisk.toFixed(2)}</span>
                </span>
              </div>
            </div>
          )}

          {/* BTC benchmark */}
          {btcBenchmark && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>vs BTC Hold · since {btcBenchmark.firstTradeDate}</span>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: btcBenchmark.agentReturnPct >= btcBenchmark.btcReturnPct ? "#00e5a0" : "#ff5572", fontWeight: 700 }}>
                  {btcBenchmark.agentReturnPct >= btcBenchmark.btcReturnPct ? "▲ Beating BTC" : "▼ Underperforming"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                <div>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", margin: "0 0 2px", textTransform: "uppercase" }}>Agent</p>
                  <p style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", margin: 0, color: pnlColor(btcBenchmark.agentReturnPct) }}>
                    {btcBenchmark.agentReturnPct >= 0 ? "+" : ""}{btcBenchmark.agentReturnPct.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", margin: "0 0 2px", textTransform: "uppercase" }}>BTC Hold</p>
                  <p style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", margin: 0, color: pnlColor(btcBenchmark.btcReturnPct) }}>
                    {btcBenchmark.btcReturnPct >= 0 ? "+" : ""}{btcBenchmark.btcReturnPct.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", margin: "0 0 2px", textTransform: "uppercase" }}>Alpha</p>
                  <p style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", margin: 0, color: pnlColor(btcBenchmark.agentReturnPct - btcBenchmark.btcReturnPct) }}>
                    {(btcBenchmark.agentReturnPct - btcBenchmark.btcReturnPct) >= 0 ? "+" : ""}{(btcBenchmark.agentReturnPct - btcBenchmark.btcReturnPct).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Advanced stats: E(V), Profit Factor, Sharpe, Kelly */}
          {advancedStats && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {[
                { label: "Exp. Value / Trade", val: `${advancedStats.ev >= 0 ? "+" : ""}$${advancedStats.ev.toFixed(2)}`, color: advancedStats.ev > 0 ? "#00e5a0" : "#ff5572" },
                { label: "Profit Factor",      val: advancedStats.pf !== null ? advancedStats.pf.toFixed(2) + "×" : "—",  color: (advancedStats.pf ?? 0) >= 1.5 ? "#00e5a0" : (advancedStats.pf ?? 0) >= 1 ? "#ffb020" : "#ff5572" },
                { label: "Info Ratio (per trade)", val: advancedStats.sharpe !== null ? advancedStats.sharpe.toFixed(2) : "—", color: (advancedStats.sharpe ?? 0) > 0.5 ? "#00e5a0" : (advancedStats.sharpe ?? 0) > 0 ? "#ffb020" : "#ff5572",
                  tip: "Mean P&L / Std Dev P&L per trade — not annualised Sharpe. Needs 20+ trades to be meaningful." },
                { label: "Kelly %",            val: advancedStats.kelly !== null ? `${(advancedStats.kelly * 100).toFixed(1)}%` : "—", color: (advancedStats.kelly ?? 0) > 0.05 ? "#00e5a0" : (advancedStats.kelly ?? 0) > 0 ? "#ffb020" : "#ff5572",
                  tip: "Optimal bet size per Kelly criterion — use half-Kelly (÷2) in practice" },
              ].map(s => (
                <div key={s.label} title={"tip" in s ? s.tip : undefined} style={{ padding: "8px 6px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center", cursor: "tip" in s ? "help" : "default" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: s.color, margin: "0 0 2px", fontFamily: "var(--font-mono)" }}>{s.val}</p>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Risk stats row — drawdown, worst loss, loss streak */}
          {positions.some(p => p.status === "closed") && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
              {[
                { label: "Max Drawdown", val: riskStats.maxDrawdown > 0 ? `-$${riskStats.maxDrawdown.toFixed(2)}` : "—", color: riskStats.maxDrawdown > 0 ? "#ff5572" : "rgba(255,255,255,0.3)" },
                { label: "Worst Loss",   val: riskStats.worstLoss  < 0 ? `$${riskStats.worstLoss.toFixed(2)}`   : "—",  color: riskStats.worstLoss  < 0 ? "#ff5572" : "rgba(255,255,255,0.3)" },
                { label: "Loss Streak",  val: riskStats.maxStreak  > 0 ? String(riskStats.maxStreak)            : "—",  color: riskStats.maxStreak  > 0 ? "#ffb020" : "rgba(255,255,255,0.3)" },
              ].map(s => (
                <div key={s.label} style={{ padding: "8px 6px", borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,85,114,0.1)", textAlign: "center" }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: s.color, margin: "0 0 2px", fontFamily: "var(--font-mono)" }}>{s.val}</p>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Strategy performance breakdown by framework */}
          {strategyPerf.length > 0 && (
            <div style={{ borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.06)", padding: "10px 12px" }}>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Strategy P&L by Framework</p>
              {strategyPerf.map(s => (
                <div key={s.framework} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", width: 90, flexShrink: 0, fontFamily: "var(--font-mono)" }}>{s.framework}</span>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: s.winRate >= 60 ? "#00e5a0" : s.winRate >= 40 ? "#ffb020" : "#ff5572", width: 38 }}>{s.winRate}% WR</span>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.3)", width: 42 }}>{s.wins}W/{s.losses}L</span>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, Math.abs(s.totalPnl) / 5)}%`, background: s.totalPnl >= 0 ? "#00e5a0" : "#ff5572", borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, color: pnlColor(s.totalPnl), width: 56, textAlign: "right" }}>
                    {s.totalPnl >= 0 ? "+" : ""}${s.totalPnl.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Per-coin P&L breakdown */}
          {coinPerf.length > 0 && (
            <div style={{ borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.06)", padding: "10px 12px" }}>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>P&L by Coin</p>
              {coinPerf.map(s => (
                <div key={s.coin} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.6)", width: 44, flexShrink: 0 }}>{s.coin}</span>
                  <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.2)", width: 32 }}>{s.trades}t</span>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: s.winRate >= 60 ? "#00e5a0" : s.winRate >= 40 ? "#ffb020" : "#ff5572", width: 38 }}>{s.winRate}% WR</span>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, Math.abs(s.totalPnl) / 3)}%`, background: s.totalPnl >= 0 ? "#00e5a0" : "#ff5572", borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, color: pnlColor(s.totalPnl), width: 60, textAlign: "right" }}>
                    {s.totalPnl >= 0 ? "+" : ""}${s.totalPnl.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Confidence calibration: are high-confidence signals actually more accurate? */}
          {confCalibration && confCalibration.length >= 2 && (
            <div style={{ borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.06)", padding: "10px 12px" }}>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Confidence Calibration</p>
              {confCalibration.map(b => (
                <div key={b.range} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.4)", width: 46 }}>{b.range}%</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${b.winRate}%`, background: b.winRate >= 60 ? "#00e5a0" : b.winRate >= 40 ? "#ffb020" : "#ff5572", borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: b.winRate >= 60 ? "#00e5a0" : b.winRate >= 40 ? "#ffb020" : "#ff5572", width: 48 }}>{b.winRate}% WR</span>
                  <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.2)", width: 28 }}>n={b.total}</span>
                </div>
              ))}
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", margin: "6px 0 0", fontFamily: "var(--font-mono)" }}>If high-conf ≠ high WR, the confidence score is uncalibrated</p>
            </div>
          )}
        </>
      )}

      {loading && positions.length === 0 && <EmptyMsg msg="Loading…" />}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {positions.map(pos => {
          const status      = pos.status ?? (pos.isOpen ? "open" : "closed");
          const isOpen      = status === "open";
          const isPending   = status === "pending";
          const badge = {
            pending:   { label: "Pending",   color: "#ffb020" },
            open:      { label: "Open",       color: accentColor },
            closed:    { label: "Closed",     color: "rgba(255,255,255,0.25)" },
            cancelled: { label: "Cancelled",  color: "#ff5572" },
          }[status];
          const closeReason = status === "closed" && pos.exitPrice !== undefined
            ? pos.stopLossPrice   !== undefined && pos.exitPrice <= pos.stopLossPrice   * 1.001 ? "sl_triggered"
            : pos.takeProfitPrice !== undefined && pos.exitPrice >= pos.takeProfitPrice * 0.999 ? "tp_hit"
            : "closed"
            : null;

          // Live data for open positions
          const livePrice   = isOpen && pos.entryPrice ? livePrices[pos.tokenOut] : undefined;
          const livePct     = livePrice && pos.entryPrice ? ((livePrice - pos.entryPrice) / pos.entryPrice) * 100 : undefined;
          const livePnlUsd  = livePct !== undefined ? (livePct / 100) * pos.entryAmountUsd : undefined;
          const nearSl      = livePrice && pos.stopLossPrice   ? livePrice <= pos.stopLossPrice   * 1.02 : false;
          const nearTp      = livePrice && pos.takeProfitPrice ? livePrice >= pos.takeProfitPrice * 0.98 : false;

          // R:R ratio
          const rrRatio = pos.stopLossPrice && pos.takeProfitPrice && pos.entryPrice ? (() => {
            const risk   = pos.entryPrice - pos.stopLossPrice;
            const reward = pos.takeProfitPrice - pos.entryPrice;
            return risk > 0 ? (reward / risk) : null;
          })() : null;

          return (
            <div key={pos.positionId} style={{
              padding: "11px 12px", borderRadius: 10, background: "rgb(8,18,32)",
              border: `1px solid ${isOpen ? (nearSl ? "#ff557240" : nearTp ? "#00e5a040" : accentColor + "25") : isPending ? "#ffb02033" : closeReason === "sl_triggered" ? "#ff557222" : closeReason === "tp_hit" ? "#00e5a022" : "rgba(255,255,255,0.07)"}`,
              boxShadow: nearSl ? "0 0 14px rgba(255,85,114,0.07)" : nearTp ? "0 0 14px rgba(0,229,160,0.07)" : "none",
            }}>
              {/* Row 1: pair name + close reason + proximity alerts + status badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-display,sans-serif)" }}>
                  {pos.tokenIn} → {pos.tokenOut}
                </span>
                {closeReason === "sl_triggered" && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#ff5572", background: "#ff557218", border: "1px solid #ff557230", padding: "2px 7px", borderRadius: 5 }}>⚡ SL Auto-closed</span>
                )}
                {closeReason === "tp_hit" && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#00e5a0", background: "#00e5a018", border: "1px solid #00e5a030", padding: "2px 7px", borderRadius: 5 }}>✓ TP Hit</span>
                )}
                {nearSl && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#ff5572", background: "#ff557218", border: "1px solid #ff557240", padding: "2px 7px", borderRadius: 5 }}>⚠ Near SL</span>
                )}
                {nearTp && !nearSl && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#00e5a0", background: "#00e5a018", border: "1px solid #00e5a040", padding: "2px 7px", borderRadius: 5 }}>⬆ Near TP</span>
                )}
                <span style={{ fontSize: 11, fontWeight: 700, color: badge.color, background: `${badge.color}1f`, padding: "2px 7px", borderRadius: 5, marginLeft: "auto" }}>
                  {badge.label}
                </span>
              </div>

              {/* Row 2: amount / price / realized P&L */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono)" }}>
                  {isPending
                    ? `$${pos.entryAmountUsd.toFixed(2)} · limit${pos.entryZoneLow !== undefined && pos.entryZoneHigh !== undefined ? ` @ $${pos.entryZoneLow.toFixed(2)}–$${pos.entryZoneHigh.toFixed(2)}` : ""}`
                    : `$${pos.entryAmountUsd.toFixed(2)}${pos.entryPrice !== undefined ? ` @ $${pos.entryPrice.toFixed(4)}` : ""}`}
                </span>
                {status === "closed" && pos.exitPrice !== undefined && pos.entryPrice !== undefined && (
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.3)" }}>
                    <span style={{ color: "rgba(255,255,255,0.45)" }}>${pos.entryPrice.toFixed(4)}</span>
                    {" → "}
                    <span style={{ color: pnlColor(pos.exitPrice - pos.entryPrice) }}>${pos.exitPrice.toFixed(4)}</span>
                  </span>
                )}
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

              {/* Row 3: strategy meta */}
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "5px 0 0", fontFamily: "var(--font-mono)" }}>
                {pos.strategy}{pos.framework ? ` · ${pos.framework}` : ""}{pos.confidence !== undefined ? ` · ${pos.confidence}% conf` : ""}
                {" · "}{new Date(pos.entryAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                {pos.exitAt && <span> → {new Date(pos.exitAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>}
              </p>

              {/* Row 4: SL / TP / R:R */}
              {(pos.stopLossPrice !== undefined || pos.takeProfitPrice !== undefined) && (
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "3px 0 0", fontFamily: "var(--font-mono)" }}>
                  {pos.stopLossPrice   !== undefined && <span style={{ color: closeReason === "sl_triggered" ? "#ff5572" : "rgba(255,85,114,0.6)" }}>SL ${pos.stopLossPrice.toFixed(2)}</span>}
                  {pos.stopLossPrice   !== undefined && pos.takeProfitPrice !== undefined && "  ·  "}
                  {pos.takeProfitPrice !== undefined && <span style={{ color: closeReason === "tp_hit" ? "#00e5a0" : "rgba(0,229,160,0.6)" }}>TP ${pos.takeProfitPrice.toFixed(2)}</span>}
                  {rrRatio !== null && (
                    <span style={{ marginLeft: 10, color: rrRatio >= 2 ? "rgba(0,229,160,0.55)" : rrRatio >= 1 ? "rgba(255,176,32,0.55)" : "rgba(255,85,114,0.55)" }}>
                      R:R 1:{rrRatio.toFixed(1)}
                    </span>
                  )}
                </p>
              )}

              {/* ── Live P&L block (open positions with a live price) ── */}
              {isOpen && livePrice && livePct !== undefined && livePnlUsd !== undefined && (
                <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: livePct >= 0 ? "#00e5a00a" : "#ff55720a", border: `1px solid ${livePct >= 0 ? "#00e5a020" : "#ff557220"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono)" }}>
                      ${(pos.entryPrice ?? 0).toLocaleString()} → <span style={{ color: livePct >= 0 ? "#00e5a0" : "#ff5572", fontWeight: 700 }}>${livePrice.toLocaleString()}</span>
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: livePct >= 0 ? "#00e5a0" : "#ff5572", fontFamily: "var(--font-mono)" }}>
                      {livePnlUsd >= 0 ? "+" : ""}${livePnlUsd.toFixed(2)} · {livePct >= 0 ? "+" : ""}{livePct.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                    {pos.stopLossPrice && (
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: nearSl ? "#ff5572" : "rgba(255,85,114,0.55)" }}>
                        SL {(((pos.stopLossPrice - livePrice) / livePrice) * 100).toFixed(2)}% away
                      </span>
                    )}
                    {pos.takeProfitPrice && (
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: nearTp ? "#00e5a0" : "rgba(0,229,160,0.55)" }}>
                        TP {(((pos.takeProfitPrice - livePrice) / livePrice) * 100).toFixed(2)}% away
                      </span>
                    )}
                    {pos.trailingStopPct && (
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#ffb020" }}>
                        ⟳ trail {pos.trailingStopPct}%{pos.highWaterMarkPrice ? ` · HWM $${pos.highWaterMarkPrice.toLocaleString()}` : ""}
                      </span>
                    )}
                    {fundingRates[pos.tokenOut] !== undefined && (
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", marginLeft: "auto", color: fundingRates[pos.tokenOut] > 0 ? "rgba(255,85,114,0.6)" : "rgba(0,229,160,0.6)" }}
                        title="Perp funding rate (8h). Positive = longs pay shorts.">
                        funding {fundingRates[pos.tokenOut] > 0 ? "+" : ""}{fundingRates[pos.tokenOut].toFixed(4)}%
                      </span>
                    )}
                  </div>
                  {/* Partial exit + Close at market */}
                  <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", alignSelf: "center", textTransform: "uppercase", letterSpacing: "0.05em" }}>Exit partial:</span>
                    {[25, 50, 75].map(pct => (
                      <button key={pct}
                        onClick={() => partialExit(pos, pct)}
                        disabled={!!partialExiting[pos.positionId]}
                        style={{
                          padding: "3px 9px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.1)",
                          background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)",
                          fontSize: 10, fontFamily: "var(--font-mono)", cursor: "pointer",
                          opacity: partialExiting[pos.positionId] ? 0.4 : 1,
                        }}
                      >
                        {partialExiting[pos.positionId] ? "…" : `${pct}%`}
                      </button>
                    ))}
                    <button
                      onClick={() => closeAtMarket(pos)}
                      disabled={!!closingPos[pos.positionId]}
                      style={{
                        marginLeft: "auto", padding: "3px 10px", borderRadius: 5,
                        border: "1px solid rgba(255,85,114,0.35)",
                        background: "rgba(255,85,114,0.08)", color: "#ff5572",
                        fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)", cursor: "pointer",
                        opacity: closingPos[pos.positionId] ? 0.4 : 1,
                      }}
                    >
                      {closingPos[pos.positionId] ? "Closing…" : "✕ Close Now"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── SL management controls (open positions only) ── */}
              {isOpen && pos.entryPrice && (
                <div style={{ marginTop: 7, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => moveToBreakeven(pos)}
                    disabled={!!updatingSl[pos.positionId]}
                    style={{
                      padding: "5px 10px", borderRadius: 6, border: "1px solid #ffb02040",
                      background: "#ffb02010", color: "#ffb020", fontSize: 10,
                      fontFamily: "var(--font-mono)", cursor: updatingSl[pos.positionId] ? "not-allowed" : "pointer",
                      fontWeight: 700, opacity: updatingSl[pos.positionId] ? 0.5 : 1,
                    }}
                  >
                    {updatingSl[pos.positionId] ? "…" : "Move SL → BE"}
                  </button>
                  <input
                    type="number" min="0.1" max="20" step="0.1"
                    placeholder="Trail %"
                    value={trailInputs[pos.positionId] ?? ""}
                    onChange={e => setTrailInputs(prev => ({ ...prev, [pos.positionId]: e.target.value }))}
                    style={{
                      width: 62, padding: "4px 7px", borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.65)",
                      fontSize: 11, fontFamily: "var(--font-mono)", outline: "none",
                    }}
                  />
                  <button
                    onClick={() => applyTrailing(pos)}
                    disabled={!!updatingSl[pos.positionId] || !trailInputs[pos.positionId]}
                    style={{
                      padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)",
                      fontSize: 10, fontFamily: "var(--font-mono)", cursor: "pointer",
                      opacity: !trailInputs[pos.positionId] ? 0.35 : 1,
                    }}
                  >
                    Set Trail
                  </button>
                </div>
              )}

              {/* Chart */}
              {(() => {
                const snap = positionSnapshot(pos);
                if (!snap) return null;
                return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.25)", marginBottom: 3, display: "flex", justifyContent: "space-between" }}>
                      <span>{snap.binanceSymbol} · 1D</span>
                      <span style={{ color: "rgba(255,255,255,0.15)" }}>click to expand</span>
                    </div>
                    <MiniChart snapshot={snap} defaultTimeframe="1d" />
                  </div>
                );
              })()}
            </div>
          );
        })}
        {!loading && positions.length === 0 && <EmptyMsg msg="No positions yet — run the agent loop first." />}

        {/* ── Trade Journal: closed trades log ── */}
        {positions.filter(p => p.status === "closed").length > 0 && (
          <div style={{ borderRadius: 10, background: "rgb(8,18,32)", border: "1px solid rgba(255,255,255,0.06)", padding: "10px 12px", marginTop: 4 }}>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Trade Journal</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {positions.filter(p => p.status === "closed").slice(0, 10).map(p => {
                const won      = (p.realizedPnlUsd ?? 0) > 0;
                const durationMs = p.exitAt && p.entryAt ? new Date(p.exitAt).getTime() - new Date(p.entryAt).getTime() : null;
                const durationH  = durationMs ? durationMs / 3_600_000 : null;
                const pnl        = p.realizedPnlUsd ?? 0;
                const pnlPct     = p.entryAmountUsd > 0 ? pnl / p.entryAmountUsd * 100 : 0;
                return (
                  <div key={p.positionId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: won ? "#00e5a0" : "#ff5572", flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.5)", width: 36, flexShrink: 0 }}>{p.tokenOut}</span>
                    <span style={{ fontSize: 9, color: p.framework ? "#a78bfa" : "rgba(255,255,255,0.2)", width: 78, flexShrink: 0, fontFamily: "var(--font-mono)" }}>{p.framework ?? p.strategy}</span>
                    <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.2)", flex: 1 }}>
                      {new Date(p.entryAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      {durationH !== null && ` · ${durationH < 24 ? durationH.toFixed(0) + "h" : (durationH / 24).toFixed(1) + "d"}`}
                    </span>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, color: pnlColor(pnl), textAlign: "right", minWidth: 60 }}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} <span style={{ fontSize: 9, fontWeight: 400, color: "rgba(255,255,255,0.25)" }}>({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SIGNALS TAB ───────────────────────────────────────────────────────────────

function SignalsTab({ accentColor }: { accentColor: string }) {
  const [opps,    setOpps]    = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<Record<string, boolean>>({});

  const reload = useCallback(async () => {
    try { const d = await apiClient.get<{ opportunities: Opportunity[]; count: number }>("/opportunities?limit=30"); setOpps(d.opportunities ?? []); }
    catch {}
  }, []);

  useEffect(() => { reload().finally(() => setLoading(false)); }, [reload]);

  const deploy = async (opp: Opportunity) => {
    setActing(prev => ({ ...prev, [opp.opportunityId]: true }));
    try { await apiClient.post(`/opportunities/${opp.opportunityId}/act`, { actionTaken: "capital_deployed" }); await reload(); }
    catch {} finally { setActing(prev => ({ ...prev, [opp.opportunityId]: false })); }
  };

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
        const col      = typeColor[opp.type] ?? "#94a3b8";
        const isActing = acting[opp.opportunityId];
        return (
          <div key={opp.opportunityId} style={{ padding: "12px 12px", borderRadius: 10, background: "rgb(8,18,32)", border: `1px solid ${opp.acted ? col + "40" : col + "22"}` }}>
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
            <p style={{ fontFamily: "var(--font-display,sans-serif)", fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.45)", margin: "0 0 8px" }}>{opp.detail}</p>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
              {opp.protocol && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>{opp.protocol}</span>}
              {opp.chain    && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>{opp.chain}</span>}
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                {new Date(opp.detectedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 5, alignItems: "center" }}>
                {opp.acted ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: col, background: `${col}12`, border: `1px solid ${col}30`, padding: "3px 10px", borderRadius: 6, fontFamily: "var(--font-mono)" }}>
                    ✓ Deployed
                  </span>
                ) : (
                  <button
                    onClick={() => deploy(opp)}
                    disabled={isActing}
                    style={{
                      padding: "5px 12px", borderRadius: 6,
                      border: `1px solid ${col}50`, background: `${col}12`,
                      color: col, fontSize: 11, fontWeight: 700,
                      fontFamily: "var(--font-mono)", cursor: isActing ? "not-allowed" : "pointer",
                      opacity: isActing ? 0.5 : 1,
                    }}
                  >
                    {isActing ? "…" : "Deploy →"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {!loading && opps.length === 0 && <EmptyMsg msg="No active signals — agent will populate these on next tick." />}
    </div>
  );
}

// ── PROPOSALS TAB ────────────────────────────────────────────────────────────

const FW_COLOR: Record<StrategyFramework, string> = {
  SmartMoney:  "#36b6ff",
  Wyckoff:     "#a78bfa",
  ElliottWave: "#ffb020",
  Harmonic:    "#00e5a0",
};
const SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "AVAX"] as const;

function fmt2(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ProposalCard({
  card, runId, autoMode, onAction, accentColor,
}: {
  card: StrategyCard; runId: string; autoMode: boolean;
  onAction: () => void; accentColor: string;
}) {
  const [expanded,  setExpanded]  = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const fc = FW_COLOR[card.framework];

  const newsColor =
    card.newsImpact.verdict === "supports"    ? "#00e5a0" :
    card.newsImpact.verdict === "contradicts" ? "#ff5572" : "rgba(255,255,255,0.3)";

  const approve = async () => {
    setApproving(true);
    try { await coinAnalysisService.approveCard(runId, card.framework); onAction(); }
    catch {} finally { setApproving(false); }
  };
  const reject = async () => {
    setRejecting(true);
    try { await coinAnalysisService.rejectCard(runId, card.framework); onAction(); }
    catch {} finally { setRejecting(false); }
  };

  const statusChip = () => {
    if (card.approvalStatus === "auto_executed") return { label: "Auto-executed", color: "#36b6ff" };
    if (card.approvalStatus === "approved")      return { label: "Approved",      color: "#00e5a0" };
    if (card.approvalStatus === "rejected")      return { label: "Rejected",      color: "#ff5572" };
    if (card.approvalStatus === "skipped")       return { label: "Skipped",       color: "rgba(255,255,255,0.3)" };
    return null;
  };
  const sc = statusChip();

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${fc}25`, background: "rgb(4,10,18)", display: "flex", flexDirection: "column" }}>

      {/* Card header */}
      <div style={{ padding: "9px 12px", background: `${fc}10`, borderBottom: `1px solid ${fc}20`, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 800, color: fc }}>{card.framework}</span>
        {card.signal && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
            color: card.signal.confidence >= 65 ? "#00e5a0" : card.signal.confidence >= 45 ? "#ffb020" : "#ff5572",
            background: (card.signal.confidence >= 65 ? "#00e5a0" : card.signal.confidence >= 45 ? "#ffb020" : "#ff5572") + "18",
            border: `1px solid ${(card.signal.confidence >= 65 ? "#00e5a0" : card.signal.confidence >= 45 ? "#ffb020" : "#ff5572")}30`,
          }}>
            {card.signal.confidence}% conf
          </span>
        )}
        {card.newsImpact.verdict !== "neutral" && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: newsColor }}>
            {card.newsImpact.confidenceDelta > 0 ? `+${card.newsImpact.confidenceDelta}` : card.newsImpact.confidenceDelta} news
          </span>
        )}
        {sc && (
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: sc.color, background: sc.color + "18", padding: "2px 7px", borderRadius: 20 }}>
            {sc.label}
          </span>
        )}
      </div>

      {/* Chart */}
      {card.chartSnapshot ? (
        <MiniChart snapshot={card.chartSnapshot} />
      ) : (
        <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", background: "rgb(8,18,32)", fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
          No signal
        </div>
      )}

      {/* Levels + R:R */}
      {card.signal && card.chartSnapshot && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, padding: "9px 12px 0" }}>
            {[
              { l: "Entry", v: `$${fmt2(card.chartSnapshot.entryZone.low)}–$${fmt2(card.chartSnapshot.entryZone.high)}`, c: "#00d4ff" },
              { l: "SL",    v: `$${fmt2(card.chartSnapshot.stopLoss)}`, c: "#ff5572" },
              { l: "TP1",   v: card.chartSnapshot.takeProfitLevels[0] ? `$${fmt2(card.chartSnapshot.takeProfitLevels[0])}` : "—", c: "#00e5a0" },
            ].map(item => (
              <div key={item.l} style={{ padding: "5px 7px", borderRadius: 7, background: `${item.c}08`, border: `1px solid ${item.c}18` }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 2, textTransform: "uppercase" }}>{item.l}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: item.c }}>{item.v}</div>
              </div>
            ))}
          </div>
          {/* R:R ratio row */}
          {(() => {
            const entry  = (card.chartSnapshot.entryZone.low + card.chartSnapshot.entryZone.high) / 2;
            const risk   = entry - card.chartSnapshot.stopLoss;
            const reward = (card.chartSnapshot.takeProfitLevels[0] ?? 0) - entry;
            if (risk <= 0 || reward <= 0) return null;
            const rr = reward / risk;
            const rrColor = rr >= 2 ? "#00e5a0" : rr >= 1 ? "#ffb020" : "#ff5572";
            return (
              <div style={{ padding: "6px 12px 0", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>R:R</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800, color: rrColor }}>1:{rr.toFixed(1)}</span>
                <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(rr / 3, 1) * 100}%`, background: rrColor, borderRadius: 2 }} />
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* News */}
      {card.newsImpact.headlines.length > 0 && (
        <div style={{ margin: "8px 12px 0", padding: "7px 9px", borderRadius: 8, background: `${newsColor}08`, border: `1px solid ${newsColor}20` }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            News · {card.newsImpact.verdict}
          </div>
          {card.newsImpact.headlines.map((h, i) => (
            <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.55)", marginBottom: 2, lineHeight: 1.4, display: "flex", gap: 5 }}>
              <span style={{ color: newsColor, flexShrink: 0 }}>{h.sentiment > 0 ? "↑" : h.sentiment < 0 ? "↓" : "·"}</span>
              <span>{h.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Narrative toggle */}
      {card.llmNarrative && (
        <div style={{ padding: "8px 12px 0" }}>
          <button onClick={() => setExpanded(!expanded)} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.3)", padding: 0 }}>
            {expanded ? "▲" : "▼"} {expanded ? "Hide" : "Show"} analysis
          </button>
          {expanded && (
            <div style={{ marginTop: 5, padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)", fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
              {card.llmNarrative}
            </div>
          )}
        </div>
      )}

      {/* Approve / Reject */}
      {!autoMode && card.approvalStatus === "pending" && card.signal && (
        <div style={{ display: "flex", gap: 7, padding: "10px 12px" }}>
          <button onClick={approve} disabled={approving || rejecting}
            style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid #00e5a050", background: "#00e5a012", color: "#00e5a0", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>
            {approving ? "…" : "✓ Approve"}
          </button>
          <button onClick={reject} disabled={approving || rejecting}
            style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid #ff557250", background: "#ff557210", color: "#ff5572", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>
            {rejecting ? "…" : "✕ Reject"}
          </button>
        </div>
      )}

      {card.approvalStatus === "skipped" && card.skippedReason && (
        <div style={{
          padding: "8px 12px",
          fontFamily: "var(--font-mono)", fontSize: 10, fontStyle: "italic",
          color: card.skippedReason.startsWith("LLM vetoed")
            ? "#a78bfa"
            : card.skippedReason.startsWith("Already in open")
            ? "#ffb020"
            : "rgba(255,255,255,0.25)",
          borderTop: card.skippedReason.startsWith("LLM vetoed")
            ? "1px solid #a78bfa18"
            : card.skippedReason.startsWith("Already in open")
            ? "1px solid #ffb02018"
            : undefined,
          background: card.skippedReason.startsWith("LLM vetoed")
            ? "#a78bfa08"
            : card.skippedReason.startsWith("Already in open")
            ? "#ffb02008"
            : undefined,
        }}>
          {card.skippedReason.startsWith("LLM vetoed") && "🤖 "}
          {card.skippedReason.startsWith("Already in open") && "⚠ "}
          {card.skippedReason}
        </div>
      )}
    </div>
  );
}

function ProposalsTab({ accentColor }: { accentColor: string }) {
  const [symbol,  setSymbol]  = useState<string>("BTC");
  const [run,     setRun]     = useState<CoinAnalysisRun | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => () => stopPoll(), []);

  const loadLatest = useCallback(async () => {
    try {
      const data = await coinAnalysisService.getLatest();
      setRun(data);
      if (data.symbol) setSymbol(data.symbol);
    } catch { /* 404 is fine — no runs yet */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  // Background poll every 20s for scheduler-triggered runs
  useEffect(() => {
    const id = setInterval(loadLatest, 20_000);
    return () => clearInterval(id);
  }, [loadLatest]);

  const pollRun = useCallback(async (runId: string) => {
    try {
      const data = await coinAnalysisService.getRun(runId);
      setRun(data);
      if (data.status !== "running") { stopPoll(); setRunning(false); }
    } catch { stopPoll(); setRunning(false); }
  }, []);

  const triggerRun = async () => {
    setRunning(true);
    setError(null);
    stopPoll();
    try {
      const { coinAnalysisRunId } = await coinAnalysisService.trigger(symbol);
      pollRef.current = setInterval(() => pollRun(coinAnalysisRunId), 2500);
    } catch (e: any) {
      setError(e?.message ?? "Trigger failed");
      setRunning(false);
    }
  };

  const statusColor =
    run?.status === "completed"        ? "#00e5a0" :
    run?.status === "auto_executed"    ? "#36b6ff" :
    run?.status === "pending_approval" ? "#a78bfa" :
    run?.status === "failed"           ? "#ff5572" : "rgba(255,255,255,0.3)";

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Loading…</span>
    </div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", borderRadius: 10, background: "rgb(6,14,22)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", gap: 2, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 2 }}>
          {SYMBOLS.map(s => (
            <button key={s} onClick={() => setSymbol(s)} disabled={running}
              style={{ padding: "4px 9px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, transition: "all 0.15s",
                background: symbol === s ? accentColor : "transparent",
                color: symbol === s ? "rgb(2,6,9)" : "rgba(255,255,255,0.4)" }}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={triggerRun} disabled={running}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: `1px solid ${accentColor}40`, background: running ? "transparent" : `${accentColor}15`, color: accentColor, cursor: running ? "default" : "pointer", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>
          {running ? "⏳ Analysing…" : "⚡ Run Now"}
        </button>
        {run && (
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: statusColor }}>
            {run.symbol} · {run.status.replace(/_/g, " ")}
            {run.autoMode ? " · auto" : " · manual"}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "#ff55720d", border: "1px solid #ff557230", fontFamily: "var(--font-mono)", fontSize: 11, color: "#ff5572" }}>
          {error}
        </div>
      )}

      {/* No run yet */}
      {!run && !running && (
        <div style={{ textAlign: "center", padding: "32px 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
          No analysis run yet — click Run Now or wait for the scheduler.
        </div>
      )}

      {/* Loading skeleton while agent is running */}
      {running && (!run || run.status === "running") && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {(["SmartMoney", "Wyckoff", "ElliottWave", "Harmonic"] as const).map(fw => (
            <div key={fw} style={{ borderRadius: 12, border: `1px solid ${FW_COLOR[fw]}20`, background: "rgb(4,10,18)", overflow: "hidden" }}>
              <div style={{ padding: "9px 12px", background: `${FW_COLOR[fw]}0d`, borderBottom: `1px solid ${FW_COLOR[fw]}15`, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 800, color: FW_COLOR[fw] }}>
                {fw} <span style={{ fontSize: 10, fontWeight: 400, color: "rgba(255,255,255,0.3)", marginLeft: 6 }}>analysing…</span>
              </div>
              <div style={{ height: 150, background: "rgb(8,18,32)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                ···
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4 proposal cards */}
      {run && run.strategyCards.length > 0 && (
        <>
          {/* Pending approval banner */}
          {run.status === "pending_approval" && !run.autoMode && (
            <div style={{ padding: "9px 14px", borderRadius: 10, background: "#a78bfa10", border: "1px solid #a78bfa30", fontFamily: "var(--font-mono)", fontSize: 11, color: "#a78bfa", display: "flex", alignItems: "center", gap: 8 }}>
              ⚠ Trade proposals awaiting your approval — review the charts and approve or reject each.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {run.strategyCards.map(card => (
              <ProposalCard
                key={card.framework}
                card={card}
                runId={run.coinAnalysisRunId}
                autoMode={run.autoMode}
                accentColor={accentColor}
                onAction={loadLatest}
              />
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.25)", flexWrap: "wrap" }}>
            <span>Run: {run.coinAnalysisRunId.slice(0, 12)}…</span>
            <span>Triggered by: {run.triggeredBy}</span>
            <span>News sources: {run.newsArticlesUsed.length}</span>
            {run.completedAt && <span>At: {new Date(run.completedAt).toLocaleTimeString()}</span>}
          </div>
        </>
      )}
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
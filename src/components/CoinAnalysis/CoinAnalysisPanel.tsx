"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Brain, CheckCircle, XCircle, Zap, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { MiniChart } from "@/components/AgentChart/MiniChart";
import {
  coinAnalysisService,
  type CoinAnalysisRun,
  type StrategyCard,
  type StrategyFramework,
} from "@/services/agent.service.frontend";

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:       "rgb(6,14,22)",
  border:   "rgba(255,255,255,0.07)",
  ink:      "rgba(255,255,255,0.88)",
  inkSoft:  "rgba(255,255,255,0.55)",
  inkMuted: "rgba(255,255,255,0.3)",
  mono:     "var(--font-mono,'JetBrains Mono',monospace)",
  green:    "#00e5a0",
  red:      "#ff5572",
  amber:    "#ffb020",
  cyan:     "#00d4ff",
  purple:   "#a78bfa",
};

const FRAMEWORK_COLOR: Record<StrategyFramework, string> = {
  SmartMoney:  "#36b6ff",
  Wyckoff:     "#a78bfa",
  ElliottWave: "#ffb020",
  Harmonic:    "#00e5a0",
};

const SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "AVAX"] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function Spin() {
  return (
    <span style={{ display: "inline-block", width: 13, height: 13, border: `2px solid ${C.border}`, borderTopColor: C.cyan, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 20, fontSize: 10, fontFamily: C.mono, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}30` }}>
      {children}
    </span>
  );
}

// ── Single strategy card ───────────────────────────────────────────────────────
function StrategyCardView({
  card,
  runId,
  autoMode,
  onAction,
}: {
  card:     StrategyCard;
  runId:    string;
  autoMode: boolean;
  onAction: () => void;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const fc = FRAMEWORK_COLOR[card.framework];

  const newsColor =
    card.newsImpact.verdict === "supports"    ? C.green :
    card.newsImpact.verdict === "contradicts" ? C.red   : C.inkMuted;

  const statusBadge = () => {
    if (card.approvalStatus === "auto_executed") return <Tag color={C.cyan}>Auto-executed</Tag>;
    if (card.approvalStatus === "approved")      return <Tag color={C.green}>Approved</Tag>;
    if (card.approvalStatus === "rejected")      return <Tag color={C.red}>Rejected</Tag>;
    if (card.approvalStatus === "skipped")       return <Tag color={C.inkMuted}>Skipped</Tag>;
    return null;
  };

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

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${fc}25`, background: "rgb(4,10,18)", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ padding: "10px 14px", background: `${fc}0d`, borderBottom: `1px solid ${fc}20`, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 800, color: fc, letterSpacing: "0.04em" }}>{card.framework}</span>
        {card.signal && (
          <Tag color={card.signal.confidence >= 65 ? C.green : card.signal.confidence >= 45 ? C.amber : C.red}>
            {card.signal.confidence}% conf
          </Tag>
        )}
        {card.newsImpact.verdict !== "neutral" && (
          <Tag color={newsColor}>
            {card.newsImpact.verdict === "supports" ? `+${card.newsImpact.confidenceDelta}` : `${card.newsImpact.confidenceDelta}`} news
          </Tag>
        )}
        <div style={{ marginLeft: "auto" }}>{statusBadge()}</div>
      </div>

      {/* Chart */}
      {card.chartSnapshot ? (
        <MiniChart snapshot={card.chartSnapshot} />
      ) : (
        <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "rgb(8,18,32)", fontFamily: C.mono, fontSize: 11, color: C.inkMuted }}>
          No signal generated
        </div>
      )}

      {/* Body */}
      <div style={{ padding: "10px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>

        {/* Key levels */}
        {card.signal && card.chartSnapshot && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
            {[
              { l: "Entry", v: `$${fmt(card.chartSnapshot.entryZone.low)}–$${fmt(card.chartSnapshot.entryZone.high)}`, c: C.cyan },
              { l: "SL",    v: `$${fmt(card.chartSnapshot.stopLoss)}`,                                                   c: C.red },
              { l: "TP1",   v: card.chartSnapshot.takeProfitLevels[0] ? `$${fmt(card.chartSnapshot.takeProfitLevels[0])}` : "—", c: C.green },
            ].map(item => (
              <div key={item.l} style={{ padding: "6px 8px", borderRadius: 7, background: `${item.c}08`, border: `1px solid ${item.c}18` }}>
                <div style={{ fontFamily: C.mono, fontSize: 8, color: C.inkMuted, marginBottom: 2, textTransform: "uppercase" }}>{item.l}</div>
                <div style={{ fontFamily: C.mono, fontSize: 10, fontWeight: 700, color: item.c }}>{item.v}</div>
              </div>
            ))}
          </div>
        )}

        {/* News headlines */}
        {card.newsImpact.headlines.length > 0 && (
          <div style={{ padding: "7px 9px", borderRadius: 8, background: `${newsColor}08`, border: `1px solid ${newsColor}20` }}>
            <div style={{ fontFamily: C.mono, fontSize: 8, color: C.inkMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              News · {card.newsImpact.verdict}
            </div>
            {card.newsImpact.headlines.map((h, i) => (
              <div key={i} style={{ fontFamily: C.mono, fontSize: 10, color: C.inkSoft, marginBottom: 3, lineHeight: 1.45, display: "flex", gap: 6, alignItems: "flex-start" }}>
                <span style={{ color: newsColor, flexShrink: 0, marginTop: 1 }}>
                  {h.sentiment > 0 ? "↑" : h.sentiment < 0 ? "↓" : "·"}
                </span>
                <span>{h.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* LLM narrative */}
        {card.llmNarrative && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", cursor: "pointer", fontFamily: C.mono, fontSize: 10, color: C.inkMuted, padding: 0, marginBottom: expanded ? 5 : 0 }}
            >
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {expanded ? "Hide" : "Show"} analysis
            </button>
            {expanded && (
              <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.25)", border: `1px solid ${C.border}`, fontFamily: C.mono, fontSize: 10, color: C.inkSoft, lineHeight: 1.7 }}>
                {card.llmNarrative}
              </div>
            )}
          </div>
        )}

        {/* Skipped reason */}
        {card.approvalStatus === "skipped" && card.skippedReason && (
          <div style={{ fontFamily: C.mono, fontSize: 10, color: C.inkMuted, fontStyle: "italic" }}>
            {card.skippedReason}
          </div>
        )}

        {/* Approve / Reject buttons */}
        {!autoMode && card.approvalStatus === "pending" && card.signal && (
          <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 6 }}>
            <button
              onClick={approve} disabled={approving || rejecting}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 0", borderRadius: 8, border: `1px solid ${C.green}50`, background: `${C.green}12`, color: C.green, cursor: "pointer", fontFamily: C.mono, fontSize: 11, fontWeight: 700 }}
            >
              {approving ? <Spin /> : <CheckCircle size={13} />}
              {approving ? "…" : "Approve"}
            </button>
            <button
              onClick={reject} disabled={approving || rejecting}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 0", borderRadius: 8, border: `1px solid ${C.red}50`, background: `${C.red}10`, color: C.red, cursor: "pointer", fontFamily: C.mono, fontSize: 11, fontWeight: 700 }}
            >
              {rejecting ? <Spin /> : <XCircle size={13} />}
              {rejecting ? "…" : "Reject"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────
export function CoinAnalysisPanel() {
  const [symbol, setSymbol]         = useState<string>("BTC");
  const [running, setRunning]       = useState(false);
  const [run, setRun]               = useState<CoinAnalysisRun | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const pollRef                     = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const pollRun = useCallback(async (runId: string) => {
    try {
      const data = await coinAnalysisService.getRun(runId);
      setRun(data);
      if (data.status !== "running") { stopPolling(); setRunning(false); }
    } catch { stopPolling(); setRunning(false); }
  }, []);

  useEffect(() => () => stopPolling(), []);

  const trigger = async () => {
    setRunning(true);
    setRun(null);
    setError(null);
    stopPolling();
    try {
      const { coinAnalysisRunId } = await coinAnalysisService.trigger(symbol);
      pollRef.current = setInterval(() => pollRun(coinAnalysisRunId), 2500);
    } catch (e: any) {
      setError(e?.message ?? "Trigger failed");
      setRunning(false);
    }
  };

  const refresh = () => {
    if (run) pollRun(run.coinAnalysisRunId);
  };

  const statusColor =
    run?.status === "completed"       ? C.green  :
    run?.status === "auto_executed"   ? C.cyan   :
    run?.status === "pending_approval"? C.amber  :
    run?.status === "failed"          ? C.red    : C.inkMuted;

  return (
    <div style={{ background: "rgb(4,10,18)", border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>

      {/* Header bar */}
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Brain size={15} style={{ color: C.cyan }} />
          <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Coin Analysis · 4 Frameworks Parallel
          </span>
        </div>

        {/* Coin selector */}
        <div style={{ display: "flex", gap: 3, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 3 }}>
          {SYMBOLS.map(s => (
            <button
              key={s} onClick={() => setSymbol(s)} disabled={running}
              style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontFamily: C.mono, fontWeight: 700, transition: "all 0.15s", background: symbol === s ? C.cyan : "transparent", color: symbol === s ? "rgb(2,6,9)" : C.inkMuted }}
            >{s}</button>
          ))}
        </div>

        {/* Trigger button */}
        <button
          onClick={trigger} disabled={running}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.cyan}40`, background: running ? "transparent" : `${C.cyan}15`, color: C.cyan, cursor: running ? "default" : "pointer", fontFamily: C.mono, fontSize: 11, fontWeight: 700 }}
        >
          {running ? <Spin /> : <Zap size={13} />}
          {running ? "Analysing…" : "Run Analysis"}
        </button>

        {/* Status */}
        {run && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {run.status === "pending_approval" && (
              <span style={{ fontFamily: C.mono, fontSize: 10, color: C.amber }}>
                <AlertCircle size={11} style={{ display: "inline", marginRight: 4 }} />
                Awaiting approval
              </span>
            )}
            <Tag color={statusColor}>{run.status.replace(/_/g, " ").toUpperCase()}</Tag>
            <span style={{ fontFamily: C.mono, fontSize: 9, color: C.inkMuted }}>{run.symbol}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "16px 20px" }}>

        {/* Error */}
        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: `${C.red}0d`, border: `1px solid ${C.red}30`, fontFamily: C.mono, fontSize: 11, color: C.red, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {/* Empty state */}
        {!run && !running && !error && (
          <div style={{ textAlign: "center", padding: "32px 0", fontFamily: C.mono, fontSize: 12, color: C.inkMuted }}>
            Select a coin and click Run Analysis — SmartMoney, Wyckoff, ElliottWave, and Harmonic run in parallel.
          </div>
        )}

        {/* Running skeleton */}
        {running && !run && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {(["SmartMoney", "Wyckoff", "ElliottWave", "Harmonic"] as const).map(fw => (
              <div key={fw} style={{ borderRadius: 12, border: `1px solid ${FRAMEWORK_COLOR[fw]}20`, background: "rgb(4,10,18)", overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", background: `${FRAMEWORK_COLOR[fw]}0d`, borderBottom: `1px solid ${FRAMEWORK_COLOR[fw]}15`, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 800, color: FRAMEWORK_COLOR[fw] }}>{fw}</span>
                  <Spin />
                </div>
                <div style={{ height: 180, background: "rgb(8,18,32)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Spin />
                </div>
                <div style={{ padding: "10px 14px" }}>
                  <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.04)", marginBottom: 8 }} />
                  <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.04)", width: "70%" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 4 strategy cards */}
        {run && run.strategyCards.length > 0 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {run.strategyCards.map(card => (
                <StrategyCardView
                  key={card.framework}
                  card={card}
                  runId={run.coinAnalysisRunId}
                  autoMode={run.autoMode}
                  onAction={refresh}
                />
              ))}
            </div>

            {/* Footer metadata */}
            <div style={{ marginTop: 12, display: "flex", gap: 12, fontFamily: C.mono, fontSize: 9, color: C.inkMuted, flexWrap: "wrap" }}>
              <span>Run: {run.coinAnalysisRunId.slice(0, 12)}…</span>
              <span>Triggered: {run.triggeredBy}</span>
              <span>News sources: {run.newsArticlesUsed.length}</span>
              <span>Auto mode: {run.autoMode ? "on" : "off"}</span>
              {run.completedAt && (
                <span>Completed: {new Date(run.completedAt).toLocaleTimeString()}</span>
              )}
              {run.errorMessage && (
                <span style={{ color: C.red }}>Error: {run.errorMessage}</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

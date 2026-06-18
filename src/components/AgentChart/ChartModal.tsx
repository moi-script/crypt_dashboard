"use client";

import { useEffect, useCallback } from "react";
import { AgentChart }             from "./AgentChart";
import type { ChartSnapshot }     from "@/services/agent.service.frontend";

const TIMEFRAMES = ["15m", "1h", "4h", "1d", "1w"] as const;
type TF = (typeof TIMEFRAMES)[number];

const FRAMEWORK_COLORS: Record<string, string> = {
  SmartMoney:  "#36b6ff",
  Wyckoff:     "#a78bfa",
  ElliottWave: "#ffb020",
  Harmonic:    "#00e5a0",
};

interface Props {
  snapshot?:       ChartSnapshot;
  symbol?:         string;
  timeframe:       TF;
  onTimeframeChange: (tf: TF) => void;
  onClose:         () => void;
  stopLoss?:       number;
  takeProfits?:    number[];
  entryZoneLow?:   number;
  entryZoneHigh?:  number;
}

export function ChartModal({
  snapshot, symbol, timeframe, onTimeframeChange, onClose,
  stopLoss, takeProfits = [], entryZoneLow, entryZoneHigh,
}: Props) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const frameworkColor = snapshot ? (FRAMEWORK_COLORS[snapshot.framework] ?? "#94a3b8") : "#36b6ff";
  const displaySymbol  = snapshot?.symbol ?? symbol ?? "?";

  // Resolve SL/TP for header display (snapshot takes priority)
  const sl  = snapshot?.stopLoss            ?? stopLoss;
  const tps = snapshot?.takeProfitLevels    ?? takeProfits;
  const fw  = snapshot?.framework;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(1200px, 96vw)",
          background: "rgb(6,12,22)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        }}
      >
        {/* ── Header ───────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.02)",
        }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "var(--font-mono)" }}>
            {displaySymbol}<span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>/USDT</span>
          </span>

          {fw && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: frameworkColor,
              background: `${frameworkColor}20`, padding: "3px 9px", borderRadius: 6,
              border: `1px solid ${frameworkColor}40`,
            }}>
              {fw}
            </span>
          )}

          {snapshot?.confidence != null && (
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono)" }}>
              {snapshot.confidence}% conf
            </span>
          )}

          {snapshot?.snapshotAt && (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-mono)" }}>
              Signal {new Date(snapshot.snapshotAt).toLocaleString()}
            </span>
          )}

          <button
            onClick={onClose}
            style={{
              marginLeft: "auto", background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
              color: "rgba(255,255,255,0.5)", fontSize: 16, cursor: "pointer",
              width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >×</button>
        </div>

        {/* ── Timeframe tabs + SL/TP bar ───────────────── */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "10px 16px 8px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "rgb(5,11,20)",
          gap: 4,
        }}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              style={{
                padding: "5px 14px", borderRadius: 7, border: "none",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                fontFamily: "var(--font-mono)",
                background: timeframe === tf ? frameworkColor : "rgba(255,255,255,0.06)",
                color:      timeframe === tf ? "#020609"         : "rgba(255,255,255,0.45)",
                transition: "all 0.15s",
              }}
            >{tf}</button>
          ))}

          <div style={{ flex: 1 }} />

          {/* SL/TP legend */}
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {sl != null && (
              <span style={{ fontSize: 12, color: "#ff5572", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                SL {sl.toLocaleString()}
              </span>
            )}
            {tps.map((tp, i) => (
              <span key={i} style={{ fontSize: 12, color: "#00e5a0", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                TP{tps.length > 1 ? i + 1 : ""} {tp.toLocaleString()}
              </span>
            ))}
            {(entryZoneLow ?? snapshot?.entryZone?.low) != null && (
              <span style={{ fontSize: 12, color: "#ffb020", fontFamily: "var(--font-mono)" }}>
                Entry {(snapshot?.entryZone?.low ?? entryZoneLow)?.toLocaleString()}
                –{(snapshot?.entryZone?.high ?? entryZoneHigh)?.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* ── Chart ────────────────────────────────────── */}
        <AgentChart
          snapshot={snapshot}
          symbol={symbol}
          timeframe={timeframe}
          height={560}
          compact={false}
          stopLoss={stopLoss}
          takeProfits={takeProfits}
          entryZoneLow={entryZoneLow}
          entryZoneHigh={entryZoneHigh}
        />

        {/* ── Legend footer ────────────────────────────── */}
        <div style={{
          display: "flex", gap: 18, alignItems: "center",
          padding: "9px 18px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(255,255,255,0.01)",
        }}>
          {[
            { color: "#00e5a0", label: "Support / TP" },
            { color: "#ff5572", label: "Resistance / SL" },
            { color: "#ffb020", label: "Entry zone" },
            ...(snapshot?.overlays?.trendlines?.length ? [{ color: "#60a0ff60", label: "Trendlines" }] : []),
            ...(snapshot?.framework === "Wyckoff" ? [{ color: "#a78bfa", label: "Wyckoff range" }] : []),
            ...(snapshot?.framework === "ElliottWave" ? [{ color: "#ffb020", label: "Elliott pivots" }] : []),
          ].map(item => (
            <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 18, height: 2, background: item.color, display: "inline-block", borderRadius: 1 }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-mono)" }}>{item.label}</span>
            </span>
          ))}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", fontFamily: "var(--font-mono)" }}>
            ESC to close · Click outside to dismiss
          </span>
        </div>
      </div>
    </div>
  );
}

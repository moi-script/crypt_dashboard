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
  snapshot:  ChartSnapshot;
  timeframe: TF;
  onTimeframeChange: (tf: TF) => void;
  onClose: () => void;
}

export function ChartModal({ snapshot, timeframe, onTimeframeChange, onClose }: Props) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const frameworkColor = FRAMEWORK_COLORS[snapshot.framework] ?? "#94a3b8";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(1100px,96vw)", background: "rgb(8,14,26)",
          borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden", display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono)" }}>
            {snapshot.symbol}/USDC
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: frameworkColor, background: `${frameworkColor}20`, padding: "3px 9px", borderRadius: 6 }}>
            {snapshot.framework}
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            Confidence {snapshot.confidence}%
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>
            Signal at {new Date(snapshot.snapshotAt).toLocaleString()}
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}
          >×</button>
        </div>

        {/* Timeframe tabs */}
        <div style={{ display: "flex", gap: 4, padding: "10px 18px 0", background: "rgb(6,12,22)" }}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              style={{
                padding: "5px 14px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "var(--font-mono)",
                background: timeframe === tf ? frameworkColor : "rgba(255,255,255,0.06)",
                color:      timeframe === tf ? "#020609"         : "rgba(255,255,255,0.45)",
                transition: "all 0.15s ease",
              }}
            >{tf}</button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center", paddingBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#00e5a0", fontFamily: "var(--font-mono)" }}>
              SL {snapshot.stopLoss.toLocaleString()}
            </span>
            {snapshot.takeProfitLevels.map((tp, i) => (
              <span key={i} style={{ fontSize: 11, color: "#ff5572", fontFamily: "var(--font-mono)" }}>
                TP{i + 1} {tp.toLocaleString()}
              </span>
            ))}
          </div>
        </div>

        {/* Chart */}
        <AgentChart snapshot={snapshot} timeframe={timeframe} height={520} compact={false} />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { AgentChart }  from "./AgentChart";
import { ChartModal }  from "./ChartModal";
import type { ChartSnapshot } from "@/services/agent.service.frontend";

type TF = "15m" | "1h" | "4h" | "1d" | "1w";
const TIMEFRAMES: TF[] = ["15m", "1h", "4h", "1d", "1w"];

interface Props {
  snapshot?:      ChartSnapshot;
  symbol?:        string;
  stopLoss?:      number;
  takeProfits?:   number[];
  entryZoneLow?:  number;
  entryZoneHigh?: number;
}

export function MiniChart({ snapshot, symbol, stopLoss, takeProfits, entryZoneLow, entryZoneHigh }: Props) {
  const [tf,   setTf]   = useState<TF>("4h");
  const [open, setOpen] = useState(false);

  const displaySymbol = snapshot?.symbol ?? symbol ?? "?";

  return (
    <>
      <div style={{
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgb(5,12,22)",
      }}>
        {/* Tab bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 2,
          padding: "7px 10px 6px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(255,255,255,0.02)",
        }}>
          {TIMEFRAMES.map(t => (
            <button
              key={t}
              onClick={() => setTf(t)}
              style={{
                padding: "3px 9px", border: "none", borderRadius: 5,
                fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
                cursor: "pointer",
                background: tf === t ? "rgba(0,212,255,0.18)" : "transparent",
                color:      tf === t ? "#00d4ff" : "rgba(255,255,255,0.3)",
                transition: "all 0.12s",
              }}
            >{t}</button>
          ))}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-mono)" }}>
            {displaySymbol}/USDT
          </span>
          <button
            onClick={() => setOpen(true)}
            title="Expand full chart"
            style={{
              marginLeft: 6, padding: "3px 8px", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 5, background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.45)", fontSize: 11, cursor: "pointer",
              fontFamily: "var(--font-mono)",
            }}
          >⤢</button>
        </div>

        {/* Chart */}
        <AgentChart
          snapshot={snapshot}
          symbol={symbol}
          timeframe={tf}
          height={240}
          compact={true}
          stopLoss={stopLoss}
          takeProfits={takeProfits}
          entryZoneLow={entryZoneLow}
          entryZoneHigh={entryZoneHigh}
        />
      </div>

      {open && (
        <ChartModal
          snapshot={snapshot}
          symbol={symbol}
          timeframe={tf}
          onTimeframeChange={setTf}
          onClose={() => setOpen(false)}
          stopLoss={stopLoss}
          takeProfits={takeProfits}
          entryZoneLow={entryZoneLow}
          entryZoneHigh={entryZoneHigh}
        />
      )}
    </>
  );
}

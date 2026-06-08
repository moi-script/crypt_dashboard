"use client";

import type { OHLCVRange } from "@/models/coin.model";

const RANGES: OHLCVRange[] = ["1D", "1W", "1M", "1Y"];

export function RangeTabs({ value, onChange }: { value: OHLCVRange; onChange: (r: OHLCVRange) => void }) {
  return (
    <div
      className="flex items-center gap-0.5 p-0.5 rounded-xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {RANGES.map(r => {
        const active = value === r;
        return (
          <button
            key={r}
            onClick={() => onChange(r)}
            className="transition-all duration-200"
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              background: active
                ? "linear-gradient(135deg, rgba(0,212,255,0.18), rgba(167,139,250,0.1))"
                : "transparent",
              border: active ? "1px solid rgba(0,212,255,0.22)" : "1px solid transparent",
              color: active ? "var(--cyan)" : "var(--ink-muted)",
              cursor: "pointer",
              boxShadow: active ? "0 0 12px rgba(0,212,255,0.12)" : "none",
            }}
            onMouseEnter={e => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-soft)";
            }}
            onMouseLeave={e => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-muted)";
            }}
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}
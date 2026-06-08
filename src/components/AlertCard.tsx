"use client";

import { CoinAvatar } from "./CoinAvatar";
import { fmtPrice, clsx } from "@/lib/format";
import { CONDITION_LABEL, type Alert } from "@/models/alert.model";
import type { Coin } from "@/models/coin.model";

export function AlertCard({ alert, coin, onToggle, onDelete, busy }: {
  alert: Alert; coin?: Coin;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  busy?: boolean;
}) {
  const unit     = alert.condition === "pct_change" ? "%" : "$";
  const distance = coin && alert.condition !== "pct_change"
    ? ((alert.threshold - coin.price) / coin.price) * 100
    : null;

  return (
    <div
      className={clsx("relative flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200", busy && "animate-pulse")}
      style={{
        background: "rgba(8,16,28,0.85)",
        border: `1px solid ${alert.active ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.04)"}`,
        opacity: alert.active ? 1 : 0.5,
        boxShadow: alert.triggered ? "0 0 20px rgba(255,176,32,0.1)" : "none",
      }}
    >
      {/* triggered strip */}
      {alert.triggered && (
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--warn), transparent)" }} />
      )}

      <CoinAvatar src={coin?.image} symbol={coin?.symbol ?? alert.coinId.slice(0, 3)} size={28} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            {coin?.name ?? alert.coinId}
          </span>
          {alert.triggered && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--warn)", background: "rgba(255,176,32,0.08)", border: "1px solid rgba(255,176,32,0.2)", padding: "2px 6px", borderRadius: 4 }}>
              triggered
            </span>
          )}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>
          {CONDITION_LABEL[alert.condition]}{" "}
          <span style={{ color: "var(--ink-soft)" }}>
            {unit === "$" ? "$" : "±"}{fmtPrice(alert.threshold)}{unit === "%" ? "%" : ""}
          </span>
          {distance !== null && (
            <span style={{ marginLeft: 8, color: distance >= 0 ? "var(--up)" : "var(--down)" }}>
              ({distance >= 0 ? "+" : "−"}{Math.abs(distance).toFixed(1)}% away)
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onToggle(alert.id, !alert.active)}
        className="transition-all duration-150"
        style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: alert.active ? "var(--up)" : "var(--ink-muted)", background: "none", border: "none", cursor: "pointer" }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--cyan)")}
        onMouseLeave={e => (e.currentTarget.style.color = alert.active ? "var(--up)" : "var(--ink-muted)")}
      >
        {alert.active ? "● on" : "○ off"}
      </button>

      <button
        onClick={() => onDelete(alert.id)}
        style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-faint)", background: "none", border: "none", cursor: "pointer", transition: "color 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--down)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-faint)")}
      >
        ✕
      </button>
    </div>
  );
}
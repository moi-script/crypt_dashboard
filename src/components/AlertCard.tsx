"use client";

import { CoinAvatar } from "./CoinAvatar";
import { clsx, fmtPrice } from "@/lib/format";
import { CONDITION_LABEL, type Alert } from "@/models/alert.model";
import type { Coin } from "@/models/coin.model";

export function AlertCard({
  alert,
  coin,
  onToggle,
  onDelete,
  busy,
}: {
  alert: Alert;
  coin?: Coin;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  busy?: boolean;
}) {
  const unit = alert.condition === "pct_change" ? "%" : "$";
  const distance =
    coin && alert.condition !== "pct_change"
      ? ((alert.threshold - coin.price) / coin.price) * 100
      : null;

  return (
    <div
      className={clsx(
        "panel flex items-center gap-3 px-3 py-3 transition-opacity",
        !alert.active && "opacity-50",
        busy && "animate-pulse",
      )}
    >
      <CoinAvatar src={coin?.image} symbol={coin?.symbol ?? alert.coinId.slice(0, 3)} size={30} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">{coin?.name ?? alert.coinId}</span>
          {alert.triggered && (
            <span className="border border-warn/40 bg-warn/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-warn">
              triggered
            </span>
          )}
        </div>
        <div className="font-mono text-xs text-muted">
          {CONDITION_LABEL[alert.condition]}{" "}
          <span className="text-ink-soft">
            {unit === "$" ? "$" : "±"}
            {fmtPrice(alert.threshold)}
            {unit === "%" ? "%" : ""}
          </span>
          {distance !== null && (
            <span className={clsx("ml-2", distance >= 0 ? "text-up" : "text-down")}>
              ({distance >= 0 ? "+" : "−"}
              {Math.abs(distance).toFixed(1)}% away)
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onToggle(alert.id, !alert.active)}
        className="font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:text-up"
        title={alert.active ? "Pause alert" : "Resume alert"}
      >
        {alert.active ? "● on" : "○ off"}
      </button>
      <button
        onClick={() => onDelete(alert.id)}
        className="font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:text-down"
        title="Delete alert"
      >
        ✕
      </button>
    </div>
  );
}

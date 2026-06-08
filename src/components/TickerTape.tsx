"use client";

import Link from "next/link";
import { useCoinList } from "@/controllers/useCoinList";
import { fmtPrice, fmtPct } from "@/lib/format";
import type { Coin } from "@/models/coin.model";

function Item({ coin }: { coin: Coin }) {
  const up = coin.change24h >= 0;
  return (
    <Link
      href={`/coins/${coin.id}`}
      className="inline-flex items-center gap-2.5 px-4 py-0.5 transition-opacity duration-150 hover:opacity-70"
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--ink-muted)" }}>
        {coin.symbol}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>
        ${fmtPrice(coin.price)}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: up ? "var(--up)" : "var(--down)", display: "inline-flex", alignItems: "center", gap: 2 }}>
        <span style={{ fontSize: 7 }}>{up ? "▲" : "▼"}</span>
        {fmtPct(coin.change24h, { sign: false })}
      </span>
      <span style={{ color: "rgba(255,255,255,0.06)", fontSize: 6, margin: "0 2px" }}>●</span>
    </Link>
  );
}

export function TickerTape() {
  const { data } = useCoinList();
  const coins = data ?? [];

  if (!coins.length) {
    return (
      <div style={{ height: 36, background: "rgba(4,11,20,0.96)", borderBottom: "1px solid rgba(255,255,255,0.04)" }} />
    );
  }

  const loop = [...coins, ...coins];

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: 36, background: "rgba(4,11,20,0.96)", borderBottom: "1px solid rgba(255,255,255,0.04)", backdropFilter: "blur(12px)" }}
    >
      <div className="ticker-track h-full flex items-center">
        {loop.map((c, i) => <Item key={`${c.id}-${i}`} coin={c} />)}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10" style={{ background: "linear-gradient(90deg, rgba(4,11,20,0.96), transparent)" }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10" style={{ background: "linear-gradient(270deg, rgba(4,11,20,0.96), transparent)" }} />
    </div>
  );
}
"use client";

import Link from "next/link";
import { useCoinList } from "@/controllers/useCoinList";
import { clsx, fmtPrice, fmtPct } from "@/lib/format";
import type { Coin } from "@/models/coin.model";

function Item({ coin }: { coin: Coin }) {
  const up = coin.change24h >= 0;
  return (
    <Link
      href={`/coins/${coin.id}`}
      className="inline-flex items-center gap-2 px-4 py-1.5 transition-colors hover:bg-panel-2"
    >
      <span className="font-mono text-xs font-medium uppercase text-ink-soft">{coin.symbol}</span>
      <span className="font-mono text-xs tabular-nums text-ink">${fmtPrice(coin.price)}</span>
      <span className={clsx("font-mono text-[11px] tabular-nums", up ? "text-up" : "text-down")}>
        {up ? "▲" : "▼"}
        {fmtPct(coin.change24h, { sign: false })}
      </span>
    </Link>
  );
}

export function TickerTape() {
  const { data } = useCoinList();
  const coins = data ?? [];
  if (!coins.length) {
    return <div className="h-9 border-b border-line bg-panel" />;
  }
  const loop = [...coins, ...coins];

  return (
    <div className="relative overflow-hidden border-b border-line bg-panel">
      <div className="ticker-track">
        {loop.map((c, i) => (
          <Item key={`${c.id}-${i}`} coin={c} />
        ))}
      </div>
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-panel to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-panel to-transparent" />
    </div>
  );
}

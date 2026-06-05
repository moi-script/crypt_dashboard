"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useCoinList } from "@/controllers/useCoinList";
import { CoinTable } from "@/components/CoinTable";
import { StatCard } from "@/components/StatCard";
import { PriceChange } from "@/components/PriceChange";
import { CoinAvatar } from "@/components/CoinAvatar";
import { Panel } from "@/components/Panel";
import { fmtCompact, fmtPct } from "@/lib/format";
import type { Coin } from "@/models/coin.model";

function Mover({ coin }: { coin: Coin }) {
  return (
    <Link
      href={`/coins/${coin.id}`}
      className="flex items-center gap-2 border border-line bg-panel px-3 py-2 transition-colors hover:border-line-bright hover:bg-panel-2"
    >
      <CoinAvatar src={coin.image} symbol={coin.symbol} size={22} />
      <span className="font-mono text-xs uppercase text-ink-soft">{coin.symbol}</span>
      <PriceChange value={coin.change24h} className="ml-auto" />
    </Link>
  );
}

export default function MarketsView() {
  const { data, isLoading } = useCoinList();
  const coins = useMemo(() => data ?? [], [data]);

  const stats = useMemo(() => {
    if (!coins.length) return null;
    const totalCap = coins.reduce((s, c) => s + c.marketCap, 0);
    const totalVol = coins.reduce((s, c) => s + c.volume24h, 0);
    const btc = coins.find((c) => c.symbol === "BTC");
    const dom = btc ? (btc.marketCap / totalCap) * 100 : 0;
    const tradable = coins.filter((c) => c.symbol !== "USDT");
    const sorted = [...tradable].sort((a, b) => b.change24h - a.change24h);
    return {
      totalCap,
      totalVol,
      dom,
      gainers: sorted.slice(0, 3),
      losers: sorted.slice(-3).reverse(),
      avg: tradable.reduce((s, c) => s + c.change24h, 0) / (tradable.length || 1),
    };
  }, [coins]);

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-6">
      {/* Heading */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-ink">
            Markets<span className="text-up cursor-blink" />
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            Live spot prices across {coins.length || "—"} assets · sortable · click any row to open the desk
          </p>
        </div>
      </div>

      {/* Overview stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total Market Cap"
          value={stats ? `$${fmtCompact(stats.totalCap)}` : "—"}
          sub="tracked universe"
        />
        <StatCard
          label="24h Volume"
          value={stats ? `$${fmtCompact(stats.totalVol)}` : "—"}
          sub="aggregate turnover"
        />
        <StatCard
          label="BTC Dominance"
          value={stats ? `${stats.dom.toFixed(1)}%` : "—"}
          accent="warn"
          sub="share of market cap"
        />
        <StatCard
          label="Avg 24h Move"
          value={stats ? fmtPct(stats.avg) : "—"}
          accent={stats && stats.avg >= 0 ? "up" : "down"}
          sub="ex-stablecoins"
        />
      </div>

      {/* Movers */}
      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <Panel title={<span className="text-up">▲ Top Gainers</span>} bodyClassName="grid grid-cols-1 gap-2 p-2 sm:grid-cols-3">
          {(stats?.gainers ?? []).map((c) => <Mover key={c.id} coin={c} />)}
          {!stats && <div className="skeleton col-span-3 h-10" />}
        </Panel>
        <Panel title={<span className="text-down">▼ Top Losers</span>} bodyClassName="grid grid-cols-1 gap-2 p-2 sm:grid-cols-3">
          {(stats?.losers ?? []).map((c) => <Mover key={c.id} coin={c} />)}
          {!stats && <div className="skeleton col-span-3 h-10" />}
        </Panel>
      </div>

      {/* Main table */}
      <Panel
        title={<span className="text-ink-soft">Order Book · Spot</span>}
        right={<span className="font-mono text-[10px] text-faint">auto-refresh 15s</span>}
        ticks
      >
        <CoinTable coins={coins} loading={isLoading} />
      </Panel>
    </div>
  );
}

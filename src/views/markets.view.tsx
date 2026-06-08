"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useCoinList } from "@/controllers/useCoinList";
import { CoinTable } from "@/components/CoinTable";
import { StatCard } from "@/components/StatCard";
import { CoinAvatar } from "@/components/CoinAvatar";
import { fmtCompact, fmtPct, fmtPrice } from "@/lib/format";
import type { Coin } from "@/models/coin.model";

function MoverRow({ coin, rank }: { coin: Coin; rank: number }) {
  const up = coin.change24h >= 0;
  return (
    <Link
      href={`/coins/${coin.id}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", textDecoration: "none" }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = up ? "rgba(0,229,160,0.05)" : "rgba(255,85,114,0.05)";
        el.style.borderColor = up ? "rgba(0,229,160,0.15)" : "rgba(255,85,114,0.15)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = "rgba(255,255,255,0.02)";
        el.style.borderColor = "rgba(255,255,255,0.04)";
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-faint)", width: 14, textAlign: "center", flexShrink: 0 }}>{rank}</span>
      <CoinAvatar src={coin.image} symbol={coin.symbol} size={26} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{coin.symbol}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>${fmtPrice(coin.price)}</div>
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: up ? "var(--up)" : "var(--down)", flexShrink: 0 }}>
        {up ? "+" : ""}{fmtPct(coin.change24h, { sign: false })}
      </span>
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
    const btc = coins.find(c => c.symbol === "BTC");
    const dom = btc ? (btc.marketCap / totalCap) * 100 : 0;
    const tradable = coins.filter(c => c.symbol !== "USDT");
    const sorted   = [...tradable].sort((a, b) => b.change24h - a.change24h);
    const avg      = tradable.reduce((s, c) => s + c.change24h, 0) / (tradable.length || 1);
    return { totalCap, totalVol, dom, avg, gainers: sorted.slice(0, 4), losers: sorted.slice(-4).reverse() };
  }, [coins]);

  return (
    <div style={{ padding: "20px", maxWidth: 1600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Title ────────────────────────────────────────────────────── */}
      <div className="fade-up fade-up-1" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>
            Markets<span className="cursor-blink" style={{ marginLeft: 4 }} />
          </h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>
            {coins.length || "—"} assets · live prices · click any row for full desk
          </p>
        </div>
        <div
          className="hidden md:flex items-center gap-2"
          style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--ink-muted)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", padding: "6px 12px", borderRadius: 8 }}
        >
          <span className="w-1.5 h-1.5 rounded-full pulse" style={{ background: "var(--up)", color: "var(--up)", boxShadow: "0 0 6px var(--up)", display: "inline-block" }} />
          Auto-refresh 15s
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────── */}
      <div className="fade-up fade-up-2" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        <StatCard label="Total Market Cap" value={stats ? `$${fmtCompact(stats.totalCap)}` : "—"} sub="Global crypto universe"  accent="info" />
        <StatCard label="24h Volume"       value={stats ? `$${fmtCompact(stats.totalVol)}` : "—"} sub="Aggregate turnover"       accent="info" />
        <StatCard label="BTC Dominance"    value={stats ? `${stats.dom.toFixed(1)}%` : "—"}        sub="Share of total cap"       accent="warn" />
        <StatCard label="Avg 24h Move"     value={stats ? fmtPct(stats.avg) : "—"}                 sub="Ex-stablecoins"           accent={stats && stats.avg >= 0 ? "up" : "down"} />
      </div>

      {/* ── Movers ───────────────────────────────────────────────────── */}
      <div className="fade-up fade-up-3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        {/* Gainers */}
        <div className="relative rounded-xl overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(0,229,160,0.05), rgba(8,16,28,0.96))", border: "1px solid rgba(0,229,160,0.1)", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 3, height: 16, borderRadius: 2, background: "var(--up)", boxShadow: "0 0 8px var(--up)" }} />
            <span className="label label-up">Top Gainers</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {stats?.gainers.map((c, i) => <MoverRow key={c.id} coin={c} rank={i + 1} />) ??
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 12 }} />)}
          </div>
        </div>

        {/* Losers */}
        <div className="relative rounded-xl overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(255,85,114,0.05), rgba(8,16,28,0.96))", border: "1px solid rgba(255,85,114,0.1)", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 3, height: 16, borderRadius: 2, background: "var(--down)", boxShadow: "0 0 8px var(--down)" }} />
            <span className="label label-down">Top Losers</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {stats?.losers.map((c, i) => <MoverRow key={c.id} coin={c} rank={i + 1} />) ??
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 12 }} />)}
          </div>
        </div>
      </div>

      {/* ── Coin table ───────────────────────────────────────────────── */}
      <div
        className="fade-up fade-up-4 rounded-xl overflow-hidden"
        style={{ background: "linear-gradient(180deg, rgba(10,20,34,0.94), rgba(5,12,22,0.98))", border: "1px solid rgba(255,255,255,0.052)", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.012)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 2, height: 16, borderRadius: 1, background: "var(--cyan)", boxShadow: "0 0 8px var(--cyan)" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-soft)" }}>
              All Assets
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--cyan)", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.14)", padding: "2px 8px", borderRadius: 6 }}>
              {coins.length}
            </span>
          </div>
          <span className="label">Sortable · Click for detail</span>
        </div>
        <CoinTable coins={coins} loading={isLoading} />
      </div>
    </div>
  );
}
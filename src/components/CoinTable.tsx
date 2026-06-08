"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CoinAvatar } from "./CoinAvatar";
import { Sparkline } from "./Sparkline";
import { fmtCompact, fmtPrice, fmtPct, clsx } from "@/lib/format";
import type { Coin } from "@/models/coin.model";

type SortKey = "rank" | "name" | "price" | "change24h" | "volume24h" | "marketCap";

/* ── Flashing price cell ─────────────────────────────────────────── */
function PriceCell({ value }: { value: number }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<"" | "flash-up" | "flash-down">("");

  useEffect(() => {
    if (value !== prev.current) {
      setFlash(value > prev.current ? "flash-up" : "flash-down");
      prev.current = value;
      const t = setTimeout(() => setFlash(""), 750);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span
      className={clsx("inline-block px-2 py-0.5 rounded-md tabular-nums", flash)}
      style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--ink)", transition: "color 0.3s" }}
    >
      ${fmtPrice(value)}
    </span>
  );
}

/* ── Sort icon ───────────────────────────────────────────────────── */
function SortChevron({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span style={{ fontSize: 7, color: active ? "var(--cyan)" : "var(--ink-faint)", marginLeft: 3, opacity: active ? 1 : 0.5 }}>
      {active ? (dir === "asc" ? "▲" : "▼") : "◆"}
    </span>
  );
}

/* ── Header cell ─────────────────────────────────────────────────── */
function Th({
  label, k, sort, dir, onSort, align = "right",
}: {
  label: string; k: SortKey; sort: SortKey; dir: "asc" | "desc";
  onSort: (k: SortKey) => void; align?: "left" | "right";
}) {
  const active = sort === k;
  return (
    <th
      onClick={() => onSort(k)}
      style={{
        padding: "10px 14px",
        textAlign: align,
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.18em",
        color: active ? "var(--cyan)" : "var(--ink-muted)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        userSelect: "none",
        transition: "color 0.15s",
      }}
    >
      {align === "left"
        ? <span style={{ display: "inline-flex", alignItems: "center" }}>{label}<SortChevron active={active} dir={dir} /></span>
        : <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", width: "100%" }}>{label}<SortChevron active={active} dir={dir} /></span>
      }
    </th>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
export function CoinTable({ coins, loading }: { coins: Coin[]; loading?: boolean }) {
  const [sort, setSort] = useState<SortKey>("marketCap");
  const [dir,  setDir]  = useState<"asc" | "desc">("desc");

  const onSort = (k: SortKey) => {
    if (k === sort) setDir(d => d === "asc" ? "desc" : "asc");
    else { setSort(k); setDir(k === "name" ? "asc" : "desc"); }
  };

  const rows = useMemo(() => {
    return [...coins].sort((a, b) => {
      const cmp = sort === "name" ? a.name.localeCompare(b.name)
        : sort === "rank" ? (a.rank ?? 999) - (b.rank ?? 999)
        : (a[sort] as number) - (b[sort] as number);
      return dir === "asc" ? cmp : -cmp;
    });
  }, [coins, sort, dir]);

  if (loading) {
    return (
      <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 44, borderRadius: 10, opacity: 1 - i * 0.09 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>

        {/* Header */}
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.012)" }}>
            <th style={{ padding: "10px 14px 10px 20px", textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--ink-muted)", cursor: "pointer", userSelect: "none" }} onClick={() => onSort("rank")}>
              <span style={{ display: "inline-flex", alignItems: "center" }}>#<SortChevron active={sort === "rank"} dir={dir} /></span>
            </th>
            <Th label="Asset"   k="name"       sort={sort} dir={dir} onSort={onSort} align="left" />
            <Th label="Price"   k="price"      sort={sort} dir={dir} onSort={onSort} />
            <Th label="24h"     k="change24h"  sort={sort} dir={dir} onSort={onSort} />
            <Th label="Volume"  k="volume24h"  sort={sort} dir={dir} onSort={onSort} />
            <Th label="Mkt Cap" k="marketCap"  sort={sort} dir={dir} onSort={onSort} />
            <th style={{ padding: "10px 14px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--ink-faint)", userSelect: "none" }}>7d</th>
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {rows.map((c, i) => (
            <tr
              key={c.id}
              className="table-row"
              style={{ animationDelay: `${i * 0.018}s` }}
            >
              {/* Rank */}
              <td style={{ padding: "13px 14px 13px 20px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-faint)", width: 48 }}>
                {c.rank ?? i + 1}
              </td>

              {/* Asset */}
              <td style={{ padding: "13px 14px" }}>
                <Link href={`/coins/${c.id}`} style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none" }}
                  onMouseEnter={e => { const name = (e.currentTarget as HTMLElement).querySelector(".asset-name") as HTMLElement; if (name) name.style.color = "var(--cyan)"; }}
                  onMouseLeave={e => { const name = (e.currentTarget as HTMLElement).querySelector(".asset-name") as HTMLElement; if (name) name.style.color = "var(--ink)"; }}
                >
                  <CoinAvatar src={c.image} symbol={c.symbol} size={30} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className="asset-name" style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--ink)", transition: "color 0.15s" }}>
                      {c.name}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--ink-muted)" }}>
                      {c.symbol}
                    </span>
                  </div>
                </Link>
              </td>

              {/* Price */}
              <td style={{ padding: "13px 14px", textAlign: "right" }}>
                <PriceCell value={c.price} />
              </td>

              {/* 24h */}
              <td style={{ padding: "13px 14px", textAlign: "right" }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500,
                  color: c.change24h >= 0 ? "var(--up)" : "var(--down)",
                  display: "inline-flex", alignItems: "center", gap: 3,
                }}>
                  <span style={{ fontSize: 7 }}>{c.change24h >= 0 ? "▲" : "▼"}</span>
                  {fmtPct(c.change24h, { sign: false })}
                </span>
              </td>

              {/* Volume */}
              <td style={{ padding: "13px 14px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)" }}>
                ${fmtCompact(c.volume24h)}
              </td>

              {/* Mkt Cap */}
              <td style={{ padding: "13px 14px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)" }}>
                ${fmtCompact(c.marketCap)}
              </td>

              {/* Sparkline */}
              <td style={{ padding: "13px 14px 13px 4px", textAlign: "right" }}>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Sparkline data={c.sparkline ?? []} positive={c.change24h >= 0} width={80} height={26} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
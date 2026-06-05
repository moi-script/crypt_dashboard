"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CoinAvatar } from "./CoinAvatar";
import { PriceChange } from "./PriceChange";
import { Sparkline } from "./Sparkline";
import { clsx, fmtCompact, fmtPrice } from "@/lib/format";
import type { Coin } from "@/models/coin.model";

type SortKey = "rank" | "name" | "price" | "change24h" | "volume24h" | "marketCap";

/** Price cell that flashes green/red whenever the value ticks. */
function PriceCell({ value }: { value: number }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<"" | "flash-up" | "flash-down">("");

  useEffect(() => {
    if (value !== prev.current) {
      setFlash(value > prev.current ? "flash-up" : "flash-down");
      prev.current = value;
      const t = setTimeout(() => setFlash(""), 700);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span className={clsx("inline-block px-1 font-mono tabular-nums", flash)}>
      ${fmtPrice(value)}
    </span>
  );
}

function HeaderCell({
  label,
  k,
  sort,
  dir,
  onSort,
  align = "right",
}: {
  label: string;
  k: SortKey;
  sort: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort === k;
  return (
    <th
      onClick={() => onSort(k)}
      className={clsx(
        "cursor-pointer select-none whitespace-nowrap px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors hover:text-ink",
        align === "left" ? "text-left" : "text-right",
        active ? "text-up" : "text-muted",
      )}
    >
      {label}
      <span className="ml-1 inline-block w-2 text-up">{active ? (dir === "asc" ? "▲" : "▼") : ""}</span>
    </th>
  );
}

export function CoinTable({ coins, loading }: { coins: Coin[]; loading?: boolean }) {
  const [sort, setSort] = useState<SortKey>("marketCap");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const onSort = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(k);
      setDir(k === "name" ? "asc" : "desc");
    }
  };

  const rows = useMemo(() => {
    const sorted = [...coins].sort((a, b) => {
      let cmp: number;
      if (sort === "name") cmp = a.name.localeCompare(b.name);
      else if (sort === "rank") cmp = (a.rank ?? 999) - (b.rank ?? 999);
      else cmp = (a[sort] as number) - (b[sort] as number);
      return dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [coins, sort, dir]);

  if (loading) {
    return (
      <div className="divide-y divide-line">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-3">
            <div className="skeleton h-6 w-6 rounded-full" />
            <div className="skeleton h-3 w-32" />
            <div className="skeleton ml-auto h-3 w-20" />
            <div className="skeleton h-3 w-14" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-panel">
          <tr className="border-b border-line">
            <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-faint">#</th>
            <HeaderCell label="Asset" k="name" sort={sort} dir={dir} onSort={onSort} align="left" />
            <HeaderCell label="Price" k="price" sort={sort} dir={dir} onSort={onSort} />
            <HeaderCell label="24h" k="change24h" sort={sort} dir={dir} onSort={onSort} />
            <HeaderCell label="Volume" k="volume24h" sort={sort} dir={dir} onSort={onSort} />
            <HeaderCell label="Mkt Cap" k="marketCap" sort={sort} dir={dir} onSort={onSort} />
            <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wider text-faint">7d</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr
              key={c.id}
              className="group border-b border-line/60 transition-colors hover:bg-panel-2"
            >
              <td className="px-3 py-2.5 font-mono text-xs text-faint">{c.rank ?? i + 1}</td>
              <td className="px-3 py-2.5">
                <Link href={`/coins/${c.id}`} className="flex items-center gap-2.5">
                  <CoinAvatar src={c.image} symbol={c.symbol} size={24} />
                  <span className="flex flex-col leading-tight">
                    <span className="font-medium text-ink transition-colors group-hover:text-up">
                      {c.name}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-muted">
                      {c.symbol}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="px-3 py-2.5 text-right text-ink">
                <PriceCell value={c.price} />
              </td>
              <td className="px-3 py-2.5 text-right">
                <PriceChange value={c.change24h} />
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs text-ink-soft">
                ${fmtCompact(c.volume24h)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs text-ink-soft">
                ${fmtCompact(c.marketCap)}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex justify-end">
                  <Sparkline data={c.sparkline ?? []} positive={c.change24h >= 0} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

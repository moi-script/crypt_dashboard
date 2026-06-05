"use client";

import { useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { CoinAvatar } from "@/components/CoinAvatar";
import { PriceChange } from "@/components/PriceChange";
import { Modal } from "@/components/Modal";
import { usePortfolio, useRemoveHolding, useUpsertHolding } from "@/controllers/usePortfolio";
import { useCoinList } from "@/controllers/useCoinList";
import { clsx, fmtPrice, fmtUSD } from "@/lib/format";
import type { HoldingRow } from "@/models/portfolio.model";

const ALLOC_COLORS = ["#00e08a", "#36b6ff", "#b388ff", "#ffb020", "#ff4d5e", "#0a7d52", "#6b7785"];

function PortfolioInner() {
  const { data: portfolio, isLoading } = usePortfolio();
  const { data: coins } = useCoinList();
  const upsert = useUpsertHolding();
  const remove = useRemoveHolding();
  const [adding, setAdding] = useState(false);

  const rows = useMemo<HoldingRow[]>(() => {
    if (!portfolio || !coins) return [];
    const total = portfolio.holdings.reduce((s, h) => {
      const c = coins.find((x) => x.id === h.coinId);
      return s + (c ? c.price * h.quantity : 0);
    }, 0);
    return portfolio.holdings
      .map((h) => {
        const c = coins.find((x) => x.id === h.coinId);
        const price = c?.price ?? 0;
        const value = price * h.quantity;
        const cost = h.avgCost * h.quantity;
        const pnl = value - cost;
        return {
          ...h,
          name: c?.name ?? h.coinId,
          symbol: c?.symbol ?? h.coinId.slice(0, 4).toUpperCase(),
          image: c?.image,
          price,
          change24h: c?.change24h ?? 0,
          value,
          cost,
          pnl,
          pnlPct: cost ? (pnl / cost) * 100 : 0,
          weight: total ? (value / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [portfolio, coins]);

  const totals = useMemo(() => {
    const value = rows.reduce((s, r) => s + r.value, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    const pnl = value - cost;
    const dayChange = rows.reduce((s, r) => s + r.value * (r.change24h / 100), 0);
    return { value, cost, pnl, pnlPct: cost ? (pnl / cost) * 100 : 0, dayChange };
  }, [rows]);

  return (
    <div className="mx-auto max-w-[1200px] p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-ink">Portfolio</h1>
          <p className="mt-0.5 text-sm text-muted">Your holdings, marked to live market prices</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="border border-up/40 bg-up/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-up transition-colors hover:bg-up/20"
        >
          + Add holding
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Value" value={fmtUSD(totals.value)} sub={`cost basis ${fmtUSD(totals.cost)}`} />
        <StatCard
          label="Total P&L"
          value={fmtUSD(totals.pnl, { sign: true })}
          accent={totals.pnl >= 0 ? "up" : "down"}
          sub={`${totals.pnlPct >= 0 ? "+" : ""}${totals.pnlPct.toFixed(2)}% all-time`}
        />
        <StatCard
          label="24h Change"
          value={fmtUSD(totals.dayChange, { sign: true })}
          accent={totals.dayChange >= 0 ? "up" : "down"}
          sub="mark-to-market"
        />
        <StatCard label="Positions" value={rows.length || "—"} sub="open holdings" />
      </div>

      {/* Allocation bar */}
      {rows.length > 0 && (
        <Panel className="mb-5" title="Allocation" ticks>
          <div className="p-4">
            <div className="flex h-3 w-full overflow-hidden border border-line">
              {rows.map((r, i) => (
                <div
                  key={r.coinId}
                  title={`${r.symbol} ${r.weight.toFixed(1)}%`}
                  style={{ width: `${r.weight}%`, background: ALLOC_COLORS[i % ALLOC_COLORS.length] }}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {rows.map((r, i) => (
                <span key={r.coinId} className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
                  <span className="h-2 w-2" style={{ background: ALLOC_COLORS[i % ALLOC_COLORS.length] }} />
                  {r.symbol} <span className="text-ink-soft">{r.weight.toFixed(1)}%</span>
                </span>
              ))}
            </div>
          </div>
        </Panel>
      )}

      <Panel title={<span className="text-ink-soft">Holdings</span>} ticks>
        {isLoading ? (
          <div className="p-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton my-2 h-10" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center font-mono text-xs text-muted">
            No holdings yet. Use “Add holding” or the “+ Portfolio” button on any coin.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Avg Cost</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Value</th>
                  <th className="px-3 py-2 text-right">P&L</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.coinId} className="border-b border-line/60 hover:bg-panel-2">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <CoinAvatar src={r.image} symbol={r.symbol} size={24} />
                        <div className="flex flex-col leading-tight">
                          <span className="text-ink">{r.name}</span>
                          <span className="font-mono text-[10px] uppercase text-muted">{r.symbol}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-ink-soft">{r.quantity}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted">${fmtPrice(r.avgCost)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-ink">${fmtPrice(r.price)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-ink">{fmtUSD(r.value)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className={clsx("font-mono text-xs tabular-nums", r.pnl >= 0 ? "text-up" : "text-down")}>
                        {fmtUSD(r.pnl, { sign: true })}
                      </div>
                      <PriceChange value={r.pnlPct} showArrow={false} className="justify-end" />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => remove.mutate(r.coinId)}
                        className="font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:text-down"
                        title="Remove holding"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {adding && (
        <AddHoldingModal
          coins={(coins ?? []).map((c) => ({ id: c.id, symbol: c.symbol, price: c.price }))}
          pending={upsert.isPending}
          onSubmit={async (input) => {
            await upsert.mutateAsync(input);
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function AddHoldingModal({
  coins,
  onSubmit,
  onClose,
  pending,
}: {
  coins: { id: string; symbol: string; price: number }[];
  onSubmit: (input: { coinId: string; quantity: number; avgCost: number }) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [coinId, setCoinId] = useState(coins[0]?.id ?? "bitcoin");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ coinId, quantity: Number(qty), avgCost: Number(cost) });
  };

  return (
    <Modal open onClose={onClose} title="Add holding">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted">Asset</label>
          <select
            value={coinId}
            onChange={(e) => {
              setCoinId(e.target.value);
              const c = coins.find((x) => x.id === e.target.value);
              if (c && !cost) setCost(c.price.toFixed(2));
            }}
            className="w-full border border-line bg-void px-3 py-2 font-mono text-sm text-ink outline-none focus:border-up/50"
          >
            {coins.map((c) => (
              <option key={c.id} value={c.id} className="bg-panel">
                {c.symbol} — {c.id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted">Quantity</label>
          <input
            type="number" step="any" value={qty} autoFocus
            onChange={(e) => setQty(e.target.value)} placeholder="0.00"
            className="w-full border border-line bg-void px-3 py-2 font-mono text-sm text-ink outline-none focus:border-up/50"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted">Avg cost (USD)</label>
          <input
            type="number" step="any" value={cost}
            onChange={(e) => setCost(e.target.value)} placeholder="0.00"
            className="w-full border border-line bg-void px-3 py-2 font-mono text-sm text-ink outline-none focus:border-up/50"
          />
        </div>
        <button
          type="submit"
          disabled={!qty || !cost || pending}
          className="w-full border border-up/40 bg-up/10 py-2 font-mono text-xs uppercase tracking-wider text-up transition-colors hover:bg-up/20 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save holding"}
        </button>
      </form>
    </Modal>
  );
}

export default function PortfolioView() {
  return (
    <ProtectedRoute>
      <PortfolioInner />
    </ProtectedRoute>
  );
}

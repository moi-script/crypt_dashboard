"use client";

import { useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StatCard } from "@/components/StatCard";
import { CoinAvatar } from "@/components/CoinAvatar";
import { Modal } from "@/components/Modal";
import { usePortfolio, useRemoveHolding, useUpsertHolding } from "@/controllers/usePortfolio";
import { useCoinList } from "@/controllers/useCoinList";
import { fmtPrice, fmtUSD } from "@/lib/format";
import type { HoldingRow } from "@/models/portfolio.model";

const COLORS = ["#00e5a0","#36b6ff","#a78bfa","#ffb020","#ff5572","#0a7d52","#6b7785"];

const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)", outline: "none", transition: "all 0.2s" };

function Field({ label, value, onChange, placeholder, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--ink-muted)" }}>{label}</label>
      <input type="number" step="any" value={value} autoFocus={autoFocus} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={inputStyle}
        onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.07)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );
}

function PortfolioInner() {
  const { data: portfolio, isLoading } = usePortfolio();
  const { data: coins } = useCoinList();
  const upsert = useUpsertHolding();
  const remove = useRemoveHolding();
  const [adding, setAdding] = useState(false);

  const rows = useMemo<HoldingRow[]>(() => {
    if (!portfolio || !coins) return [];
    const total = portfolio.holdings.reduce((s, h) => {
      const c = coins.find(x => x.id === h.coinId);
      return s + (c ? c.price * h.quantity : 0);
    }, 0);
    return portfolio.holdings.map(h => {
      const c = coins.find(x => x.id === h.coinId);
      const price = c?.price ?? 0;
      const value = price * h.quantity;
      const cost  = h.avgCost * h.quantity;
      const pnl   = value - cost;
      return { ...h, name: c?.name ?? h.coinId, symbol: c?.symbol ?? h.coinId.slice(0, 4).toUpperCase(), image: c?.image, price, change24h: c?.change24h ?? 0, value, cost, pnl, pnlPct: cost ? (pnl / cost) * 100 : 0, weight: total ? (value / total) * 100 : 0 };
    }).sort((a, b) => b.value - a.value);
  }, [portfolio, coins]);

  const totals = useMemo(() => {
    const value    = rows.reduce((s, r) => s + r.value, 0);
    const cost     = rows.reduce((s, r) => s + r.cost, 0);
    const pnl      = value - cost;
    const dayChange = rows.reduce((s, r) => s + r.value * (r.change24h / 100), 0);
    return { value, cost, pnl, pnlPct: cost ? (pnl / cost) * 100 : 0, dayChange };
  }, [rows]);

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* title */}
      <div className="fade-up fade-up-1" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Portfolio</h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>Your holdings marked to live market prices</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="btn-shiny"
          style={{ padding: "10px 18px", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--up)", background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.22)", cursor: "pointer", transition: "all 0.2s" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(0,229,160,0.18)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = "none"}
        >+ Add Holding</button>
      </div>

      {/* stats */}
      <div className="fade-up fade-up-2" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        <StatCard label="Total Value"  value={fmtUSD(totals.value)}             sub={`Cost basis ${fmtUSD(totals.cost)}`} accent="info" />
        <StatCard label="Total P&L"    value={fmtUSD(totals.pnl, { sign: true })} sub={`${totals.pnlPct >= 0 ? "+" : ""}${totals.pnlPct.toFixed(2)}% all-time`} accent={totals.pnl >= 0 ? "up" : "down"} />
        <StatCard label="24h Change"   value={fmtUSD(totals.dayChange, { sign: true })} sub="Mark-to-market"           accent={totals.dayChange >= 0 ? "up" : "down"} />
        <StatCard label="Positions"    value={rows.length || "—"}               sub="Open holdings" />
      </div>

      {/* allocation bar */}
      {rows.length > 0 && (
        <div className="fade-up fade-up-3 rounded-xl overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(10,20,34,0.94), rgba(5,12,22,0.98))", border: "1px solid rgba(255,255,255,0.052)", padding: 16 }}>
          <span className="label" style={{ display: "block", marginBottom: 10, color: "var(--ink-muted)" }}>Allocation</span>
          <div style={{ display: "flex", height: 12, width: "100%", overflow: "hidden", borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
            {rows.map((r, i) => (
              <div key={r.coinId} title={`${r.symbol} ${r.weight.toFixed(1)}%`} style={{ width: `${r.weight}%`, background: COLORS[i % COLORS.length], boxShadow: `0 0 8px ${COLORS[i % COLORS.length]}60` }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginTop: 10 }}>
            {rows.map((r, i) => (
              <span key={r.coinId} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                {r.symbol} <span style={{ color: "var(--ink-soft)" }}>{r.weight.toFixed(1)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* holdings table */}
      <div className="fade-up fade-up-4 rounded-xl overflow-hidden" style={{ background: "linear-gradient(180deg, rgba(10,20,34,0.94), rgba(5,12,22,0.98))", border: "1px solid rgba(255,255,255,0.052)", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.012)" }}>
          <div style={{ width: 2, height: 14, borderRadius: 1, background: "var(--cyan)", boxShadow: "0 0 8px var(--cyan)" }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-soft)" }}>Holdings</span>
        </div>

        {isLoading ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}
          </div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)" }}>
            No holdings yet. Add your first position above.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
                  {["Asset","Qty","Avg Cost","Price","Value","P&L",""].map(h => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: h === "Asset" || h === "" ? "left" : "right", fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--ink-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.coinId} className="table-row">
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <CoinAvatar src={r.image} symbol={r.symbol} size={28} />
                        <div>
                          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{r.name}</div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--ink-muted)", marginTop: 2 }}>{r.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)" }}>{r.quantity}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted)" }}>${fmtPrice(r.avgCost)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>${fmtPrice(r.price)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>{fmtUSD(r.value)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: r.pnl >= 0 ? "var(--up)" : "var(--down)" }}>{fmtUSD(r.pnl, { sign: true })}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: r.pnlPct >= 0 ? "var(--up)" : "var(--down)", opacity: 0.75 }}>{r.pnlPct >= 0 ? "+" : ""}{r.pnlPct.toFixed(2)}%</div>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <button onClick={() => remove.mutate(r.coinId)} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-faint)", background: "none", border: "none", cursor: "pointer", transition: "color 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "var(--down)")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-faint)")}
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* add modal */}
      {adding && (
        <AddModal
          coins={(coins ?? []).map(c => ({ id: c.id, symbol: c.symbol, price: c.price }))}
          pending={upsert.isPending}
          onSubmit={async input => { await upsert.mutateAsync(input); setAdding(false); }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function AddModal({ coins, onSubmit, onClose, pending }: {
  coins: { id: string; symbol: string; price: number }[];
  onSubmit: (i: { coinId: string; quantity: number; avgCost: number }) => void;
  onClose: () => void; pending: boolean;
}) {
  const [coinId, setCoinId] = useState(coins[0]?.id ?? "bitcoin");
  const [qty,  setQty]  = useState("");
  const [cost, setCost] = useState("");

  return (
    <Modal open onClose={onClose} title="Add Holding">
      <form onSubmit={e => { e.preventDefault(); onSubmit({ coinId, quantity: Number(qty), avgCost: Number(cost) }); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--ink-muted)" }}>Asset</label>
          <select value={coinId} onChange={e => { setCoinId(e.target.value); const c = coins.find(x => x.id === e.target.value); if (c && !cost) setCost(c.price.toFixed(2)); }} style={inputStyle}
            onFocus={e => e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)"}
            onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
          >
            {coins.map(c => <option key={c.id} value={c.id}>{c.symbol} — {c.id}</option>)}
          </select>
        </div>
        <Field label="Quantity"      value={qty}  onChange={setQty}  placeholder="0.00" autoFocus />
        <Field label="Avg Cost (USD)" value={cost} onChange={setCost} placeholder="0.00" />
        <button type="submit" disabled={!qty || !cost || pending}
          className="btn-shiny"
          style={{ width: "100%", padding: "12px", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--up)", background: "rgba(0,229,160,0.09)", border: "1px solid rgba(0,229,160,0.24)", cursor: "pointer", opacity: (!qty || !cost || pending) ? 0.4 : 1, transition: "all 0.2s" }}
        >{pending ? "Saving…" : "Save Holding"}</button>
      </form>
    </Modal>
  );
}

export default function PortfolioView() {
  return <ProtectedRoute><PortfolioInner /></ProtectedRoute>;
}
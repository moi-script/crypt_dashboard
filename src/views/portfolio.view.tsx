"use client";

import { useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StatCard } from "@/components/StatCard";
import { CoinAvatar } from "@/components/CoinAvatar";
import { Modal } from "@/components/Modal";
import { usePortfolio, useRemoveHolding, useUpsertHolding } from "@/controllers/usePortfolio";
import { useWallet, useWalletStats, useWalletTrades, useResetWallet } from "@/controllers/usePaperWallet";
import { useCoinList } from "@/controllers/useCoinList";
import { fmtPrice, fmtUSD } from "@/lib/format";
import type { HoldingRow } from "@/models/portfolio.model";

const COLORS = ["#00e5a0","#36b6ff","#a78bfa","#ffb020","#ff5572","#0a7d52","#6b7785"];

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
  fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)", outline: "none", transition: "all 0.2s",
};

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

// ── Paper Wallet Section ──────────────────────────────────────────────────────

function AgentWallet() {
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: stats } = useWalletStats();
  const { data: tradesResp } = useWalletTrades({ limit: 10 });
  const { data: coins } = useCoinList();
  const reset = useResetWallet();
  const [confirmReset, setConfirmReset] = useState(false);

  // Enrich balances with live prices by matching symbol
  const balanceRows = useMemo(() => {
    if (!wallet) return [];
    return wallet.balances
      .filter(b => b.amount > 0)
      .map(b => {
        const coin = coins?.find(c => c.symbol.toUpperCase() === b.symbol.toUpperCase());
        const livePrice = coin?.price ?? b.avgCostUsd;
        const liveValue = livePrice * b.amount;
        const costBasis = b.avgCostUsd * b.amount;
        const pnl      = liveValue - costBasis;
        const pnlPct   = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
        return { ...b, coin, livePrice, liveValue, costBasis, pnl, pnlPct };
      })
      .sort((a, b) => b.liveValue - a.liveValue);
  }, [wallet, coins]);

  const totalLiveValue = balanceRows.reduce((s, r) => s + r.liveValue, 0);
  const returnPct = wallet ? ((wallet.totalValueUsd - wallet.initialUsd) / wallet.initialUsd) * 100 : 0;

  const trades = tradesResp?.trades ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Agent wallet stats */}
      <div className="fade-up fade-up-2" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        <StatCard
          label="Wallet Value"
          value={walletLoading ? "—" : fmtUSD(wallet?.totalValueUsd ?? 0)}
          sub={`Started with ${fmtUSD(wallet?.initialUsd ?? 5000)}`}
          accent="info"
        />
        <StatCard
          label="Total Return"
          value={walletLoading ? "—" : `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(2)}%`}
          sub={fmtUSD((wallet?.totalValueUsd ?? 0) - (wallet?.initialUsd ?? 5000), { sign: true })}
          accent={returnPct >= 0 ? "up" : "down"}
        />
        <StatCard
          label="Realized P&L"
          value={walletLoading ? "—" : fmtUSD(wallet?.realizedPnlUsd ?? 0, { sign: true })}
          sub="Closed positions"
          accent={(wallet?.realizedPnlUsd ?? 0) >= 0 ? "up" : "down"}
        />
        <StatCard
          label="Win Rate"
          value={stats ? `${stats.trades.winRate.toFixed(1)}%` : "—"}
          sub={stats ? `${stats.trades.winners}W / ${stats.trades.losers}L` : "Loading…"}
          accent="info"
        />
      </div>

      {/* Trade stats row */}
      {stats && (
        <div className="fade-up fade-up-3" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { label: "Total Trades", value: stats.trades.total },
            { label: "Total Volume",  value: fmtUSD(stats.trades.totalVolume) },
            { label: "Avg Win",       value: fmtUSD(stats.trades.avgWinUsd) },
            { label: "Total Fees",    value: fmtUSD(stats.trades.totalFees) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-muted)", marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Allocation bar */}
      {balanceRows.length > 0 && (
        <div className="fade-up fade-up-3 rounded-xl overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(10,20,34,0.94), rgba(5,12,22,0.98))", border: "1px solid rgba(255,255,255,0.052)", padding: 16 }}>
          <span className="label" style={{ display: "block", marginBottom: 10, color: "var(--ink-muted)" }}>Allocation</span>
          <div style={{ display: "flex", height: 12, width: "100%", overflow: "hidden", borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
            {balanceRows.map((r, i) => {
              const weight = totalLiveValue > 0 ? (r.liveValue / totalLiveValue) * 100 : 0;
              return <div key={r.symbol} title={`${r.symbol} ${weight.toFixed(1)}%`} style={{ width: `${weight}%`, background: COLORS[i % COLORS.length], boxShadow: `0 0 8px ${COLORS[i % COLORS.length]}60` }} />;
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginTop: 10 }}>
            {balanceRows.map((r, i) => {
              const weight = totalLiveValue > 0 ? (r.liveValue / totalLiveValue) * 100 : 0;
              return (
                <span key={r.symbol} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                  {r.symbol} <span style={{ color: "var(--ink-soft)" }}>{weight.toFixed(1)}%</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Token balances table */}
      <div className="fade-up fade-up-4 rounded-xl overflow-hidden" style={{ background: "linear-gradient(180deg, rgba(10,20,34,0.94), rgba(5,12,22,0.98))", border: "1px solid rgba(255,255,255,0.052)", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.012)" }}>
          <div style={{ width: 2, height: 14, borderRadius: 1, background: "var(--cyan)", boxShadow: "0 0 8px var(--cyan)" }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-soft)", flex: 1 }}>
            Agent Holdings
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-faint)" }}>Live mark-to-market</span>
        </div>

        {walletLoading ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}
          </div>
        ) : balanceRows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)" }}>
            No open positions. The agent hasn't traded yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
                  {["Asset","Amount","Avg Cost","Live Price","Value","Unrealized P&L"].map(h => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: h === "Asset" ? "left" : "right", fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--ink-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {balanceRows.map(r => (
                  <tr key={r.symbol} className="table-row">
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <CoinAvatar src={r.coin?.image} symbol={r.symbol} size={28} />
                        <div>
                          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{r.coin?.name ?? r.symbol}</div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--ink-muted)", marginTop: 2 }}>{r.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)" }}>{r.amount.toFixed(4)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted)" }}>${fmtPrice(r.avgCostUsd)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>${fmtPrice(r.livePrice)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>{fmtUSD(r.liveValue)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: r.pnl >= 0 ? "var(--up)" : "var(--down)" }}>{fmtUSD(r.pnl, { sign: true })}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: r.pnlPct >= 0 ? "var(--up)" : "var(--down)", opacity: 0.75 }}>{r.pnlPct >= 0 ? "+" : ""}{r.pnlPct.toFixed(2)}%</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent trades */}
      {trades.length > 0 && (
        <div className="fade-up fade-up-5 rounded-xl overflow-hidden" style={{ background: "linear-gradient(180deg, rgba(10,20,34,0.94), rgba(5,12,22,0.98))", border: "1px solid rgba(255,255,255,0.052)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.012)" }}>
            <div style={{ width: 2, height: 14, borderRadius: 1, background: "#a78bfa", boxShadow: "0 0 8px #a78bfa" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-soft)" }}>Recent Trades</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
                  {["Time","Side","Pair","Amount","Price","P&L","Strategy"].map(h => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: h === "Time" || h === "Side" || h === "Pair" || h === "Strategy" ? "left" : "right", fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--ink-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.txId} className="table-row">
                    <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>
                      {new Date(t.executedAt).toLocaleDateString()} {new Date(t.executedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: t.side === "buy" ? "var(--up)" : "var(--down)", background: t.side === "buy" ? "rgba(0,229,160,0.08)" : "rgba(255,85,114,0.08)", padding: "2px 6px", borderRadius: 4 }}>{t.side}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-soft)" }}>{t.tokenIn} → {t.tokenOut}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-soft)" }}>{fmtUSD(t.amountUsd)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)" }}>${fmtPrice(t.priceUsd)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      {t.realizedPnlUsd != null ? (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: t.realizedPnlUsd >= 0 ? "var(--up)" : "var(--down)" }}>
                          {fmtUSD(t.realizedPnlUsd, { sign: true })}
                        </span>
                      ) : <span style={{ color: "var(--ink-faint)", fontFamily: "var(--font-mono)", fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)" }}>{t.strategy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reset wallet (dev) */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {confirmReset ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmReset(false)} style={{ padding: "7px 14px", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>Cancel</button>
            <button onClick={() => { reset.mutate(); setConfirmReset(false); }} disabled={reset.isPending}
              style={{ padding: "7px 14px", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--down)", background: "rgba(255,85,114,0.08)", border: "1px solid rgba(255,85,114,0.18)", cursor: "pointer" }}>
              {reset.isPending ? "Resetting…" : "Confirm Reset"}
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)}
            style={{ padding: "7px 14px", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)", background: "none", border: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}>
            Reset Wallet to $5,000
          </button>
        )}
      </div>
    </div>
  );
}

// ── Manual Holdings Section ───────────────────────────────────────────────────

function ManualHoldings() {
  const { data: portfolio, isLoading } = usePortfolio();
  const { data: coins } = useCoinList();
  const upsert = useUpsertHolding();
  const remove = useRemoveHolding();
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  return (
    <div className="fade-up fade-up-6 rounded-xl overflow-hidden" style={{ background: "linear-gradient(180deg, rgba(10,20,34,0.94), rgba(5,12,22,0.98))", border: "1px solid rgba(255,255,255,0.052)" }}>
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 18px", borderBottom: expanded ? "1px solid rgba(255,255,255,0.04)" : "none", background: "rgba(255,255,255,0.012)", cursor: "pointer" }}
      >
        <div style={{ width: 2, height: 14, borderRadius: 1, background: "#ffb020", boxShadow: "0 0 8px #ffb020" }} />
        <span style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-soft)", flex: 1 }}>
          Manual Holdings <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>({rows.length})</span>
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)" }}>{expanded ? "▲ collapse" : "▼ expand"}</span>
      </div>

      {expanded && (
        <>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setAdding(true)} className="btn-shiny"
              style={{ padding: "8px 14px", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--up)", background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.22)", cursor: "pointer" }}>
              + Add Holding
            </button>
          </div>

          {isLoading ? (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}
            </div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 20px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)" }}>
              No manual holdings. Track your personal positions here.
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
        </>
      )}

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

// ── Root ──────────────────────────────────────────────────────────────────────

function PortfolioInner() {
  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="fade-up fade-up-1">
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Portfolio</h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>Agent paper wallet · live mark-to-market</p>
      </div>

      <AgentWallet />
      <ManualHoldings />
    </div>
  );
}

export default function PortfolioView() {
  return <ProtectedRoute><PortfolioInner /></ProtectedRoute>;
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CandlestickChart } from "@/components/CandlestickChart";
import { RangeTabs } from "@/components/RangeTabs";
import { SignalBadge } from "@/components/SignalBadge";
import { CoinAvatar } from "@/components/CoinAvatar";
import { NewsCard } from "@/components/NewsCard";
import { Modal } from "@/components/Modal";
import { useCoinDetail, useIndicators, useOHLCV } from "@/controllers/useCoinDetail";
import { useCoinNews } from "@/controllers/useNewsFeed";
import { useAuth } from "@/controllers/useAuth";
import { useUpsertHolding } from "@/controllers/usePortfolio";
import { useCreateAlert } from "@/controllers/useAlerts";
import { computeSignal } from "@/lib/signals";
import { fmtCompact, fmtPrice, fmtPct, fmtUSD } from "@/lib/format";
import type { OHLCVRange } from "@/models/coin.model";
import type { AlertCondition } from "@/models/alert.model";

const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)", outline: "none", transition: "all 0.2s" };

function RsiGauge({ value }: { value: number }) {
  const pct  = Math.min(100, Math.max(0, value));
  const col  = value < 30 ? "var(--up)" : value > 70 ? "var(--down)" : "var(--warn)";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="label" style={{ color: "var(--ink-muted)" }}>RSI-14</span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: col }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: "0 auto 0 30%", width: 1, background: "rgba(255,255,255,0.1)" }} />
        <div style={{ position: "absolute", inset: "0 auto 0 70%", width: 1, background: "rgba(255,255,255,0.1)" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pct}%`, width: 3, background: col, borderRadius: 2, boxShadow: `0 0 6px ${col}`, transform: "translateX(-1px)" }} />
      </div>
    </div>
  );
}

function IndRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)" }}>{value}</span>
    </div>
  );
}

function AuthGate() {
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted)", marginBottom: 14 }}>Sign in to use this action.</p>
      <Link href="/login" style={{ display: "inline-block", padding: "10px 20px", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--cyan)", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.22)", textDecoration: "none" }}>Sign in →</Link>
    </div>
  );
}

export default function CoinDetailView() {
  const params = useParams<{ id: string }>();
  const id = params?.id && params.id !== "undefined" ? params.id : "";

  const [range, setRange] = useState<OHLCVRange>("1D");
  const [modal, setModal] = useState<"none" | "hold" | "alert">("none");

  const { data: coin, isLoading: coinLoading } = useCoinDetail(id);
  const { data: ohlcv, isLoading: ohlcvLoading } = useOHLCV(id, range);
  const { data: indicators } = useIndicators(id, 100);
  const { data: news } = useCoinNews(id, 6);

  const latest = indicators?.[indicators.length - 1];
  const signal = useMemo(() => computeSignal(latest, coin?.price), [latest, coin?.price]);

  if (!id) return null;

  const stats = [
    { l: "24h Volume",   v: coin ? `$${fmtCompact(coin.volume24h)}` : "—" },
    { l: "Market Cap",   v: coin ? `$${fmtCompact(coin.marketCap)}` : "—" },
    { l: "MACD",         v: latest ? latest.macd.toFixed(2) : "—" },
    { l: "Signal Score", v: `${signal.score > 0 ? "+" : ""}${signal.score}` },
  ];

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* back link */}
      <Link href="/" className="fade-up fade-up-1" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--ink-muted)", textDecoration: "none", transition: "color 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--cyan)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-muted)")}
      >← Markets</Link>

      {/* header */}
      <div className="fade-up fade-up-2" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <CoinAvatar src={coin?.image} symbol={coin?.symbol ?? id.slice(0, 3)} size={52} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em" }}>{coin?.name ?? id}</h1>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--cyan)", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.18)", padding: "3px 8px", borderRadius: 6 }}>{coin?.symbol ?? "—"}</span>
              {coin?.rank && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-faint)" }}>RANK #{coin.rank}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800, color: "var(--ink)" }}>
                {coin ? `$${fmtPrice(coin.price)}` : <span style={{ color: "var(--ink-muted)" }}>———</span>}
              </span>
              {coin && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: coin.change24h >= 0 ? "var(--up)" : "var(--down)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 9 }}>{coin.change24h >= 0 ? "▲" : "▼"}</span>
                  {fmtPct(coin.change24h, { sign: false })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <SignalBadge verdict={signal.verdict} size="lg" />
          <button onClick={() => setModal("hold")} className="btn-shiny" style={{ padding: "10px 16px", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--up)", background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.22)", cursor: "pointer", transition: "all 0.2s" }}>
            + Portfolio
          </button>
          <button onClick={() => setModal("alert")} style={{ padding: "10px 16px", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--warn)", background: "rgba(255,176,32,0.06)", border: "1px solid rgba(255,176,32,0.2)", cursor: "pointer", transition: "all 0.2s" }}>
            ⊕ Alert
          </button>
        </div>
      </div>

      {/* stat strip */}
      <div className="fade-up fade-up-3" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, overflow: "hidden", borderRadius: 12, border: "1px solid rgba(255,255,255,0.052)" }}>
        {stats.map(s => (
          <div key={s.l} style={{ background: "rgba(10,20,34,0.95)", padding: "12px 16px" }}>
            <div className="label" style={{ color: "var(--ink-muted)", marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* chart + indicators */}
      <div className="fade-up fade-up-4" style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr", ...(typeof window !== "undefined" && window.innerWidth >= 1024 ? { gridTemplateColumns: "2fr 1fr" } : {}) }}>
        <div className="lg:col-span-2" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            {/* chart */}
            <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(180deg, rgba(10,20,34,0.95), rgba(5,12,22,0.98))", border: "1px solid rgba(255,255,255,0.052)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-soft)" }}>Candles · {coin?.symbol ?? id}</span>
                <RangeTabs value={range} onChange={setRange} />
              </div>
              <div style={{ padding: 8 }}>
                <CandlestickChart data={ohlcv ?? []} loading={ohlcvLoading || coinLoading} height={380} />
              </div>
            </div>

            {/* signal + indicators */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* technical read */}
              <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(10,20,34,0.95), rgba(5,12,22,0.98))", border: "1px solid rgba(255,255,255,0.052)" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--ink-muted)" }}>Technical Read</span>
                </div>
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <SignalBadge verdict={signal.verdict} size="lg" />
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: signal.score >= 0 ? "var(--up)" : "var(--down)" }}>
                      {signal.score > 0 ? "+" : ""}{signal.score}
                    </span>
                  </div>
                  {latest && <RsiGauge value={latest.rsi14} />}
                  <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {signal.reasons.map((r, i) => (
                      <li key={`${r.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 10 }}>
                        <span style={{ color: r.bias === "bull" ? "var(--up)" : r.bias === "bear" ? "var(--down)" : "var(--ink-faint)", fontSize: 7 }}>
                          {r.bias === "bull" ? "▲" : r.bias === "bear" ? "▼" : "■"}
                        </span>
                        <span style={{ color: "var(--ink-muted)" }}>{r.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* indicators */}
              <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(10,20,34,0.95), rgba(5,12,22,0.98))", border: "1px solid rgba(255,255,255,0.052)" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--ink-muted)" }}>Indicators</span>
                </div>
                {latest ? (
                  <>
                    <IndRow label="SMA-20"   value={`$${fmtPrice(latest.sma20)}`} />
                    <IndRow label="EMA-50"   value={`$${fmtPrice(latest.ema50)}`} />
                    <IndRow label="MACD"     value={latest.macd.toFixed(3)} />
                    <IndRow label="Signal"   value={latest.signal.toFixed(3)} />
                    <IndRow label="BB Upper" value={`$${fmtPrice(latest.bbUpper)}`} />
                    <IndRow label="BB Lower" value={`$${fmtPrice(latest.bbLower)}`} />
                  </>
                ) : (
                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 16, borderRadius: 4 }} />)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* news */}
      {(news?.length ?? 0) > 0 && (
        <div className="fade-up fade-up-5 rounded-xl overflow-hidden" style={{ background: "linear-gradient(180deg, rgba(10,20,34,0.94), rgba(5,12,22,0.98))", border: "1px solid rgba(255,255,255,0.052)" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.012)" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-soft)" }}>Related Headlines</span>
          </div>
          <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {news!.map(a => <NewsCard key={a.id} article={a} />)}
          </div>
        </div>
      )}

      {/* modals */}
      {modal === "hold" && coin && <HoldingModal coinId={id} symbol={coin.symbol} price={coin.price} onClose={() => setModal("none")} />}
      {modal === "alert" && coin && <AlertModal coinId={id} symbol={coin.symbol} price={coin.price} onClose={() => setModal("none")} />}
    </div>
  );
}

function HoldingModal({ coinId, symbol, price, onClose }: { coinId: string; symbol: string; price: number; onClose: () => void }) {
  const { status } = useAuth();
  const upsert = useUpsertHolding();
  const [qty,  setQty]  = useState("");
  const [cost, setCost] = useState(price.toFixed(2));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsert.mutateAsync({ coinId, quantity: Number(qty), avgCost: Number(cost) });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Add ${symbol} to Portfolio`}>
      {status !== "authed" ? <AuthGate /> : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--ink-muted)" }}>Quantity</label>
            <input type="number" step="any" value={qty} autoFocus onChange={e => setQty(e.target.value)} placeholder="0.00" style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.07)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--ink-muted)" }}>Avg Cost (USD)</label>
            <input type="number" step="any" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.07)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>
          <button type="submit" disabled={!qty || upsert.isPending} className="btn-shiny"
            style={{ width: "100%", padding: "12px", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--up)", background: "rgba(0,229,160,0.09)", border: "1px solid rgba(0,229,160,0.24)", cursor: "pointer", opacity: (!qty || upsert.isPending) ? 0.5 : 1, transition: "all 0.2s" }}
          >{upsert.isPending ? "Saving…" : "Save Holding"}</button>
        </form>
      )}
    </Modal>
  );
}

function AlertModal({ coinId, symbol, price, onClose }: { coinId: string; symbol: string; price: number; onClose: () => void }) {
  const { status } = useAuth();
  const create = useCreateAlert();
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [threshold, setThreshold] = useState(price.toFixed(2));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({ coinId, condition, threshold: Number(threshold) });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Alert on ${symbol}`}>
      {status !== "authed" ? <AuthGate /> : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--ink-muted)" }}>Condition</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {(["above", "below", "pct_change"] as AlertCondition[]).map(c => (
                <button key={c} type="button" onClick={() => setCondition(c)} style={{ padding: "8px", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer", transition: "all 0.15s", background: condition === c ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${condition === c ? "rgba(0,212,255,0.28)" : "rgba(255,255,255,0.07)"}`, color: condition === c ? "var(--cyan)" : "var(--ink-muted)" }}>
                  {c === "pct_change" ? "± %" : c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--ink-muted)" }}>{condition === "pct_change" ? "Percent (%)" : "Threshold (USD)"}</label>
            <input type="number" step="any" value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="0.00" style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.07)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>
          <button type="submit" disabled={!threshold || create.isPending} className="btn-shiny"
            style={{ width: "100%", padding: "12px", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--warn)", background: "rgba(255,176,32,0.08)", border: "1px solid rgba(255,176,32,0.24)", cursor: "pointer", opacity: (!threshold || create.isPending) ? 0.5 : 1, transition: "all 0.2s" }}
          >{create.isPending ? "Creating…" : "Create Alert"}</button>
        </form>
      )}
    </Modal>
  );
}
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CandlestickChart } from "@/components/CandlestickChart";
import { RangeTabs } from "@/components/RangeTabs";
import { SignalBadge } from "@/components/SignalBadge";
import { PriceChange } from "@/components/PriceChange";
import { CoinAvatar } from "@/components/CoinAvatar";
import { Panel } from "@/components/Panel";
import { NewsCard } from "@/components/NewsCard";
import { Modal } from "@/components/Modal";
import { useCoinDetail, useIndicators, useOHLCV } from "@/controllers/useCoinDetail";
import { useCoinNews } from "@/controllers/useNewsFeed";
import { useAuth } from "@/controllers/useAuth";
import { useUpsertHolding } from "@/controllers/usePortfolio";
import { useCreateAlert } from "@/controllers/useAlerts";
import { computeSignal } from "@/lib/signals";
import { clsx, fmtCompact, fmtPrice } from "@/lib/format";
import type { OHLCVRange } from "@/models/coin.model";
import type { AlertCondition } from "@/models/alert.model";

function RsiGauge({ value }: { value: number }) {
  const zone = value < 30 ? "text-up" : value > 70 ? "text-down" : "text-warn";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">RSI-14</span>
        <span className={clsx("font-mono text-sm tabular-nums", zone)}>{value.toFixed(1)}</span>
      </div>
      <div className="relative mt-1.5 h-1.5 w-full bg-line">
        <div className="absolute inset-y-0 left-[30%] w-px bg-faint" />
        <div className="absolute inset-y-0 left-[70%] w-px bg-faint" />
        <div
          className="absolute top-1/2 h-3 w-1 -translate-y-1/2 bg-ink"
          style={{ left: `calc(${Math.min(100, Math.max(0, value))}% - 2px)` }}
        />
      </div>
    </div>
  );
}

function IndicatorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line/60 px-3 py-2 last:border-0">
      <span className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</span>
      <span className="font-mono text-xs tabular-nums text-ink-soft">{value}</span>
    </div>
  );
}

export default function CoinDetailView() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [range, setRange] = useState<OHLCVRange>("1D");
  const [modal, setModal] = useState<"none" | "hold" | "alert">("none");

  const { data: coin, isLoading: coinLoading } = useCoinDetail(id);
  const { data: ohlcv, isLoading: ohlcvLoading } = useOHLCV(id, range);
  const { data: indicators } = useIndicators(id, 100);
  const { data: news } = useCoinNews(id, 6);

  const latest = indicators?.[indicators.length - 1];
  const signal = useMemo(() => computeSignal(latest, coin?.price), [latest, coin?.price]);

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-6">
      <Link href="/" className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-up">
        ← markets
      </Link>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <CoinAvatar src={coin?.image} symbol={coin?.symbol ?? id.slice(0, 3)} size={48} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-2xl font-bold tracking-tight text-ink">
                {coin?.name ?? id}
              </h1>
              <span className="border border-line bg-elev px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                {coin?.symbol ?? "—"}
              </span>
              {coin?.rank && (
                <span className="font-mono text-[10px] text-faint">RANK #{coin.rank}</span>
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-mono text-3xl font-bold tabular-nums text-ink">
                {coin ? `$${fmtPrice(coin.price)}` : <span className="text-muted">———</span>}
              </span>
              {coin && <PriceChange value={coin.change24h} size="lg" />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SignalBadge verdict={signal.verdict} size="lg" />
          <button
            onClick={() => setModal("hold")}
            className="border border-up/40 bg-up/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-up transition-colors hover:bg-up/20"
          >
            + Portfolio
          </button>
          <button
            onClick={() => setModal("alert")}
            className="border border-line px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft transition-colors hover:border-warn/50 hover:text-warn"
          >
            ⊕ Alert
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden border border-line bg-line md:grid-cols-4">
        {[
          { l: "24h Volume", v: coin ? `$${fmtCompact(coin.volume24h)}` : "—" },
          { l: "Market Cap", v: coin ? `$${fmtCompact(coin.marketCap)}` : "—" },
          { l: "MACD", v: latest ? latest.macd.toFixed(2) : "—" },
          { l: "Signal Score", v: `${signal.score > 0 ? "+" : ""}${signal.score}` },
        ].map((s) => (
          <div key={s.l} className="bg-panel px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{s.l}</div>
            <div className="mt-0.5 font-mono text-sm tabular-nums text-ink">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Chart */}
        <Panel
          className="lg:col-span-2"
          title={<span className="text-ink-soft">Candles · {coin?.symbol ?? id}</span>}
          right={<RangeTabs value={range} onChange={setRange} />}
          ticks
        >
          <div className="p-2">
            <CandlestickChart data={ohlcv ?? []} loading={ohlcvLoading || coinLoading} height={400} />
          </div>
        </Panel>

        {/* Signal + indicators */}
        <div className="flex flex-col gap-4">
          <Panel title="Technical Read" ticks>
            <div className="space-y-3 p-3">
              <div className="flex items-center justify-between">
                <SignalBadge verdict={signal.verdict} size="lg" />
                <span className={clsx("font-mono text-lg tabular-nums", signal.score >= 0 ? "text-up" : "text-down")}>
                  {signal.score > 0 ? "+" : ""}{signal.score}
                </span>
              </div>
              {latest && <RsiGauge value={latest.rsi14} />}
              <ul className="space-y-1.5 pt-1">
                {signal.reasons.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className={clsx(r.bias === "bull" ? "text-up" : r.bias === "bear" ? "text-down" : "text-faint")}>
                      {r.bias === "bull" ? "▲" : r.bias === "bear" ? "▼" : "■"}
                    </span>
                    <span className="text-ink-soft">{r.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel title="Indicators" bodyClassName="" ticks>
            {latest ? (
              <>
                <IndicatorRow label="SMA-20" value={`$${fmtPrice(latest.sma20)}`} />
                <IndicatorRow label="EMA-50" value={`$${fmtPrice(latest.ema50)}`} />
                <IndicatorRow label="MACD" value={latest.macd.toFixed(3)} />
                <IndicatorRow label="Signal" value={latest.signal.toFixed(3)} />
                <IndicatorRow label="BB Upper" value={`$${fmtPrice(latest.bbUpper)}`} />
                <IndicatorRow label="BB Lower" value={`$${fmtPrice(latest.bbLower)}`} />
              </>
            ) : (
              <div className="p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton my-1.5 h-4 w-full" />
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* News */}
      <Panel className="mt-4" title={<span className="text-ink-soft">Related Headlines</span>} ticks>
        {news?.length ? (
          news.map((a) => <NewsCard key={a.id} article={a} compact />)
        ) : (
          <p className="px-4 py-6 text-center font-mono text-xs text-muted">
            No recent headlines mention {coin?.symbol ?? id}.
          </p>
        )}
      </Panel>

      {modal === "hold" && coin && (
        <HoldingModal coinId={id} symbol={coin.symbol} price={coin.price} onClose={() => setModal("none")} />
      )}
      {modal === "alert" && coin && (
        <AlertModal coinId={id} symbol={coin.symbol} price={coin.price} onClose={() => setModal("none")} />
      )}
    </div>
  );
}

/* ── Quick-action modals ──────────────────────────────────────────────────── */

function AuthGate() {
  return (
    <div className="text-center">
      <p className="mb-3 text-sm text-muted">Sign in to use this action.</p>
      <Link
        href="/login"
        className="inline-block border border-up/40 bg-up/10 px-4 py-2 font-mono text-xs uppercase tracking-wider text-up hover:bg-up/20"
      >
        Sign in →
      </Link>
    </div>
  );
}

function HoldingModal({
  coinId,
  symbol,
  price,
  onClose,
}: {
  coinId: string;
  symbol: string;
  price: number;
  onClose: () => void;
}) {
  const { status } = useAuth();
  const upsert = useUpsertHolding();
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState(price.toFixed(2));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsert.mutateAsync({ coinId, quantity: Number(qty), avgCost: Number(cost) });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Add ${symbol} to portfolio`}>
      {status !== "authed" ? (
        <AuthGate />
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Field label="Quantity" value={qty} onChange={setQty} placeholder="0.00" autoFocus />
          <Field label="Avg cost (USD)" value={cost} onChange={setCost} placeholder="0.00" />
          <button
            type="submit"
            disabled={!qty || upsert.isPending}
            className="w-full border border-up/40 bg-up/10 py-2 font-mono text-xs uppercase tracking-wider text-up transition-colors hover:bg-up/20 disabled:opacity-40"
          >
            {upsert.isPending ? "Saving…" : "Save holding"}
          </button>
        </form>
      )}
    </Modal>
  );
}

function AlertModal({
  coinId,
  symbol,
  price,
  onClose,
}: {
  coinId: string;
  symbol: string;
  price: number;
  onClose: () => void;
}) {
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
      {status !== "authed" ? (
        <AuthGate />
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted">
              Condition
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(["above", "below", "pct_change"] as AlertCondition[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={clsx(
                    "border py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
                    condition === c ? "border-up/40 bg-up/10 text-up" : "border-line text-muted hover:text-ink",
                  )}
                >
                  {c === "pct_change" ? "± %" : c}
                </button>
              ))}
            </div>
          </div>
          <Field
            label={condition === "pct_change" ? "Percent (%)" : "Threshold (USD)"}
            value={threshold}
            onChange={setThreshold}
            placeholder="0.00"
          />
          <button
            type="submit"
            disabled={!threshold || create.isPending}
            className="w-full border border-warn/40 bg-warn/10 py-2 font-mono text-xs uppercase tracking-wider text-warn transition-colors hover:bg-warn/20 disabled:opacity-40"
          >
            {create.isPending ? "Creating…" : "Create alert"}
          </button>
        </form>
      )}
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted">
        {label}
      </label>
      <input
        type="number"
        step="any"
        inputMode="decimal"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-line bg-void px-3 py-2 font-mono text-sm text-ink outline-none transition-colors focus:border-up/50"
      />
    </div>
  );
}

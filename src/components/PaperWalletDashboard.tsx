"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRightLeft,
  Wallet,
  BarChart3,
  History,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
  AlertTriangle,
  Filter,
  RotateCcw,
  DollarSign,
  Percent,
  Activity,
  Clock,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
// import { paperWalletService } from "@/services/paperWallet.service";
import { paperWalletService } from "@/services/paperWallet.service_frontend";
import type {
  PaperWallet,
  TradeTransaction,
  WalletStats,
} from "@/services/paperWallet.service_frontend";
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
);

// ── Design tokens (mirrors AgentChat / ReportBubble) ──────────────────────────

const TOKEN_COLORS: Record<string, { accent: string; softBg: string; text: string }> = {
  USDC:    { accent: "#00e5a0", softBg: "rgba(0,229,160,0.08)",   text: "#00e5a0" },
  USDT:    { accent: "#00e5a0", softBg: "rgba(0,229,160,0.08)",   text: "#00e5a0" },
  DAI:     { accent: "#ffb020", softBg: "rgba(255,176,32,0.08)",  text: "#ffb020" },
  ETH:     { accent: "#a78bfa", softBg: "rgba(167,139,250,0.08)", text: "#a78bfa" },
  WETH:    { accent: "#a78bfa", softBg: "rgba(167,139,250,0.08)", text: "#a78bfa" },
  BTC:     { accent: "#ffb020", softBg: "rgba(255,176,32,0.08)",  text: "#ffb020" },
  WBTC:    { accent: "#ffb020", softBg: "rgba(255,176,32,0.08)",  text: "#ffb020" },
  DEFAULT: { accent: "#36b6ff", softBg: "rgba(54,182,255,0.08)",  text: "#36b6ff" },
};

function getTokenColor(symbol: string) {
  return TOKEN_COLORS[symbol.toUpperCase()] ?? TOKEN_COLORS.DEFAULT;
}

type FilterType = "all" | "buy" | "sell" | "win" | "loss";
type DashTab    = "wallet" | "history" | "stats";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function fmtCompact(n: number) {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${fmt(n, 0)}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-GB", { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

function pnlColor(v: number) {
  return v > 0 ? "#00e5a0" : v < 0 ? "#ff5572" : "#94a3b8";
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "14px 12px",
        borderRadius: 10,
        background: "rgb(8,18,32)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          marginBottom: 2,
        }}
      >
        {icon && (
          <span style={{ color: color ?? "rgba(255,255,255,0.3)", display: "flex" }}>
            {icon}
          </span>
        )}
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontFamily: "var(--font-display)",
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: color ?? "rgba(255,255,255,0.85)",
          fontFamily: "var(--font-display)",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      {sub && (
        <span
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.3)",
            fontFamily: "var(--font-display)",
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

// ── Equity curve ────────────────────────────────────────────────────────────
// Portfolio value over time, terminal-style: thin line, gradient fade, a dashed
// "start" baseline at initial capital, and green-above / red-below-water colour.

const UP = "#00e5a0";
const DOWN = "#ff5572";

// Per-chart plugin: dashed reference line at the starting capital.
const baselinePlugin = {
  id: "equityBaseline",
  afterDatasetsDraw(chart: any, _args: any, opts: any) {
    if (opts?.value == null || !chart.scales?.y || !chart.chartArea) return;
    const y = chart.scales.y.getPixelForValue(opts.value);
    const { left, right } = chart.chartArea;
    const c = chart.ctx;
    c.save();
    c.beginPath();
    c.setLineDash([3, 4]);
    c.lineWidth = 1;
    c.strokeStyle = "rgba(255,255,255,0.16)";
    c.moveTo(left, y);
    c.lineTo(right, y);
    c.stroke();
    c.setLineDash([]);
    c.font = "10px ui-monospace, monospace";
    c.fillStyle = "rgba(255,255,255,0.32)";
    c.textAlign = "left";
    c.fillText("start", left + 4, y - 5);
    c.restore();
  },
};

function EquityCurve({
  trades,
  initialUsd,
  height = 196,
}: {
  trades: TradeTransaction[];
  initialUsd: number;
  height?: number;
}) {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
  );

  const points = [
    { label: "Start", value: initialUsd },
    ...sorted.map((t) => ({
      label: new Date(t.executedAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
      value: t.portfolioValueUsd,
    })),
  ];
  const values = points.map((p) => p.value);
  const labels = points.map((p) => p.label);
  const latest = values[values.length - 1] ?? initialUsd;
  const line = latest >= initialUsd ? UP : DOWN;

  const data = {
    labels,
    datasets: [
      {
        data: values,
        borderColor: line,
        borderWidth: 1.6,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: line,
        pointHoverBorderColor: "rgb(8,18,32)",
        pointHoverBorderWidth: 2,
        tension: 0.18,
        fill: true,
        // green above the start line, red below — read at a glance
        segment: {
          borderColor: (ctx: any) =>
            ctx.p0.parsed.y < initialUsd || ctx.p1.parsed.y < initialUsd ? DOWN : UP,
        },
        backgroundColor: (ctx: any) => {
          const { chart } = ctx;
          const { ctx: cc, chartArea } = chart;
          if (!chartArea) return "transparent";
          const g = cc.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, line + "2e");
          g.addColorStop(1, line + "00");
          return g;
        },
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { display: false },
      equityBaseline: { value: initialUsd },
      tooltip: {
        callbacks: {
          title: (items: any) => items[0]?.label ?? "",
          label: (ctx: any) => `  $${fmt(ctx.raw)}`,
        },
        displayColors: false,
        backgroundColor: "rgba(4,11,20,0.96)",
        borderColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        titleColor: "rgba(255,255,255,0.45)",
        titleFont: { family: "monospace", size: 10 },
        bodyColor: "rgba(255,255,255,0.92)",
        bodyFont: { family: "monospace", size: 13, weight: 700 },
        padding: 9,
        cornerRadius: 6,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: "rgba(255,255,255,0.22)",
          font: { family: "monospace", size: 10 },
          maxTicksLimit: 5,
          maxRotation: 0,
          autoSkip: true,
        },
      },
      y: {
        position: "right" as const,
        grid: { color: "rgba(255,255,255,0.04)" },
        border: { display: false },
        ticks: {
          color: "rgba(255,255,255,0.22)",
          font: { family: "monospace", size: 10 },
          maxTicksLimit: 5,
          callback: (v: any) => fmtCompact(v),
        },
      },
    },
  };

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <Line data={data} options={options} plugins={[baselinePlugin]} />
    </div>
  );
}

// ── Balance allocation doughnut ───────────────────────────────────────────────

function AllocationChart({ wallet }: { wallet: PaperWallet }) {
  const balances = wallet.balances.filter((b) => b.valueUsd > 0);
  if (balances.length === 0) return null;

  const labels  = balances.map((b) => b.symbol);
  const values  = balances.map((b) => b.valueUsd);
  const colors  = balances.map((b) => getTokenColor(b.symbol).accent);

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        // Gaps rendered in the card background colour give crisp segment
        // separation instead of muddy translucent overlaps.
        borderColor: "rgb(8,18,32)",
        borderWidth: 2.5,
        hoverOffset: 3,
        spacing: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "74%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) =>
            ` ${ctx.label}: $${fmt(ctx.raw)} (${((ctx.raw / wallet.totalValueUsd) * 100).toFixed(1)}%)`,
        },
        backgroundColor: "rgba(5,12,24,0.92)",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        titleColor: "#fff",
        bodyColor: "rgba(255,255,255,0.6)",
        padding: 10,
        cornerRadius: 8,
      },
    },
  };

  const totalVal = wallet.totalValueUsd;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p
        style={{
          fontFamily: "monospace",
          fontSize: 12,
          color: "rgba(255,255,255,0.28)",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        Allocation
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
          <Doughnut data={data} options={options} />
          {/* Center text */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                fontWeight: 700,
                color: "rgba(255,255,255,0.7)",
                lineHeight: 1,
              }}
            >
              {fmtCompact(totalVal)}
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                letterSpacing: "0.06em",
              }}
            >
              total
            </span>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
          {balances.map((b) => {
            const tc  = getTokenColor(b.symbol);
            const pct = (b.valueUsd / totalVal) * 100;
            return (
              <div key={b.symbol} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: tc.accent,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 12,
                        fontWeight: 700,
                        color: tc.text,
                      }}
                    >
                      {b.symbol}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <div
                  style={{
                    height: 3,
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: tc.accent,
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Token balance row ─────────────────────────────────────────────────────────

function BalanceRow({
  symbol,
  amount,
  valueUsd,
  avgCostUsd,
  totalValue,
}: {
  symbol: string;
  amount: number;
  valueUsd: number;
  avgCostUsd: number;
  totalValue: number;
}) {
  const tc  = getTokenColor(symbol);
  const pct = totalValue > 0 ? (valueUsd / totalValue) * 100 : 0;
  const isStable = ["USDC", "USDT", "DAI"].includes(symbol.toUpperCase());

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 10,
        background: "rgb(8,18,32)",
        border: `1px solid ${tc.accent}18`,
      }}
    >
      {/* Token icon */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: tc.softBg,
          border: `1px solid ${tc.accent}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontFamily: "monospace",
          fontSize: 12,
          fontWeight: 700,
          color: tc.text,
        }}
      >
        {symbol.slice(0, 2)}
      </div>

      {/* Token name + amount */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 14,
              fontWeight: 700,
              color: tc.text,
            }}
          >
            {symbol}
          </span>
          {!isStable && avgCostUsd > 0 && (
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                fontFamily: "monospace",
                background: "rgba(255,255,255,0.04)",
                padding: "1px 5px",
                borderRadius: 4,
              }}
            >
              avg ${fmt(avgCostUsd, isStable ? 2 : 4)}
            </span>
          )}
        </div>
        <div
          style={{
            height: 3,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: tc.accent,
              borderRadius: 3,
            }}
          />
        </div>
      </div>

      {/* Right side: amount + USD */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 14,
            fontWeight: 700,
            color: "rgba(255,255,255,0.8)",
            margin: "0 0 1px",
          }}
        >
          {isStable ? fmt(amount) : amount.toFixed(6)}
        </p>
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            color: "rgba(255,255,255,0.35)",
            margin: 0,
          }}
        >
          ${fmt(valueUsd)} · {pct.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}

// ── Trade transaction card ────────────────────────────────────────────────────

function TradeCard({ tx }: { tx: TradeTransaction }) {
  const [open, setOpen] = useState(false);

  const isBuy    = tx.side === "buy";
  const hasPnl   = tx.realizedPnlUsd !== undefined && tx.realizedPnlUsd !== null;
  const pnl      = tx.realizedPnlUsd ?? 0;
  const pnlSign  = pnl >= 0 ? "+" : "";
  const pc       = getTokenColor(tx.tokenOut);

  const confPct  = tx.confidence;
  const confCol  = confPct >= 75 ? "#00e5a0" : confPct >= 55 ? "#ffb020" : "#ff5572";

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${open ? pc.accent + "35" : "rgba(255,255,255,0.07)"}`,
        background: open ? `${pc.accent}06` : "rgb(8,18,32)",
        transition: "all 0.15s ease",
      }}
    >
      {/* ── Card header ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "14px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* Side badge */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "monospace",
            letterSpacing: "0.08em",
            padding: "3px 8px",
            borderRadius: 6,
            flexShrink: 0,
            color: isBuy ? "#00e5a0" : "#ff5572",
            background: isBuy ? "rgba(0,229,160,0.12)" : "rgba(255,85,114,0.12)",
            border: isBuy ? "1px solid rgba(0,229,160,0.25)" : "1px solid rgba(255,85,114,0.25)",
          }}
        >
          {isBuy ? "BUY" : "SELL"}
        </span>

        {/* Pair */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 3,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              <span style={{ color: getTokenColor(tx.tokenIn).text }}>{tx.tokenIn}</span>
              {" "}
              <ArrowRightLeft
                size={11}
                style={{ display: "inline", verticalAlign: "middle", color: "rgba(255,255,255,0.25)" }}
              />
              {" "}
              <span style={{ color: pc.text }}>{tx.tokenOut}</span>
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                fontWeight: 700,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              ${fmt(tx.amountUsd, 0)}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "rgba(255,255,255,0.25)",
              }}
            >
              {fmtDate(tx.executedAt)}
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.04)",
                padding: "1px 5px",
                borderRadius: 4,
              }}
            >
              {tx.strategy}
            </span>
          </div>
        </div>

        {/* Right: PnL or portfolio value */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {hasPnl ? (
            <>
              <p
                style={{
                  fontFamily: "monospace",
                  fontSize: 15,
                  fontWeight: 700,
                  color: pnlColor(pnl),
                  margin: "0 0 1px",
                  lineHeight: 1,
                }}
              >
                {pnlSign}${fmt(Math.abs(pnl))}
              </p>
              {tx.pnlPct !== undefined && (
                <p
                  style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: pnlColor(pnl),
                    margin: 0,
                    opacity: 0.7,
                  }}
                >
                  {pnl >= 0 ? "+" : ""}{tx.pnlPct.toFixed(2)}%
                </p>
              )}
            </>
          ) : (
            <p
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                color: "rgba(255,255,255,0.3)",
                margin: 0,
              }}
            >
              ${fmt(tx.portfolioValueUsd, 0)}
            </p>
          )}
        </div>

        <span style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0, display: "flex" }}>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>

      {/* ── Expanded detail ── */}
      {open && (
        <div
          style={{
            padding: "0 16px 16px",
            borderTop: `1px solid ${pc.accent}15`,
          }}
        >
          {/* Stats grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              marginTop: 12,
            }}
          >
            {[
              {
                label: isBuy ? "Received" : "Sold",
                value: `${tx.amountOut.toFixed(4)} ${tx.tokenOut}`,
                icon: <ArrowRightLeft size={11} />,
              },
              {
                label: `${tx.tokenOut} price`,
                value:
                  tx.priceUsd >= 1000
                    ? `$${(tx.priceUsd / 1000).toFixed(2)}k`
                    : `$${fmt(tx.priceUsd, 2)}`,
                icon: <DollarSign size={11} />,
              },
              {
                label: "Net amount",
                value: `$${fmt(tx.amountUsd)}`,
                icon: <Activity size={11} />,
              },
              {
                label: "Fees",
                value: `$${fmt(tx.feesUsd, 3)}`,
                icon: <Minus size={11} />,
              },
              {
                label: "Slippage",
                value: `${tx.slippagePct.toFixed(2)}%`,
                icon: <Percent size={11} />,
              },
              {
                label: "Portfolio after",
                value: `$${fmt(tx.portfolioValueUsd, 0)}`,
                icon: <Wallet size={11} />,
              },
            ].map(({ label, value, icon }) => (
              <div
                key={label}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    marginBottom: 3,
                  }}
                >
                  <span style={{ color: "rgba(255,255,255,0.25)", display: "flex" }}>
                    {icon}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.3)",
                      fontFamily: "var(--font-display)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {label}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* AI confidence bar */}
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 5,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "var(--font-display)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Zap size={10} /> AI confidence
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  fontWeight: 700,
                  color: confCol,
                }}
              >
                {confPct}%
              </span>
            </div>
            <div
              style={{
                height: 4,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${confPct}%`,
                  background: `linear-gradient(90deg, ${confCol}66, ${confCol})`,
                  borderRadius: 3,
                }}
              />
            </div>
          </div>

          {/* Rationale */}
          {tx.rationale && (
            <div
              style={{
                marginTop: 10,
                padding: "9px 11px",
                borderRadius: 8,
                background: `${pc.accent}08`,
                borderLeft: `2px solid ${pc.accent}40`,
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  lineHeight: 1.65,
                  color: "rgba(255,255,255,0.55)",
                  margin: 0,
                  fontStyle: "italic",
                }}
              >
                {tx.rationale}
              </p>
            </div>
          )}

          {/* Cumulative PnL chip */}
          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.25)",
                fontFamily: "var(--font-display)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Clock size={10} /> Cumulative PnL at this point
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                fontWeight: 700,
                color: pnlColor(tx.cumulativePnlUsd),
                marginLeft: "auto",
              }}
            >
              {tx.cumulativePnlUsd >= 0 ? "+" : ""}${fmt(tx.cumulativePnlUsd)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter chip bar ───────────────────────────────────────────────────────────

function FilterBar({
  active,
  onChange,
  accentColor,
}: {
  active: FilterType;
  onChange: (f: FilterType) => void;
  accentColor: string;
}) {
  const filters: { id: FilterType; label: string }[] = [
    { id: "all",  label: "All"     },
    { id: "buy",  label: "Buys"    },
    { id: "sell", label: "Sells"   },
    { id: "win",  label: "Winners" },
    { id: "loss", label: "Losers"  },
  ];

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {filters.map((f) => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          style={{
            padding: "5px 12px",
            borderRadius: 20,
            fontSize: 12,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            border: `1px solid ${active === f.id ? accentColor + "50" : "rgba(255,255,255,0.09)"}`,
            background: active === f.id ? `${accentColor}12` : "transparent",
            color: active === f.id ? accentColor : "rgba(255,255,255,0.4)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <p
      style={{
        fontSize: 13,
        color: "rgba(255,255,255,0.3)",
        textAlign: "center",
        margin: "28px 0",
        fontFamily: "var(--font-display)",
      }}
    >
      {message}
    </p>
  );
}

// ── Reset confirm modal ───────────────────────────────────────────────────────

function ResetModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "rgb(8,18,32)",
          border: "1px solid rgba(255,85,114,0.3)",
          borderRadius: 16,
          padding: "24px 28px",
          maxWidth: 360,
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <AlertTriangle size={18} color="#ff5572" />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              fontWeight: 700,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            Reset paper wallet?
          </span>
        </div>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.5)",
            margin: "0 0 20px",
          }}
        >
          This will permanently delete all trade history and reset your balance to{" "}
          <strong style={{ color: "rgba(255,255,255,0.75)" }}>$5,000 USDC</strong>. This
          cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "var(--font-display)",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "var(--font-display)",
              background: loading ? "rgba(255,85,114,0.1)" : "rgba(255,85,114,0.15)",
              border: "1px solid rgba(255,85,114,0.3)",
              color: "#ff5572",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Resetting…" : "Reset wallet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface PaperWalletDashboardProps {
  /** Accent color passed down from AgentChat (mirrors mood accent) */
  accentColor?: string;
}

export function PaperWalletDashboard({
  accentColor = "#00e5a0",
}: PaperWalletDashboardProps) {
  const [tab,          setTab]          = useState<DashTab>("wallet");
  const [wallet,       setWallet]       = useState<PaperWallet | null>(null);
  const [trades,       setTrades]       = useState<TradeTransaction[]>([]);
  const [stats,        setStats]        = useState<WalletStats | null>(null);
  const [filter,       setFilter]       = useState<FilterType>("all");
  const [loading,      setLoading]      = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [showReset,    setShowReset]    = useState(false);
  const [resetting,    setResetting]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [w, t, s] = await Promise.all([
        paperWalletService.getWallet(),
        paperWalletService.getTrades({ limit: 100 }),
        paperWalletService.getStats(),
      ]);
      if (!mountedRef.current) return;
      setWallet(w);
      setTrades(t.trades);
      setStats(s);
    } catch (e: any) {
      if (mountedRef.current) setError(e.message ?? "Failed to load wallet");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const handleReset = async () => {
    setResetting(true);
    try {
      await paperWalletService.reset();
      setShowReset(false);
      await load();
    } catch { /* ignore */ } finally {
      setResetting(false);
    }
  };

  // Filter trades
  const filteredTrades = trades.filter((t) => {
    if (filter === "buy")  return t.side === "buy";
    if (filter === "sell") return t.side === "sell";
    if (filter === "win")  return (t.realizedPnlUsd ?? 0) > 0;
    if (filter === "loss") return t.side === "sell" && (t.realizedPnlUsd ?? 0) <= 0;
    return true;
  });

  const pnl          = wallet?.realizedPnlUsd ?? 0;
  const returnPct    = wallet
    ? ((wallet.totalValueUsd - wallet.initialUsd) / wallet.initialUsd) * 100
    : 0;
  const returnColor  = returnPct >= 0 ? "#00e5a0" : "#ff5572";

  const TABS: { id: DashTab; label: string; icon: React.ReactNode }[] = [
    { id: "wallet",  label: "Wallet",  icon: <Wallet size={12} />  },
    { id: "history", label: "History", icon: <History size={12} /> },
    { id: "stats",   label: "Stats",   icon: <BarChart3 size={12} /> },
  ];

  return (
    <>
      {showReset && (
        <ResetModal
          onConfirm={handleReset}
          onCancel={() => setShowReset(false)}
          loading={resetting}
        />
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          background: "rgb(2,6,9)",
        }}
      >
        {/* ── Top bar ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "13px 16px",
            background: "rgb(4,11,20)",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            flexShrink: 0,
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: accentColor,
                boxShadow: `0 0 0 3px ${accentColor}20`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 15,
                fontWeight: 600,
                color: "rgba(255,255,255,0.88)",
              }}
            >
              Paper Wallet
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: accentColor,
                background: `${accentColor}12`,
                border: `1px solid ${accentColor}25`,
                padding: "2px 7px",
                borderRadius: 6,
                fontFamily: "monospace",
                letterSpacing: "0.06em",
              }}
            >
              PAPER
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: refreshing ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.4)",
                opacity: refreshing ? 0.5 : 1,
              }}
              title="Refresh"
            >
              <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            </button>

            <button
              onClick={() => setShowReset(true)}
              style={{
                padding: "6px 11px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                background: "rgba(255,85,114,0.07)",
                border: "1px solid rgba(255,85,114,0.2)",
                color: "#ff5572",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>
        </div>

        {/* ── Sub-tabs ── */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "rgb(4,11,20)",
            flexShrink: 0,
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: "1 1 0",
                padding: "11px 4px",
                fontSize: 12,
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                background: "transparent",
                border: "none",
                borderBottom:
                  tab === t.id
                    ? `2px solid ${accentColor}`
                    : "2px solid transparent",
                color:
                  tab === t.id ? accentColor : "rgba(255,255,255,0.35)",
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {loading && !wallet && (
            <EmptyState message="Loading wallet…" />
          )}
          {error && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(255,85,114,0.07)",
                border: "1px solid rgba(255,85,114,0.2)",
                fontSize: 13,
                color: "#ff5572",
                fontFamily: "var(--font-display)",
              }}
            >
              {error}
            </div>
          )}

          {/* ── WALLET TAB ── */}
          {tab === "wallet" && wallet && (
            <>
              {/* Portfolio hero — value header + equity curve */}
              <div
                style={{
                  padding: "16px 18px 12px",
                  borderRadius: 12,
                  background: "rgb(8,18,32)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.3)",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        fontFamily: "monospace",
                        margin: "0 0 6px",
                      }}
                    >
                      Portfolio Value
                    </p>
                    <p
                      style={{
                        fontFamily: "monospace",
                        fontSize: 27,
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.92)",
                        margin: 0,
                        lineHeight: 1,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      ${fmt(wallet.totalValueUsd)}
                    </p>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 9px",
                        borderRadius: 6,
                        background: `${returnColor}12`,
                        border: `1px solid ${returnColor}2e`,
                      }}
                    >
                      {returnPct >= 0 ? <TrendingUp size={12} color={returnColor} /> : <TrendingDown size={12} color={returnColor} />}
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 14,
                          fontWeight: 700,
                          color: returnColor,
                        }}
                      >
                        {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
                      </span>
                    </div>
                    <p
                      style={{
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: pnlColor(pnl),
                        margin: "6px 0 0",
                      }}
                    >
                      {pnl >= 0 ? "+" : ""}${fmt(Math.abs(pnl))}{" "}
                      <span style={{ color: "rgba(255,255,255,0.25)" }}>PnL</span>
                    </p>
                  </div>
                </div>

                {trades.length > 0 ? (
                  <EquityCurve trades={trades} initialUsd={wallet.initialUsd} />
                ) : (
                  <p
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.3)",
                      textAlign: "center",
                      margin: "26px 0 18px",
                    }}
                  >
                    No trades yet · started at ${fmt(wallet.initialUsd, 0)}
                  </p>
                )}
              </div>

              {/* Allocation doughnut */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "rgb(8,18,32)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <AllocationChart wallet={wallet} />
              </div>

              {/* Balance rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <p
                  style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.28)",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    margin: 0,
                  }}
                >
                  Balances
                </p>
                {wallet.balances.length === 0 && <EmptyState message="No balances yet." />}
                {wallet.balances.map((b) => (
                  <BalanceRow
                    key={b.symbol}
                    {...b}
                    totalValue={wallet.totalValueUsd}
                  />
                ))}
              </div>
            </>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === "history" && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Filter size={13} color="rgba(255,255,255,0.3)" />
                  <span
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.3)",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {filteredTrades.length} trade{filteredTrades.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <FilterBar
                active={filter}
                onChange={setFilter}
                accentColor={accentColor}
              />

              {filteredTrades.length === 0 ? (
                <EmptyState
                  message={
                    filter === "all"
                      ? "No trades yet — enable the agent loop to start trading."
                      : "No trades match this filter."
                  }
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filteredTrades.map((tx) => (
                    <TradeCard key={tx.txId} tx={tx} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── STATS TAB ── */}
          {tab === "stats" && stats && (
            <>
              {/* Top summary grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2,1fr)",
                  gap: 8,
                }}
              >
                <StatCard
                  label="Total PnL"
                  value={`${pnl >= 0 ? "+" : ""}$${fmt(Math.abs(pnl))}`}
                  sub={`${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(2)}% return`}
                  color={pnlColor(pnl)}
                  icon={<TrendingUp size={11} />}
                />
                <StatCard
                  label="Win rate"
                  value={stats.trades.sells > 0 ? `${stats.trades.winRate.toFixed(0)}%` : "—"}
                  sub={`${stats.trades.winners}W / ${stats.trades.losers}L`}
                  color={
                    stats.trades.winRate >= 60
                      ? "#00e5a0"
                      : stats.trades.winRate >= 40
                      ? "#ffb020"
                      : "#ff5572"
                  }
                  icon={<ShieldCheck size={11} />}
                />
                <StatCard
                  label="Total trades"
                  value={String(stats.trades.total)}
                  sub={`${stats.trades.buys} buys · ${stats.trades.sells} sells`}
                  color={accentColor}
                  icon={<ArrowRightLeft size={11} />}
                />
                <StatCard
                  label="Total volume"
                  value={`$${fmt(stats.trades.totalVolume, 0)}`}
                  sub={`$${fmt(stats.trades.totalFees)} in fees`}
                  color="rgba(255,255,255,0.7)"
                  icon={<Activity size={11} />}
                />
              </div>

              {/* Win / loss averages */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "rgb(8,18,32)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <p
                  style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.28)",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    margin: 0,
                  }}
                >
                  Trade quality
                </p>

                {[
                  {
                    label: "Avg win",
                    value: `+$${fmt(stats.trades.avgWinUsd)}`,
                    pct: stats.trades.totalVolume > 0
                      ? (stats.trades.avgWinUsd / (stats.trades.totalVolume / Math.max(1, stats.trades.total))) * 100
                      : 0,
                    color: "#00e5a0",
                    icon: <TrendingUp size={12} />,
                  },
                  {
                    label: "Avg loss",
                    value: `-$${fmt(Math.abs(stats.trades.avgLossUsd))}`,
                    pct: stats.trades.totalVolume > 0
                      ? (Math.abs(stats.trades.avgLossUsd) / (stats.trades.totalVolume / Math.max(1, stats.trades.total))) * 100
                      : 0,
                    color: "#ff5572",
                    icon: <TrendingDown size={12} />,
                  },
                ].map(({ label, value, pct, color, icon }) => (
                  <div key={label}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 5,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          color: "rgba(255,255,255,0.45)",
                          fontFamily: "var(--font-display)",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <span style={{ color, display: "flex" }}>{icon}</span>
                        {label}
                      </span>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 15,
                          fontWeight: 700,
                          color,
                        }}
                      >
                        {value}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 5,
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, pct)}%`,
                          background: `linear-gradient(90deg, ${color}55, ${color})`,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Balance detail table */}
              {wallet && (
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: "rgb(8,18,32)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.28)",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      margin: "0 0 12px",
                    }}
                  >
                    Wallet detail
                  </p>

                  {[
                    { label: "Initial capital", value: `$${fmt(wallet.initialUsd, 0)}` },
                    { label: "Current value",   value: `$${fmt(wallet.totalValueUsd)}`, highlight: true },
                    { label: "Realized PnL",    value: `${pnl >= 0 ? "+" : ""}$${fmt(pnl)}`, color: pnlColor(pnl) },
                    { label: "Total return",    value: `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(2)}%`, color: pnlColor(returnPct) },
                    { label: "Total fees paid", value: `-$${fmt(stats.trades.totalFees)}`, color: "#ff5572" },
                  ].map(({ label, value, color, highlight }) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "9px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 13,
                          color: "rgba(255,255,255,0.4)",
                        }}
                      >
                        {label}
                      </span>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 13,
                          fontWeight: 700,
                          color: color ?? (highlight ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.65)"),
                        }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

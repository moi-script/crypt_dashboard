"use client";

import { useState, useEffect, useRef } from "react";
import {
  TrendingUp,
  Zap,
  Waves,
  Newspaper,
  CandlestickChart,
  Search,
  Target,
  FlaskConical,
  Calculator,
  Scale,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ChevronDown,
  ChevronUp,
  BarChart3,
  LineChart,
  Brain,
  ShieldAlert,
  LayoutList,
  Coins,
  RefreshCw,
} from "lucide-react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SkillResult {
  name:    string;
  verdict: "bullish" | "bearish" | "neutral";
  score:   number;
  summary: string;
}

export interface ReasoningStep {
  step:      number;
  phase:     string;
  title:     string;
  detail:    string;
  score?:    number;
  decision?: string;
  weight?:   number;
}

export interface AnalysisReport {
  verdict:    string;
  score:      number;
  confidence: number;
  narrative:  string;
  keyPoints:  string[];
  risks:      string[];
  skillsUsed: string[];
  skills:     SkillResult[];
  reasoning:  ReasoningStep[];
  coinName:   string;
  symbol:     string;
  priceAtRun: number;
  runAt:      string;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const VM: Record<string, { label: string; color: string; bg: string; border: string; glow: string }> = {
  strong_buy:  { label: "STRONG BUY",  color: "#00e5a0", bg: "rgba(0,229,160,0.08)",   border: "rgba(0,229,160,0.22)",   glow: "rgba(0,229,160,0.15)"  },
  buy:         { label: "BUY",         color: "#4ade80", bg: "rgba(74,222,128,0.07)",   border: "rgba(74,222,128,0.18)",   glow: "rgba(74,222,128,0.10)" },
  neutral:     { label: "NEUTRAL",     color: "#94a3b8", bg: "rgba(148,163,184,0.06)",  border: "rgba(148,163,184,0.16)",  glow: "rgba(148,163,184,0.08)"},
  sell:        { label: "SELL",        color: "#fb923c", bg: "rgba(251,146,60,0.07)",   border: "rgba(251,146,60,0.18)",   glow: "rgba(251,146,60,0.10)" },
  strong_sell: { label: "STRONG SELL", color: "#ff5572", bg: "rgba(255,85,114,0.08)",   border: "rgba(255,85,114,0.22)",   glow: "rgba(255,85,114,0.15)" },
};

const SC: Record<string, string> = {
  bullish: "#00e5a0",
  bearish: "#ff5572",
  neutral: "#94a3b8",
};

const PHASE_COLOR: Record<string, string> = {
  context:         "#60a5fa",
  skill_selection: "#a78bfa",
  skill_result:    "#00e5a0",
  synthesis:       "#ffb020",
  verdict:         "#f472b6",
};

const SKILL_WEIGHTS: Record<string, number> = {
  trend: 0.30, momentum: 0.25, volatility: 0.20, sentiment: 0.15, pattern: 0.10,
  yield: 0.10, rotation: 0.10,
};

// ── Lucide icon maps (replaces emoji) ─────────────────────────────────────────
const SKILL_ICON_MAP: Record<string, React.ReactNode> = {
  trend:      <TrendingUp size={14} />,
  momentum:   <Zap size={14} />,
  volatility: <Waves size={14} />,
  sentiment:  <Newspaper size={14} />,
  pattern:    <CandlestickChart size={14} />,
  yield:      <Coins size={14} />,
  rotation:   <RefreshCw size={14} />,
};

const PHASE_ICON_MAP: Record<string, React.ReactNode> = {
  context:         <Search size={13} />,
  skill_selection: <Target size={13} />,
  skill_result:    <FlaskConical size={13} />,
  synthesis:       <Calculator size={13} />,
  verdict:         <Scale size={13} />,
};

const PHASE_LABELS: Record<string, string> = {
  context:         "Data Load",
  skill_selection: "Skill Select",
  skill_result:    "Skill Results",
  synthesis:       "Synthesis",
  verdict:         "Verdict",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function useAnimated(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal((target) * ease);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

// ── 1. SCORE GAUGE (unchanged) ────────────────────────────────────────────────
function ScoreGauge({ score, color }: { score: number; color: string }) {
  const animated = useAnimated(score, 1000);
  const cx = 90, cy = 90, r = 72;
  const toAngle = (s: number) => ((s + 100) / 200) * Math.PI;
  const toXY = (angle: number) => ({
    x: cx - r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  });
  const startAngle = 0;
  const endAngle   = Math.PI;
  const p1 = toXY(startAngle);
  const p2 = toXY(endAngle);
  const trackPath = `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;
  const fillAngle = toAngle(Math.max(-100, Math.min(100, animated)));
  const pFill = toXY(fillAngle);
  const large = fillAngle > Math.PI / 2 ? 1 : 0;
  const fillPath = `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${pFill.x} ${pFill.y}`;
  const needleEnd = toXY(fillAngle);
  const zones = [
    { label: "-100", angle: 0 },
    { label: "-50",  angle: Math.PI * 0.25 },
    { label: "0",    angle: Math.PI * 0.5  },
    { label: "+50",  angle: Math.PI * 0.75 },
    { label: "+100", angle: Math.PI        },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={180} height={110} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#ff5572" />
            <stop offset="50%"  stopColor="#ffb020" />
            <stop offset="100%" stopColor="#00e5a0" />
          </linearGradient>
          <filter id="glowF">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} strokeLinecap="round" />
        <path d={fillPath} fill="none" stroke="url(#gaugeGrad)" strokeWidth={10} strokeLinecap="round" />
        <path d={fillPath} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
          opacity={0.18} filter="url(#glowF)" />
        {zones.map(z => {
          const inner = { x: cx - (r - 14) * Math.cos(z.angle), y: cy - (r - 14) * Math.sin(z.angle) };
          const outer = { x: cx - (r + 2)  * Math.cos(z.angle), y: cy - (r + 2)  * Math.sin(z.angle) };
          const lbl   = { x: cx - (r + 16) * Math.cos(z.angle), y: cy - (r + 16) * Math.sin(z.angle) };
          return (
            <g key={z.label}>
              <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
              <text x={lbl.x} y={lbl.y} textAnchor="middle" dominantBaseline="middle"
                fontSize={10} fill="rgba(255,255,255,0.25)" fontFamily="monospace">
                {z.label}
              </text>
            </g>
          );
        })}
        <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y}
          stroke={color} strokeWidth={2.5} strokeLinecap="round" filter="url(#glowF)" />
        <circle cx={cx} cy={cy} r={5} fill={color} />
        <circle cx={cx} cy={cy} r={3} fill="rgb(6,14,26)" />
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize={24} fontWeight={700}
          fill={color} fontFamily="monospace">
          {animated >= 0 ? "+" : ""}{Math.round(animated)}
        </text>
        <text x={cx} y={cy + 30} textAnchor="middle" fontSize={12} fill="rgba(255,255,255,0.3)" fontFamily="monospace">
          SIGNAL SCORE
        </text>
      </svg>
    </div>
  );
}

// ── 2. RADAR → Horizontal Bar Chart ──────────────────────────────────────────
function SkillBarChart({ skills }: { skills: SkillResult[] }) {
  const labels  = skills.map(s => s.name.toUpperCase());
  const scores  = skills.map(s => s.score);
  const bgColors = skills.map(s =>
    s.verdict === "bullish" ? "rgba(0,229,160,0.75)"
    : s.verdict === "bearish" ? "rgba(255,85,114,0.75)"
    : "rgba(148,163,184,0.65)"
  );
  const borderColors = skills.map(s =>
    s.verdict === "bullish" ? "#00e5a0"
    : s.verdict === "bearish" ? "#ff5572"
    : "#94a3b8"
  );

  const data = {
    labels,
    datasets: [{
      label: "Score",
      data: scores,
      backgroundColor: bgColors,
      borderColor: borderColors,
      borderWidth: 1.5,
      borderRadius: 4,
      borderSkipped: false,
    }],
  };

  const options = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` Score: ${ctx.raw > 0 ? "+" : ""}${ctx.raw}`,
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
    scales: {
      x: {
        min: -100,
        max: 100,
        grid: {
          color: (ctx: any) =>
            ctx.tick.value === 0
              ? "rgba(255,255,255,0.18)"
              : "rgba(255,255,255,0.05)",
          lineWidth: (ctx: any) => ctx.tick.value === 0 ? 1.5 : 1,
        },
        ticks: {
          color: "rgba(255,255,255,0.3)",
          font: { family: "monospace", size: 12 },
          callback: (v: any) => `${v > 0 ? "+" : ""}${v}`,
          stepSize: 50,
        },
        border: { color: "rgba(255,255,255,0.08)" },
      },
     y: {
  grid: { display: false },
  ticks: {
    color: "rgba(255,255,255,0.5)",
    font: { family: "monospace", size: 12, weight: 700}, // <-- Error here
  },
  border: { color: "rgba(255,255,255,0.08)" },
},
    },
  };

  const height = Math.max(180, skills.length * 44 + 40);

  return (
    <div>
      <p style={{
        fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.28)",
        fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
        margin: "0 0 12px",
      }}>
        Skill Scores
      </p>
      <div style={{ position: "relative", width: "100%", height }}>
        <Bar data={data} options={options} />
      </div>
      {/* Custom legend */}
      <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
        {[
          { label: "Bullish", color: "#00e5a0" },
          { label: "Neutral", color: "#94a3b8" },
          { label: "Bearish", color: "#ff5572" },
        ].map(item => (
          <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{
              width: 10, height: 10, borderRadius: 2,
              background: item.color, flexShrink: 0,
            }} />
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
              {item.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── 3. SIGNAL WATERFALL → Grouped Bar Chart ───────────────────────────────────
function SignalWaterfall({ skills, finalScore }: { skills: SkillResult[]; finalScore: number }) {
  const contributions = skills.map(s => {
    const w = SKILL_WEIGHTS[s.name] ?? 0.1;
    return { ...s, weight: w, contrib: Math.round(s.score * w) };
  });

  const labels = contributions.map(c => c.name.toUpperCase());
  const rawScores = contributions.map(c => c.score);
  const contribs  = contributions.map(c => c.contrib);

  const barColor  = (val: number) =>
    val > 0 ? "rgba(0,229,160,0.75)" : val < 0 ? "rgba(255,85,114,0.75)" : "rgba(148,163,184,0.55)";
  const borderColor = (val: number) =>
    val > 0 ? "#00e5a0" : val < 0 ? "#ff5572" : "#94a3b8";

  const data = {
    labels,
    datasets: [
      {
        label: "Raw Score",
        data: rawScores,
        backgroundColor: rawScores.map(barColor),
        borderColor: rawScores.map(borderColor),
        borderWidth: 1.5,
        borderRadius: 3,
        borderSkipped: false,
        barPercentage: 0.5,
        categoryPercentage: 0.7,
      },
      {
        label: "Weighted Contrib",
        data: contribs,
        backgroundColor: contribs.map(v => barColor(v).replace("0.75", "0.45")),
        borderColor: contribs.map(borderColor),
        borderWidth: 1.5,
        borderRadius: 3,
        borderSkipped: false,
        barPercentage: 0.5,
        categoryPercentage: 0.7,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.raw > 0 ? "+" : ""}${ctx.raw}`,
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
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "rgba(255,255,255,0.45)",
          font: { family: "monospace", size: 11, weight: 700 },
        },
        border: { color: "rgba(255,255,255,0.08)" },
      },
      y: {
        min: -100,
        max: 100,
        grid: {
          color: (ctx: any) =>
            ctx.tick.value === 0
              ? "rgba(255,255,255,0.18)"
              : "rgba(255,255,255,0.05)",
          lineWidth: (ctx: any) => ctx.tick.value === 0 ? 1.5 : 1,
        },
        ticks: {
          color: "rgba(255,255,255,0.3)",
          font: { family: "monospace", size: 12 },
          callback: (v: any) => `${v > 0 ? "+" : ""}${v}`,
          stepSize: 50,
        },
        border: { color: "rgba(255,255,255,0.08)" },
      },
    },
  };

  return (
    <div>
      <p style={{
        fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.28)",
        fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
        margin: "0 0 10px",
      }}>
        Signal Contribution
      </p>
      <div style={{ position: "relative", width: "100%", height: 200 }}>
        <Bar data={data} options={options} />
      </div>
      {/* Custom legend + total */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 10, flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {[
            { label: "Raw score", opacity: "0.75" },
            { label: "Weighted contrib", opacity: "0.45" },
          ].map((item, i) => (
            <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{
                width: 10, height: 10, borderRadius: 2,
                background: `rgba(0,229,160,${item.opacity})`,
                border: "1.5px solid #00e5a0",
                flexShrink: 0,
              }} />
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                {item.label}
              </span>
            </span>
          ))}
        </div>
        <span style={{
          fontFamily: "monospace", fontSize: 13, fontWeight: 700,
          color: finalScore >= 0 ? "#00e5a0" : "#ff5572",
        }}>
          Total: {finalScore >= 0 ? "+" : ""}{finalScore}
        </span>
      </div>
    </div>
  );
}

// ── 4. CONFIDENCE → Doughnut Chart ────────────────────────────────────────────
function ConfidenceBreakdown({ skills, confidence, color }: {
  skills: SkillResult[]; confidence: number; color: string;
}) {
  const animated = useAnimated(confidence, 1100);

  const bullish = skills.filter(s => s.verdict === "bullish").length;
  const bearish = skills.filter(s => s.verdict === "bearish").length;
  const neutral = skills.filter(s => s.verdict === "neutral").length;
  const total   = skills.length || 1;

  const agreement = bullish === total ? "All skills agree"
    : bearish === total ? "All skills bearish"
    : bullish === 0 || bearish === 0 ? "Mostly aligned"
    : "Conflicting signals";
  const agreementColor = bullish === total ? "#00e5a0" : bearish === total ? "#ff5572" : "#ffb020";
  const AgreementIcon  = bullish === total ? CheckCircle2 : bearish === total ? XCircle : AlertTriangle;

  // Doughnut: consensus breakdown
  const doughnutData = {
    labels: ["Bullish", "Neutral", "Bearish"],
    datasets: [{
      data: [bullish, neutral, bearish],
      backgroundColor: ["rgba(0,229,160,0.8)", "rgba(148,163,184,0.7)", "rgba(255,85,114,0.8)"],
      borderColor: ["#00e5a0", "#94a3b8", "#ff5572"],
      borderWidth: 1.5,
      hoverOffset: 4,
    }],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${ctx.raw}/${total} skills`,
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Confidence bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>
            CONFIDENCE
          </span>
          <span style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color }}>
            {Math.round(animated)}%
          </span>
        </div>
        <div style={{ position: "relative", height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{
            position: "absolute", inset: "0 auto 0 0",
            width: `${animated}%`,
            background: `linear-gradient(90deg, ${color}66, ${color})`,
            borderRadius: 8,
            transition: "width 1.1s ease",
          }} />
        </div>
      </div>

      {/* Doughnut + center label */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
          <Doughnut data={doughnutData} options={doughnutOptions} />
          {/* Center label */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>
              {bullish}
            </span>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>
              / {total}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          {[
            { label: "Bullish", val: bullish, color: "#00e5a0" },
            { label: "Neutral", val: neutral, color: "#94a3b8" },
            { label: "Bearish", val: bearish, color: "#ff5572" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0 }} />
              <span style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(255,255,255,0.45)", flex: 1 }}>
                {item.label}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: item.color }}>
                {item.val}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Agreement badge */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", borderRadius: 8,
        background: `${agreementColor}10`,
        border: `1px solid ${agreementColor}25`,
      }}>
        <AgreementIcon size={14} color={agreementColor} />
        <span style={{ fontFamily: "monospace", fontSize: 13, color: agreementColor, fontWeight: 600 }}>
          {agreement}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
          {bullish}/{total} skills bullish
        </span>
      </div>
    </div>
  );
}

// ── 5. PHASE TIMELINE (Lucide icons replacing emoji) ─────────────────────────
function PhaseTimeline({ reasoning }: { reasoning: ReasoningStep[] }) {
  const [openStep, setOpenStep] = useState<number | null>(null);

  const phaseOrder  = ["context", "skill_selection", "skill_result", "synthesis", "verdict"];

  const grouped = phaseOrder.map(ph => ({
    phase: ph,
    steps: reasoning.filter(r => r.phase === ph),
    color: PHASE_COLOR[ph] ?? "#94a3b8",
    icon:  PHASE_ICON_MAP[ph] ?? <Search size={13} />,
    label: PHASE_LABELS[ph] ?? ph,
  })).filter(g => g.steps.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {grouped.map((group, gi) => (
        <div key={group.phase} style={{ display: "flex", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: `${group.color}18`,
              border: `2px solid ${group.color}50`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: group.color, zIndex: 1,
            }}>
              {group.icon}
            </div>
            {gi < grouped.length - 1 && (
              <div style={{ flex: 1, width: 2, background: `${group.color}20`, minHeight: 16 }} />
            )}
          </div>

          <div style={{ flex: 1, paddingBottom: gi < grouped.length - 1 ? 16 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, height: 28 }}>
              <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: group.color, letterSpacing: "0.08em" }}>
                {group.label.toUpperCase()}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                {group.steps.length} step{group.steps.length > 1 ? "s" : ""}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {group.steps.map(step => {
                const isOpen = openStep === step.step;
                return (
                  <div key={step.step} style={{
                    borderRadius: 8, overflow: "hidden",
                    border: `1px solid ${isOpen ? group.color + "35" : "rgba(255,255,255,0.06)"}`,
                    background: isOpen ? `${group.color}06` : "rgba(255,255,255,0.015)",
                    transition: "all 0.2s ease",
                  }}>
                    <button
                      onClick={() => setOpenStep(isOpen ? null : step.step)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 10px", background: "transparent", border: "none",
                        cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-display, sans-serif)", fontSize: 13, fontWeight: 600,
                        color: isOpen ? group.color : "rgba(255,255,255,0.65)", flex: 1, transition: "color 0.2s ease" }}>
                        {step.title}
                      </span>
                      {step.score !== undefined && (
                        <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700,
                          color: step.score >= 0 ? "#00e5a0" : "#ff5572", flexShrink: 0 }}>
                          {step.score >= 0 ? "+" : ""}{step.score}
                        </span>
                      )}
                      <span style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0, display: "flex" }}>
                        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                    </button>

                    {isOpen && (
                      <div style={{ padding: "0 10px 10px" }}>
                        <p style={{ fontFamily: "var(--font-display, sans-serif)", fontSize: 13, lineHeight: 1.7,
                          color: "rgba(255,255,255,0.55)", margin: 0, whiteSpace: "pre-wrap" }}>
                          {step.detail}
                        </p>
                        {step.decision && (
                          <p style={{ fontFamily: "monospace", fontSize: 13, color: group.color,
                            margin: "6px 0 0", padding: "5px 8px", background: `${group.color}0c`,
                            borderRadius: 6, borderLeft: `2px solid ${group.color}50` }}>
                            → {step.decision}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 6. SKILL DETAIL CARDS (Lucide icons replacing emoji) ─────────────────────
function SkillCards({ skills }: { skills: SkillResult[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 80); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {skills.map((skill, i) => {
        const col    = SC[skill.verdict] ?? "#94a3b8";
        const icon   = SKILL_ICON_MAP[skill.name] ?? <BarChart3 size={14} />;
        const w      = SKILL_WEIGHTS[skill.name] ?? 0.1;
        const barPct = mounted ? ((skill.score + 100) / 200) * 100 : 0;
        const contrib = Math.round(skill.score * w);
        const isActive = active === skill.name;

        return (
          <div
            key={skill.name}
            onClick={() => setActive(isActive ? null : skill.name)}
            style={{
              borderRadius: 10,
              border: `1px solid ${isActive ? col + "45" : "rgba(255,255,255,0.07)"}`,
              background: isActive ? `${col}06` : "rgba(255,255,255,0.02)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: `${col}12`, border: `1px solid ${col}25`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: col,
              }}>
                {icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: col, letterSpacing: "0.08em" }}>
                    {skill.name.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                    color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em",
                    background: "rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: 4 }}>
                    {(w * 100).toFixed(0)}% WEIGHT
                  </span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${barPct}%`,
                    background: `linear-gradient(90deg, ${col}66, ${col})`,
                    borderRadius: 3,
                    transition: `width 0.8s cubic-bezier(0.34,1.56,0.64,1) ${i * 80}ms`,
                  }} />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: col, lineHeight: 1 }}>
                  {skill.score >= 0 ? "+" : ""}{skill.score}
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                  contrib {contrib >= 0 ? "+" : ""}{contrib}
                </span>
              </div>

              <span style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0, marginLeft: 2, display: "flex" }}>
                {isActive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            </div>

            {isActive && (
              <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${col}15` }}>
                <p style={{ fontFamily: "var(--font-display, sans-serif)", fontSize: 14, lineHeight: 1.7,
                  color: "rgba(255,255,255,0.6)", margin: "10px 0 0" }}>
                  {skill.summary}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 12, fontFamily: "monospace",
                    fontWeight: 700, color: col, background: `${col}14`, border: `1px solid ${col}25`,
                    letterSpacing: "0.06em" }}>
                    {skill.verdict.toUpperCase()}
                  </span>
                  <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 12, fontFamily: "monospace",
                    color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)" }}>
                    Score: {skill.score >= 0 ? "+" : ""}{skill.score} / 100
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 7. RISK PANEL (Lucide icons replacing emoji) ──────────────────────────────
function RiskPanel({ risks, keyPoints, color }: {
  risks: string[]; keyPoints: string[]; color: string;
}) {
  const severity = (r: string) => {
    if (r.toLowerCase().includes("high") || r.toLowerCase().includes("severe") || r.toLowerCase().includes("crash")) return 3;
    if (r.toLowerCase().includes("watch") || r.toLowerCase().includes("caution") || r.toLowerCase().includes("risk")) return 2;
    return 1;
  };

  const severityMeta = [
    { level: 1, label: "LOW",  color: "#94a3b8", bg: "rgba(148,163,184,0.08)", Icon: MinusCircle },
    { level: 2, label: "MED",  color: "#ffb020", bg: "rgba(255,176,32,0.08)",  Icon: AlertTriangle },
    { level: 3, label: "HIGH", color: "#ff5572", bg: "rgba(255,85,114,0.08)",  Icon: XCircle },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <p style={{ fontFamily: "monospace", fontSize: 12, color: "#ff5572", fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 8px",
          display: "flex", alignItems: "center", gap: 5 }}>
          <ShieldAlert size={11} color="#ff5572" /> Risk Factors
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {risks.map((r, i) => {
            const sev = severity(r);
            const sm  = severityMeta[sev - 1];
            return (
              <div key={i} style={{ display: "flex", gap: 10, padding: "9px 12px", borderRadius: 8,
                background: sm.bg, border: `1px solid ${sm.color}22`, alignItems: "flex-start" }}>
                <sm.Icon size={13} color={sm.color} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: sm.color,
                  background: `${sm.color}18`, padding: "2px 5px", borderRadius: 4,
                  letterSpacing: "0.06em", flexShrink: 0, marginTop: 1 }}>
                  {sm.label}
                </span>
                <span style={{ fontFamily: "var(--font-display, sans-serif)", fontSize: 14,
                  lineHeight: 1.65, color: "rgba(255,255,255,0.65)" }}>
                  {r}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p style={{ fontFamily: "monospace", fontSize: 12, color, fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 8px",
          display: "flex", alignItems: "center", gap: 5 }}>
          <CheckCircle2 size={11} color={color} /> Key Findings
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {keyPoints.map((pt, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 10px",
              borderRadius: 8, background: `${color}07`, border: `1px solid ${color}15` }}>
              <span style={{ color, flexShrink: 0, marginTop: 2, display: "flex" }}>
                <CheckCircle2 size={11} />
              </span>
              <span style={{ fontFamily: "var(--font-display, sans-serif)", fontSize: 14,
                lineHeight: 1.65, color: "rgba(255,255,255,0.65)" }}>
                {pt}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
type Tab = "overview" | "charts" | "skills" | "reasoning" | "risks";

export function ReportBubble({ report }: { report: AnalysisReport }) {
  const vm = VM[report.verdict] ?? VM.neutral;
  const [tab, setTab] = useState<Tab>("overview");

  const tabs: { id: Tab; label: string; Icon: React.ComponentType<any> }[] = [
    { id: "overview",  label: "Overview",  Icon: LayoutList   },
    { id: "charts",    label: "Charts",    Icon: BarChart3     },
    { id: "skills",    label: "Skills",    Icon: Zap           },
    { id: "reasoning", label: "Reasoning", Icon: Brain         },
    { id: "risks",     label: "Risks",     Icon: ShieldAlert   },
  ];

  return (
    <div style={{
      background: "rgb(5,12,24)",
      border: `1px solid ${vm.border}`,
      borderRadius: 16,
      overflow: "hidden",
      width: "100%",
      maxWidth: 580,
      boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px ${vm.border}, 0 0 60px ${vm.glow}`,
    }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 18px 14px", background: vm.bg, borderBottom: `1px solid ${vm.border}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flexShrink: 0 }}>
            <ScoreGauge score={report.score} color={vm.color} />
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 800,
                letterSpacing: "0.14em", color: vm.color, padding: "3px 10px", borderRadius: 6,
                background: `${vm.color}18`, border: `1px solid ${vm.color}35` }}>
                {vm.label}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(255,255,255,0.35)",
                padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)" }}>
                {report.confidence}% confidence
              </span>
            </div>

            <p style={{ fontFamily: "var(--font-display, sans-serif)", fontSize: 14, fontWeight: 700,
              color: "rgba(255,255,255,0.9)", margin: "0 0 3px" }}>
              {report.coinName}
              <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400, marginLeft: 6, fontSize: 14 }}>
                {report.symbol}
              </span>
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                ${report.priceAtRun.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
                {new Date(report.runAt).toLocaleString()}
              </span>
            </div>

            {/* Skill pills with Lucide icons */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
              {report.skills.map(s => (
                <span key={s.name} style={{
                  fontSize: 11, fontWeight: 600,
                  color: SC[s.verdict] ?? "#94a3b8",
                  background: `${SC[s.verdict] ?? "#94a3b8"}12`,
                  border: `1px solid ${SC[s.verdict] ?? "#94a3b8"}25`,
                  padding: "3px 8px", borderRadius: 5,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <span style={{ color: SC[s.verdict] ?? "#94a3b8", display: "flex" }}>
                    {SKILL_ICON_MAP[s.name] ?? <BarChart3 size={12} />}
                  </span>
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", background: "rgb(4,10,20)",
        borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: "0 0 auto", padding: "9px 14px", fontSize: 13,
              fontFamily: "var(--font-display, sans-serif)", fontWeight: 600,
              background: "transparent", border: "none",
              borderBottom: tab === t.id ? `2px solid ${vm.color}` : "2px solid transparent",
              color: tab === t.id ? vm.color : "rgba(255,255,255,0.28)",
              cursor: "pointer", transition: "all 0.15s ease",
              display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
            }}
          >
            <t.Icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}
      <div style={{ padding: "16px 18px", maxHeight: 500, overflowY: "auto" }}>

        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontFamily: "var(--font-display, sans-serif)", fontSize: 15, lineHeight: 1.8,
              color: "rgba(255,255,255,0.7)", margin: 0 }}>
              {report.narrative}
            </p>
            <ConfidenceBreakdown skills={report.skills} confidence={report.confidence} color={vm.color} />
          </div>
        )}

        {tab === "charts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <SkillBarChart skills={report.skills} />
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
            <SignalWaterfall skills={report.skills} finalScore={report.score} />
          </div>
        )}

        {tab === "skills" && <SkillCards skills={report.skills} />}

        {tab === "reasoning" && (
          <div>
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.28)",
              fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 14px" }}>
              {report.reasoning.length} Decision Steps
            </p>
            <PhaseTimeline reasoning={report.reasoning} />
          </div>
        )}

        {tab === "risks" && (
          <RiskPanel risks={report.risks} keyPoints={report.keyPoints} color={vm.color} />
        )}

      </div>
    </div>
  );
}
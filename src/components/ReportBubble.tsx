"use client";

import { useState, useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SkillResult {
  name:    string;
  verdict: "bullish" | "bearish" | "neutral";
  score:   number;
  summary: string;
}

export interface ReasoningStep {
  step:     number;
  phase:    string;
  title:    string;
  detail:   string;
  score?:   number;
  decision?: string;
  weight?:  number;
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
  context:        "#60a5fa",
  skill_selection:"#a78bfa",
  skill_result:   "#00e5a0",
  synthesis:      "#ffb020",
  verdict:        "#f472b6",
};

const SKILL_WEIGHTS: Record<string, number> = {
  trend: 0.30, momentum: 0.25, volatility: 0.20, sentiment: 0.15, pattern: 0.10,
};

const SKILL_ICONS: Record<string, string> = {
  trend: "📈", momentum: "⚡", volatility: "🌊", sentiment: "📰", pattern: "🕯️",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function useAnimated(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    const from = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * ease);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

// ── 1. SCORE GAUGE ────────────────────────────────────────────────────────────
// Arc from -100 to +100, half-circle at top
function ScoreGauge({ score, color }: { score: number; color: string }) {
  const animated = useAnimated(score, 1000);
  const cx = 90, cy = 90, r = 72;
  // Arc spans 180° (left = -100, right = +100)
  const toAngle = (s: number) => ((s + 100) / 200) * Math.PI; // 0..PI
  const toXY = (angle: number) => ({
    x: cx - r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  });

  // Full arc path (left to right, bottom half of a top circle)
  const startAngle = 0;      // leftmost (-100)
  const endAngle   = Math.PI; // rightmost (+100)
  const p1 = toXY(startAngle);
  const p2 = toXY(endAngle);
  const trackPath = `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;

  const fillAngle = toAngle(Math.max(-100, Math.min(100, animated)));
  const pFill = toXY(fillAngle);
  const large = fillAngle > Math.PI / 2 ? 1 : 0;
  const fillPath = `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${pFill.x} ${pFill.y}`;

  // Needle
  const needleEnd = toXY(fillAngle);

  // Zone markers
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

        {/* Track */}
        <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} strokeLinecap="round" />

        {/* Colored fill */}
        <path d={fillPath} fill="none" stroke="url(#gaugeGrad)" strokeWidth={10} strokeLinecap="round"
          style={{ transition: "d 0.05s" }} />

        {/* Glow fill */}
        <path d={fillPath} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
          opacity={0.18} filter="url(#glowF)" />

        {/* Zone ticks */}
        {zones.map(z => {
          const inner = { x: cx - (r - 14) * Math.cos(z.angle), y: cy - (r - 14) * Math.sin(z.angle) };
          const outer = { x: cx - (r + 2)  * Math.cos(z.angle), y: cy - (r + 2)  * Math.sin(z.angle) };
          const lbl   = { x: cx - (r + 16) * Math.cos(z.angle), y: cy - (r + 16) * Math.sin(z.angle) };
          return (
            <g key={z.label}>
              <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
              <text x={lbl.x} y={lbl.y} textAnchor="middle" dominantBaseline="middle"
                fontSize={7} fill="rgba(255,255,255,0.25)" fontFamily="monospace">
                {z.label}
              </text>
            </g>
          );
        })}

        {/* Needle */}
        <line
          x1={cx} y1={cy}
          x2={needleEnd.x} y2={needleEnd.y}
          stroke={color} strokeWidth={2.5} strokeLinecap="round"
          filter="url(#glowF)"
          style={{ transition: "x2 0.05s, y2 0.05s" }}
        />
        <circle cx={cx} cy={cy} r={5} fill={color} />
        <circle cx={cx} cy={cy} r={3} fill="rgb(6,14,26)" />

        {/* Score label */}
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize={22} fontWeight={700}
          fill={color} fontFamily="monospace">
          {animated >= 0 ? "+" : ""}{Math.round(animated)}
        </text>
        <text x={cx} y={cy + 30} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.3)" fontFamily="monospace">
          SIGNAL SCORE
        </text>
      </svg>
    </div>
  );
}

// ── 2. RADAR CHART ────────────────────────────────────────────────────────────
function RadarChart({ skills }: { skills: SkillResult[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

  if (skills.length < 3) return null;

  const cx = 110, cy = 110, rMax = 82;
  const n  = skills.length;

  const angleOf = (i: number) => (i / n) * 2 * Math.PI - Math.PI / 2;
  const pt = (i: number, pct: number) => ({
    x: cx + Math.cos(angleOf(i)) * rMax * pct,
    y: cy + Math.sin(angleOf(i)) * rMax * pct,
  });

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Skill pct: score -100..100 → 0..1
  const pcts = skills.map(s => ((s.score + 100) / 200));

  const polygon = (vals: number[]) =>
    vals.map((v, i) => `${pt(i, v).x},${pt(i, v).y}`).join(" ");

  const dataColor = "#00e5a0";

  return (
    <svg width={220} height={220} style={{ display: "block", margin: "0 auto", overflow: "visible" }}>
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#00e5a0" stopOpacity={0.25} />
          <stop offset="100%" stopColor="#00e5a0" stopOpacity={0.04} />
        </radialGradient>
      </defs>

      {/* Grid rings */}
      {rings.map(r => (
        <polygon key={r}
          points={polygon(skills.map(() => r))}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}

      {/* Axis spokes */}
      {skills.map((_, i) => {
        const outer = pt(i, 1.0);
        return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y}
          stroke="rgba(255,255,255,0.08)" strokeWidth={1} />;
      })}

      {/* Data polygon (unanimated fallback then animated) */}
      <polygon
        points={polygon(pcts.map(p => mounted ? p : 0))}
        fill="url(#radarFill)"
        stroke={dataColor}
        strokeWidth={2}
        style={{ transition: "points 0.9s cubic-bezier(0.34,1.56,0.64,1)" }}
      />

      {/* Data points */}
      {skills.map((s, i) => {
        const p   = pt(i, mounted ? pcts[i] : 0);
        const col = SC[s.verdict] ?? "#94a3b8";
        return (
          <g key={i} style={{ transition: `transform 0.9s cubic-bezier(0.34,1.56,0.64,1)` }}>
            <circle cx={p.x} cy={p.y} r={5} fill={col} stroke="rgb(6,14,26)" strokeWidth={2} />
            <circle cx={p.x} cy={p.y} r={9} fill={col} opacity={0.15} />
          </g>
        );
      })}

      {/* Labels */}
      {skills.map((s, i) => {
        const p   = pt(i, 1.22);
        const col = SC[s.verdict] ?? "#94a3b8";
        const icon = SKILL_ICONS[s.name] ?? "📊";
        return (
          <g key={i}>
            <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize={13} dominantBaseline="middle">
              {icon}
            </text>
            <text x={p.x} y={p.y + 9} textAnchor="middle" fontSize={8.5}
              fill={col} fontFamily="monospace" fontWeight={700} letterSpacing={0.8}>
              {s.name.toUpperCase()}
            </text>
            <text x={p.x} y={p.y + 20} textAnchor="middle" fontSize={8}
              fill="rgba(255,255,255,0.35)" fontFamily="monospace">
              {s.score > 0 ? "+" : ""}{s.score}
            </text>
          </g>
        );
      })}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3} fill="rgba(255,255,255,0.2)" />
    </svg>
  );
}

// ── 3. SIGNAL WATERFALL ───────────────────────────────────────────────────────
// Shows each skill's weighted contribution to the final score
function SignalWaterfall({ skills, finalScore }: { skills: SkillResult[]; finalScore: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 150); }, []);

  const contributions = skills.map(s => {
    const w    = SKILL_WEIGHTS[s.name] ?? 0.1;
    const contrib = Math.round(s.score * w);
    return { ...s, weight: w, contrib };
  });

  const maxAbs = Math.max(100, ...contributions.map(c => Math.abs(c.contrib)));
  const barW   = 200; // total bar pixel width

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <p style={{
        fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.3)",
        letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 10px",
      }}>
        Signal Contribution
      </p>

      {/* Zero line reference */}
      <div style={{ position: "relative" }}>
        {contributions.map((c, i) => {
          const col    = SC[c.verdict] ?? "#94a3b8";
          const absW   = mounted ? (Math.abs(c.contrib) / maxAbs) * barW : 0;
          const isNeg  = c.contrib < 0;
          const icon   = SKILL_ICONS[c.name] ?? "📊";

          return (
            <div key={c.name} style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr 44px",
              alignItems: "center",
              gap: 8,
              padding: "5px 0",
              borderBottom: i < contributions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
              {/* Label */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 12 }}>{icon}</span>
                <span style={{
                  fontFamily: "monospace", fontSize: 9.5, fontWeight: 700,
                  color: col, letterSpacing: "0.06em",
                }}>
                  {c.name.toUpperCase()}
                </span>
              </div>

              {/* Bar */}
              <div style={{
                position: "relative", height: 20,
                display: "flex", alignItems: "center",
              }}>
                {/* Zero center line */}
                <div style={{
                  position: "absolute", left: "50%", top: 0, bottom: 0,
                  width: 1, background: "rgba(255,255,255,0.12)",
                }} />

                {/* Bar — grows from center */}
                <div style={{
                  position: "absolute",
                  height: 12, borderRadius: 3,
                  background: `linear-gradient(${isNeg ? "270deg" : "90deg"}, ${col}aa, ${col})`,
                  boxShadow: `0 0 8px ${col}40`,
                  width: absW,
                  ...(isNeg
                    ? { right: "50%", transformOrigin: "right" }
                    : { left: "50%",  transformOrigin: "left"  }
                  ),
                  transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)",
                  transitionDelay: `${i * 60}ms`,
                }} />
              </div>

              {/* Value */}
              <span style={{
                fontFamily: "monospace", fontSize: 10, fontWeight: 700,
                color: col, textAlign: "right",
              }}>
                {c.contrib >= 0 ? "+" : ""}{c.contrib}
              </span>
            </div>
          );
        })}

        {/* Total row */}
        <div style={{
          display: "grid", gridTemplateColumns: "80px 1fr 44px",
          alignItems: "center", gap: 8,
          paddingTop: 8, marginTop: 4,
          borderTop: "1px solid rgba(255,255,255,0.12)",
        }}>
          <span style={{
            fontFamily: "monospace", fontSize: 9.5, fontWeight: 700,
            color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em",
          }}>
            TOTAL
          </span>
          <div />
          <span style={{
            fontFamily: "monospace", fontSize: 12, fontWeight: 700,
            color: finalScore >= 0 ? "#00e5a0" : "#ff5572", textAlign: "right",
          }}>
            {finalScore >= 0 ? "+" : ""}{finalScore}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── 4. CONFIDENCE BREAKDOWN ───────────────────────────────────────────────────
function ConfidenceBreakdown({ skills, confidence, color }: {
  skills: SkillResult[]; confidence: number; color: string;
}) {
  const animated = useAnimated(confidence, 1100);

  const bullish = skills.filter(s => s.verdict === "bullish").length;
  const bearish = skills.filter(s => s.verdict === "bearish").length;
  const neutral = skills.filter(s => s.verdict === "neutral").length;
  const total   = skills.length || 1;

  const agreement = bullish === total || bearish === total
    ? "All skills agree"
    : bullish === 0 || bearish === 0
    ? "Mostly aligned"
    : "Conflicting signals";

  const agreementColor = bullish === total ? "#00e5a0" : bearish === total ? "#ff5572" : "#ffb020";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Big confidence arc */}
      <div style={{ position: "relative", height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: "0 auto 0 0",
          width: `${animated}%`,
          background: `linear-gradient(90deg, ${color}66, ${color})`,
          borderRadius: 8,
          boxShadow: `0 0 12px ${color}50`,
          transition: "width 1.1s ease",
        }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>
          CONFIDENCE
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color }}>
          {Math.round(animated)}%
        </span>
      </div>

      {/* Skill consensus breakdown */}
      <div style={{
        display: "flex", gap: 1, height: 6, borderRadius: 4, overflow: "hidden",
      }}>
        <div style={{
          flex: bullish, background: "#00e5a0",
          transition: "flex 0.8s ease",
        }} />
        <div style={{
          flex: neutral, background: "#94a3b8",
          transition: "flex 0.8s ease",
        }} />
        <div style={{
          flex: bearish, background: "#ff5572",
          transition: "flex 0.8s ease",
        }} />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { label: "Bullish", val: bullish, color: "#00e5a0" },
          { label: "Neutral", val: neutral, color: "#94a3b8" },
          { label: "Bearish", val: bearish, color: "#ff5572" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
            <span style={{ fontFamily: "monospace", fontSize: 9.5, color: "rgba(255,255,255,0.4)" }}>
              {item.val} {item.label}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 10px", borderRadius: 8,
        background: `${agreementColor}10`,
        border: `1px solid ${agreementColor}25`,
      }}>
        <span style={{ fontSize: 12 }}>
          {bullish === total ? "🎯" : bearish === total ? "⚠️" : "⚡"}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: agreementColor, fontWeight: 600 }}>
          {agreement}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
          {bullish}/{total} skills bullish
        </span>
      </div>
    </div>
  );
}

// ── 5. PHASE TIMELINE ─────────────────────────────────────────────────────────
function PhaseTimeline({ reasoning }: { reasoning: ReasoningStep[] }) {
  const [openStep, setOpenStep] = useState<number | null>(null);

  // Group by phase
  const phaseOrder = ["context", "skill_selection", "skill_result", "synthesis", "verdict"];
  const phaseIcons: Record<string, string> = {
    context:         "🔍",
    skill_selection: "🎯",
    skill_result:    "⚡",
    synthesis:       "🧮",
    verdict:         "⚖️",
  };
  const phaseLabels: Record<string, string> = {
    context:         "Data Load",
    skill_selection: "Skill Select",
    skill_result:    "Skill Results",
    synthesis:       "Synthesis",
    verdict:         "Verdict",
  };

  const grouped = phaseOrder.map(ph => ({
    phase: ph,
    steps: reasoning.filter(r => r.phase === ph),
    color: PHASE_COLOR[ph] ?? "#94a3b8",
    icon:  phaseIcons[ph] ?? "📌",
    label: phaseLabels[ph] ?? ph,
  })).filter(g => g.steps.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {grouped.map((group, gi) => (
        <div key={group.phase} style={{ display: "flex", gap: 12 }}>
          {/* Timeline spine */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: `${group.color}18`,
              border: `2px solid ${group.color}50`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, zIndex: 1,
            }}>
              {group.icon}
            </div>
            {gi < grouped.length - 1 && (
              <div style={{ flex: 1, width: 2, background: `${group.color}20`, minHeight: 16 }} />
            )}
          </div>

          {/* Phase content */}
          <div style={{ flex: 1, paddingBottom: gi < grouped.length - 1 ? 16 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, height: 28 }}>
              <span style={{
                fontFamily: "monospace", fontSize: 10, fontWeight: 700,
                color: group.color, letterSpacing: "0.08em",
              }}>
                {group.label.toUpperCase()}
              </span>
              <span style={{
                fontFamily: "monospace", fontSize: 8.5,
                color: "rgba(255,255,255,0.25)",
              }}>
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
                      <span style={{
                        fontFamily: "var(--font-display, sans-serif)",
                        fontSize: 11, fontWeight: 600,
                        color: isOpen ? group.color : "rgba(255,255,255,0.55)",
                        flex: 1, transition: "color 0.2s ease",
                      }}>
                        {step.title}
                      </span>
                      {step.score !== undefined && (
                        <span style={{
                          fontFamily: "monospace", fontSize: 10, fontWeight: 700,
                          color: step.score >= 0 ? "#00e5a0" : "#ff5572",
                          flexShrink: 0,
                        }}>
                          {step.score >= 0 ? "+" : ""}{step.score}
                        </span>
                      )}
                      <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, flexShrink: 0 }}>
                        {isOpen ? "▴" : "▾"}
                      </span>
                    </button>

                    {isOpen && (
                      <div style={{ padding: "0 10px 10px" }}>
                        <p style={{
                          fontFamily: "var(--font-display, sans-serif)",
                          fontSize: 11, lineHeight: 1.65,
                          color: "rgba(255,255,255,0.45)",
                          margin: 0, whiteSpace: "pre-wrap",
                        }}>
                          {step.detail}
                        </p>
                        {step.decision && (
                          <p style={{
                            fontFamily: "monospace", fontSize: 10,
                            color: group.color,
                            margin: "6px 0 0",
                            padding: "5px 8px",
                            background: `${group.color}0c`,
                            borderRadius: 6,
                            borderLeft: `2px solid ${group.color}50`,
                          }}>
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

// ── 6. SKILL DETAIL CARDS ─────────────────────────────────────────────────────
function SkillCards({ skills }: { skills: SkillResult[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 80); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {skills.map((skill, i) => {
        const col  = SC[skill.verdict] ?? "#94a3b8";
        const icon = SKILL_ICONS[skill.name] ?? "📊";
        const w    = SKILL_WEIGHTS[skill.name] ?? 0.1;
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
            {/* Header */}
            <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              {/* Icon */}
              <div style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: `${col}12`, border: `1px solid ${col}25`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>
                {icon}
              </div>

              {/* Name + verdict */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{
                    fontFamily: "monospace", fontSize: 10, fontWeight: 700,
                    color: col, letterSpacing: "0.08em",
                  }}>
                    {skill.name.toUpperCase()}
                  </span>
                  <span style={{
                    fontSize: 8.5, fontFamily: "monospace", fontWeight: 700,
                    color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em",
                    background: "rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: 4,
                  }}>
                    {(w * 100).toFixed(0)}% WEIGHT
                  </span>
                </div>
                {/* Mini bar */}
                <div style={{
                  height: 4, background: "rgba(255,255,255,0.06)",
                  borderRadius: 3, overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", width: `${barPct}%`,
                    background: `linear-gradient(90deg, ${col}66, ${col})`,
                    borderRadius: 3,
                    transition: `width 0.8s cubic-bezier(0.34,1.56,0.64,1) ${i * 80}ms`,
                  }} />
                </div>
              </div>

              {/* Score */}
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: col, lineHeight: 1,
                }}>
                  {skill.score >= 0 ? "+" : ""}{skill.score}
                </span>
                <span style={{
                  fontFamily: "monospace", fontSize: 8.5,
                  color: "rgba(255,255,255,0.25)",
                }}>
                  contrib {contrib >= 0 ? "+" : ""}{contrib}
                </span>
              </div>

              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, flexShrink: 0, marginLeft: 2 }}>
                {isActive ? "▴" : "▾"}
              </span>
            </div>

            {/* Expanded summary */}
            {isActive && (
              <div style={{
                padding: "0 12px 12px",
                borderTop: `1px solid ${col}15`,
              }}>
                <p style={{
                  fontFamily: "var(--font-display, sans-serif)",
                  fontSize: 11.5, lineHeight: 1.65,
                  color: "rgba(255,255,255,0.5)",
                  margin: "10px 0 0",
                }}>
                  {skill.summary}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <span style={{
                    padding: "3px 8px", borderRadius: 6, fontSize: 9.5,
                    fontFamily: "monospace", fontWeight: 700,
                    color: col, background: `${col}14`,
                    border: `1px solid ${col}25`,
                    letterSpacing: "0.06em",
                  }}>
                    {skill.verdict.toUpperCase()}
                  </span>
                  <span style={{
                    padding: "3px 8px", borderRadius: 6, fontSize: 9.5,
                    fontFamily: "monospace",
                    color: "rgba(255,255,255,0.35)",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}>
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

// ── 7. RISK PANEL ─────────────────────────────────────────────────────────────
function RiskPanel({ risks, keyPoints, color }: {
  risks: string[]; keyPoints: string[]; color: string;
}) {
  // Heuristic severity: longer / more punctuation = higher risk
  const severity = (r: string) => {
    if (r.toLowerCase().includes("high") || r.toLowerCase().includes("severe") || r.toLowerCase().includes("crash")) return 3;
    if (r.toLowerCase().includes("watch") || r.toLowerCase().includes("caution") || r.toLowerCase().includes("risk")) return 2;
    return 1;
  };

  const severityMeta = [
    { level: 1, label: "LOW",  color: "#94a3b8", bg: "rgba(148,163,184,0.08)" },
    { level: 2, label: "MED",  color: "#ffb020", bg: "rgba(255,176,32,0.08)"  },
    { level: 3, label: "HIGH", color: "#ff5572", bg: "rgba(255,85,114,0.08)"  },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Risk list with severity */}
      <div>
        <p style={{ fontFamily: "monospace", fontSize: 9, color: "#ff5572", fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 8px" }}>
          ⚠ Risk Factors
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {risks.map((r, i) => {
            const sev = severity(r);
            const sm  = severityMeta[sev - 1];
            return (
              <div key={i} style={{
                display: "flex", gap: 10, padding: "9px 12px",
                borderRadius: 8, background: sm.bg,
                border: `1px solid ${sm.color}22`,
                alignItems: "flex-start",
              }}>
                <span style={{
                  fontFamily: "monospace", fontSize: 8, fontWeight: 700,
                  color: sm.color, background: `${sm.color}18`,
                  padding: "2px 5px", borderRadius: 4,
                  letterSpacing: "0.06em", flexShrink: 0, marginTop: 1,
                }}>
                  {sm.label}
                </span>
                <span style={{
                  fontFamily: "var(--font-display, sans-serif)",
                  fontSize: 11.5, lineHeight: 1.55, color: "rgba(255,255,255,0.5)",
                }}>
                  {r}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key points */}
      <div>
        <p style={{ fontFamily: "monospace", fontSize: 9, color, fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 8px" }}>
          ✦ Key Findings
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {keyPoints.map((pt, i) => (
            <div key={i} style={{
              display: "flex", gap: 8, alignItems: "flex-start",
              padding: "7px 10px", borderRadius: 8,
              background: `${color}07`,
              border: `1px solid ${color}15`,
            }}>
              <span style={{ color, fontSize: 11, flexShrink: 0, marginTop: 1 }}>▸</span>
              <span style={{
                fontFamily: "var(--font-display, sans-serif)",
                fontSize: 11.5, lineHeight: 1.55, color: "rgba(255,255,255,0.5)",
              }}>
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
  const vm     = VM[report.verdict] ?? VM.neutral;
  const [tab, setTab] = useState<Tab>("overview");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview",  label: "Overview",  icon: "📋" },
    { id: "charts",    label: "Charts",    icon: "📊" },
    { id: "skills",    label: "Skills",    icon: "⚡" },
    { id: "reasoning", label: "Reasoning", icon: "🔍" },
    { id: "risks",     label: "Risks",     icon: "⚠️" },
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
      <div style={{
        padding: "16px 18px 14px",
        background: vm.bg,
        borderBottom: `1px solid ${vm.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          {/* Gauge */}
          <div style={{ flexShrink: 0 }}>
            <ScoreGauge score={report.score} color={vm.color} />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
            {/* Verdict badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{
                fontFamily: "monospace", fontSize: 11, fontWeight: 800,
                letterSpacing: "0.14em", color: vm.color,
                padding: "3px 10px", borderRadius: 6,
                background: `${vm.color}18`, border: `1px solid ${vm.color}35`,
              }}>
                {vm.label}
              </span>
              <span style={{
                fontFamily: "monospace", fontSize: 10,
                color: "rgba(255,255,255,0.35)",
                padding: "3px 8px", borderRadius: 6,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                {report.confidence}% confidence
              </span>
            </div>

            {/* Coin */}
            <p style={{
              fontFamily: "var(--font-display, sans-serif)",
              fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)",
              margin: "0 0 3px",
            }}>
              {report.coinName}
              <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400, marginLeft: 6, fontSize: 12 }}>
                {report.symbol}
              </span>
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                ${report.priceAtRun.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                {new Date(report.runAt).toLocaleString()}
              </span>
            </div>

            {/* Skills used pills */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
              {report.skills.map(s => (
                <span key={s.name} style={{
                  fontFamily: "monospace", fontSize: 8, fontWeight: 700,
                  color: SC[s.verdict] ?? "#94a3b8",
                  background: `${SC[s.verdict] ?? "#94a3b8"}12`,
                  border: `1px solid ${SC[s.verdict] ?? "#94a3b8"}25`,
                  padding: "2px 6px", borderRadius: 4, letterSpacing: "0.06em",
                }}>
                  {SKILL_ICONS[s.name]} {s.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        background: "rgb(4,10,20)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        overflowX: "auto",
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: "0 0 auto",
              padding: "9px 14px",
              fontSize: 11,
              fontFamily: "var(--font-display, sans-serif)",
              fontWeight: 600,
              background: "transparent",
              border: "none",
              borderBottom: tab === t.id ? `2px solid ${vm.color}` : "2px solid transparent",
              color: tab === t.id ? vm.color : "rgba(255,255,255,0.28)",
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex", alignItems: "center", gap: 5,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 12 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}
      <div style={{ padding: "16px 18px", maxHeight: 500, overflowY: "auto" }}>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{
              fontFamily: "var(--font-display, sans-serif)",
              fontSize: 12.5, lineHeight: 1.75,
              color: "rgba(255,255,255,0.55)", margin: 0,
            }}>
              {report.narrative}
            </p>
            <ConfidenceBreakdown skills={report.skills} confidence={report.confidence} color={vm.color} />
          </div>
        )}

        {/* CHARTS */}
        {tab === "charts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Radar */}
            <div>
              <p style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.28)",
                fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 12px" }}>
                Skill Radar
              </p>
              <RadarChart skills={report.skills} />
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

            {/* Signal waterfall */}
            <SignalWaterfall skills={report.skills} finalScore={report.score} />
          </div>
        )}

        {/* SKILLS */}
        {tab === "skills" && (
          <SkillCards skills={report.skills} />
        )}

        {/* REASONING */}
        {tab === "reasoning" && (
          <div>
            <p style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.28)",
              fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 14px" }}>
              {report.reasoning.length} Decision Steps
            </p>
            <PhaseTimeline reasoning={report.reasoning} />
          </div>
        )}

        {/* RISKS */}
        {tab === "risks" && (
          <RiskPanel risks={report.risks} keyPoints={report.keyPoints} color={vm.color} />
        )}

      </div>
    </div>
  );
}
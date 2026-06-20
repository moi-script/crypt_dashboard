"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/controllers/useAuth";
import { useCoinList } from "@/controllers/useCoinList";
import type { Coin } from "@/models/coin.model";

// ── Types ────────────────────────────────────────────────────────────────────

type ActiveSection = "hero" | "markets" | "charts" | "agent" | "stats";
type AuthTab = "login" | "register";

const THEME: Record<ActiveSection, { glow: string; accent: string }> = {
  hero:    { glow: "rgba(0,212,255,0.18)",   accent: "#00d4ff" },
  markets: { glow: "rgba(0,212,255,0.14)",   accent: "#00d4ff" },
  charts:  { glow: "rgba(167,139,250,0.18)", accent: "#a78bfa" },
  agent:   { glow: "rgba(0,229,160,0.18)",   accent: "#00e5a0" },
  stats:   { glow: "rgba(0,212,255,0.12)",   accent: "#00d4ff" },
};

// ── Format helpers ───────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1)    return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

// ── Scroll reveal (direct DOM, no re-renders) ────────────────────────────────

function useReveal(ref: { current: HTMLElement | null }) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "opacity 0.85s cubic-bezier(0.16,1,0.3,1), transform 0.85s cubic-bezier(0.16,1,0.3,1)";
    el.style.opacity = "0";
    el.style.transform = "translateY(30px)";
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
}

// ── ScrollProgress (left-edge vertical bar) ──────────────────────────────────

function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const update = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const pct = total > 0 ? (window.scrollY / total) * 100 : 0;
      bar.style.height = `${Math.min(pct, 100)}%`;
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <div style={{ position: "fixed", left: 0, top: 0, width: 2, height: "100dvh", background: "rgba(255,255,255,0.03)", zIndex: 80, pointerEvents: "none" }}>
      <div ref={barRef} style={{ width: "100%", height: "0%", background: "linear-gradient(to bottom, var(--cyan), var(--violet), var(--up))", transition: "height 0.08s linear" }} />
    </div>
  );
}

// ── LandingNav (floats in after hero leaves viewport) ─────────────────────────

function LandingNav({ show }: { show: boolean }) {
  return (
    <nav
      aria-hidden={!show}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 90,
        height: 52, display: "flex", alignItems: "center", padding: "0 5vw",
        background: "rgba(2,5,8,0.88)", backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        transform: show ? "translateY(0)" : "translateY(-100%)",
        opacity: show ? 1 : 0,
        transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.35s ease",
        pointerEvents: show ? "auto" : "none",
      }}
    >
      <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em", marginRight: "auto" }}>
        CRPT<span style={{ color: "var(--cyan)" }}>X</span>
      </span>

      <div className="hidden md:flex items-center" style={{ gap: 28, marginRight: 24 }}>
        {[
          { href: "#section-markets", label: "Markets" },
          { href: "#section-charts",  label: "Charts"  },
          { href: "#section-agent",   label: "AI Agent" },
        ].map(l => (
          <a key={l.href} href={l.href} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)", textDecoration: "none", letterSpacing: "0.04em", transition: "color 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-muted)"; }}
          >{l.label}</a>
        ))}
      </div>

      <a
        href="https://github.com/moi-script/crypt_dashboard"
        target="_blank"
        rel="noopener noreferrer"
        title="View source on GitHub"
        style={{ display: "flex", alignItems: "center", padding: "6px 8px", borderRadius: 8, color: "var(--ink-muted)", transition: "color 0.15s", marginRight: 8 }}
        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-muted)"; }}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17" aria-hidden="true">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
      </a>

      <Link href="/login" style={{ padding: "7px 18px", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none", color: "var(--cyan)", border: "1px solid rgba(0,212,255,0.28)", background: "rgba(0,212,255,0.06)", transition: "all 0.2s" }}>
        Sign In
      </Link>
    </nav>
  );
}

// ── FeatureStrip ──────────────────────────────────────────────────────────────

function FeatureStrip() {
  const items = [
    { label: "Real-time WebSocket feeds",   color: "var(--cyan)"   },
    { label: "AI portfolio co-pilot",        color: "var(--up)"    },
    { label: "300+ crypto pairs",            color: "var(--cyan)"  },
    { label: "Price & volume alerts",        color: "var(--violet)"},
    { label: "Multi-asset portfolio",        color: "var(--up)"    },
    { label: "15-second refresh cycles",     color: "var(--cyan)"  },
  ];
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "18px 5vw", display: "flex", gap: 36, overflowX: "auto" } as React.CSSProperties}>
      {items.map((f, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: f.color, boxShadow: `0 0 5px ${f.color}`, flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)", whiteSpace: "nowrap", letterSpacing: "0.03em" }}>{f.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  const cols: Record<string, { href: string; label: string }[]> = {
    Platform: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "#section-markets", label: "Markets" },
      { href: "/portfolio", label: "Portfolio" },
      { href: "/agent", label: "AI Agent" },
      { href: "/news", label: "News" },
    ],
    Account: [
      { href: "/login",    label: "Sign In" },
      { href: "/register", label: "Create Account" },
    ],
  };
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "3rem 5vw 2.5rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2.5rem", justifyContent: "space-between" }}>
        <div style={{ maxWidth: 240 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 10 }}>
            CRPT<span style={{ color: "var(--cyan)" }}>X</span> Terminal
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-faint)", lineHeight: 1.7 }}>
            Professional-grade crypto analytics for serious traders.
          </p>
        </div>
        <div style={{ display: "flex", gap: "2.5rem", flexWrap: "wrap" }}>
          {Object.entries(cols).map(([group, items]) => (
            <div key={group}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--ink-faint)", marginBottom: 16 }}>{group}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {items.map(l => (
                  <Link key={l.href} href={l.href} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)", textDecoration: "none", transition: "color 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-muted)"; }}
                  >{l.label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)" }}>© 2026 CRPTX Terminal · Educational purposes only · Not financial advice.</span>
        <a
          href="https://github.com/moi-script/crypt_dashboard"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)", textDecoration: "none", transition: "color 0.15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-soft)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-faint)"; }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          moi-script/crypt_dashboard
        </a>
      </div>
    </footer>
  );
}

// ── Sparklines ────────────────────────────────────────────────────────────────

function MiniSparkline({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const W = 64, H = 28;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={up ? "#00e5a0" : "#ff5572"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
    </svg>
  );
}

function FullSparkline({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const W = 400, H = 90;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`).join(" ");
  const area = `0,${H} ${pts} ${W},${H}`;
  const color = up ? "#00e5a0" : "#ff5572";
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id="sfFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.13" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sfFill)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── CoinIcon / CoinRow / SkeletonRow ─────────────────────────────────────────

function CoinIcon({ coin }: { coin: Coin }) {
  if (coin.image) {
    return <img src={coin.image} alt={coin.symbol} width={32} height={32} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />;
  }
  return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--cyan)" }}>
      {coin.symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}

function CoinRow({ coin }: { coin: Coin }) {
  const up = coin.change24h >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s", cursor: "default" }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.025)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
      <CoinIcon coin={coin} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{coin.name}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{coin.symbol}</div>
      </div>
      {coin.sparkline && coin.sparkline.length > 1 && <MiniSparkline data={coin.sparkline} up={up} />}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{fmtPrice(coin.price)}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: up ? "var(--up)" : "var(--down)" }}>{fmtPct(coin.change24h)}</div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.04)", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: 90, height: 12, borderRadius: 4, background: "rgba(255,255,255,0.04)", marginBottom: 6 }} />
        <div style={{ width: 40, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.03)" }} />
      </div>
      <div style={{ width: 70, height: 12, borderRadius: 4, background: "rgba(255,255,255,0.04)" }} />
    </div>
  );
}

// ── CandlestickPreview ────────────────────────────────────────────────────────

function CandlestickPreview() {
  const bars = [
    { o: 60, h: 65, l: 55, c: 62 }, { o: 62, h: 68, l: 60, c: 66 },
    { o: 65, h: 70, l: 63, c: 64 }, { o: 64, h: 69, l: 58, c: 67 },
    { o: 67, h: 73, l: 65, c: 72 }, { o: 70, h: 75, l: 68, c: 71 },
    { o: 71, h: 78, l: 69, c: 76 }, { o: 74, h: 80, l: 72, c: 73 },
    { o: 73, h: 77, l: 70, c: 75 }, { o: 75, h: 82, l: 73, c: 80 },
    { o: 78, h: 85, l: 76, c: 83 }, { o: 82, h: 87, l: 80, c: 85 },
  ];
  const W = 360, H = 110, bW = 20, total = 30;
  const toY = (v: number) => H - ((v - 55) / 32) * H;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="cUp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00e5a0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#00e5a0" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="cDn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff5572" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ff5572" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {bars.map((b, i) => {
        const x = i * total + 10;
        const up = b.c >= b.o;
        const bodyTop = Math.min(toY(b.o), toY(b.c));
        const bodyH = Math.max(2, Math.abs(toY(b.o) - toY(b.c)));
        return (
          <g key={i}>
            <line x1={x + bW / 2} y1={toY(b.h)} x2={x + bW / 2} y2={toY(b.l)} stroke={up ? "#00e5a0" : "#ff5572"} strokeWidth={1.5} opacity={0.5} />
            <rect x={x} y={bodyTop} width={bW} height={bodyH} fill={up ? "url(#cUp)" : "url(#cDn)"} rx={2} />
          </g>
        );
      })}
    </svg>
  );
}

// ── 3D Candlestick Background ─────────────────────────────────────────────────

function HeroBg3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Offscreen canvas — scene is rendered here, then bloom-composited to main
    const oc  = document.createElement("canvas");
    const oct = oc.getContext("2d");
    if (!oct) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, angle = -0.28, tick = 0;

    const setSize = () => {
      const w = canvas.offsetWidth || 800, h = canvas.offsetHeight || 600;
      canvas.width = w; canvas.height = h;
      oc.width     = w; oc.height     = h;
    };
    setSize();
    window.addEventListener("resize", setSize);

    // ── Price series (30 bars, upward bias) ──────────────────────────────────
    const N = 30;
    type Bar = { o: number; h: number; l: number; c: number };
    const bars: Bar[] = [];
    let price = 68;
    for (let i = 0; i < N; i++) {
      const d = (Math.random() - 0.43) * 12;
      const o = price;
      price = Math.max(14, Math.min(192, price + d));
      const c = price;
      const body = Math.abs(c - o);
      bars.push({ o, c, h: Math.max(o, c) + Math.random() * (body * 0.45 + 2), l: Math.min(o, c) - Math.random() * (body * 0.45 + 2) });
    }
    const minP  = Math.min(...bars.map(b => b.l));
    const maxP  = Math.max(...bars.map(b => b.h));
    const pRange = maxP - minP;

    // EMA-9
    const ema9: number[] = [];
    let emaV = bars[0].c;
    bars.forEach(b => { emaV = b.c * (2 / 10) + emaV * (8 / 10); ema9.push(emaV); });

    // ── Particle system ───────────────────────────────────────────────────────
    type Particle = { x: number; y: number; vx: number; vy: number; life: number; ml: number; r: number; g: number; bv: number; sz: number };
    const particles: Particle[] = [];
    const spawnPt = (sx: number, sy: number, r: number, g: number, bv: number) => {
      if (particles.length >= 120) return;
      particles.push({ x: sx + (Math.random() - 0.5) * 7, y: sy, vx: (Math.random() - 0.5) * 0.55, vy: -(Math.random() * 1.2 + 0.35), life: 1, ml: 55 + Math.random() * 55, r, g, bv, sz: Math.random() * 1.5 + 0.4 });
    };

    // ── Data rain (subtle background vertical streaks) ────────────────────────
    const rain = Array.from({ length: 38 }, () => ({
      x: Math.random(), y: Math.random(), speed: Math.random() * 0.0018 + 0.0008, alpha: Math.random() * 0.052 + 0.016,
    }));

    // ── Projection: Y-axis rotation → X-axis tilt → perspective ──────────────
    type Pt2 = { x: number; y: number } | null;
    const proj3 = (wx: number, wy: number, wz: number, cx: number, cy: number, ax: number): Pt2 => {
      // Y rotation
      const rx  = wx * Math.cos(angle) - wz * Math.sin(angle);
      const rz1 = wx * Math.sin(angle) + wz * Math.cos(angle);
      // X tilt
      const ry  = wy  * Math.cos(ax) - rz1 * Math.sin(ax);
      const rz2 = wy  * Math.sin(ax) + rz1 * Math.cos(ax);
      // Perspective
      const depth = rz2 + 520;
      if (depth < 1) return null;
      const s = 520 / depth;
      return { x: rx * s + cx, y: ry * s + cy };
    };

    const drawFace = (c: CanvasRenderingContext2D, pts: Pt2[], r: number, g: number, bv: number, a: number) => {
      const vp = pts.filter((q): q is { x: number; y: number } => q !== null);
      if (vp.length < 3) return;
      c.beginPath(); c.moveTo(vp[0].x, vp[0].y);
      for (let i = 1; i < vp.length; i++) c.lineTo(vp[i].x, vp[i].y);
      c.closePath();
      c.fillStyle = `rgba(${r},${g},${bv},${a.toFixed(2)})`; c.fill();
    };

    const drawLine = (c: CanvasRenderingContext2D, a: Pt2, b: Pt2, style: string, lw = 1) => {
      if (!a || !b) return;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
      c.strokeStyle = style; c.lineWidth = lw; c.stroke();
    };

    // ── Main render loop ──────────────────────────────────────────────────────
    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      oct.clearRect(0, 0, W, H);

      if (!reduced) { angle += 0.0015; tick++; }

      // Camera: slow X-tilt oscillation + vertical breathing
      const ax = 0.20 + Math.sin(tick * 0.0055) * 0.022;
      const cx = W * 0.65;
      const cy = H * 0.44 + Math.sin(tick * 0.0085) * 20;

      const spacing = 28, barW = 11, barD = 9, yScale = 1.85;
      const totalW  = N * spacing;
      const toY = (v: number) => -(v - minP) * yScale - 10;
      const gFloor  = toY(minP) + 24;

      // Full-depth painter sort (includes X-tilt contribution)
      const sorted = bars.map((bar, i) => {
        const wx  = i * spacing - totalW / 2 + spacing / 2;
        const rz1 = wx * Math.sin(angle);
        const rz2 = toY(bar.c) * Math.sin(ax) + rz1 * Math.cos(ax);
        return { ...bar, wx, rz2 };
      }).sort((a, b) => b.rz2 - a.rz2);

      const p = (wx: number, wy: number, wz: number) => proj3(wx, wy, wz, cx, cy, ax);

      // ── 1. Data rain (deepest background layer) ───────────────────────────
      rain.forEach(d => {
        d.y += d.speed;
        if (d.y > 1) { d.y = 0; d.x = Math.random(); }
        oct.beginPath();
        oct.moveTo(d.x * W, d.y * H);
        oct.lineTo(d.x * W, d.y * H - 14);
        oct.strokeStyle = `rgba(0,212,255,${d.alpha.toFixed(3)})`;
        oct.lineWidth = 0.5; oct.stroke();
      });

      // ── 2. Horizon ambient glow ───────────────────────────────────────────
      const hg = oct.createRadialGradient(cx, cy + 55, 0, cx, cy + 55, W * 0.46);
      hg.addColorStop(0, "rgba(0,212,255,0.06)");
      hg.addColorStop(1, "rgba(0,0,0,0)");
      oct.fillStyle = hg; oct.fillRect(0, 0, W, H);

      // ── 3. Perspective floor grid with intersection glows ─────────────────
      const gSize = totalW * 1.2;
      oct.lineWidth = 0.5;
      for (let gi = 0; gi <= 9; gi++) {
        const t = (gi / 9 - 0.5) * gSize;
        drawLine(oct, p(t, gFloor, -gSize / 2), p(t, gFloor, gSize / 2), "rgba(0,212,255,0.048)");
        drawLine(oct, p(-gSize / 2, gFloor, t), p(gSize / 2, gFloor, t), "rgba(0,212,255,0.048)");
        if (gi % 3 === 0) {
          for (let gj = 0; gj <= 9; gj += 3) {
            const t2 = (gj / 9 - 0.5) * gSize;
            const gpt = p(t, gFloor, t2);
            if (gpt) { oct.beginPath(); oct.arc(gpt.x, gpt.y, 1.4, 0, Math.PI * 2); oct.fillStyle = "rgba(0,212,255,0.18)"; oct.fill(); }
          }
        }
      }

      // ── 4. Price reference lines ──────────────────────────────────────────
      [minP + pRange * 0.33, minP + pRange * 0.67].forEach(refP => {
        drawLine(oct, p(-totalW / 2, toY(refP), 0), p(totalW / 2, toY(refP), 0), "rgba(0,212,255,0.07)", 0.5);
      });

      // ── 5. Ghost chart (z = +145, violet) ────────────────────────────────
      sorted.forEach(({ o, c, wx }) => {
        const yTop = toY(Math.max(o, c)), yBot = toY(Math.min(o, c));
        const gz = 145;
        const x0 = wx - barW / 2 - 2, x1 = wx + barW / 2 + 2;
        const z0 = gz - barD / 2,     z1 = gz + barD / 2;
        drawFace(oct, [p(x0,yTop,z0),p(x1,yTop,z0),p(x1,yTop,z1),p(x0,yTop,z1)], 167, 139, 250, 0.21);
        drawFace(oct, [p(x0,yBot,z0),p(x1,yBot,z0),p(x1,yTop,z0),p(x0,yTop,z0)], 167, 139, 250, 0.14);
        drawFace(oct, [p(x1,yBot,z0),p(x1,yBot,z1),p(x1,yTop,z1),p(x1,yTop,z0)], 167, 139, 250, 0.09);
      });

      // ── 6. Volume bars (below price bars) ────────────────────────────────
      sorted.forEach(({ o, c, wx }) => {
        const up = c >= o;
        const [r, g, bv] = up ? [0, 229, 160] : [255, 85, 114];
        const vol  = Math.min((Math.abs(c - o) / (pRange * 0.1)) * 14, 22);
        const vTop = gFloor - vol;
        const x0 = wx - barW / 2 + 1, x1 = wx + barW / 2 - 1;
        const z0 = -barD / 2, z1 = barD / 2;
        drawFace(oct, [p(x0,vTop,z0),p(x1,vTop,z0),p(x1,vTop,z1),p(x0,vTop,z1)], r, g, bv, 0.28);
        drawFace(oct, [p(x0,gFloor,z0),p(x1,gFloor,z0),p(x1,vTop,z0),p(x0,vTop,z0)], r, g, bv, 0.22);
        drawFace(oct, [p(x1,gFloor,z0),p(x1,gFloor,z1),p(x1,vTop,z1),p(x1,vTop,z0)], r, g, bv, 0.14);
      });

      // ── 7. Main candlestick bars ──────────────────────────────────────────
      const bullishHighs: Pt2[] = [];
      sorted.forEach(({ o, h, l, c, wx }) => {
        const up = c >= o;
        const [r, g, bv] = up ? [0, 229, 160] : [255, 85, 114];
        const yTop = toY(Math.max(o, c)), yBot = toY(Math.min(o, c));
        const yH = toY(h), yL = toY(l);
        const x0 = wx - barW / 2, x1 = wx + barW / 2;
        const z0 = -barD / 2,     z1 = barD / 2;

        const tfl = p(x0,yTop,z0), tfr = p(x1,yTop,z0);
        const tbl = p(x0,yTop,z1), tbr = p(x1,yTop,z1);
        const bfl = p(x0,yBot,z0), bfr = p(x1,yBot,z0);
        const bbl = p(x0,yBot,z1), bbr = p(x1,yBot,z1);

        oct.shadowColor = `rgba(${r},${g},${bv},0.6)`; oct.shadowBlur = 18;
        drawFace(oct, [tfl,tfr,tbr,tbl], r, g, bv, 0.92); // top
        drawFace(oct, [bfl,bfr,tfr,tfl], r, g, bv, 0.74); // front
        drawFace(oct, [bfr,bbr,tbr,tfr], r, g, bv, 0.50); // right
        drawFace(oct, [bbr,bbl,tbl,tbr], r, g, bv, 0.30); // back
        drawFace(oct, [bbl,bfl,tfl,tbl], r, g, bv, 0.42); // left
        oct.shadowBlur = 0;

        const pHigh = p(wx,yH, 0), pTop = p(wx,yTop,0);
        const pBot  = p(wx,yBot,0), pLow = p(wx,yL, 0);
        drawLine(oct, pHigh, pTop, `rgba(${r},${g},${bv},0.62)`);
        drawLine(oct, pBot,  pLow, `rgba(${r},${g},${bv},0.62)`);

        if (up && pHigh) bullishHighs.push(pHigh);
      });

      // ── 8. EMA-9 glowing curve ────────────────────────────────────────────
      const emaPts: Pt2[] = bars.map((_, i) => p(i * spacing - totalW / 2 + spacing / 2, toY(ema9[i]), 0));
      oct.save();
      oct.shadowColor = "rgba(0,212,255,0.95)"; oct.shadowBlur = 10;
      oct.strokeStyle = "rgba(0,212,255,0.80)"; oct.lineWidth = 1.9;
      oct.lineJoin = "round"; oct.lineCap = "round";
      oct.beginPath();
      let started = false;
      emaPts.forEach((pt, i) => {
        if (!pt) return;
        if (!started) { oct.moveTo(pt.x, pt.y); started = true; }
        else {
          const prev = emaPts[i - 1];
          if (prev) { const mx = (prev.x + pt.x) / 2, my = (prev.y + pt.y) / 2; oct.quadraticCurveTo(prev.x, prev.y, mx, my); }
        }
      });
      oct.stroke(); oct.restore();

      // ── 9. Live-price pulsing dot ─────────────────────────────────────────
      const lastWx = (N - 1) * spacing - totalW / 2 + spacing / 2;
      const liveDot = p(lastWx, toY(bars[N - 1].c), 0);
      if (liveDot) {
        const pr = 2.4 + Math.sin(tick * 0.14) * 1.7;
        oct.save();
        oct.shadowColor = "rgba(0,212,255,1)"; oct.shadowBlur = 22;
        oct.beginPath(); oct.arc(liveDot.x, liveDot.y, pr, 0, Math.PI * 2);
        oct.fillStyle = "rgba(0,212,255,0.96)"; oct.fill(); oct.restore();
      }

      // ── 10. Spawn + draw particles ────────────────────────────────────────
      if (!reduced) {
        bullishHighs.forEach(pt => { if (pt && Math.random() < 0.016) spawnPt(pt.x, pt.y, 0, 229, 160); });
      }
      for (let pi = particles.length - 1; pi >= 0; pi--) {
        const pt = particles[pi];
        pt.x += pt.vx; pt.y += pt.vy; pt.vx *= 0.99;
        pt.life -= 1 / pt.ml;
        if (pt.life <= 0) { particles.splice(pi, 1); continue; }
        oct.beginPath(); oct.arc(pt.x, pt.y, pt.sz, 0, Math.PI * 2);
        oct.fillStyle = `rgba(${pt.r},${pt.g},${pt.bv},${(pt.life * 0.72).toFixed(2)})`; oct.fill();
      }

      // ── Bloom composite (sharp → glow on top) ────────────────────────────
      // Pass 1: sharp scene
      ctx.drawImage(oc, 0, 0);
      // Pass 2: wide bloom
      ctx.save();
      ctx.filter = "blur(14px)";
      ctx.globalAlpha = 0.44;
      ctx.globalCompositeOperation = "screen";
      ctx.drawImage(oc, 0, 0);
      // Pass 3: tight rim glow
      ctx.filter = "blur(4px)";
      ctx.globalAlpha = 0.28;
      ctx.drawImage(oc, 0, 0);
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", setSize); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        opacity: 0.42,
        pointerEvents: "none",
        WebkitMaskImage: "linear-gradient(to right, transparent 13%, black 43%)",
        maskImage:        "linear-gradient(to right, transparent 13%, black 43%)",
      }}
    />
  );
}

// ── DashboardShowcase ─────────────────────────────────────────────────────────

const SHOWCASE_TABS = [
  { id: "dashboard", label: "Dashboard", src: "/screenshots/dashboard.png", desc: "Live market overview — price feeds, portfolio snapshot, and trend indicators updating every 15 seconds." },
  { id: "portfolio", label: "Portfolio",  src: "/screenshots/portfolio.png", desc: "Full position history with realized PnL, allocation breakdown, and closed-trade analytics." },
  { id: "agent",     label: "AI Agent",   src: "/screenshots/agent.png",    desc: "Conversational co-pilot backed by MongoDB Atlas vector search — ask about your positions, signals, or market context." },
  { id: "positions", label: "Positions",  src: "/screenshots/positions.png", desc: "Open position cards with entry price, current mark, trailing stop level, and one-click management." },
] as const;

type ShowcaseTabId = typeof SHOWCASE_TABS[number]["id"];

function DashboardShowcase() {
  const [active, setActive] = useState<ShowcaseTabId>("dashboard");
  const tab = SHOWCASE_TABS.find(t => t.id === active)!;

  return (
    <section id="section-showcase" style={{ padding: "5rem 5vw 4rem", position: "relative", overflow: "hidden" }}>
      {/* ambient violet glow */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 65% 40%, rgba(167,139,250,0.07) 0%, transparent 60%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* heading */}
        <div style={{ marginBottom: 36, maxWidth: 560 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4vw, 3.4rem)", fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: 14 }}>
            The terminal,{" "}
            <span style={{ color: "var(--violet)", textShadow: "0 0 36px rgba(167,139,250,0.36)" }}>inside.</span>
          </h2>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.72, maxWidth: "52ch" }}>
            Real data. No mockups. This is exactly how it looks in production — live feeds, AI memory, and full position control in one window.
          </p>
        </div>

        {/* browser frame */}
        <div style={{
          borderRadius: 14, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 48px 120px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,255,255,0.03), 0 0 60px rgba(167,139,250,0.06)",
          transform: "perspective(1600px) rotateX(1.8deg)",
          transformOrigin: "center top",
        }}>

          {/* macOS chrome bar */}
          <div style={{ height: 40, display: "flex", alignItems: "center", gap: 7, padding: "0 16px", background: "rgba(4,9,18,1)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            {(["#ff5f57","#ffbd2e","#28c840"] as const).map((c, i) => (
              <span key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: c, opacity: 0.75, flexShrink: 0 }} />
            ))}
            {/* URL bar */}
            <div style={{ flex: 1, marginLeft: 12, marginRight: 12, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <svg viewBox="0 0 16 16" fill="none" width="10" height="10" aria-hidden="true">
                <path d="M6 2a4 4 0 100 8A4 4 0 006 2zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.817A6 6 0 010 6z" fill="currentColor" style={{ color: "rgba(255,255,255,0.2)" }} />
              </svg>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.03em" }}>
                crptx.app / {tab.id}
              </span>
            </div>
          </div>

          {/* in-app nav tabs */}
          <div style={{ display: "flex", background: "rgba(3,7,14,0.99)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "0 6px", gap: 2 }}>
            {SHOWCASE_TABS.map(t => {
              const isActive = t.id === active;
              return (
                <button
                  key={t.id}
                  onClick={() => setActive(t.id)}
                  style={{
                    padding: "10px 18px",
                    background: isActive ? "rgba(167,139,250,0.08)" : "transparent",
                    border: "none",
                    borderBottom: isActive ? "2px solid var(--violet)" : "2px solid transparent",
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: isActive ? "var(--violet)" : "var(--ink-faint)",
                    transition: "all 0.18s",
                    flexShrink: 0,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* screenshot */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={active}
            src={tab.src}
            alt={`CRPTX Terminal — ${tab.label} view`}
            className="scrn-img"
            loading="lazy"
            style={{ width: "100%", display: "block", maxHeight: 560, objectFit: "cover", objectPosition: "top center" }}
          />
        </div>

        {/* caption */}
        <p style={{ marginTop: 18, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.7, maxWidth: "60ch" }}>
          {tab.desc}
        </p>
      </div>
    </section>
  );
}

// ── LoadingScreen ─────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: "var(--bg)", zIndex: 50 }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full spin" style={{ border: "2px solid rgba(0,212,255,0.15)", borderTopColor: "var(--cyan)" }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--ink-muted)" }}>Loading</span>
      </div>
    </div>
  );
}

// ── AuthFormBody (shared between desktop panel + mobile section) ───────────────

function AuthFormBody({ accent, compact = false }: { accent: string; compact?: boolean }) {
  const [tab, setTab] = useState<AuthTab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await (tab === "login" ? login : register)({ email, password });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const switchTab = (t: AuthTab) => { setTab(t); setError(null); };

  const inp: React.CSSProperties = {
    width: "100%", padding: compact ? "10px 12px" : "11px 14px", borderRadius: 10,
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
    fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink)",
    outline: "none", caretColor: accent, transition: "all 0.2s", boxSizing: "border-box",
  };

  return (
    <>
      {/* Tabs */}
      <div style={{ display: "flex", borderRadius: 12, marginBottom: compact ? 20 : 28, padding: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", gap: 4 }}>
        {(["login", "register"] as const).map(t => (
          <button key={t} onClick={() => switchTab(t)} style={{
            flex: 1, padding: "9px 0", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
            letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.25s",
            background: tab === t ? `linear-gradient(135deg, ${accent}26, ${accent}12)` : "transparent",
            border: tab === t ? `1px solid ${accent}40` : "1px solid transparent",
            color: tab === t ? accent : "var(--ink-muted)",
          }}>
            {t === "login" ? "Sign In" : "Register"}
          </button>
        ))}
      </div>

      {/* Heading */}
      {!compact && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 6 }}>
            {tab === "login" ? "Welcome back" : "Join the terminal"}
          </h2>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.5 }}>
            {tab === "login" ? "Sign in to your trading account" : "Create your free account to start trading"}
          </p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-muted)", marginBottom: 7 }}>Email</label>
          <input type="email" value={email} required placeholder="trader@terminal.io"
            onChange={e => setEmail(e.target.value)} style={inp}
            onFocus={e => { e.currentTarget.style.borderColor = `${accent}50`; e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}10`; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-muted)", marginBottom: 7 }}>Password</label>
          <input type="password" value={password} required minLength={8} placeholder="••••••••"
            onChange={e => setPassword(e.target.value)} style={inp}
            onFocus={e => { e.currentTarget.style.borderColor = `${accent}50`; e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}10`; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>

        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,85,114,0.07)", border: "1px solid rgba(255,85,114,0.2)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--down)" }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={busy} style={{
          width: "100%", padding: "13px", borderRadius: 10,
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.15em",
          color: busy ? "var(--ink-muted)" : accent,
          background: `linear-gradient(135deg, ${accent}30, ${accent}18)`,
          border: `1px solid ${accent}44`,
          boxShadow: busy ? "none" : `0 0 28px ${accent}20`,
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.6 : 1, transition: "all 0.2s",
        }}>
          {busy ? "Connecting…" : tab === "login" ? "Enter Terminal" : "Create Account"}
        </button>
      </form>

      <p style={{ marginTop: 16, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)" }}>
        Any credentials start a demo session when offline.
      </p>
    </>
  );
}

// ── AuthPanel (desktop sticky) ────────────────────────────────────────────────

function AuthPanel({ section }: { section: ActiveSection }) {
  const { glow, accent } = THEME[section];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "2rem 2.5rem", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse at 50% 35%, ${glow}, transparent 70%)`, transition: "background 1s ease", zIndex: 0 }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, background: "linear-gradient(135deg, rgba(0,212,255,0.18), rgba(167,139,250,0.12))", border: "1px solid rgba(0,212,255,0.24)", boxShadow: `0 0 30px ${glow}`, transition: "box-shadow 1s ease" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: accent, transition: "color 1s ease" }}>₿</span>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              CRPT<span style={{ color: accent, transition: "color 1s ease" }}>X</span> Terminal
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)", marginTop: 2 }}>Professional crypto platform</div>
          </div>
        </div>
        <AuthFormBody accent={accent} />
      </div>
    </div>
  );
}

// ── MobileAuthSection ─────────────────────────────────────────────────────────

function MobileAuthSection() {
  return (
    <section className="lg:hidden" style={{ padding: "5rem 5vw 3rem", borderTop: "1px solid rgba(255,255,255,0.06)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(0,212,255,0.07), transparent 60%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, rgba(0,212,255,0.18), rgba(167,139,250,0.12))", border: "1px solid rgba(0,212,255,0.24)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--cyan)" }}>₿</span>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em" }}>Start trading</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>Create your account or sign in</div>
          </div>
        </div>
        <AuthFormBody accent="#00d4ff" compact />
      </div>
    </section>
  );
}

// ── SectionHeading ────────────────────────────────────────────────────────────

function SectionHeading({ line1, line2, accent, sub }: { line1: string; line2: string; accent: string; sub: string }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4vw, 3.6rem)", fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: 16 }}>
        {line1}<br />
        <span style={{ color: accent, textShadow: `0 0 40px ${accent}55` }}>{line2}</span>
      </h2>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.7, maxWidth: "48ch" }}>{sub}</p>
    </div>
  );
}

// ── LandingView (main export) ─────────────────────────────────────────────────

export default function LandingView() {
  const { status } = useAuth();
  const router = useRouter();
  const { data: coins, isError: coinsError } = useCoinList();
  const [activeSection, setActiveSection] = useState<ActiveSection>("hero");
  const [navShow, setNavShow] = useState(false);
  const [show3D, setShow3D] = useState(true);

  // Smooth scroll
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  // Auth redirect
  useEffect(() => {
    if (status === "authed") router.replace("/dashboard");
  }, [status, router]);

  // Section refs (for IntersectionObserver)
  const heroRef    = useRef<HTMLElement>(null);
  const marketsRef = useRef<HTMLElement>(null);
  const chartsRef  = useRef<HTMLElement>(null);
  const agentRef   = useRef<HTMLElement>(null);
  const statsRef   = useRef<HTMLElement>(null);

  // Content refs (for scroll reveals on sections 2-5)
  const marketsContent = useRef<HTMLDivElement>(null);
  const chartsContent  = useRef<HTMLDivElement>(null);
  const agentContent   = useRef<HTMLDivElement>(null);
  const statsContent   = useRef<HTMLDivElement>(null);

  // Active section → drives auth panel glow color
  useEffect(() => {
    const map: [{ current: HTMLElement | null }, ActiveSection][] = [
      [heroRef, "hero"], [marketsRef, "markets"],
      [chartsRef, "charts"], [agentRef, "agent"], [statsRef, "stats"],
    ];
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            const hit = map.find(([ref]) => ref.current === e.target);
            if (hit) setActiveSection(hit[1]);
          }
        });
      },
      { threshold: 0.4 },
    );
    map.forEach(([ref]) => { if (ref.current) obs.observe(ref.current); });
    return () => obs.disconnect();
  }, []);

  // Nav: appears when hero leaves viewport
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setNavShow(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Scroll reveal for sections 2-5
  useReveal(marketsContent);
  useReveal(chartsContent);
  useReveal(agentContent);
  useReveal(statsContent);

  if (status === "loading" || status === "authed") return <LoadingScreen />;

  const topCoins  = (coins ?? []).slice(0, 6);
  const firstCoin = (coins ?? [])[0];
  const sectionPad = "6rem 5vw";

  return (
    <>
      <style>{`
        @keyframes drift1 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(28px,-18px) scale(1.05); }
        }
        @keyframes drift2 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(-22px,16px) scale(1.04); }
        }
        @keyframes fadeUpIn {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .land-hero-content { animation: fadeUpIn 0.9s cubic-bezier(0.16,1,0.3,1) both; }
        .land-cta-primary  { transition: all 0.2s !important; }
        .land-cta-primary:hover  { transform: translateY(-2px); box-shadow: 0 0 55px rgba(0,212,255,0.42) !important; }
        .land-cta-primary:active { transform: translateY(0) scale(0.98); }
        .land-cta-ghost    { transition: all 0.2s !important; }
        .land-cta-ghost:hover { border-color: rgba(255,255,255,0.22) !important; color: var(--ink) !important; }
        @keyframes scrnFadeIn {
          from { opacity: 0; transform: scale(1.012); }
          to   { opacity: 1; transform: scale(1); }
        }
        .scrn-img { animation: scrnFadeIn 0.38s cubic-bezier(0.16,1,0.3,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .land-blob, .land-hero-content { animation: none !important; }
          .land-hero-content { opacity: 1 !important; transform: none !important; }
          .scrn-img { animation: none !important; }
        }
      `}</style>

      <ScrollProgress />
      <LandingNav show={navShow} />

      {/* max-width container keeps layout from stretching past 1400px on ultrawide */}
      <div style={{ background: "var(--bg)", display: "flex", alignItems: "flex-start", maxWidth: 1400, marginLeft: "auto", marginRight: "auto" }}>

        {/* ── Left: scrolling narrative ───────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* 1 — Hero */}
          <section ref={heroRef} id="section-hero" style={{ minHeight: "100dvh", position: "relative", display: "flex", alignItems: "center", padding: sectionPad }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
              <div className="land-blob" style={{ position: "absolute", width: 680, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,212,255,0.065), transparent 65%)", top: "-15%", left: "-12%", animation: "drift1 9s ease-in-out infinite" }} />
              <div className="land-blob" style={{ position: "absolute", width: 540, height: 540, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.055), transparent 65%)", bottom: "-15%", right: "-8%", animation: "drift2 11s ease-in-out infinite" }} />
              <div className="retro-grid" style={{ position: "absolute", inset: 0, opacity: 0.025 }} />
              {show3D && <HeroBg3D />}
            </div>

            <div className="land-hero-content" style={{ position: "relative", zIndex: 1, maxWidth: 680 }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.4rem, 5vw, 4.8rem)", fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.04em", lineHeight: 1.06, marginBottom: 22 }}>
                Trade with the<br />
                <span style={{ color: "var(--cyan)", textShadow: "0 0 40px rgba(0,212,255,0.32)" }}>clarity of a machine.</span>
              </h1>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.75, maxWidth: "50ch", marginBottom: 44 }}>
                Real-time markets, AI-powered insights, and professional tools — all in one terminal built for serious traders.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href="#section-markets" className="land-cta-primary" style={{ display: "inline-flex", alignItems: "center", padding: "14px 30px", borderRadius: 12, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", textDecoration: "none", color: "#020508", background: "var(--cyan)", boxShadow: "0 0 40px rgba(0,212,255,0.28)", cursor: "pointer" }}>
                  Explore Platform
                </a>
                <Link href="/register" className="land-cta-ghost" style={{ display: "inline-flex", alignItems: "center", padding: "14px 30px", borderRadius: 12, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", textDecoration: "none", color: "var(--ink-soft)", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
                  Create Account
                </Link>
              </div>

              {/* Sub-row: 3D toggle + GitHub */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
                <button
                  onClick={() => setShow3D(v => !v)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", background: "transparent", border: `1px solid ${show3D ? "rgba(0,212,255,0.28)" : "rgba(255,255,255,0.08)"}`, color: show3D ? "var(--cyan)" : "var(--ink-faint)", transition: "all 0.2s" }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: show3D ? "var(--cyan)" : "rgba(255,255,255,0.2)", boxShadow: show3D ? "0 0 6px var(--cyan)" : "none", flexShrink: 0, transition: "all 0.2s" }} />
                  Live 3D {show3D ? "On" : "Off"}
                </button>

                <a
                  href="https://github.com/moi-script/crypt_dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none", color: "var(--ink-muted)", border: "1px solid rgba(255,255,255,0.08)", background: "transparent", transition: "all 0.2s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = "rgba(255,255,255,0.18)"; el.style.color = "var(--ink)"; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = "rgba(255,255,255,0.08)"; el.style.color = "var(--ink-muted)"; }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" aria-hidden="true">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  View Source
                </a>
              </div>
            </div>
          </section>

          {/* Feature strip (social proof) */}
          <FeatureStrip />

          {/* 2 — Markets */}
          <section id="section-markets" ref={marketsRef} style={{ minHeight: "100dvh", display: "flex", alignItems: "center", padding: sectionPad, position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent, rgba(0,212,255,0.025) 50%, transparent)", pointerEvents: "none" }} />
            <div ref={marketsContent} style={{ width: "100%", maxWidth: 620 }}>
              <SectionHeading
                line1="Every price."
                line2="Every second."
                accent="var(--cyan)"
                sub="Live data across hundreds of pairs, powered by real-time streams with 15-second refresh cycles."
              />
              <div style={{ borderRadius: 16, background: "linear-gradient(160deg, rgba(10,20,34,0.96), rgba(5,12,22,0.99))", border: "1px solid rgba(0,212,255,0.11)", boxShadow: "0 24px 70px rgba(0,0,0,0.5), 0 0 50px rgba(0,212,255,0.06)", overflow: "hidden", position: "relative" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,212,255,0.04)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: coinsError ? "var(--down)" : "var(--up)", boxShadow: `0 0 6px ${coinsError ? "var(--down)" : "var(--up)"}` }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--ink-muted)" }}>{coinsError ? "Feed Error" : "Live Markets"}</span>
                  <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)" }}>Real-time</span>
                </div>
                {coinsError ? (
                  <div style={{ padding: "32px 20px", textAlign: "center" }}>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted)", marginBottom: 14 }}>Market data temporarily unavailable.</p>
                    <Link href="/dashboard" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cyan)", textDecoration: "none" }}>Open Dashboard →</Link>
                  </div>
                ) : topCoins.length > 0 ? (
                  topCoins.map(c => <CoinRow key={c.id} coin={c} />)
                ) : (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                )}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 64, background: "linear-gradient(to top, rgba(5,12,22,0.99), transparent)", pointerEvents: "none" }} />
              </div>
            </div>
          </section>

          {/* 3 — Charts */}
          <section id="section-charts" ref={chartsRef} style={{ minHeight: "100dvh", display: "flex", alignItems: "center", padding: sectionPad, position: "relative", background: "linear-gradient(135deg, rgba(167,139,250,0.03) 0%, transparent 60%)" }}>
            <div ref={chartsContent} style={{ width: "100%", maxWidth: 620 }}>
              <SectionHeading
                line1="Read the signal"
                line2="before the crowd."
                accent="var(--violet)"
                sub="Professional candlestick charts with RSI, MACD, Bollinger Bands, and EMAs — computed live on every candle."
              />
              <div style={{ borderRadius: 16, background: "linear-gradient(160deg, rgba(10,20,34,0.96), rgba(5,12,22,0.99))", border: "1px solid rgba(167,139,250,0.14)", boxShadow: "0 24px 70px rgba(0,0,0,0.5), 0 0 60px rgba(167,139,250,0.08)", padding: "20px 20px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                    {firstCoin ? `${firstCoin.symbol.toUpperCase()} / USDT` : "BTC / USDT"}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: firstCoin ? (firstCoin.change24h >= 0 ? "var(--up)" : "var(--down)") : "var(--up)" }}>
                    {firstCoin ? fmtPct(firstCoin.change24h) : "+4.82%"}
                  </span>
                  <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)" }}>1D</span>
                </div>
                {/* Live sparkline if we have real data; otherwise static candlestick */}
                <div style={{ marginBottom: 16 }}>
                  {firstCoin?.sparkline && firstCoin.sparkline.length > 4
                    ? <FullSparkline data={firstCoin.sparkline} up={firstCoin.change24h >= 0} />
                    : <CandlestickPreview />
                  }
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["RSI 14", "MACD", "BB Bands", "EMA 50", "SMA 20"].map(ind => (
                    <span key={ind} style={{ padding: "4px 10px", borderRadius: 20, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>{ind}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 4 — Agent */}
          <section id="section-agent" ref={agentRef} style={{ minHeight: "100dvh", display: "flex", alignItems: "center", padding: sectionPad, position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(0,229,160,0.03) 0%, transparent 60%)", pointerEvents: "none" }} />
            <div ref={agentContent} style={{ width: "100%", maxWidth: 620, position: "relative", zIndex: 1 }}>
              <SectionHeading
                line1="Intelligence that"
                line2="trades with you."
                accent="var(--up)"
                sub="Your AI co-pilot analyzes market conditions, reads technical signals, and responds to your questions in real time."
              />
              <div style={{ borderRadius: 16, background: "linear-gradient(160deg, rgba(10,20,34,0.96), rgba(5,12,22,0.99))", border: "1px solid rgba(0,229,160,0.14)", boxShadow: "0 24px 70px rgba(0,0,0,0.5), 0 0 60px rgba(0,229,160,0.07)", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,229,160,0.04)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--up)", boxShadow: "0 0 6px var(--up)" }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--ink-muted)" }}>AI Agent</span>
                  <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--up)" }}>Active</span>
                </div>
                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    { q: "Is BTC forming a bullish reversal here?", a: "RSI divergence at 42 suggests buyers accumulating. Watch the 200-day MA at $61,240 — a close above confirms the reversal. Volume needs to follow on the next candle." },
                    { q: "What's my portfolio exposure to large-caps?", a: "Your holdings are 71% large-caps (BTC + ETH), 22% mid-caps, 7% alts. BTC position currently up 14.3% from your entry." },
                  ].map(({ q, a }, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <div style={{ padding: "10px 14px", borderRadius: "14px 14px 4px 14px", background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.18)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)", maxWidth: "80%", lineHeight: 1.55 }}>{q}</div>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, rgba(0,229,160,0.2), rgba(0,212,255,0.15))", border: "1px solid rgba(0,229,160,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "var(--up)" }}>AI</div>
                        <div style={{ padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: "rgba(0,229,160,0.06)", border: "1px solid rgba(0,229,160,0.12)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)", maxWidth: "85%", lineHeight: 1.6 }}>{a}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 4b — Dashboard showcase */}
          <DashboardShowcase />

          {/* 5 — Stats */}
          <section id="section-stats" ref={statsRef} style={{ minHeight: "60vh", display: "flex", alignItems: "center", padding: sectionPad }}>
            <div ref={statsContent} style={{ width: "100%", maxWidth: 620 }}>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "4rem" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--ink-faint)", marginBottom: 48 }}>Built for serious traders</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem" }}>
                  {[
                    { value: "300+", label: "Assets tracked live" },
                    { value: "15s",  label: "Refresh cycle"      },
                    { value: "24/7", label: "AI market analysis" },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 800, color: "var(--cyan)", textShadow: "0 0 30px rgba(0,212,255,0.25)", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 10 }}>{s.value}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted)" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Mobile auth section (lg:hidden) */}
          <MobileAuthSection />

          {/* Footer */}
          <Footer />
        </div>

        {/* ── Right: sticky auth panel (desktop only) ─────────────────────── */}
        <div className="hidden lg:flex lg:flex-col" style={{ width: 420, flexShrink: 0, position: "sticky", top: 0, height: "100dvh", background: "linear-gradient(160deg, rgba(10,20,34,0.98), rgba(5,12,22,0.99))", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
          <AuthPanel section={activeSection} />
        </div>
      </div>
    </>
  );
}

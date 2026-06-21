"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TickerTape } from "@/components/TickerTape";
import { Clock } from "@/components/Clock";
import { useLivePrices } from "@/controllers/useWebSocket";
import { useDemoMode } from "@/controllers/useDemoMode";
import { useAuth } from "@/controllers/useAuth";
import { clsx } from "@/lib/format";

// ── SVG Icons ──────────────────────────────────────────────────────────────

const Icons = {
  markets: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  portfolio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  alerts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  agent: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
  news: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <line x1="9" y1="7" x2="15" y2="7" />
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="15" x2="13" y2="15" />
    </svg>
  ),
  dashboard: (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
),
};

const NAV = [
  { href: "/markets",   label: "Markets",   icon: Icons.markets,   match: (p: string) => p === "/markets" || p.startsWith("/coins") },
  { href: "/portfolio", label: "Portfolio", icon: Icons.portfolio, match: (p: string) => p.startsWith("/portfolio") },
  { href: "/alerts",    label: "Alerts",    icon: Icons.alerts,    match: (p: string) => p.startsWith("/alerts") },
  
  { href: "/agent",     label: "AI Agent",  icon: Icons.agent,     match: (p: string) => p.startsWith("/agent") },
  { href: "/dashboard", label: "Dashboard", icon: Icons.dashboard, match: (p : string) => p.startsWith("/dashboard") },
  { href: "/news",      label: "News",      icon: Icons.news,      match: (p: string) => p.startsWith("/news") },

];

// ── Account chip ──────────────────────────────────────────────────────────

function AccountChip() {
  const { user, status, logout } = useAuth();

  if (status === "authed" && user) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px]"
          style={{
            background: "rgba(0,212,255,0.06)",
            border: "1px solid rgba(0,212,255,0.15)",
            color: "var(--ink-soft)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full pulse"
            style={{ background: "var(--up)", boxShadow: "0 0 6px var(--up)", color: "var(--up)" }}
          />
          {user.email.split("@")[0]}
        </div>
        <button
          onClick={logout}
          className="px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest transition-all duration-200"
          style={{
            background: "transparent",
            border: "1px solid rgba(255,85,114,0.2)",
            color: "var(--ink-muted)",
            fontFamily: "var(--font-mono)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,85,114,0.5)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--down)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,85,114,0.2)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-muted)";
          }}
        >
          Exit
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="btn-shiny px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest transition-all duration-200"
      style={{
        background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.08))",
        border: "1px solid rgba(0,212,255,0.3)",
        color: "var(--cyan)",
        fontFamily: "var(--font-mono)",
        boxShadow: "0 0 20px rgba(0,212,255,0.1)",
      }}
    >
      Sign In →
    </Link>
  );
}

// ── App Layout ─────────────────────────────────────────────────────────────

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const demo = useDemoMode();
  useLivePrices();

  if (pathname === "/" || pathname === "/login" || pathname === "/register") {
    return <>{children}</>;
  }

  const currentItem = NAV.find(n => n.match(pathname));
  const pageTitle = pathname.startsWith("/coins/") ? "Markets / Detail"
    : pathname.startsWith("/agent/") ? "AI Agent"
    : currentItem?.label ?? "Terminal";

  return (
    <div className="flex h-screen flex-col" style={{ background: "var(--bg)", position: "relative", zIndex: 1 }}>

      {/* Ticker tape */}
      <TickerTape />

      <div className="flex min-h-0 flex-1">

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside
          className="flex w-16 md:w-60 shrink-0 flex-col border-r"
          style={{
            background: "linear-gradient(180deg, rgba(6,14,22,0.97) 0%, rgba(4,10,18,0.97) 100%)",
            borderColor: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-5 mb-2"
          >
            <div
              className="relative w-9 h-9 flex items-center justify-center rounded-xl shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(167,139,250,0.15))",
                border: "1px solid rgba(0,212,255,0.25)",
                boxShadow: "0 0 20px rgba(0,212,255,0.15)",
              }}
            >
              <span
                className="text-base font-bold"
                style={{ fontFamily: "var(--font-mono)", color: "var(--cyan)" }}
              >₿</span>
            </div>
            <div className="hidden md:block">
              <div
                className="text-sm font-bold tracking-tight"
                style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
              >
                CRPT<span style={{ color: "var(--cyan)" }}>X</span>
              </div>
              <div className="label" style={{ marginTop: 1 }}>Terminal v2</div>
            </div>
          </Link>

          {/* Nav */}
          <nav className="flex flex-col gap-1 px-2 flex-1">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                    active ? "nav-active" : "",
                  )}
                  style={{
                    background: active
                      ? "linear-gradient(135deg, rgba(0,212,255,0.1), rgba(167,139,250,0.06))"
                      : "transparent",
                    border: active
                      ? "1px solid rgba(0,212,255,0.15)"
                      : "1px solid transparent",
                    color: active ? "var(--cyan)" : "var(--ink-muted)",
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
                      (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-soft)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                      (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-muted)";
                    }
                  }}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span
                    className="hidden md:block text-xs font-medium"
                    style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}
                  >
                    {item.label}
                  </span>
                  {active && item.label === "AI Agent" && (
                    <span
                      className="hidden md:block ml-auto text-[8px] px-1.5 py-0.5 rounded-full"
                      style={{
                        background: "rgba(0,212,255,0.15)",
                        color: "var(--cyan)",
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      LIVE
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Feed status */}
          <div className="px-4 py-4 hidden md:block">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full pulse"
                style={{
                  background: demo ? "var(--warn)" : "var(--up)",
                  color: demo ? "var(--warn)" : "var(--up)",
                  boxShadow: `0 0 6px ${demo ? "var(--warn)" : "var(--up)"}`,
                }}
              />
              <span className="label">{demo ? "Demo Feed" : "Live Feed"}</span>
            </div>
          </div>
        </aside>

        {/* ── Main column ──────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">

          {/* Header */}
          <header
            className="flex h-14 shrink-0 items-center justify-between px-5 border-b"
            style={{
              background: "rgba(4,10,18,0.85)",
              borderColor: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Breadcrumb */}
            <div className="flex items-center gap-3">
              <div
                className="w-1 h-5 rounded-full"
                style={{ background: "var(--cyan)", boxShadow: "0 0 8px var(--cyan)" }}
              />
              <span
                className="text-xs font-semibold tracking-widest uppercase"
                style={{ fontFamily: "var(--font-display)", color: "var(--ink-soft)" }}
              >
                {pageTitle}
              </span>
              {demo && (
                <span
                  className="px-2 py-0.5 rounded text-[9px] uppercase tracking-widest"
                  style={{
                    background: "rgba(255,176,32,0.1)",
                    border: "1px solid rgba(255,176,32,0.25)",
                    color: "var(--warn)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Demo
                </span>
              )}
            </div>

            {/* Right */}
            <div className="flex items-center gap-4">
              <Clock />
              <AccountChip />
            </div>
          </header>

          {/* Content */}
          <main className="min-h-0 flex-1 overflow-y-auto" style={{ position: "relative", zIndex: 1 }}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
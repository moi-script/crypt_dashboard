"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TickerTape } from "@/components/TickerTape";
import { Clock } from "@/components/Clock";
import { useLivePrices } from "@/controllers/useWebSocket";
import { useDemoMode } from "@/controllers/useDemoMode";
import { useAuth } from "@/controllers/useAuth";
import { clsx } from "@/lib/format";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (p: string) => boolean;
}

const I = {
  markets: (
    <path d="M3 17l5-5 3 3 7-8M21 7h-4M21 7v4" strokeWidth="1.6" />
  ),
  portfolio: (
    <path d="M3 7h18v12H3zM3 7l3-3h12l3 3M9 12h6" strokeWidth="1.6" />
  ),
  alerts: (
    <path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6M10 21a2 2 0 004 0" strokeWidth="1.6" />
  ),
  agent: (
  <path d="M12 2a5 5 0 015 5v2a5 5 0 01-10 0V7a5 5 0 015-5zM4 20c0-4 3.6-7 8-7s8 3 8 7" strokeWidth="1.6" />
),
  news: (
    <path d="M4 5h13v14H4zM17 9h3v8a2 2 0 01-2 2M8 9h5M8 13h5M8 17h3" strokeWidth="1.6" />
  ),
};

const NAV: NavItem[] = [
  { href: "/", label: "Markets", icon: I.markets, match: (p) => p === "/" || p.startsWith("/coins") },
  { href: "/portfolio", label: "Portfolio", icon: I.portfolio, match: (p) => p.startsWith("/portfolio") },
  { href: "/alerts", label: "Alerts", icon: I.alerts, match: (p) => p.startsWith("/alerts") },
  { href: "/agent", label: "Agent", icon: I.agent, match: (p) => p.startsWith("/agent") },
  { href: "/news", label: "News", icon: I.news, match: (p) => p.startsWith("/news") },
];

function SectionTitle({ pathname }: { pathname: string }) {
  const item = NAV.find((n) => n.match(pathname));
  const label = pathname.startsWith("/coins") ? "Markets / Detail" : item?.label ?? "Terminal";
  return (
    <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
      <span className="text-up">▌</span> {label}
    </span>
  );
}

function AccountChip() {
  const { user, status, logout } = useAuth();
  if (status === "authed" && user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden font-mono text-xs text-ink-soft sm:inline">{user.email}</span>
        <button
          onClick={() => logout()}
          className="border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:border-down/50 hover:text-down"
        >
          Sign out
        </button>
      </div>
    );
  }
  return (
    <Link
      href="/login"
      className="border border-up/40 bg-up/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-up transition-colors hover:bg-up/20"
    >
      Sign in
    </Link>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const demo = useDemoMode();
  useLivePrices();

  // Auth pages render standalone (no terminal chrome).
  if (pathname === "/login" || pathname === "/register") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen flex-col bg-bg">
      <TickerTape />

      <div className="flex min-h-0 flex-1">
        {/* Sidebar rail */}
        <aside className="flex w-16 shrink-0 flex-col items-center border-r border-line bg-panel py-3 md:w-56 md:items-stretch md:px-3">
          <Link href="/" className="mb-6 flex items-center gap-2 px-2">
            <span className="grid h-8 w-8 place-items-center border border-up/50 bg-up/10 font-mono text-sm font-bold text-up">
              ₿
            </span>
            <span className="hidden font-mono text-sm font-bold tracking-tight text-ink md:block">
              TERMINAL<span className="text-up">_</span>
            </span>
          </Link>

          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "group relative flex items-center gap-3 px-2 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors md:px-3",
                    active ? "text-up" : "text-muted hover:text-ink",
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-up" style={{ boxShadow: "0 0 8px var(--color-up)" }} />
                  )}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    className="h-5 w-5 shrink-0"
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                  >
                    {item.icon}
                  </svg>
                  <span className="hidden md:block">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto hidden px-2 md:block">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-faint">
              <span className={clsx("h-1.5 w-1.5 rounded-full", demo ? "bg-warn" : "bg-up")} style={{ boxShadow: "0 0 6px currentColor" }} />
              {demo ? "demo feed" : "live feed"}
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-panel/60 px-4 backdrop-blur">
            <SectionTitle pathname={pathname} />
            <div className="flex items-center gap-4">
              {demo && (
                <span className="border border-warn/40 bg-warn/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warn">
                  demo data
                </span>
              )}
              <Clock />
              <AccountChip />
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}

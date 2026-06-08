"use client";

import Link from "next/link";
import { useAuth } from "@/controllers/useAuth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="grid h-full place-items-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-8 h-8 rounded-full spin"
            style={{ border: "2px solid rgba(0,212,255,0.15)", borderTopColor: "var(--cyan)" }}
          />
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}
          >
            authenticating
          </span>
        </div>
      </div>
    );
  }

  if (status === "anon") {
    return (
      <div className="grid h-full place-items-center p-8">
        <div
          className="relative overflow-hidden rounded-2xl p-8 text-center max-w-sm w-full noise"
          style={{
            background: "linear-gradient(145deg, rgba(10,20,32,0.95), rgba(6,14,22,0.98))",
            border: "1px solid rgba(255,176,32,0.18)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(255,176,32,0.06)",
          }}
        >
          {/* Top glow */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,176,32,0.4), transparent)" }}
          />

          {/* Lock icon */}
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
            style={{
              background: "rgba(255,176,32,0.08)",
              border: "1px solid rgba(255,176,32,0.2)",
              boxShadow: "0 0 20px rgba(255,176,32,0.1)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, color: "var(--warn)" }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <div
            className="text-[10px] uppercase tracking-[0.25em] mb-2"
            style={{ fontFamily: "var(--font-mono)", color: "var(--warn)" }}
          >
            ⊘ Access Restricted
          </div>
          <p
            className="text-[12px] leading-relaxed mb-6"
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}
          >
            This desk requires an authenticated session. Sign in to view your holdings and alerts.
          </p>
          <Link
            href="/login"
            className="btn-shiny inline-flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.08))",
              border: "1px solid rgba(0,212,255,0.25)",
              color: "var(--cyan)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              textDecoration: "none",
              boxShadow: "0 0 20px rgba(0,212,255,0.1)",
            }}
          >
            Sign In →
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
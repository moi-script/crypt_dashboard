"use client";

import Link from "next/link";
import { useAuth } from "@/controllers/useAuth";

/** Gates auth-only views. Shows a sign-in prompt instead of hard-redirecting. */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="grid h-full place-items-center">
        <span className="font-mono text-xs text-muted cursor-blink">authenticating</span>
      </div>
    );
  }

  if (status === "anon") {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="panel ticks max-w-sm p-6 text-center">
          <div className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-warn">
            ⊘ access restricted
          </div>
          <p className="mb-4 text-sm text-muted">
            This desk requires an authenticated session. Sign in to view your
            holdings and alerts.
          </p>
          <Link
            href="/login"
            className="inline-block border border-up/40 bg-up/10 px-4 py-2 font-mono text-xs uppercase tracking-wider text-up transition-colors hover:bg-up/20"
          >
            Sign in →
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

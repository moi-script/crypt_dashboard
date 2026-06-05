"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/controllers/useAuth";
import { useDemoMode } from "@/controllers/useDemoMode";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { login, register } = useAuth();
  const demo = useDemoMode();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isLogin = mode === "login";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await (isLogin ? login : register)({ email, password });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-bg p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center border border-up/50 bg-up/10 font-mono text-base font-bold text-up">
            ₿
          </span>
          <span className="font-mono text-lg font-bold tracking-tight text-ink">
            TERMINAL<span className="text-up">_</span>
          </span>
        </Link>

        <div className="panel ticks fade-up">
          <div className="panel-hd justify-between">
            <span className="text-up">{isLogin ? "auth // login" : "auth // register"}</span>
            <span className="text-faint">●●●</span>
          </div>
          <form onSubmit={submit} className="space-y-4 p-5">
            <p className="font-mono text-[11px] leading-relaxed text-muted">
              <span className="text-up">$</span> {isLogin ? "establishing session…" : "provisioning account…"}
              <span className="cursor-blink" />
            </p>

            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted">Email</label>
              <input
                type="email" value={email} required autoFocus autoComplete="email"
                onChange={(e) => setEmail(e.target.value)} placeholder="trader@desk.io"
                className="w-full border border-line bg-void px-3 py-2 font-mono text-sm text-ink outline-none transition-colors focus:border-up/50"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted">Password</label>
              <input
                type="password" value={password} required minLength={8}
                autoComplete={isLogin ? "current-password" : "new-password"}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full border border-line bg-void px-3 py-2 font-mono text-sm text-ink outline-none transition-colors focus:border-up/50"
              />
            </div>

            {error && (
              <div className="border border-down/40 bg-down/10 px-3 py-2 font-mono text-[11px] text-down">
                ✕ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full border border-up/40 bg-up/10 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-up transition-colors hover:bg-up/20 disabled:opacity-40"
            >
              {busy ? "Connecting…" : isLogin ? "Enter terminal →" : "Create account →"}
            </button>

            <div className="text-center font-mono text-[11px] text-muted">
              {isLogin ? "No account?" : "Already enrolled?"}{" "}
              <Link href={isLogin ? "/register" : "/login"} className="text-up hover:underline">
                {isLogin ? "register" : "sign in"}
              </Link>
            </div>
          </form>
        </div>

        <p className="mt-4 text-center font-mono text-[10px] leading-relaxed text-faint">
          {demo
            ? "demo mode · any credentials start a local session"
            : "backend offline? any credentials start a demo session"}
        </p>
      </div>
    </div>
  );
}

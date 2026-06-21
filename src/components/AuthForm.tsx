"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/controllers/useAuth";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { login, register } = useAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [busy,     setBusy]     = useState(false);
  const isLogin = mode === "login";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await (isLogin ? login : register)({ email, password });
      router.push("/markets");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 12,
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink)",
    outline: "none", caretColor: "var(--cyan)", transition: "all 0.2s",
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 retro-grid"
      style={{ background: "var(--bg)" }}
    >
      {/* ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }}>
        <div className="absolute rounded-full blur-3xl" style={{ width: 500, height: 400, background: "radial-gradient(circle, rgba(0,212,255,0.06), transparent 70%)", top: "-10%", left: "-5%" }} />
        <div className="absolute rounded-full blur-3xl" style={{ width: 400, height: 400, background: "radial-gradient(circle, rgba(167,139,250,0.05), transparent 70%)", bottom: "-10%", right: "-5%" }} />
      </div>

      <div className="relative w-full max-w-sm fade-up" style={{ zIndex: 1 }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 32, textDecoration: "none" }}>
          <div style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, background: "linear-gradient(135deg, rgba(0,212,255,0.18), rgba(167,139,250,0.12))", border: "1px solid rgba(0,212,255,0.24)", boxShadow: "0 0 30px rgba(0,212,255,0.18)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--cyan)" }}>₿</span>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              Profy<span style={{ color: "var(--cyan)" }}>.ai</span>
            </div>
            <div className="label" style={{ marginTop: 2 }}>Professional crypto platform</div>
          </div>
        </Link>

        {/* Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "linear-gradient(160deg, rgba(10,20,34,0.96), rgba(5,12,22,0.99))", border: "1px solid rgba(0,212,255,0.11)", boxShadow: "0 24px 70px rgba(0,0,0,0.55), 0 0 50px rgba(0,212,255,0.07)" }}
        >
          {/* card header */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(0,212,255,0.08)", background: "linear-gradient(90deg, rgba(0,212,255,0.055), transparent)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--cyan)" }}>
              {isLogin ? "auth // session start" : "auth // provision account"}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>
              <span style={{ color: "var(--cyan)" }}>$</span>{" "}
              {isLogin ? "establishing session…" : "provisioning account…"}
              <span className="cursor-blink" />
            </div>
          </div>

          {/* form */}
          <form onSubmit={submit} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* email */}
            <div>
              <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--ink-muted)" }}>Email Address</label>
              <input
                type="email" value={email} required autoFocus
                placeholder="trader@terminal.io"
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.07)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            {/* password */}
            <div>
              <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--ink-muted)" }}>Password</label>
              <input
                type="password" value={password} required minLength={8}
                placeholder="••••••••"
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.07)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            {/* error */}
            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,85,114,0.07)", border: "1px solid rgba(255,85,114,0.2)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--down)" }}>
                ✕ {error}
              </div>
            )}

            {/* submit */}
            <button
              type="submit"
              disabled={busy}
              className="btn-shiny"
              style={{ width: "100%", padding: "12px", borderRadius: 12, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.18em", color: busy ? "var(--ink-muted)" : "var(--cyan)", background: "linear-gradient(135deg, rgba(0,212,255,0.18), rgba(0,212,255,0.09))", border: "1px solid rgba(0,212,255,0.26)", boxShadow: busy ? "none" : "0 0 28px rgba(0,212,255,0.1)", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1, transition: "all 0.2s" }}
            >
              {busy ? "Connecting…" : isLogin ? "Enter Terminal →" : "Create Account →"}
            </button>

            {/* switch */}
            <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)" }}>
              {isLogin ? "No account?" : "Already enrolled?"}{" "}
              <Link href={isLogin ? "/register" : "/login"} style={{ color: "var(--cyan)", textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
              >
                {isLogin ? "Register" : "Sign in"}
              </Link>
            </div>
          </form>
        </div>

        <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)", marginTop: 16 }}>
          Backend offline? Any credentials start a demo session.
        </p>
      </div>
    </div>
  );
}
"use client";

import { useEffect } from "react";

export function Modal({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ paddingTop: "12vh", background: "rgba(1,3,7,0.82)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      <div
        className="fade-up w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, rgba(10,20,34,0.98), rgba(6,14,24,0.99))",
          border: "1px solid rgba(0,212,255,0.14)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.65), 0 0 40px rgba(0,212,255,0.08)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <header
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 18px",
            borderBottom: "1px solid rgba(0,212,255,0.1)",
            background: "linear-gradient(90deg, rgba(0,212,255,0.06), transparent)",
          }}
        >
          <span style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cyan)" }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ink-muted)", background: "none", border: "none", cursor: "pointer", transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-muted)")}
          >
            ✕
          </button>
        </header>
        <div style={{ padding: "18px" }}>{children}</div>
      </div>
    </div>
  );
}
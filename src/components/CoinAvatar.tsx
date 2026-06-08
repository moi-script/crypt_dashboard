"use client";

import { useState } from "react";
import { clsx } from "@/lib/format";

export function CoinAvatar({ src, symbol, size = 24, className }: {
  src?: string; symbol: string; size?: number; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size };

  if (!src || failed) {
    return (
      <span
        style={{
          ...dim,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          borderRadius: "50%",
          background: "rgba(0,212,255,0.07)",
          border: "1px solid rgba(0,212,255,0.14)",
          fontFamily: "var(--font-mono)",
          fontSize: Math.max(7, size * 0.3),
          fontWeight: 700,
          color: "var(--cyan)",
          flexShrink: 0,
        }}
        className={clsx(className)}
      >
        {symbol.slice(0, 3).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={symbol}
      style={{ ...dim, borderRadius: "50%", objectFit: "contain", flexShrink: 0, background: "rgba(255,255,255,0.04)" }}
      onError={() => setFailed(true)}
      className={clsx(className)}
    />
  );
}
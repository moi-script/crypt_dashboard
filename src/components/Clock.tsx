"use client";

import { useEffect, useState } from "react";

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const text = now
    ? now.toLocaleTimeString("en-GB", { hour12: false, timeZone: "UTC" })
    : "--:--:--";

  return (
    <span
      className="tabular-nums"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--ink-muted)",
        letterSpacing: "0.06em",
      }}
    >
      {text}
      <span
        style={{
          marginLeft: 5,
          fontSize: 9,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
        }}
      >
        UTC
      </span>
    </span>
  );
}
"use client";

import { useState } from "react";
import { clsx } from "@/lib/format";

/** Coin logo with a monogram fallback when the remote image is unavailable. */
export function CoinAvatar({
  src,
  symbol,
  size = 24,
  className,
}: {
  src?: string;
  symbol: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size };

  if (!src || failed) {
    return (
      <span
        style={dim}
        className={clsx(
          "inline-flex items-center justify-center border border-line-bright bg-elev font-mono text-[9px] font-bold text-ink-soft",
          className,
        )}
      >
        {symbol.slice(0, 3)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={symbol}
      style={dim}
      onError={() => setFailed(true)}
      className={clsx("rounded-full bg-elev object-contain", className)}
    />
  );
}

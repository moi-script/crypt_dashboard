"use client";

import { clsx } from "@/lib/format";
import type { OHLCVRange } from "@/models/coin.model";

const RANGES: OHLCVRange[] = ["1D", "1W", "1M", "1Y"];

export function RangeTabs({
  value,
  onChange,
}: {
  value: OHLCVRange;
  onChange: (r: OHLCVRange) => void;
}) {
  return (
    <div className="flex border border-line">
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={clsx(
            "px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors",
            value === r ? "bg-up/15 text-up" : "text-muted hover:text-ink",
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

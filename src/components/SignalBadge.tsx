import { clsx } from "@/lib/format";
import { VERDICT_META } from "@/lib/signals";
import type { SignalVerdict } from "@/models/coin.model";

const TONE: Record<string, string> = {
  up: "text-up border-up/40 bg-up/10",
  down: "text-down border-down/40 bg-down/10",
  warn: "text-warn border-warn/40 bg-warn/10",
};

export function SignalBadge({
  verdict,
  size = "sm",
  className,
}: {
  verdict: SignalVerdict;
  size?: "sm" | "lg";
  className?: string;
}) {
  const meta = VERDICT_META[verdict];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 border font-mono uppercase tracking-wider",
        TONE[meta.tone],
        size === "lg" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]",
        className,
      )}
    >
      <span
        className={clsx(
          "inline-block h-1.5 w-1.5 rounded-full",
          meta.tone === "up" ? "bg-up" : meta.tone === "down" ? "bg-down" : "bg-warn",
        )}
        style={{ boxShadow: "0 0 6px currentColor" }}
      />
      {meta.label}
    </span>
  );
}

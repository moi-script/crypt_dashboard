import { clsx } from "@/lib/format";
import { VERDICT_META } from "@/lib/signals";
import type { SignalVerdict } from "@/models/coin.model";

const TONE_STYLE = {
  up:   { color: "var(--up)",   bg: "rgba(0,229,160,0.08)",   border: "rgba(0,229,160,0.22)",  dot: "var(--up)" },
  down: { color: "var(--down)", bg: "rgba(255,85,114,0.08)",  border: "rgba(255,85,114,0.22)", dot: "var(--down)" },
  warn: { color: "var(--warn)", bg: "rgba(255,176,32,0.08)",  border: "rgba(255,176,32,0.22)", dot: "var(--warn)" },
};

export function SignalBadge({ verdict, size = "sm", className }: {
  verdict: SignalVerdict; size?: "sm" | "lg"; className?: string;
}) {
  const meta  = VERDICT_META[verdict];
  const style = TONE_STYLE[meta.tone];

  return (
    <span
      className={clsx("inline-flex items-center gap-1.5", className)}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: size === "lg" ? 11 : 9,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: style.color,
        background: style.bg,
        border: `1px solid ${style.border}`,
        padding: size === "lg" ? "5px 10px" : "3px 7px",
        borderRadius: 6,
      }}
    >
      <span
        style={{ width: 5, height: 5, borderRadius: "50%", background: style.dot, boxShadow: `0 0 6px ${style.dot}`, display: "inline-block", flexShrink: 0 }}
      />
      {meta.label}
    </span>
  );
}
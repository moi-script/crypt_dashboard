import { clsx, fmtPct } from "@/lib/format";

/** Coloured directional percentage with a triangle marker. */
export function PriceChange({
  value,
  className,
  showArrow = true,
  size = "sm",
}: {
  value: number;
  className?: string;
  showArrow?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const up = value >= 0;
  const sizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  } as const;

  return (
    <span
      className={clsx(
        "font-mono tabular-nums inline-flex items-center gap-1",
        sizes[size],
        up ? "text-up" : "text-down",
        className,
      )}
    >
      {showArrow && <span aria-hidden>{up ? "▲" : "▼"}</span>}
      {fmtPct(value)}
    </span>
  );
}

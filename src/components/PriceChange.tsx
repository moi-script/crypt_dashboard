import { fmtPct } from "@/lib/format";

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
  const fontSize = size === "sm" ? 11 : size === "md" ? 13 : 15;

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontFamily: "var(--font-mono)",
        fontSize,
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
        color: up ? "var(--up)" : "var(--down)",
      }}
    >
      {showArrow && (
        <span style={{ fontSize: fontSize * 0.7, lineHeight: 1 }}>
          {up ? "▲" : "▼"}
        </span>
      )}
      {fmtPct(value)}
    </span>
  );
}
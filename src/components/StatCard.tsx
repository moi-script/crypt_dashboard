import { clsx } from "@/lib/format";

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: "up" | "down" | "warn" | "info";
}) {
  const accentCls = accent
    ? { up: "text-up", down: "text-down", warn: "text-warn", info: "text-info" }[accent]
    : "text-ink";
  return (
    <div className="panel ticks px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className={clsx("mt-1 font-mono text-xl tabular-nums", accentCls)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

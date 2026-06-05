/** Formatting helpers shared across the terminal UI. */

export function fmtPrice(value: number): string {
  if (!isFinite(value)) return "—";
  const digits = value >= 1000 ? 2 : value >= 1 ? 2 : value >= 0.01 ? 4 : 6;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtUSD(value: number, opts: { sign?: boolean } = {}): string {
  if (!isFinite(value)) return "—";
  const s = `$${fmtPrice(Math.abs(value))}`;
  if (opts.sign) return `${value < 0 ? "−" : "+"}${s}`;
  return value < 0 ? `−${s}` : s;
}

export function fmtCompact(value: number): string {
  if (!isFinite(value)) return "—";
  const abs = Math.abs(value);
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) return `${(value / size).toFixed(2)}${suffix}`;
  }
  return value.toFixed(0);
}

export function fmtPct(value: number, opts: { sign?: boolean } = { sign: true }): string {
  if (!isFinite(value)) return "—";
  const s = `${Math.abs(value).toFixed(2)}%`;
  if (opts.sign) return `${value < 0 ? "−" : "+"}${s}`;
  return s;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

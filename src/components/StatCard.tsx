const STYLES = {
  up:   { color: "var(--up)",     glow: "rgba(0,229,160,0.1)",   border: "rgba(0,229,160,0.18)",   shine: "rgba(0,229,160,0.5)" },
  down: { color: "var(--down)",   glow: "rgba(255,85,114,0.1)",  border: "rgba(255,85,114,0.18)",  shine: "rgba(255,85,114,0.5)" },
  warn: { color: "var(--warn)",   glow: "rgba(255,176,32,0.1)",  border: "rgba(255,176,32,0.18)",  shine: "rgba(255,176,32,0.5)" },
  info: { color: "var(--cyan)",   glow: "rgba(0,212,255,0.1)",   border: "rgba(0,212,255,0.18)",   shine: "rgba(0,212,255,0.5)" },
  none: { color: "var(--ink)",    glow: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.06)", shine: "rgba(255,255,255,0.3)" },
};

export function StatCard({
  label, value, sub, accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: "up" | "down" | "warn" | "info";
}) {
  const s = STYLES[accent ?? "none"];

  return (
    <div
      className="stat-card relative overflow-hidden rounded-xl px-5 py-4"
      style={{
        background: `linear-gradient(145deg, rgba(10,20,34,0.92), rgba(6,14,24,0.96))`,
        border: `1px solid ${s.border}`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.35), inset 0 0 32px ${s.glow}`,
      }}
    >
      {/* top shine strip */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${s.shine}60, transparent)` }} />

      <div className="label mb-2" style={{ color: "var(--ink-muted)" }}>{label}</div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          color: s.color,
          textShadow: accent ? `0 0 24px ${s.color}50` : "none",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1.5" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}
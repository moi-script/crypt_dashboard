import { clsx } from "@/lib/format";

export function Panel({
  title, right, children, className, bodyClassName, ticks,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  ticks?: boolean;
}) {
  return (
    <section
      className={clsx("relative overflow-hidden rounded-xl", ticks && "ticks", className)}
      style={{
        background: "linear-gradient(180deg, rgba(10,20,34,0.92) 0%, rgba(6,14,24,0.96) 100%)",
        border: "1px solid rgba(255,255,255,0.055)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
      }}
    >
      {(title || right) && (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.048)",
            background: "rgba(255,255,255,0.012)",
            gap: 8,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--ink-muted)" }}>
            {title}
          </span>
          {right}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
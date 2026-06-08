import { timeAgo } from "@/lib/format";
import { sentimentBand, type NewsArticle } from "@/models/news.model";

const BAND_STYLE = {
  bullish: { color: "var(--up)",   glow: "rgba(0,229,160,0.08)",  border: "rgba(0,229,160,0.14)",  label: "Bullish", bar: "var(--up)" },
  bearish: { color: "var(--down)", glow: "rgba(255,85,114,0.08)", border: "rgba(255,85,114,0.14)", label: "Bearish", bar: "var(--down)" },
  neutral: { color: "var(--warn)", glow: "rgba(255,176,32,0.06)", border: "rgba(255,176,32,0.11)", label: "Neutral", bar: "var(--warn)" },
};

export function NewsCard({ article }: { article: NewsArticle }) {
  const band  = sentimentBand(article.sentiment);
  const style = BAND_STYLE[band];
  const pct   = Math.round(((article.sentiment + 1) / 2) * 100);

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col gap-3 rounded-xl overflow-hidden transition-all duration-200"
      style={{ padding: "16px", background: "rgba(8,16,28,0.82)", border: "1px solid rgba(255,255,255,0.048)", textDecoration: "none" }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = `linear-gradient(145deg, ${style.glow}, rgba(8,16,28,0.92))`;
        el.style.borderColor = style.border;
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = `0 10px 32px rgba(0,0,0,0.35)`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = "rgba(8,16,28,0.82)";
        el.style.borderColor = "rgba(255,255,255,0.048)";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
      }}
    >
      {/* sentiment top strip */}
      <div className="absolute top-0 left-0 right-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${style.color}, transparent)` }} />

      {/* meta row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--ink-muted)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 4 }}>
          {article.source}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-faint)" }}>
          {timeAgo(article.publishedAt)}
        </span>
      </div>

      {/* title */}
      <h3
        className="line-clamp-2"
        style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: "var(--ink-soft)", transition: "color 0.15s" }}
      >
        {article.title}
      </h3>

      {/* summary */}
      {article.summary && (
        <p className="line-clamp-2" style={{ fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6, color: "var(--ink-muted)" }}>
          {article.summary}
        </p>
      )}

      {/* footer */}
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", width: 52, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${pct}%`, background: style.bar, borderRadius: 2, boxShadow: `0 0 4px ${style.color}` }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: style.color }}>
            {style.label}
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {article.coins.slice(0, 2).map(c => (
            <span key={c} style={{ fontFamily: "var(--font-mono)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--cyan)", background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.12)", padding: "2px 6px", borderRadius: 4 }}>
              {c}
            </span>
          ))}
        </div>
      </div>
    </a>
  );
}
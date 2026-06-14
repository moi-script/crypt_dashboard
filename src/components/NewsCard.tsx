import { timeAgo } from "@/lib/format";
import { sentimentBand, type NewsArticle } from "@/models/news.model";

const BAND_STYLE = {
  bullish: { color: "var(--up)",   glow: "rgba(0,229,160,0.10)",  border: "rgba(0,229,160,0.20)",  label: "Bullish", bar: "var(--up)" },
  bearish: { color: "var(--down)", glow: "rgba(255,85,114,0.10)", border: "rgba(255,85,114,0.20)", label: "Bearish", bar: "var(--down)" },
  neutral: { color: "var(--warn)", glow: "rgba(255,176,32,0.08)", border: "rgba(255,176,32,0.15)", label: "Neutral", bar: "var(--warn)" },
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
      className="news-card group relative rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: "rgba(8,16,28,0.92)",
        border: "1px solid rgba(255,255,255,0.048)",
        textDecoration: "none",
        display: "flex",
        // flexDirection: "column",
        width: "100%",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = style.border;
        el.style.transform = "translateY(-3px)";
        el.style.boxShadow = `0 16px 48px rgba(0,0,0,0.5)`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "rgba(255,255,255,0.048)";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
      }}
    >
      {/* sentiment top strip */}
      <div
        className="news-card__strip absolute top-0 left-0 right-0 h-px opacity-80"
        style={{ background: `linear-gradient(90deg, transparent, ${style.color}, transparent)`, zIndex: 10 }}
      />

      {/* ── Hero image ──────────────────────────────────────────── */}
      <div className="news-card__hero relative overflow-hidden" style={{ flexShrink: 0 }}>
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt=""
            aria-hidden="true"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(135deg, rgba(8,16,28,1) 0%, ${style.glow.replace("0.10", "0.35")} 100%)`,
            }}
          />
        )}

        {/* scrim */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.65) 100%)" }} />

        {/* source + time */}
        <div className="news-card__meta" style={{ position: "absolute", top: 12, left: 14, right: 14, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.85)", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.12)", padding: "3px 9px", borderRadius: 4, backdropFilter: "blur(6px)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60%" }}>
            {article.source}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.55)" }}>
            {timeAgo(article.publishedAt)}
          </span>
        </div>

        {/* coin tags */}
        {article.coins.length > 0 && (
          <div style={{ position: "absolute", bottom: 12, right: 14, display: "flex", gap: 4, zIndex: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {article.coins.slice(0, 3).map(c => (
              <span key={c} style={{ fontFamily: "var(--font-mono)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--cyan)", background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.22)", padding: "2px 7px", borderRadius: 4, backdropFilter: "blur(4px)" }}>
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Content body ────────────────────────────────────────── */}
      <div className="news-card__body" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 18px 14px", flex: 1, overflow: "hidden" }}>

        <h3
          className="news-card__title"
          style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, lineHeight: 1.4, color: "var(--ink-soft)", margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}
        >
          {article.title}
        </h3>

        <div className="news-card__divider" style={{ height: 1, background: "rgba(255,255,255,0.05)", flexShrink: 0 }} />

        {article.summary && (
          <p
            className="news-card__summary"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.7,
              color: "var(--ink-muted)",
              margin: 0,
              flex: 1,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 5,
              WebkitBoxOrient: "vertical",
            } as React.CSSProperties}
          >
            {article.summary}
          </p>
        )}

        {/* footer */}
        <div style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative", width: 64, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${pct}%`, background: style.bar, borderRadius: 2 }} />
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: style.color }}>
              {style.label}
            </span>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-faint)" }}>
            Read →
          </span>
        </div>
      </div>
    </a>
  );
}
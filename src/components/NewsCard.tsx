import { clsx, timeAgo } from "@/lib/format";
import { sentimentBand, type NewsArticle } from "@/models/news.model";

const BAND = {
  bullish: { label: "BULLISH", cls: "text-up", bar: "bg-up" },
  bearish: { label: "BEARISH", cls: "text-down", bar: "bg-down" },
  neutral: { label: "NEUTRAL", cls: "text-warn", bar: "bg-warn" },
} as const;

export function NewsCard({ article, compact }: { article: NewsArticle; compact?: boolean }) {
  const band = BAND[sentimentBand(article.sentiment)];
  const pct = Math.round(((article.sentiment + 1) / 2) * 100);

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block border-b border-line/70 px-4 py-3.5 transition-colors hover:bg-panel-2"
    >
      <div className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-muted">
        <span className="text-ink-soft">{article.source}</span>
        <span className="text-faint">·</span>
        <span>{timeAgo(article.publishedAt)}</span>
        <span className={clsx("ml-auto flex items-center gap-1.5", band.cls)}>
          <span className="hidden sm:inline">{band.label}</span>
          <span className="relative h-1 w-12 overflow-hidden bg-line">
            <span className={clsx("absolute inset-y-0 left-0", band.bar)} style={{ width: `${pct}%` }} />
          </span>
        </span>
      </div>

      <h3
        className={clsx(
          "font-medium leading-snug text-ink transition-colors group-hover:text-up",
          compact ? "text-sm" : "text-[15px]",
        )}
      >
        {article.title}
      </h3>

      {!compact && <p className="mt-1 line-clamp-2 text-sm text-muted">{article.summary}</p>}

      {article.coins.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {article.coins.map((c) => (
            <span
              key={c}
              className="border border-line bg-elev px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-soft"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}

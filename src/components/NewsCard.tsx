import { clsx, timeAgo } from "@/lib/format";
import { sentimentBand, type NewsArticle } from "@/models/news.model";

const BAND = {
  bullish: { label: "BULLISH", cls: "text-up", bar: "bg-up" },
  bearish: { label: "BEARISH", cls: "text-down", bar: "bg-down" },
  neutral: { label: "NEUTRAL", cls: "text-warn", bar: "bg-warn" },
} as const;
export function NewsCard({ article }: { article: NewsArticle }) {
  const band = sentimentBand(article.sentiment);
  const pct = Math.round(((article.sentiment + 1) / 2) * 100);
  const BAND = {
    bullish: { label: "Bullish", cls: "text-up", bar: "bg-up" },
    bearish: { label: "Bearish", cls: "text-down", bar: "bg-down" },
    neutral: { label: "Neutral", cls: "text-warn", bar: "bg-warn" },
  };
  const b = BAND[band];

  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer"
      className="panel flex flex-col gap-2 p-3.5 transition-colors hover:bg-panel-2"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted">{article.source}</span>
        <span className="font-mono text-[10px] text-faint">{timeAgo(article.publishedAt)}</span>
      </div>

      <h3 className="flex-1 text-[13px] font-medium leading-snug text-ink line-clamp-3">
        {article.title}
      </h3>

      <p className="text-[12px] text-muted leading-relaxed line-clamp-2">{article.summary}</p>

      <div className="mt-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative h-1 w-12 overflow-hidden bg-line">
            <span className={clsx("absolute inset-y-0 left-0", b.bar)} style={{ width: `${pct}%` }} />
          </div>
          <span className={clsx("font-mono text-[10px]", b.cls)}>{b.label}</span>
        </div>
        <div className="flex gap-1">
          {article.coins.slice(0, 2).map(c => (
            <span key={c} className="border border-line bg-elev px-1.5 py-0.5 font-mono text-[9px] uppercase text-ink-soft">{c}</span>
          ))}
        </div>
      </div>
    </a>
  );
}
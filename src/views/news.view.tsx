"use client";

import { useMemo, useState } from "react";
import { useNewsFeed } from "@/controllers/useNewsFeed";
import { NewsCard } from "@/components/NewsCard";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { clsx } from "@/lib/format";
import { sentimentBand, type SentimentBand } from "@/models/news.model";

const FILTERS: Array<{ key: SentimentBand | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "bullish", label: "Bullish" },
  { key: "neutral", label: "Neutral" },
  { key: "bearish", label: "Bearish" },
];

export default function NewsView() {
  const { data, isLoading } = useNewsFeed(40);
  const [filter, setFilter] = useState<SentimentBand | "all">("all");
  const articles = useMemo(() => data ?? [], [data]);

  const avg = articles.length
    ? articles.reduce((s, a) => s + a.sentiment, 0) / articles.length
    : 0;
  const mood = sentimentBand(avg);

  const shown = articles.filter((a) => filter === "all" || sentimentBand(a.sentiment) === filter);

  return (
    <div className="mx-auto max-w-[1000px] p-4 md:p-6">
      <div className="mb-5">
        <h1 className="font-mono text-2xl font-bold tracking-tight text-ink">Newswire</h1>
        <p className="mt-0.5 text-sm text-muted">
          Latest crypto headlines with model-scored sentiment
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Articles" value={articles.length || "—"} sub="last 24h window" />
        <StatCard
          label="Market Mood"
          value={mood.toUpperCase()}
          accent={mood === "bullish" ? "up" : mood === "bearish" ? "down" : "warn"}
          sub={`avg sentiment ${avg >= 0 ? "+" : ""}${avg.toFixed(2)}`}
        />
        <StatCard
          label="Net Bias"
          value={`${avg >= 0 ? "+" : "−"}${Math.abs(avg * 100).toFixed(0)}`}
          accent={avg >= 0 ? "up" : "down"}
          sub="−100 … +100"
        />
      </div>

      <Panel
        title={<span className="text-ink-soft">Feed</span>}
        right={
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={clsx(
                  "px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
                  filter === f.key ? "text-up" : "text-muted hover:text-ink",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
        ticks
      >
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-b border-line/60 px-4 py-4">
              <div className="skeleton mb-2 h-3 w-40" />
              <div className="skeleton h-4 w-full" />
            </div>
          ))
        ) : shown.length ? (
          shown.map((a) => (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
  {shown.map((a) => <NewsCard key={a.id} article={a} />)}
</div>
          ))
        ) : (
          <p className="px-4 py-8 text-center font-mono text-xs text-muted">No matching headlines.</p>
        )}
      </Panel>
    </div>
  );
}

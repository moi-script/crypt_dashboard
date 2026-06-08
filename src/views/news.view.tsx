"use client";

import { useMemo, useState } from "react";
import { useNewsFeed } from "@/controllers/useNewsFeed";
import { NewsCard } from "@/components/NewsCard";
import { StatCard } from "@/components/StatCard";
import { fmtPct } from "@/lib/format";
import { sentimentBand, type SentimentBand } from "@/models/news.model";

const FILTERS: { key: SentimentBand | "all"; label: string }[] = [
  { key: "all",     label: "All" },
  { key: "bullish", label: "Bullish" },
  { key: "neutral", label: "Neutral" },
  { key: "bearish", label: "Bearish" },
];

export default function NewsView() {
  const { data, isLoading } = useNewsFeed(40);
  const [filter, setFilter] = useState<SentimentBand | "all">("all");
  const articles = useMemo(() => data ?? [], [data]);

  const avg  = articles.length ? articles.reduce((s, a) => s + a.sentiment, 0) / articles.length : 0;
  const mood = sentimentBand(avg);
  const shown = articles.filter(a => filter === "all" || sentimentBand(a.sentiment) === filter);

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* title */}
      <div className="fade-up fade-up-1">
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Newswire</h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>
          Latest crypto headlines with AI-scored sentiment
        </p>
      </div>

      {/* stats */}
      <div className="fade-up fade-up-2" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <StatCard label="Articles" value={articles.length || "—"} sub="Last 24h window" />
        <StatCard
          label="Market Mood"
          value={mood.toUpperCase()}
          accent={mood === "bullish" ? "up" : mood === "bearish" ? "down" : "warn"}
          sub={`Avg sentiment ${avg >= 0 ? "+" : ""}${avg.toFixed(2)}`}
        />
        <StatCard
          label="Net Bias"
          value={`${avg >= 0 ? "+" : "−"}${Math.abs(avg * 100).toFixed(0)}`}
          accent={avg >= 0 ? "up" : "down"}
          sub="−100 … +100 scale"
        />
      </div>

      {/* feed panel */}
      <div className="fade-up fade-up-3 rounded-xl overflow-hidden" style={{ background: "linear-gradient(180deg, rgba(10,20,34,0.94), rgba(5,12,22,0.98))", border: "1px solid rgba(255,255,255,0.052)", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
        {/* panel header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.012)", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 2, height: 14, borderRadius: 1, background: "var(--cyan)", boxShadow: "0 0 8px var(--cyan)" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink-soft)" }}>Feed</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-faint)" }}>{shown.length} articles</span>
          </div>
          {/* filter tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{ padding: "4px 10px", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", cursor: "pointer", transition: "all 0.15s",
                  background: filter === f.key ? "rgba(0,212,255,0.1)" : "transparent",
                  border: `1px solid ${filter === f.key ? "rgba(0,212,255,0.25)" : "transparent"}`,
                  color: filter === f.key ? "var(--cyan)" : "var(--ink-muted)",
                }}
              >{f.label}</button>
            ))}
          </div>
        </div>

        {/* articles grid */}
        <div style={{ padding: 16 }}>
          {isLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 180, borderRadius: 12 }} />
              ))}
            </div>
          ) : shown.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {shown.map(a => <NewsCard key={a.id} article={a} />)}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)" }}>
              No matching headlines.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { AgentChat } from "@/components/AgentChat";

export default function AgentView() {
  const params = useParams<{ coinId?: string }>();
  const coinId = params?.coinId ?? "bitcoin";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "rgb(2,6,9)" }}>

      {/* Breadcrumb */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 20px",
        background: "rgb(4,11,20)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 12,
            color: "var(--ink-muted)",
            textDecoration: "none",
            fontWeight: 500,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-soft)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-muted)"}
        >
          Markets
        </Link>

        <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>›</span>

        {coinId !== "bitcoin" && (
          <>
            <Link
              href={`/coins/${coinId}`}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 12,
                color: "var(--ink-muted)",
                textDecoration: "none",
                fontWeight: 500,
                transition: "color 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-soft)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-muted)"}
            >
              {coinId.charAt(0).toUpperCase() + coinId.slice(1)}
            </Link>
            <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>›</span>
          </>
        )}

        <span style={{
          fontFamily: "var(--font-display)",
          fontSize: 12,
          color: "var(--ink)",
          fontWeight: 600,
        }}>
          AI Agent
        </span>

        {/* Live pill */}
        <span style={{
          marginLeft: 4,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "2px 8px",
          borderRadius: 20,
          background: "var(--up-glass)",
          border: "1px solid var(--up-border)",
        }}>
          <span className="pulse" style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--up)",
            color: "var(--up)",
            display: "inline-block",
          }} />
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--up)",
          }}>
            Live
          </span>
        </span>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <AgentChat coinId={coinId} />
      </div>
    </div>
  );
}
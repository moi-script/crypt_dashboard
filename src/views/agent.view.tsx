"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { AgentChat } from "@/components/AgentChat";

// userId is no longer passed — useChatEngine reads tokenStore directly
// which is always up to date even before useAuth resolves

export default function AgentView() {
  const params = useParams<{ coinId?: string }>();
  const coinId = params?.coinId ?? "bitcoin";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "rgb(2,6,9)" }}>

      {/* Breadcrumb */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "13px 20px", background: "rgb(4,11,20)",
        borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0,
      }}>
        <Link href="/" style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none", fontWeight: 500 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"}
        >
          Markets
        </Link>
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>›</span>

        {coinId !== "bitcoin" && (
          <>
            <Link href={`/coins/${coinId}`} style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none", fontWeight: 500 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"}
            >
              {coinId.charAt(0).toUpperCase() + coinId.slice(1)}
            </Link>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>›</span>
          </>
        )}

        <span style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>
          AI Agent
        </span>

        <span style={{ marginLeft: 4, display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: "var(--up-glass)", border: "1px solid var(--up-border)" }}>
          <span className="pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--up)", display: "inline-block" }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600, color: "var(--up)" }}>Live</span>
        </span>
      </div>

      {/* Chat — no userId prop needed */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <AgentChat coinId={coinId} />
      </div>
    </div>
  );
}
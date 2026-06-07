"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { AgentChat } from "@/components/AgentChat";

/**
 * Standalone agent page at /agent or /agent/[coinId]
 * Can also be used as an embedded panel inside coin detail page.
 */
export default function AgentView() {
  const params = useParams<{ coinId?: string }>();
  const coinId = params?.coinId ?? "bitcoin";

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-line bg-panel/60 flex-shrink-0">
        <Link
          href="/"
          className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-up transition-colors"
        >
          Markets
        </Link>
        <span className="font-mono text-[10px] text-faint">/</span>
        {coinId !== "bitcoin" && (
          <>
            <Link
              href={`/coins/${coinId}`}
              className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-up transition-colors"
            >
              {coinId}
            </Link>
            <span className="font-mono text-[10px] text-faint">/</span>
          </>
        )}
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
          Agent
        </span>
      </div>

      {/* Full-height chat */}
      <div className="flex-1 min-h-0">
        <AgentChat coinId={coinId} />
      </div>
    </div>
  );
}
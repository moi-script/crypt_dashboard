"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/services/api.client";
import { tokenStore } from "@/services/api.client";

// ── Raw session shape from GET /agent/sessions ────────────────────────────────
interface RawSession {
  sessionId: string;
  coinId:    string;
  updatedAt: string | number;
}

function toMs(v: string | number): number {
  if (typeof v === "string") return new Date(v).getTime();
  return v > 1e12 ? v : v * 1000;
}

export default function AgentBasePage() {
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      // No token → send to login, not to agent
      if (!tokenStore.access) {
        router.replace("/login");
        return;
      }

      try {
        // Try to resume the most recent existing session first
        const sessions = await apiClient.get<RawSession[]>("/agent/sessions");
        if (sessions?.length) {
          const latest = [...sessions].sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt))[0];
          router.replace(`/agent/${latest.coinId}/${latest.sessionId}`);
          return;
        }

        // No existing sessions — create a fresh one
        const res = await apiClient.post<{ sessionId: string }>("/agent/session/create", { coinId: "bitcoin" });
        router.replace(`/agent/bitcoin/${res.sessionId}`);
      } catch (err) {
        console.error("Failed to initialize agent session", err);
        // If auth fails mid-way, go to login
        router.replace("/login");
      }
    };

    init();
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-black text-[#00d4ff] font-mono text-sm animate-pulse">
      INITIALIZING TERMINAL...
    </div>
  );
}
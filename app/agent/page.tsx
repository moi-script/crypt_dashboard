// src/app/agent/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/services/api.client";

export default function AgentBasePage() {
  const router = useRouter();

  useEffect(() => {
    // When a user hits /agent, automatically create a clean session and redirect them
    const initSession = async () => {
      try {
        const res = await apiClient.post<{ sessionId: string }>("/agent/session/create", { coinId: "bitcoin" });
        router.push(`/agent/bitcoin/${res.sessionId}`);
      } catch (err) {
        console.error("Failed to initialize base session", err);
      }
    };
    
    initSession();
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-black text-[#00d4ff] font-mono text-sm animate-pulse">
      INITIALIZING TERMINAL...
    </div>
  );
}
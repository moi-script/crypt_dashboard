"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/controllers/useAuth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);

  if (status === "loading" || status === "anon") {
    return (
      <div className="grid h-full place-items-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-8 h-8 rounded-full spin"
            style={{ border: "2px solid rgba(0,212,255,0.15)", borderTopColor: "var(--cyan)" }}
          />
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}
          >
            authenticating
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
// src/app/agent/[coinId]/[sessionId]/page.tsx
import { AgentChat } from "@/components/AgentChat";
export default async function AgentSessionPage({
  params,
}: {
  params: Promise<{ coinId: string; sessionId: string }>;
}) {
  const { coinId } = await params;

  return (
    <main className="h-screen w-full bg-black overflow-hidden">
      <AgentChat coinId={coinId} />
    </main>
  );
}

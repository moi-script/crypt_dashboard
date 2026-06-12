"use client";

import { PaperWalletDashboard } from "../PaperWalletDashboard"; // Your existing wallet UI
// import { TradingDashboard } from "../TradingDashboard";   
import TradingDashboard from "../TradingDashboard";      // Your existing runs/stats UI
import type { ChatMessage } from "./hooks/useChatEngine";

interface ChatDashboardProps {
  engine: {
    activeSessionId: string | null;
    messages: ChatMessage[];
  };
  accentColor?: string;
}

export function ChatDashboard({ engine, accentColor = "#00d4ff" }: ChatDashboardProps) {
  if (!engine.activeSessionId) {
    return (
      <div className="flex h-full items-center justify-center text-white/30 text-sm font-mono p-6 text-center">
        <p>Initialize a Terminal Session to view analytics and manage paper trading.</p>
      </div>
    );
  }

  // Calculate simple session stats to show in the header
  const aiMessageCount = engine.messages.filter((m) => m.role === "agent").length;
  const toolExecutions = engine.messages.filter((m) => m.toolResult).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent bg-[#040914] relative">
      
      {/* 1. Dashboard Header Stats */}
      <div className="grid grid-cols-3 gap-1 p-4 border-b border-white/5 sticky top-0 bg-[#040914]/90 backdrop-blur-md z-10">
        <div className="bg-white/5 rounded-lg p-3 border border-white/5 flex flex-col items-center justify-center">
          <span className="text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1">Session ID</span>
          <span className="text-xs text-white font-mono truncate w-full text-center" title={engine.activeSessionId}>
            {engine.activeSessionId.split('-')[0] || "Unknown"}
          </span>
        </div>
        <div className="bg-white/5 rounded-lg p-3 border border-white/5 flex flex-col items-center justify-center">
          <span className="text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1">AI Responses</span>
          <span className="text-sm font-bold text-white font-mono">{aiMessageCount}</span>
        </div>
        <div className="bg-white/5 rounded-lg p-3 border border-white/5 flex flex-col items-center justify-center">
          <span className="text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1">Tools Executed</span>
          <span className="text-sm font-bold font-mono" style={{ color: accentColor }}>
            {toolExecutions}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-6">
        
        {/* 2. Paper Trading / Portfolio Management */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="w-1.5 h-4 bg-[#00e5a0] rounded-sm shadow-[0_0_8px_rgba(0,229,160,0.5)]" />
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-widest">
              Execution Engine
            </h3>
          </div>
          {/* We wrap your existing massive PaperWallet component here so it gets its own dedicated layout space */}
          <div className="bg-[#081220] border border-white/5 rounded-xl overflow-hidden shadow-xl">
            <PaperWalletDashboard />
          </div>
        </section>

        {/* 3. Global Agent Analytics & Autonomous Config */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both pb-10">
          <div className="flex items-center gap-2 mb-3 px-1">
             <span className="w-1.5 h-4 rounded-sm shadow-[0_0_8px_rgba(0,212,255,0.5)]" style={{ backgroundColor: accentColor }} />
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-widest">
              Autonomous Loop Stats
            </h3>
          </div>
          {/* Your existing TradingDashboard that tracks the /agent-runs/config loop */}
          <div className="bg-[#081220] border border-white/5 rounded-xl overflow-hidden shadow-xl p-2">
            <TradingDashboard />
          </div>
        </section>

      </div>
    </div>
  );
}
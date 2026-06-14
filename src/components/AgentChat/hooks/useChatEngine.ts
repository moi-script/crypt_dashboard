"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiClient } from "@/services/api.client";
import { API_URL, tokenStore } from "@/services/api.client";
import type { ToolResult } from "@/components/AgentToolCards";
import type { AnalysisReport } from "@/components/ReportBubble";

// ── Emotion types ─────────────────────────────────────────────────────────────
export type EmotionType = "happy" | "depressed" | "nervous" | "frustrated" | "shocked" | "thinking";

export interface AgentEmotion {
  emotion:   EmotionType;
  intensity: "low" | "medium" | "high";
  reason:    string;
  asset:     string;
  message:   string;
}

export const MOOD: Record<EmotionType, {
  accent: string; softBg: string; textColor: string; label: string; emoji: string;
}> = {
  happy:      { accent: "#00e5a0", softBg: "rgba(0,229,160,0.08)",   textColor: "#00e5a0", label: "Feeling good",     emoji: "😊" },
  depressed:  { accent: "#36b6ff", softBg: "rgba(54,182,255,0.08)",  textColor: "#60a5fa", label: "A bit down",       emoji: "😔" },
  nervous:    { accent: "#ffb020", softBg: "rgba(255,176,32,0.08)",  textColor: "#ffb020", label: "A little nervous", emoji: "😬" },
  frustrated: { accent: "#ff5572", softBg: "rgba(255,85,114,0.08)",  textColor: "#ff5572", label: "Frustrated",       emoji: "😤" },
  shocked:    { accent: "#a78bfa", softBg: "rgba(167,139,250,0.08)", textColor: "#a78bfa", label: "Shocked",          emoji: "😲" },
  thinking:   { accent: "#94a3b8", softBg: "rgba(148,163,184,0.06)", textColor: "#94a3b8", label: "Thinking…",        emoji: "🤔" },
};

// ── Message & session types ───────────────────────────────────────────────────
export interface ChatMessage {
  id:            string;
  role:          "user" | "agent";
  content:       string;
  emotion?:      AgentEmotion;
  ts:            number;
  toolResult?:   ToolResult;
  toolLoading?:  boolean;
  report?:       AnalysisReport;
  isStreaming?:  boolean;
  clarification?: {
    question:   string;
    options:    ClarificationOption[];
    toolIntent: PendingToolIntent;
  };
}

export interface SessionListItem {
  sessionId:       string;
  coinId:          string;
  updatedAt:       number;
  lastMessage?:    string;
  currentEmotion?: AgentEmotion;
  messageCount?:   number;
}

// ── Raw session shape returned by GET /agent/sessions ─────────────────────────
interface RawSession {
  sessionId:      string;
  coinId:         string;
  messages:       { role: string; content: string; ts: number }[];
  currentEmotion: AgentEmotion;
  createdAt:      string | number;
  updatedAt:      string | number;
}

function toMs(v: string | number): number {
  if (typeof v === "string") return new Date(v).getTime();
  return v > 1e12 ? v : v * 1000;
}

function rawToItem(s: RawSession): SessionListItem {
  const msgs = s.messages ?? [];
  const last = msgs.filter(m => m.content && m.content !== "__init__").at(-1);
  return {
    sessionId:      s.sessionId,
    coinId:         s.coinId,
    updatedAt:      toMs(s.updatedAt),
    lastMessage:    last?.content?.slice(0, 80),
    currentEmotion: s.currentEmotion,
    messageCount:   msgs.filter(m => m.content !== "__init__").length,
  };
}

// ── Tool types ────────────────────────────────────────────────────────────────
export type ToolName =
  | "chart_analyze"
  | "chart_primitives"
  | "intelligence_scan"
  | "intelligence_coin"
  | "orderblocks_active"
  | "orderblocks_sync"
  | "agent_runs";

export interface PendingToolIntent {
  tool:       ToolName;
  symbol?:    string;
  coinId?:    string;
  timeframe?: string;
}

export interface ClarificationOption {
  label:  string;
  value:  string;
  emoji?: string;
}

// ── Intent detection ──────────────────────────────────────────────────────────
interface IntentMatch {
  tool:           ToolName;
  needsSymbol?:   boolean;
  defaultSymbol?: string;
}

const COIN_SYMBOLS: Record<string, string> = {
  bitcoin: "BTCUSDT", btc: "BTCUSDT",
  ethereum: "ETHUSDT", eth: "ETHUSDT",
  solana: "SOLUSDT",  sol: "SOLUSDT",
  bnb: "BNBUSDT", xrp: "XRPUSDT",
  avax: "AVAXUSDT", aave: "AAVEUSDT",
  arb: "ARBUSDT", op: "OPUSDT",
};

export const SYMBOL_OPTIONS: ClarificationOption[] = [
  { label: "Bitcoin",  value: "BTCUSDT",  emoji: "₿" },
  { label: "Ethereum", value: "ETHUSDT",  emoji: "Ξ" },
  { label: "Solana",   value: "SOLUSDT",  emoji: "◎" },
  { label: "AVAX",     value: "AVAXUSDT", emoji: "🔺" },
  { label: "AAVE",     value: "AAVEUSDT", emoji: "👻" },
  { label: "ARB",      value: "ARBUSDT",  emoji: "🔵" },
];

export const TIMEFRAME_OPTIONS: ClarificationOption[] = [
  { label: "1 hour",  value: "1h", emoji: "⏱" },
  { label: "4 hours", value: "4h", emoji: "🕓" },
  { label: "1 day",   value: "1d", emoji: "📅" },
];

function coinToSymbol(coinId: string): string {
  return COIN_SYMBOLS[coinId.toLowerCase()] ?? coinId.toUpperCase() + "USDT";
}

function detectToolIntent(text: string, currentCoinId: string): IntentMatch | null {
  const t = text.toLowerCase();
  if (/analyz|analysis|trade setup|entry|setup/i.test(t))
    return { tool: "chart_analyze", needsSymbol: true, defaultSymbol: coinToSymbol(currentCoinId) };
  if (/indicator|primitive|rsi|macd|ichimoku|fibonacci|fib|bb |bollinger|vwap|stoch|adx/i.test(t))
    return { tool: "chart_primitives", needsSymbol: true, defaultSymbol: coinToSymbol(currentCoinId) };
  if (/scan market|market scan|cascade|opportunities|market intel|which coin/i.test(t))
    return { tool: "intelligence_scan" };
  if (/intel|intelligence|deep dive|deep-dive|deep scan/i.test(t))
    return { tool: "intelligence_coin", needsSymbol: true, defaultSymbol: coinToSymbol(currentCoinId) };
  if (/order block|orderblock|ob |smart money|fvg|fair value gap/i.test(t))
    return { tool: "orderblocks_active", needsSymbol: true, defaultSymbol: coinToSymbol(currentCoinId) };
  if (/agent run|loop run|what did the agent do|last run|recent run/i.test(t))
    return { tool: "agent_runs" };
  return null;
}

// ── API dispatch ──────────────────────────────────────────────────────────────
async function dispatchTool(intent: PendingToolIntent): Promise<ToolResult> {
  const sym = intent.symbol ?? "BTCUSDT";
  switch (intent.tool) {
    case "chart_analyze": {
      const res = await apiClient.post<any>(`/chart/analyze/${sym}`, { timeframe: intent.timeframe ?? "4h" });
      return { type: "chart_analyze", symbol: sym, data: res.data };
    }
    case "chart_primitives": {
      const res = await apiClient.get<any>(`/chart/primitives/${sym}`);
      return { type: "chart_primitives", symbol: sym, data: res.data };
    }
    case "intelligence_scan": {
      const res = await apiClient.get<any>("/intelligence/scan");
      return { type: "intelligence_scan", data: res.data };
    }
    case "intelligence_coin": {
      const coin = sym.replace("USDT", "").toLowerCase();
      const res  = await apiClient.get<any>(`/intelligence/coin/${coin}`);
      return { type: "intelligence_coin", symbol: coin, data: res.data };
    }
    case "orderblocks_active": {
      const res = await apiClient.get<any>(`/orderblocks/active/${sym}`);
      return { type: "orderblocks_active", symbol: sym, data: res.data };
    }
    case "orderblocks_sync": {
      const res = await apiClient.post<any>(`/orderblocks/sync/${sym}`, {});
      return { type: "orderblocks_sync", symbol: sym, data: res.data };
    }
    case "agent_runs": {
      const res = await apiClient.get<any>("/agent-runs?limit=10&status=completed");
      return { type: "agent_runs", data: res };
    }
    default:
      throw new Error(`Unknown tool: ${(intent as any).tool}`);
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useChatEngine({ coinId, userId }: { coinId: string; userId: string | null | undefined }) {
  const router          = useRouter();
  const params          = useParams<{ sessionId?: string }>();
  const activeSessionId = params?.sessionId ?? null;

  const [messages,        setMessages]        = useState<ChatMessage[]>([]);
  const [emotion,         setEmotion]         = useState<AgentEmotion | null>(null);
  const [sessions,        setSessions]        = useState<SessionListItem[]>([]);
  const [isRestoring,     setIsRestoring]     = useState(false);
  const [isGenerating,    setIsGenerating]    = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [suggestAnalysis, setSuggestAnalysis] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const mood = emotion ? MOOD[emotion.emotion] : MOOD.thinking;


  // ── Session list fetch ────────────────────────────────────────────────────
  // Uses tokenStore.access directly instead of relying on userId prop timing.
  // This means it works even when userId hasn't propagated from parent yet.
  const refreshSessionList = useCallback(async () => {
    // Use token presence as the auth check — more reliable than waiting for userId prop
    if (!tokenStore.access) return;
    try {
      const raw = await apiClient.get<RawSession[]>("/agent/sessions");
      setSessions(
        (raw ?? [])
          .map(rawToItem)
          .sort((a, b) => b.updatedAt - a.updatedAt)
      );
    } catch {
      // non-critical — sidebar just stays empty
    }
  }, []); // no dependencies — always reads fresh tokenStore.access

  // ── Load session list when userId becomes available ───────────────────────
  // Also handles the case where userId starts as undefined then resolves
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    // Only trigger when userId transitions from falsy → truthy (auth resolved)
    const wasAuthed = !!prevUserIdRef.current;
    const isAuthed  = !!userId;
    prevUserIdRef.current = userId;

    if (isAuthed) {
      // Always fetch when we have a userId — catches both initial load and re-auth
      refreshSessionList();
    } else if (!wasAuthed && !isAuthed && tokenStore.access) {
      // userId prop is still undefined/null but token exists — fetch anyway
      // This covers the race where AgentView renders before useAuth resolves
      refreshSessionList();
    }
  }, [userId, refreshSessionList]);

  // ── Also fetch on mount if token exists (catches page refresh with token) ──
  useEffect(() => {
    if (tokenStore.access) {
      refreshSessionList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once on mount only

  // ── Load messages whenever the URL session changes ────────────────────────
  useEffect(() => {
    if (!activeSessionId) return;
    let isMounted = true;

    const load = async () => {
      setIsRestoring(true);
      setMessages([]);
      setError(null);
      try {
        const data = await apiClient.get<{ messages: ChatMessage[]; currentEmotion: AgentEmotion }>(
          `/agent/session/${activeSessionId}`
        );

        
        if (!isMounted) return;
        const real = (data.messages ?? []).filter(m => m.content && m.content !== "__init__");
        setMessages(real);
        setEmotion(data.currentEmotion ?? null);
      } catch {
        if (isMounted) setError("Failed to load chat history.");
      } finally {
        if (isMounted) setIsRestoring(false);
      }
    };

    load();
    return () => { isMounted = false; };
  }, [activeSessionId]);


  

  // ── Re-sync sidebar when session URL changes ──────────────────────────────
  const prevSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeSessionId) return;
    if (activeSessionId === prevSessionRef.current) return;
    prevSessionRef.current = activeSessionId;
    // Delay so the new session doc is written before we fetch
    const t = setTimeout(() => refreshSessionList(), 600);
    return () => clearTimeout(t);
  }, [activeSessionId, refreshSessionList]);

  // ── Start new session ─────────────────────────────────────────────────────
  const startNewSession = useCallback(async () => {
    try {
      setIsRestoring(true);
      setError(null);
      const res = await apiClient.post<{ sessionId: string }>("/agent/session/create", { coinId });

      // Optimistically add to sidebar — never clears existing sessions
      const now = Date.now();
      setSessions(prev => [
        { sessionId: res.sessionId, coinId, updatedAt: now, messageCount: 0 },
        ...prev,
      ]);

      // Navigate to new session
      router.push(`/agent/${coinId}/${res.sessionId}`);

      // Server reconcile after navigation settles
      setTimeout(() => refreshSessionList(), 800);
    } catch {
      setError("Failed to create a new session. Please try again.");
    } finally {
      setIsRestoring(false);
    }
  }, [coinId, router, refreshSessionList]);

  // ── Switch session ────────────────────────────────────────────────────────
  const switchToSession = useCallback((sid: string) => {
    router.push(`/agent/${coinId}/${sid}`);
  }, [coinId, router]);

  // ── Optimistic sidebar update ─────────────────────────────────────────────
  const markSessionUpdated = useCallback((sid: string, lastMsg: string, emo?: AgentEmotion) => {
    setSessions(prev => {
      const now    = Date.now();
      const exists = prev.find(s => s.sessionId === sid);
      if (exists) {
        return prev
          .map(s => s.sessionId === sid
            ? { ...s, updatedAt: now, lastMessage: lastMsg.slice(0, 80), currentEmotion: emo ?? s.currentEmotion, messageCount: (s.messageCount ?? 0) + 1 }
            : s
          )
          .sort((a, b) => b.updatedAt - a.updatedAt);
      }
      return [{ sessionId: sid, coinId, updatedAt: now, lastMessage: lastMsg.slice(0, 80), currentEmotion: emo, messageCount: 1 }, ...prev];
    });
  }, [coinId]);

  const deleteSession = useCallback(async (sid: string) => {
  try {
    await apiClient.del(`/agent/session/${sid}`);
  } catch {}
  setSessions(prev => prev.filter(s => s.sessionId !== sid));
  if (sid === activeSessionId) {
    router.push(`/agent/${coinId}`); // or pick next session
  }
}, [activeSessionId, coinId, router]);

const runFullAnalysis = useCallback(async (coinIdForAnalysis: string, agentMsgId: string) => {
  if (!activeSessionId) return;

  setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, toolLoading: true } : m));

  try {
    const result = await apiClient.post<{
      analysis: { verdict: string; score: number; confidence: number };
      agentOutput: {
        content: string;
        emotion: AgentEmotion;
        analysisReport?: AnalysisReport;
      } | null;
    }>(`/analysis/${coinIdForAnalysis}/run`, { sessionId: activeSessionId });

    const output = result.agentOutput;

    setMessages(prev => prev.map(m => m.id === agentMsgId ? {
      ...m,
      toolLoading: false,
      content: output?.content
        ?? `Analysis complete: ${result.analysis.verdict.toUpperCase()} (${result.analysis.score > 0 ? '+' : ''}${result.analysis.score}/100, ${result.analysis.confidence}% confidence)`,
      emotion: output?.emotion,
      report: output?.analysisReport,
    } : m));

    if (output?.emotion) setEmotion(output.emotion);
    markSessionUpdated(activeSessionId, output?.content ?? "Analysis complete", output?.emotion);

  } catch (err) {
    setMessages(prev => prev.map(m => m.id === agentMsgId ? {
      ...m, toolLoading: false, content: m.content || "⚠️ Analysis failed."
    } : m));
  }
}, [activeSessionId, markSessionUpdated]);
  // ── Tool narration ────────────────────────────────────────────────────────
  function summariseToolResult(result: ToolResult): string {
    try {
      const d = result.data;
      switch (result.type) {
        case "chart_analyze": {
          const a = d?.analysis ?? d;
          return `Chart analysis for ${result.symbol}: bias=${a?.bias}, setup="${a?.setup_name}", confidence=${a?.confidence}%, entry=${JSON.stringify(a?.entry_zone)}, stop=${a?.stop_loss}, targets=${JSON.stringify(a?.take_profit_levels)}, R:R=${a?.risk_reward}, regime=${a?.regime}.`;
        }
        case "chart_primitives": {
          const ind = d?.indicators ?? {};
          const sm  = d?.smart_money ?? {};
          const mtf = d?.mtfa ?? {};
          return `Market primitives for ${result.symbol}: RSI=${ind.rsi_14}, MACD hist=${ind.macd?.histogram?.toFixed(3)}, Stoch ${ind.stoch?.state}, ADX=${ind.adx}, OBV trend=${ind.obv_trend}. Smart money: BOS=${sm.bos?.direction}, ${sm.order_blocks?.length ?? 0} OBs, ${sm.fvgs?.length ?? 0} FVGs. Bias=${mtf.overall_bias}.`;
        }
        case "intelligence_scan": {
          const coins = d?.top_opportunities ?? d?.coins ?? [];
          const top3  = coins.slice(0, 3).map((c: any) => `${c.coin ?? c.symbol} (score ${(c.opportunity_score * 100)?.toFixed(0) ?? c.opportunity_score}, ${c.analysis?.bias ?? ""} bias)`).join(", ");
          return `Market scan: ${d?.total_analyzed ?? "?"} coins, ${d?.windows_open ?? "?"} windows open. Top: ${top3}. BTC regime=${d?.btc_context?.regime}.`;
        }
        case "orderblocks_active": {
          const obs = Array.isArray(result.data) ? result.data : (result.data?.data ?? []);
          if (!obs.length) return `No active order blocks for ${result.symbol}.`;
          return `Order blocks for ${result.symbol}: ${obs.length} active. ${obs.slice(0, 3).map((ob: any) => `${ob.type} ${ob.low}–${ob.high} (str ${ob.strength})`).join(", ")}.`;
        }
        case "agent_runs": {
          const runs = result.data?.runs ?? [];
          if (!runs.length) return "No recent agent runs found.";
          const last = runs[0];
          return `Latest run: ${last.runId}, strategy=${last.strategy}, status=${last.status}. ${last.decision?.reasoning?.slice(0, 150)}`;
        }
        default:
          return `Tool result for ${result.type}: ${JSON.stringify(result.data).slice(0, 300)}`;
      }
    } catch {
      return `Tool result received for ${result.type}.`;
    }
  }

  const narrateToolResult = useCallback(async (
    result:       ToolResult,
    agentMsgId:   string,
    existingText: string,
  ) => {
    if (!activeSessionId) return;

    const summary = summariseToolResult(result);
    const prompt  = `You just fetched live market data for the user. Here is what came back:\n\n${summary}\n\nIn 3–5 sentences, narrate this to the user in your current mood. Be specific — mention actual numbers, levels, and what they mean. Give your honest opinion on what the data suggests. Do not repeat the raw numbers robotically; interpret them.`;

    setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, isStreaming: true } : m));

    try {
      const response = await fetch(`${API_URL}/agent/chat/stream`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${tokenStore.access ?? ""}`,
        },
        body: JSON.stringify({ sessionId: activeSessionId, message: prompt, coinId }),
      });

      if (!response.ok || !response.body) {
        setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, isStreaming: false } : m));
        return;
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let narration = existingText ? existingText + "\n\n" : "";
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (!value) continue;
        const lines = decoder.decode(value, { stream: true }).split("\n").filter(Boolean);
        for (const line of lines) {
          let data: any;
          try { data = JSON.parse(line); } catch { continue; }
          if (data.type === "text_delta") {
            narration += data.text;
            setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, content: narration } : m));
          }
          if (data.type === "emotion_update") {
            setEmotion(data.emotion);
            setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, emotion: data.emotion } : m));
          }
        }
      }
    } catch { /* non-critical */ }
    finally {
      setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, isStreaming: false } : m));
    }
  }, [activeSessionId, coinId]);

  const executeToolInline = useCallback(async (intent: PendingToolIntent, agentMsgId: string) => {
    setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, toolLoading: true, clarification: undefined } : m));
    try {
      const result = await dispatchTool(intent);
      setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, toolLoading: false, toolResult: result } : m));
      let currentText = "";
      setMessages(prev => { currentText = prev.find(m => m.id === agentMsgId)?.content ?? ""; return prev; });
      await narrateToolResult(result, agentMsgId, currentText);
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === agentMsgId ? { ...m, toolLoading: false, isStreaming: false, content: m.content || "⚠️ Tool call failed." } : m
      ));
    }
  }, [narrateToolResult]);

  const resolveClarification = useCallback((
    agentMsgId: string, intent: PendingToolIntent,
    field: "symbol" | "coinId" | "timeframe", value: string,
  ) => {
    const resolved: PendingToolIntent = { ...intent, [field]: value };
    setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, clarification: undefined } : m));
    executeToolInline(resolved, agentMsgId);
  }, [executeToolInline]);

  const dispatchToolChip = useCallback(async (tool: ToolName, symbol?: string) => {
    const ts  = Date.now();
    const id  = `tool_${ts}`;
    const sym = symbol ?? coinToSymbol(coinId);

    const THINKING: Record<ToolName, string> = {
      chart_analyze:      "Let me pull the chart analysis…",
      chart_primitives:   "Fetching indicators and market structure…",
      intelligence_scan:  "Scanning the market for opportunities…",
      intelligence_coin:  "Running a deep-dive on this coin…",
      orderblocks_active: "Checking active order blocks…",
      orderblocks_sync:   "Syncing order blocks from chain…",
      agent_runs:         "Pulling recent agent run history…",
    };

    setMessages(prev => [...prev, {
      id, role: "agent", content: THINKING[tool],
      ts, emotion: emotion ?? undefined, toolLoading: true,
    }]);

    try {
      const result = await dispatchTool({ tool, symbol: sym });
      setMessages(prev => prev.map(m => m.id === id ? { ...m, toolLoading: false, toolResult: result } : m));
      await narrateToolResult(result, id, "");
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === id ? { ...m, toolLoading: false, isStreaming: false, content: "⚠️ Tool call failed." } : m
      ));
    }
  }, [coinId, emotion, narrateToolResult]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isGenerating || !activeSessionId) return;

     if (/^run analysis$/i.test(text.trim())) {
    const userMsgId  = `usr_${Date.now()}`;
    const agentMsgId = `agt_${Date.now()}`;
    setMessages(prev => [
      ...prev,
      { id: userMsgId,  role: "user",  content: text, ts: Date.now() },
      {
        id: agentMsgId, role: "agent",
        content: "Running full technical analysis — crunching indicators, smart money, Wyckoff, and more. This can take 15-30s...",
        ts: Date.now() + 1, toolLoading: true, emotion: emotion ?? undefined,
      },
    ]);
    setIsGenerating(true);
    try {
      await runFullAnalysis(coinId, agentMsgId);
    } finally {
      setIsGenerating(false);
    }
    return;
  }

    const intent = detectToolIntent(text, coinId);

    

    if (intent && intent.needsSymbol && !intent.defaultSymbol) {
      const agentMsgId = `clar_${Date.now()}`;
      setMessages(prev => [...prev,
        { id: `usr_${Date.now()}`, role: "user", content: text, ts: Date.now() },
        {
          id: agentMsgId, role: "agent", content: "",
          ts: Date.now() + 1, emotion: emotion ?? undefined,
          clarification: { question: "Which coin would you like me to analyze?", options: SYMBOL_OPTIONS, toolIntent: intent },
        },
      ]);
      return;
    }

    

    const userMsgId  = `usr_${Date.now()}`;
    const agentMsgId = `agt_${Date.now()}`;

    setMessages(prev => [
      ...prev,
      { id: userMsgId,  role: "user",  content: text, ts: Date.now() },
      { id: agentMsgId, role: "agent", content: "",   ts: Date.now() + 1, isStreaming: true },
    ]);

    setIsGenerating(true);
    setError(null);
    setSuggestAnalysis(false);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_URL}/agent/chat/stream`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${tokenStore.access ?? ""}`,
        },
        body:   JSON.stringify({ sessionId: activeSessionId, message: text, coinId }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok)   throw new Error(`Server error: ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader  = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let streamedContent = "";
      let finalEmotion:  AgentEmotion | undefined;
      let finalToolCall: ToolResult   | undefined;
      let finalReport:   AnalysisReport  | undefined;
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (!value) continue;
        const lines = decoder.decode(value, { stream: true }).split("\n").filter(Boolean);
        for (const line of lines) {
          let data: any;
          try { data = JSON.parse(line); } catch { continue; }
          if (data.type === "text_delta") {
            streamedContent += data.text;
            setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, content: streamedContent } : m));
          }
          if (data.type === "emotion_update") { finalEmotion = data.emotion; setEmotion(data.emotion); }
          if (data.type === "suggest_analysis") setSuggestAnalysis(true);
          if (data.type === "tool_execution") {
            // finalToolCall = { type: data.toolName, symbol: data.symbol, data: data.toolData };

             if (data.toolName === "analysis_report") {
    finalReport = data.toolData; // new variable
  } else {
    finalToolCall = { type: data.toolName, symbol: data.symbol, data: data.toolData };
  }
          }
        }
      }

     setMessages(prev => prev.map(m =>
  m.id === agentMsgId
    ? { ...m, content: streamedContent, isStreaming: false, toolResult: finalToolCall, report: finalReport, emotion: finalEmotion }
    : m
));

      if (activeSessionId && streamedContent) {
        markSessionUpdated(activeSessionId, streamedContent, finalEmotion);
      }

      if (intent) {
        setTimeout(() => executeToolInline({ tool: intent.tool, symbol: intent.defaultSymbol, coinId }, agentMsgId), 300);
      }

    } catch (err: any) {
      if (err.name === "AbortError") {
        setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, isStreaming: false } : m));
      } else {
        setError("The agent encountered a network error. Please try again.");
        setMessages(prev => prev.map(m =>
          m.id === agentMsgId ? { ...m, content: "⚠️ Connection interrupted.", isStreaming: false } : m
        ));
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [activeSessionId, coinId, isGenerating, markSessionUpdated, emotion, executeToolInline]);

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
  }, []);

  return {
    activeSessionId,
    messages,
    emotion,
    mood,
    sessions,
    isRestoring,
    isGenerating,
    error,
    suggestAnalysis,
    setSuggestAnalysis,
    startNewSession,
    switchToSession,
    sendMessage,
    stopGeneration,
    markSessionUpdated,
    refreshSessionList,
    setMessages,
    setError,
    resolveClarification,
    dispatchToolChip,
    deleteSession,
    SYMBOL_OPTIONS,
    TIMEFRAME_OPTIONS,
  };
}
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity, BarChart3, Brain, ChevronDown, ChevronUp,
  RefreshCw, Layers, Eye, ArrowRight, Zap, Clock,
} from "lucide-react";
import { apiClient } from "@/services/api.client";
import { intelligenceService, type ScanHistoryEntry } from "@/services/trading.service";

// ── Types ──────────────────────────────────────────────────────────────────────
type Bias = "long" | "short" | "neutral";
type MarketRegime = "trending_up" | "trending_down" | "ranging" | "accumulation" | "distribution" | "price_discovery";
type CascadeStatus = "window_open" | "reacting_now" | "reacted" | "decorrelated" | "leading";

interface ChartAnalysis {
  regime: MarketRegime; bias: Bias; primary_framework: string; setup_name: string;
  entry_zone: { high: number; low: number }; stop_loss: number;
  take_profit_levels: number[]; risk_reward: number; confidence: number;
  invalidation: string; reasoning?: string;
  framework_scores: Record<string, number>;
  confluence_score: number; confluence_factors: string[];
}
interface RiskResult { approved: boolean; adjusted_confidence: number; adjusted_size_mult: number; warnings: string[]; }
interface HistoryRecord extends ChartAnalysis {
  _id: string; symbol: string; risk_approved: boolean; adjusted_confidence: number;
  risk_warnings: string[]; analyzed_at: string; timeframes_used: string[];
}
interface OrderBlock {
  _id: string; id: string; symbol: string; type: "bullish" | "bearish";
  high: number; low: number; timeframe: string; status: string; strength: number;
  associated_fvg: { high: number; low: number; type: string } | null; createdAt: string;
}
interface CoinIntelCard {
  coin: string; symbol: string; current_price: number; price_change_24h: number;
  cascade: { status: CascadeStatus; window_remaining_minutes: number; expected_move_pct: number; historical_follow_rate: number; expected_window_hours: number; };
  confluence_score: number; confluence_factors: string[]; analysis: ChartAnalysis;
  correlation: { correlation_30d: number; beta_30d: number; lag_hours: number; };
  opportunity_score: number; last_updated: string;
}
interface IntelligenceScan {
  scan_id: string; generated_at: string;
  btc_context: { regime: MarketRegime; bias: Bias; signal_fired_at: string; signal_type: string; dominance: { btc_dominance: number; btc_d_trend: string; market_phase: string; }; minutes_since_signal: number; };
  market_phase: string; coins: CoinIntelCard[]; total_analyzed: number; windows_open: number; top_opportunities: CoinIntelCard[];
}
interface AgentRun {
  runId: string; strategy: string; mode: string; startedAt: string; status: string;
  decision?: { intent: { type: string; rationale?: string }; confidence: number; reasoning: string; toolCallTrace: string[]; };
  executionResult?: { status: string; simulatedPnlUsd?: number; };
}
interface AgentConfig {
  enabled: boolean; mode: string; loopIntervalMs: number;
  strategies: Record<string, boolean>; watchlist: string[]; maxTradeUsd: number;
}
interface PaperWallet {
  walletId: string; balances: { symbol: string; amount: number; valueUsd: number }[];
  totalValueUsd: number; initialUsd: number; realizedPnlUsd: number; unrealizedPnlUsd: number;
}

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg: "rgb(2,6,9)", surface: "rgb(6,14,22)", border: "rgba(255,255,255,0.07)",
  cyan: "#00d4ff", green: "#00e5a0", red: "#ff5572", amber: "#ffb020", purple: "#a78bfa",
  ink: "rgba(255,255,255,0.88)", inkSoft: "rgba(255,255,255,0.55)", inkMuted: "rgba(255,255,255,0.3)",
  mono: "var(--font-mono,'JetBrains Mono',monospace)",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number, dec = 2) { return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`;
}
function biasColor(b: string) { if (b==="long"||b==="bullish") return C.green; if (b==="short"||b==="bearish") return C.red; return C.inkSoft; }
function biasLabel(b: string) { if (b==="long"||b==="bullish") return "↑ "+b.toUpperCase(); if (b==="short"||b==="bearish") return "↓ "+b.toUpperCase(); return "— NEUTRAL"; }
function cascadeColor(s: CascadeStatus) { if (s==="window_open") return C.amber; if (s==="reacting_now") return C.green; if (s==="leading") return C.purple; return C.inkMuted; }
function confColor(c: number) { return c>=70?C.green:c>=50?C.amber:C.red; }

// ── Primitives ─────────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", ...style }}>{children}</div>;
}
function STitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      {icon && <span style={{ color: C.cyan, opacity: 0.8 }}>{icon}</span>}
      <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: "0.1em", textTransform: "uppercase" }}>{children}</span>
    </div>
  );
}
function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:20, fontSize:10, fontFamily:C.mono, fontWeight:700, color, background:color+"18", border:`1px solid ${color}30` }}>{children}</span>;
}
function Spin() {
  return <span style={{ display:"inline-block", width:14, height:14, border:`2px solid ${C.border}`, borderTopColor:C.cyan, borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />;
}
function Bar({ value, color=C.cyan }: { value:number; color?:string }) {
  return <div style={{ height:3, borderRadius:2, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}><div style={{ height:"100%", width:`${Math.min(100,value)}%`, background:color, borderRadius:2, transition:"width 0.4s" }} /></div>;
}

// ── Wallet Panel ───────────────────────────────────────────────────────────────
function WalletPanel() {
  const [wallet, setWallet] = useState<PaperWallet|null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiClient.get<PaperWallet>("/paper-wallet").then(setWallet).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  if (loading) return <Card><div style={{display:"flex",justifyContent:"center",padding:16}}><Spin/></div></Card>;
  if (!wallet) return <Card><div style={{fontFamily:C.mono,fontSize:11,color:C.inkMuted,textAlign:"center",padding:16}}>Wallet unavailable</div></Card>;
  const pnl = wallet.realizedPnlUsd + wallet.unrealizedPnlUsd;
  const pnlPct = wallet.initialUsd > 0 ? (pnl / wallet.initialUsd) * 100 : 0;
  return (
    <Card>
      <STitle icon={<Zap size={14}/>}>Paper Wallet</STitle>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <div style={{fontFamily:C.mono,fontSize:26,fontWeight:700,color:C.ink,lineHeight:1}}>${fmt(wallet.totalValueUsd)}</div>
          <div style={{fontFamily:C.mono,fontSize:10,color:C.inkMuted,marginTop:4}}>total value</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontFamily:C.mono,fontSize:16,fontWeight:700,color:pnl>=0?C.green:C.red}}>{pnl>=0?"+":""}{fmt(pnl)} <span style={{fontSize:11}}>({pnlPct>=0?"+":""}{fmt(pnlPct)}%)</span></div>
          <div style={{fontFamily:C.mono,fontSize:10,color:C.inkMuted,marginTop:2}}>total P&L</div>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {wallet.balances.map(b=>(
          <div key={b.symbol} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:26,height:26,borderRadius:6,background:"rgba(0,212,255,0.1)",border:`1px solid ${C.cyan}30`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:C.mono,fontSize:8,fontWeight:700,color:C.cyan}}>{b.symbol.slice(0,3)}</div>
              <span style={{fontFamily:C.mono,fontSize:12,fontWeight:600,color:C.ink}}>{b.symbol}</span>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:C.mono,fontSize:12,fontWeight:700,color:C.ink}}>${fmt(b.valueUsd)}</div>
              <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted}}>{((b.valueUsd/wallet.totalValueUsd)*100).toFixed(1)}%</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}>
        <span style={{fontFamily:C.mono,fontSize:10,color:C.inkMuted}}>initial</span>
        <span style={{fontFamily:C.mono,fontSize:10,color:C.inkMuted}}>${fmt(wallet.initialUsd)}</span>
      </div>
    </Card>
  );
}

// ── Chart Analysis Panel ───────────────────────────────────────────────────────
function ChartAnalysisPanel() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [analysis, setAnalysis] = useState<ChartAnalysis|null>(null);
  const [risk, setRisk] = useState<RiskResult|null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"analysis"|"history">("analysis");
  const SYMS = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","AVAXUSDT"];

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<{success:boolean;data:{analysis:ChartAnalysis;risk:RiskResult}}>(`/chart/analyze/${symbol}`, {});
      setAnalysis(res.data.analysis); setRisk(res.data.risk);
    } catch {} finally { setLoading(false); }
  }, [symbol]);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await apiClient.get<{success:boolean;data:HistoryRecord[]}>(`/chart/history/${symbol}?limit=10`);
      setHistory(res.data);
    } catch {} finally { setHistLoading(false); }
  }, [symbol]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  return (
    <Card>
      <STitle icon={<BarChart3 size={14}/>}>Chart Analysis</STitle>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:3,background:"rgba(0,0,0,0.3)",borderRadius:8,padding:3}}>
          {SYMS.map(s=>(
            <button key={s} onClick={()=>setSymbol(s)} style={{padding:"4px 9px",borderRadius:6,border:"none",cursor:"pointer",fontSize:10,fontFamily:C.mono,fontWeight:600,transition:"all 0.15s",background:symbol===s?C.cyan:"transparent",color:symbol===s?C.bg:C.inkMuted}}>
              {s.replace("USDT","")}
            </button>
          ))}
        </div>
        <button onClick={runAnalysis} disabled={loading} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:8,border:`1px solid ${C.cyan}40`,background:loading?"transparent":`${C.cyan}15`,color:C.cyan,cursor:loading?"default":"pointer",fontFamily:C.mono,fontSize:11,fontWeight:700}}>
          {loading?<Spin/>:<Brain size={13}/>}{loading?"Analysing…":"Analyse"}
        </button>
        <button onClick={()=>{setTab("history");loadHistory();}} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.inkSoft,cursor:"pointer",fontFamily:C.mono,fontSize:11}}>
          <Clock size={12}/>History
        </button>
      </div>

      <div style={{display:"flex",gap:1,marginBottom:14,borderBottom:`1px solid ${C.border}`}}>
        {(["analysis","history"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:"6px 14px",border:"none",background:"transparent",cursor:"pointer",fontFamily:C.mono,fontSize:11,fontWeight:600,textTransform:"capitalize",color:tab===t?C.cyan:C.inkMuted,borderBottom:tab===t?`2px solid ${C.cyan}`:"2px solid transparent",marginBottom:-1,transition:"all 0.15s"}}>{t}</button>
        ))}
      </div>

      {tab==="analysis" && analysis && (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <Tag color={biasColor(analysis.bias)}>{biasLabel(analysis.bias)}</Tag>
            <Tag color={C.inkSoft}>{analysis.regime.replace(/_/g," ").toUpperCase()}</Tag>
            <Tag color={C.purple}>{analysis.primary_framework}</Tag>
            <Tag color={confColor(analysis.confidence)}>{analysis.confidence}% conf</Tag>
            {risk&&!risk.approved&&<Tag color={C.red}>⚠ REJECTED</Tag>}
          </div>
          <div style={{fontFamily:C.mono,fontSize:13,fontWeight:700,color:C.ink}}>{analysis.setup_name}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>
            {[{l:"Entry",v:`$${fmt(analysis.entry_zone.low)}–$${fmt(analysis.entry_zone.high)}`,c:C.cyan},{l:"Stop Loss",v:`$${fmt(analysis.stop_loss)}`,c:C.red},{l:"R:R",v:`${analysis.risk_reward}:1`,c:analysis.risk_reward>=2?C.green:C.amber}].map(item=>(
              <div key={item.l} style={{padding:"9px 10px",borderRadius:8,background:`${item.c}0a`,border:`1px solid ${item.c}20`}}>
                <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted,marginBottom:3,textTransform:"uppercase"}}>{item.l}</div>
                <div style={{fontFamily:C.mono,fontSize:11,fontWeight:700,color:item.c}}>{item.v}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted,marginBottom:5,textTransform:"uppercase"}}>Take Profits</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {analysis.take_profit_levels.map((tp,i)=>(
                <span key={i} style={{padding:"2px 9px",borderRadius:6,fontSize:10,fontFamily:C.mono,fontWeight:600,background:`${C.green}10`,border:`1px solid ${C.green}25`,color:C.green}}>TP{i+1} ${fmt(tp)}</span>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted,marginBottom:6,textTransform:"uppercase"}}>Framework Scores</div>
            {Object.entries(analysis.framework_scores).map(([name,score])=>(
              <div key={name} style={{marginBottom:5}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                  <span style={{fontFamily:C.mono,fontSize:10,color:C.inkSoft}}>{name}</span>
                  <span style={{fontFamily:C.mono,fontSize:10,fontWeight:700,color:score>50?C.green:C.inkMuted}}>{score}</span>
                </div>
                <Bar value={score} color={score>50?C.green:score>25?C.amber:C.inkMuted}/>
              </div>
            ))}
          </div>
          <div style={{padding:"9px 12px",borderRadius:8,background:"rgba(0,0,0,0.3)",border:`1px solid ${C.border}`}}>
            <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted,marginBottom:6,textTransform:"uppercase"}}>Confluence ({analysis.confluence_score})</div>
            {analysis.confluence_factors.map((f,i)=>(
              <div key={i} style={{display:"flex",gap:7,marginBottom:3}}><span style={{color:C.cyan}}>·</span><span style={{fontFamily:C.mono,fontSize:10,color:C.inkSoft}}>{f}</span></div>
            ))}
          </div>
          <div style={{padding:"7px 11px",borderRadius:8,background:`${C.red}08`,border:`1px solid ${C.red}20`,fontFamily:C.mono,fontSize:10,color:C.red}}>⚠ {analysis.invalidation}</div>
          {risk&&(
            <div style={{display:"flex",gap:7}}>
              <div style={{flex:1,padding:"7px 11px",borderRadius:8,background:`${risk.approved?C.green:C.red}08`,border:`1px solid ${risk.approved?C.green:C.red}20`}}>
                <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted,marginBottom:2,textTransform:"uppercase"}}>Risk Gate</div>
                <div style={{fontFamily:C.mono,fontSize:11,fontWeight:700,color:risk.approved?C.green:C.red}}>{risk.approved?"✓ APPROVED":"✗ REJECTED"}</div>
              </div>
              <div style={{flex:1,padding:"7px 11px",borderRadius:8,background:"rgba(0,0,0,0.2)",border:`1px solid ${C.border}`}}>
                <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted,marginBottom:2,textTransform:"uppercase"}}>Size Mult</div>
                <div style={{fontFamily:C.mono,fontSize:11,fontWeight:700,color:C.ink}}>{(risk.adjusted_size_mult*100).toFixed(0)}%</div>
              </div>
            </div>
          )}
          {analysis.reasoning&&(
            <div>
              <button onClick={()=>setExpanded(!expanded)} style={{display:"flex",alignItems:"center",gap:5,background:"transparent",border:"none",cursor:"pointer",fontFamily:C.mono,fontSize:10,color:C.inkMuted,padding:0}}>
                {expanded?<ChevronUp size={11}/>:<ChevronDown size={11}/>}{expanded?"Hide":"Show"} reasoning
              </button>
              {expanded&&<div style={{marginTop:7,padding:"9px 12px",borderRadius:8,background:"rgba(0,0,0,0.25)",border:`1px solid ${C.border}`,fontFamily:C.mono,fontSize:10,color:C.inkSoft,lineHeight:1.7}}>{analysis.reasoning}</div>}
            </div>
          )}
        </div>
      )}
      {tab==="analysis"&&!analysis&&!loading&&<div style={{textAlign:"center",padding:"20px 0",color:C.inkMuted,fontFamily:C.mono,fontSize:11}}>Hit Analyse to run the two-tier pipeline</div>}

      {tab==="history"&&(
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {histLoading&&<div style={{display:"flex",justifyContent:"center",padding:12}}><Spin/></div>}
          {!histLoading&&history.length===0&&<div style={{textAlign:"center",padding:"16px 0",color:C.inkMuted,fontFamily:C.mono,fontSize:11}}>No history for {symbol}</div>}
          {history.map(r=>(
            <div key={r._id} style={{padding:"9px 12px",borderRadius:8,background:"rgba(0,0,0,0.25)",border:`1px solid ${C.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontFamily:C.mono,fontSize:11,fontWeight:700,color:C.ink}}>{r.setup_name}</span>
                <Tag color={biasColor(r.bias)}>{r.bias.toUpperCase()}</Tag>
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <span style={{fontFamily:C.mono,fontSize:10,color:C.inkMuted}}>Entry ${fmt(r.entry_zone.low)}–${fmt(r.entry_zone.high)}</span>
                <span style={{fontFamily:C.mono,fontSize:10,color:r.risk_reward>=2?C.green:C.amber}}>{r.risk_reward}:1 R:R</span>
                <span style={{fontFamily:C.mono,fontSize:10,color:confColor(r.adjusted_confidence)}}>{r.adjusted_confidence}% conf</span>
              </div>
              <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted,marginTop:3}}>{ago(r.analyzed_at)} · {r.timeframes_used.join(", ")}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Order Blocks Panel ─────────────────────────────────────────────────────────
function OrderBlocksPanel() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [obs, setObs] = useState<OrderBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string|null>(null);

  const load = useCallback(async (sym: string) => {
    setLoading(true);
    try { const res = await apiClient.get<{success:boolean;data:OrderBlock[]}>(`/orderblocks/active/${sym}`); setObs(res.data); }
    catch {} finally { setLoading(false); }
  }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await apiClient.post<{success:boolean;data:OrderBlock[];synced_at:string}>(`/orderblocks/sync/${symbol}`, {});
      setObs(res.data); setLastSync(res.synced_at);
    } catch {} finally { setSyncing(false); }
  };

  useEffect(() => { load(symbol); }, [symbol, load]);

  return (
    <Card>
      <STitle icon={<Layers size={14}/>}>Order Blocks</STitle>
      <div style={{display:"flex",gap:7,marginBottom:14,alignItems:"center"}}>
        <select value={symbol} onChange={e=>setSymbol(e.target.value)} style={{flex:1,padding:"6px 10px",borderRadius:8,fontSize:11,fontFamily:C.mono,background:"rgba(0,0,0,0.4)",border:`1px solid ${C.border}`,color:C.ink,cursor:"pointer"}}>
          {["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT"].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={sync} disabled={syncing} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 11px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.inkSoft,cursor:syncing?"default":"pointer",fontFamily:C.mono,fontSize:11}}>
          <RefreshCw size={11} style={{animation:syncing?"spin 0.7s linear infinite":"none"}}/>Sync
        </button>
      </div>
      {lastSync&&<div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted,marginBottom:9}}>Synced {ago(lastSync)}</div>}
      {loading&&<div style={{display:"flex",justifyContent:"center",padding:14}}><Spin/></div>}
      {!loading&&obs.length===0&&<div style={{textAlign:"center",padding:"16px 0",color:C.inkMuted,fontFamily:C.mono,fontSize:11}}>No active OBs — hit Sync</div>}
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {obs.map(ob=>{
          const col = ob.type==="bullish"?C.green:C.red;
          return (
            <div key={ob.id} style={{padding:"9px 12px",borderRadius:8,background:`${col}08`,border:`1px solid ${col}25`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                  <Tag color={col}>{ob.type.toUpperCase()} OB</Tag>
                  <span style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted}}>{ob.timeframe}</span>
                </div>
                <span style={{fontFamily:C.mono,fontSize:10,color:C.amber}}>Str {ob.strength}</span>
              </div>
              <div style={{display:"flex",gap:14}}>
                <div>
                  <div style={{fontFamily:C.mono,fontSize:8,color:C.inkMuted,marginBottom:2}}>RANGE</div>
                  <div style={{fontFamily:C.mono,fontSize:12,fontWeight:700,color:col}}>${fmt(ob.low)} – ${fmt(ob.high)}</div>
                </div>
                {ob.associated_fvg&&(
                  <div>
                    <div style={{fontFamily:C.mono,fontSize:8,color:C.inkMuted,marginBottom:2}}>FVG</div>
                    <div style={{fontFamily:C.mono,fontSize:10,color:C.inkSoft}}>${fmt(ob.associated_fvg.low)} – ${fmt(ob.associated_fvg.high)}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Intelligence Panel ─────────────────────────────────────────────────────────
function IntelligencePanel() {
  const [scan, setScan] = useState<IntelligenceScan|null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [selected, setSelected] = useState<CoinIntelCard|null>(null);
  const [tab, setTab] = useState<"top"|"cascade"|"all">("top");
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historicalId, setHistoricalId] = useState<string|null>(null); // null = viewing live

  const loadScan = useCallback(async (refresh=false) => {
    setLoading(true);
    setHistoricalId(null);
    try { const res = await apiClient.get<{success:boolean;data:IntelligenceScan;cached:boolean}>(`/intelligence/scan${refresh?"?refresh=true":""}`); setScan(res.data); }
    catch {} finally { setLoading(false); }
  }, []);

  const loadHistory = useCallback(async () => {
    try { const res = await intelligenceService.history(20); setHistory(res.data); }
    catch {}
  }, []);

  const openHistorical = async (entry: ScanHistoryEntry) => {
    setShowHistory(false);
    setSelected(null);
    setLoading(true);
    try {
      const res = await intelligenceService.getScan(entry.scan_id);
      setScan(res.data as unknown as IntelligenceScan);
      setHistoricalId(entry.scan_id);
    } catch {} finally { setLoading(false); }
  };

  const toggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) loadHistory();
  };

  const trigger = async () => {
    setTriggering(true);
    try { await apiClient.post("/intelligence/trigger", {}); await loadScan(true); }
    catch {} finally { setTriggering(false); }
  };

  useEffect(() => { loadScan(); }, [loadScan]);

  const coins = tab==="top" ? scan?.top_opportunities??[] : tab==="cascade" ? (scan?.coins??[]).filter(c=>c.cascade.status==="window_open"||c.cascade.status==="reacting_now") : scan?.coins??[];

  return (
    <Card style={{gridColumn:"span 2"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <STitle icon={<Brain size={14}/>}>Intelligence Scanner</STitle>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {scan&&<span style={{fontFamily:C.mono,fontSize:10,color:C.inkMuted}}>{scan.windows_open} windows · {ago(scan.generated_at)}</span>}
          <button onClick={toggleHistory} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 9px",borderRadius:8,border:`1px solid ${showHistory?C.cyan+"40":C.border}`,background:showHistory?`${C.cyan}12`:"transparent",color:showHistory?C.cyan:C.inkSoft,cursor:"pointer",fontFamily:C.mono,fontSize:11}}>
            <Clock size={11}/> History
          </button>
          <button onClick={()=>loadScan(true)} disabled={loading} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 9px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.inkSoft,cursor:"pointer",fontFamily:C.mono,fontSize:11}}>
            <RefreshCw size={11} style={{animation:loading?"spin 0.7s linear infinite":"none"}}/>
          </button>
          <button onClick={trigger} disabled={triggering} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:8,border:`1px solid ${C.purple}40`,background:`${C.purple}15`,color:C.purple,cursor:triggering?"default":"pointer",fontFamily:C.mono,fontSize:11,fontWeight:700}}>
            {triggering?<Spin/>:<Zap size={11}/>}{triggering?"Scanning…":"Trigger"}
          </button>
        </div>
      </div>

      {showHistory&&(
        <div style={{marginBottom:12,borderRadius:8,border:`1px solid ${C.border}`,background:"rgba(0,0,0,0.3)",overflow:"hidden"}}>
          <div style={{padding:"7px 12px",borderBottom:`1px solid ${C.border}`,fontFamily:C.mono,fontSize:9,color:C.inkMuted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Scan History · last {history.length}</div>
          {history.length===0&&<div style={{padding:"14px 0",textAlign:"center",fontFamily:C.mono,fontSize:11,color:C.inkMuted}}>No persisted scans yet</div>}
          <div style={{maxHeight:220,overflowY:"auto"}}>
            {history.map(h=>(
              <button key={h.scan_id} onClick={()=>openHistorical(h)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"8px 12px",border:"none",borderBottom:`1px solid ${C.border}`,background:historicalId===h.scan_id?`${C.cyan}10`:"transparent",cursor:"pointer",textAlign:"left"}}>
                <span style={{flex:1,minWidth:0,fontFamily:C.mono,fontSize:11,color:C.ink}}>{ago(h.generated_at)}</span>
                {h.btc_bias&&<Tag color={biasColor(h.btc_bias)}>BTC {biasLabel(h.btc_bias)}</Tag>}
                {h.btc_regime&&<span style={{fontFamily:C.mono,fontSize:9,color:C.inkSoft}}>{h.btc_regime.replace(/_/g," ")}</span>}
                <Tag color={C.amber}>{h.market_phase.replace(/_/g," ").toUpperCase()}</Tag>
                <span style={{width:70,textAlign:"right",fontFamily:C.mono,fontSize:9,color:C.inkMuted}}>{h.windows_open}w · {h.coin_count}c</span>
                <ArrowRight size={11} style={{color:C.inkMuted,flexShrink:0}}/>
              </button>
            ))}
          </div>
        </div>
      )}

      {historicalId&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12,padding:"7px 12px",borderRadius:8,background:`${C.amber}12`,border:`1px solid ${C.amber}30`}}>
          <span style={{display:"flex",alignItems:"center",gap:6,fontFamily:C.mono,fontSize:11,color:C.amber}}><Clock size={11}/> Viewing historical scan{scan&&<> · {ago(scan.generated_at)}</>}</span>
          <button onClick={()=>loadScan(false)} style={{padding:"3px 10px",borderRadius:6,border:`1px solid ${C.amber}40`,background:"transparent",color:C.amber,cursor:"pointer",fontFamily:C.mono,fontSize:10,fontWeight:700}}>Return to live</button>
        </div>
      )}

      {scan&&(
        <div style={{display:"flex",gap:14,padding:"9px 12px",borderRadius:8,marginBottom:12,background:"rgba(0,0,0,0.3)",border:`1px solid ${C.border}`,flexWrap:"wrap",alignItems:"center"}}>
          {[
            {l:"BTC",v:<span style={{fontFamily:C.mono,fontSize:12,fontWeight:700,color:biasColor(scan.btc_context.bias)}}>{biasLabel(scan.btc_context.bias)}</span>},
            {l:"Setup",v:<span style={{fontFamily:C.mono,fontSize:11,color:C.ink}}>{scan.btc_context.signal_type}</span>},
            {l:"Regime",v:<span style={{fontFamily:C.mono,fontSize:11,color:C.inkSoft}}>{scan.btc_context.regime.replace(/_/g," ")}</span>},
            {l:"Phase",v:<Tag color={C.amber}>{scan.market_phase.replace(/_/g," ").toUpperCase()}</Tag>},
            {l:"BTC.D",v:<span style={{fontFamily:C.mono,fontSize:11,color:C.inkSoft}}>{scan.btc_context.dominance.btc_dominance}% {scan.btc_context.dominance.btc_d_trend}</span>},
            {l:"Analyzed",v:<span style={{fontFamily:C.mono,fontSize:11,color:C.inkSoft}}>{scan.total_analyzed} coins</span>},
          ].map(({l,v})=>(
            <div key={l}>
              <div style={{fontFamily:C.mono,fontSize:8,color:C.inkMuted,marginBottom:2,textTransform:"uppercase"}}>{l}</div>
              {v}
            </div>
          ))}
        </div>
      )}

      <div style={{display:"flex",gap:1,marginBottom:12,borderBottom:`1px solid ${C.border}`}}>
        {([{k:"top",l:"Top"},{k:"cascade",l:"Windows Open"},{k:"all",l:"All"}] as const).map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"5px 12px",border:"none",background:"transparent",cursor:"pointer",fontFamily:C.mono,fontSize:11,fontWeight:600,color:tab===t.k?C.cyan:C.inkMuted,borderBottom:tab===t.k?`2px solid ${C.cyan}`:"2px solid transparent",marginBottom:-1,transition:"all 0.15s"}}>{t.l}</button>
        ))}
      </div>

      {loading&&<div style={{display:"flex",justifyContent:"center",padding:20}}><Spin/></div>}
      {!loading&&!scan&&<div style={{textAlign:"center",padding:"20px 0",color:C.inkMuted,fontFamily:C.mono,fontSize:11}}>No scan — hit Trigger</div>}

      {!loading&&scan&&(
        <div style={{display:"grid",gridTemplateColumns:selected?"1fr 320px":"1fr",gap:10}}>
          <div style={{display:"flex",flexDirection:"column",gap:6,minWidth:0}}>
            {coins.map(c=>(
              <button key={c.coin} onClick={()=>setSelected(selected?.coin===c.coin?null:c)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,cursor:"pointer",background:selected?.coin===c.coin?`${C.cyan}10`:"rgba(0,0,0,0.25)",border:`1px solid ${selected?.coin===c.coin?C.cyan+"40":C.border}`,textAlign:"left"}}>
                <div style={{width:44,flexShrink:0}}>
                  <div style={{fontFamily:C.mono,fontSize:12,fontWeight:700,color:C.ink}}>{c.coin}</div>
                  <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted}}>${fmt(c.current_price,c.current_price<1?4:2)}</div>
                </div>
                <div style={{width:48,flexShrink:0,textAlign:"right"}}>
                  <span style={{fontFamily:C.mono,fontSize:11,fontWeight:700,color:c.price_change_24h>=0?C.green:C.red}}>{c.price_change_24h>=0?"+":""}{fmt(c.price_change_24h)}%</span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:3}}>
                    <span style={{fontFamily:C.mono,fontSize:9,fontWeight:700,color:cascadeColor(c.cascade.status)}}>● {c.cascade.status.replace(/_/g," ").toUpperCase()}</span>
                    <span style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted}}>{c.cascade.window_remaining_minutes}m</span>
                  </div>
                  <Bar value={c.cascade.window_remaining_minutes/(c.cascade.expected_window_hours*60)*100} color={cascadeColor(c.cascade.status)}/>
                </div>
                <div style={{width:52,flexShrink:0,textAlign:"right"}}>
                  <div style={{fontFamily:C.mono,fontSize:12,fontWeight:700,color:C.amber}}>{(c.opportunity_score*100).toFixed(1)}</div>
                  <div style={{fontFamily:C.mono,fontSize:8,color:C.inkMuted}}>score</div>
                </div>
                <Tag color={biasColor(c.analysis.bias)}>{c.analysis.bias.toUpperCase()}</Tag>
                <ArrowRight size={11} style={{color:C.inkMuted,flexShrink:0}}/>
              </button>
            ))}
          </div>

          {selected&&(
            <div style={{padding:"12px 14px",borderRadius:10,background:"rgba(0,0,0,0.35)",border:`1px solid ${C.border}`,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontFamily:C.mono,fontSize:15,fontWeight:700,color:C.ink}}>{selected.coin}</span>
                <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",color:C.inkMuted,cursor:"pointer",fontSize:15}}>×</button>
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                <Tag color={biasColor(selected.analysis.bias)}>{biasLabel(selected.analysis.bias)}</Tag>
                <Tag color={cascadeColor(selected.cascade.status)}>{selected.cascade.status.replace(/_/g," ")}</Tag>
                <Tag color={confColor(selected.analysis.confidence)}>{selected.analysis.confidence}%</Tag>
              </div>
              <div style={{fontFamily:C.mono,fontSize:11,fontWeight:700,color:C.ink}}>{selected.analysis.setup_name}</div>
              {[
                {l:"Entry",v:`$${fmt(selected.analysis.entry_zone.low)}–$${fmt(selected.analysis.entry_zone.high)}`,c:C.cyan},
                {l:"Stop",v:`$${fmt(selected.analysis.stop_loss)}`,c:C.red},
                {l:"R:R",v:`${selected.analysis.risk_reward}:1`,c:C.green},
                {l:"Exp. Move",v:`${selected.cascade.expected_move_pct}%`,c:C.amber},
                {l:"Follow",v:`${(selected.cascade.historical_follow_rate*100).toFixed(0)}%`,c:C.purple},
                {l:"Beta",v:`${fmt(selected.correlation.beta_30d)}x`,c:C.inkSoft},
                {l:"Corr 30d",v:fmt(selected.correlation.correlation_30d,3),c:C.inkSoft},
                {l:"Lag",v:`${selected.correlation.lag_hours}h`,c:C.inkSoft},
              ].map(row=>(
                <div key={row.l} style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontFamily:C.mono,fontSize:10,color:C.inkMuted}}>{row.l}</span>
                  <span style={{fontFamily:C.mono,fontSize:11,fontWeight:700,color:row.c}}>{row.v}</span>
                </div>
              ))}
              <div>
                <div style={{fontFamily:C.mono,fontSize:8,color:C.inkMuted,marginBottom:5,textTransform:"uppercase"}}>Confluence</div>
                {selected.confluence_factors.map((f,i)=>(
                  <div key={i} style={{display:"flex",gap:5,marginBottom:3}}><span style={{color:C.cyan}}>·</span><span style={{fontFamily:C.mono,fontSize:10,color:C.inkSoft}}>{f}</span></div>
                ))}
              </div>
              <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted}}>⚠ {selected.analysis.invalidation}</div>
              <div style={{fontFamily:C.mono,fontSize:8,color:C.inkMuted,paddingTop:5,borderTop:`1px solid ${C.border}`}}>Updated {ago(selected.last_updated)}</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Agent Runs Panel ───────────────────────────────────────────────────────────
function AgentRunsPanel() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [config, setConfig] = useState<AgentConfig|null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [expanded, setExpanded] = useState<string|null>(null);
  const [schedulerActive, setSchedulerActive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([
        apiClient.get<{runs:AgentRun[];total:number}>("/agent-runs?limit=10&status=completed"),
        apiClient.get<{config:AgentConfig;schedulerActive:boolean}>("/agent-runs/config"),
      ]);
      setRuns(r.runs); setConfig(c.config); setSchedulerActive(c.schedulerActive);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const trigger = async () => {
    setTriggering(true);
    try { await apiClient.post("/agent-runs/trigger", {}); setTimeout(()=>load(), 3000); }
    catch {} finally { setTriggering(false); }
  };

  const intentColor = (t: string) => t==="swap"?C.green:t==="set_alert"?C.cyan:t==="no_action"?C.inkMuted:C.amber;

  return (
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <STitle icon={<Activity size={14}/>}>Agent Runs</STitle>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {schedulerActive&&<span style={{display:"flex",alignItems:"center",gap:4,fontFamily:C.mono,fontSize:9,color:C.green}}><span style={{width:5,height:5,borderRadius:"50%",background:C.green,display:"inline-block"}}/>Scheduler</span>}
          <button onClick={trigger} disabled={triggering} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:8,border:`1px solid ${C.amber}40`,background:`${C.amber}10`,color:C.amber,cursor:triggering?"default":"pointer",fontFamily:C.mono,fontSize:11,fontWeight:700}}>
            {triggering?<Spin/>:<Zap size={11}/>}{triggering?"…":"Trigger"}
          </button>
        </div>
      </div>

      {config&&(
        <div style={{display:"flex",gap:10,padding:"7px 10px",borderRadius:8,marginBottom:10,background:"rgba(0,0,0,0.25)",border:`1px solid ${C.border}`,flexWrap:"wrap"}}>
          <Tag color={config.mode==="paper"?C.cyan:C.amber}>{config.mode.toUpperCase()}</Tag>
          <Tag color={config.enabled?C.green:C.red}>{config.enabled?"ENABLED":"DISABLED"}</Tag>
          <span style={{fontFamily:C.mono,fontSize:10,color:C.inkMuted}}>max ${config.maxTradeUsd}</span>
          {Object.entries(config.strategies).filter(([,v])=>v).map(([k])=><Tag key={k} color={C.purple}>{k}</Tag>)}
        </div>
      )}

      {loading&&<div style={{display:"flex",justifyContent:"center",padding:14}}><Spin/></div>}
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {runs.map(run=>(
          <div key={run.runId} style={{borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`}}>
            <button onClick={()=>setExpanded(expanded===run.runId?null:run.runId)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:expanded===run.runId?"rgba(0,0,0,0.35)":"rgba(0,0,0,0.2)",border:"none",cursor:"pointer",textAlign:"left"}}>
              <div style={{width:6,height:6,borderRadius:"50%",flexShrink:0,background:run.status==="completed"?C.green:run.status==="failed"?C.red:C.amber}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontFamily:C.mono,fontSize:10,fontWeight:700,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{run.runId}</span>
                  {run.decision&&<Tag color={intentColor(run.decision.intent.type)}>{run.decision.intent.type.replace(/_/g," ")}</Tag>}
                </div>
                <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted,marginTop:1}}>{run.strategy} · {ago(run.startedAt)}{run.decision?` · ${run.decision.confidence}% conf`:""}</div>
              </div>
              {expanded===run.runId?<ChevronUp size={11} style={{color:C.inkMuted,flexShrink:0}}/>:<ChevronDown size={11} style={{color:C.inkMuted,flexShrink:0}}/>}
            </button>
            {expanded===run.runId&&run.decision&&(
              <div style={{padding:"9px 12px",background:"rgba(0,0,0,0.3)",borderTop:`1px solid ${C.border}`}}>
                <div style={{fontFamily:C.mono,fontSize:10,color:C.inkSoft,lineHeight:1.6,marginBottom:8}}>{run.decision.intent.rationale??run.decision.reasoning}</div>
                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                  {run.decision.toolCallTrace.map((t,i)=>(
                    <span key={i} style={{padding:"1px 6px",borderRadius:4,fontSize:9,fontFamily:C.mono,background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,color:C.inkMuted}}>{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Primitives Panel ───────────────────────────────────────────────────────────
function PrimitivesPanel() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const res = await apiClient.get<{success:boolean;data:any}>(`/chart/primitives/${symbol}`); setData(res.data); }
    catch {} finally { setLoading(false); }
  };

  const ind = data?.indicators, mtfa = data?.mtfa, wyckoff = data?.wyckoff, sm = data?.smart_money;

  return (
    <Card>
      <STitle icon={<Eye size={14}/>}>Tier 1 Primitives</STitle>
      <div style={{display:"flex",gap:7,marginBottom:14}}>
        <select value={symbol} onChange={e=>setSymbol(e.target.value)} style={{flex:1,padding:"6px 10px",borderRadius:8,fontSize:11,fontFamily:C.mono,background:"rgba(0,0,0,0.4)",border:`1px solid ${C.border}`,color:C.ink}}>
          {["BTCUSDT","ETHUSDT","SOLUSDT"].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} disabled={loading} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,border:`1px solid ${C.cyan}40`,background:`${C.cyan}10`,color:C.cyan,cursor:loading?"default":"pointer",fontFamily:C.mono,fontSize:11,fontWeight:700}}>
          {loading?<Spin/>:<RefreshCw size={11}/>}Fetch
        </button>
      </div>
      {!data&&!loading&&<div style={{textAlign:"center",padding:"16px 0",color:C.inkMuted,fontFamily:C.mono,fontSize:11}}>Select symbol and fetch</div>}
      {data&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted}}>{data.meta?.timeframes_analyzed?.join(", ")} · ~{data.meta?.token_count_estimate} tokens</div>
          {ind&&(
            <div>
              <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted,marginBottom:6,textTransform:"uppercase"}}>Indicators</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                {[
                  {l:"RSI 14",v:fmt(ind.rsi_14,1),c:ind.rsi_14>70?C.red:ind.rsi_14<30?C.green:C.inkSoft},
                  {l:"ADX",v:fmt(ind.adx,1),c:ind.adx>25?C.amber:C.inkMuted},
                  {l:"Stoch",v:`${fmt(ind.stoch.k,1)} ${ind.stoch.state}`,c:ind.stoch.state.includes("overbought")?C.red:ind.stoch.state.includes("oversold")?C.green:C.inkSoft},
                  {l:"OBV",v:ind.obv_trend,c:ind.obv_trend==="rising"?C.green:ind.obv_trend==="falling"?C.red:C.inkMuted},
                  {l:"CMF",v:fmt(ind.cmf,3),c:ind.cmf>0?C.green:C.red},
                  {l:"MACD H",v:fmt(ind.macd.histogram,3),c:ind.macd.histogram>0?C.green:C.red},
                  {l:"BB %B",v:fmt(ind.bb.percent_b,3)+(ind.bb.squeeze?" 🗜":""),c:ind.bb.percent_b>0.8?C.red:ind.bb.percent_b<0.2?C.green:C.inkSoft},
                  {l:"ATR 14",v:fmt(ind.atr_14),c:C.inkSoft},
                ].map(row=>(
                  <div key={row.l} style={{display:"flex",justifyContent:"space-between",padding:"4px 7px",borderRadius:5,background:"rgba(0,0,0,0.2)"}}>
                    <span style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted}}>{row.l}</span>
                    <span style={{fontFamily:C.mono,fontSize:9,fontWeight:700,color:row.c}}>{row.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {mtfa&&(
            <div>
              <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted,marginBottom:6,textTransform:"uppercase"}}>Multi-TF</div>
              {(["1D","4H","1H"] as const).map(tf=>{const t=mtfa[tf];if(!t)return null;return(
                <div key={tf} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted,width:24}}>{tf}</span>
                  <Tag color={biasColor(t.bias)}>{t.bias.toUpperCase()}</Tag>
                  <span style={{fontFamily:C.mono,fontSize:9,color:C.inkSoft,flex:1,marginLeft:7,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.structure}</span>
                </div>
              );})}
              {mtfa.htf_overrides_ltf&&<div style={{fontFamily:C.mono,fontSize:9,color:C.amber,marginTop:3}}>⚠ HTF overrides LTF</div>}
            </div>
          )}
          {sm&&(
            <div>
              <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted,marginBottom:5,textTransform:"uppercase"}}>Smart Money</div>
              {sm.bos&&<div style={{marginBottom:5}}><Tag color={sm.bos.direction==="bullish"?C.green:C.red}>{sm.bos.type} {sm.bos.direction.toUpperCase()} @ ${fmt(sm.bos.level)}</Tag></div>}
              {sm.order_blocks.map((ob:any,i:number)=>(
                <div key={i} style={{fontFamily:C.mono,fontSize:9,color:C.inkSoft,marginBottom:2}}>{ob.type==="bullish"?"🟢":"🔴"} {ob.type} OB {ob.timeframe}: ${fmt(ob.price_low)}–${fmt(ob.price_high)}</div>
              ))}
              <div style={{fontFamily:C.mono,fontSize:9,color:C.inkMuted,marginTop:3}}>{sm.fvgs.length} FVGs · {sm.liquidity_sweeps.length} sweeps</div>
            </div>
          )}
          {wyckoff&&(
            <div style={{padding:"8px 10px",borderRadius:8,background:`${C.purple}08`,border:`1px solid ${C.purple}20`}}>
              <div style={{fontFamily:C.mono,fontSize:8,color:C.inkMuted,marginBottom:3,textTransform:"uppercase"}}>Wyckoff</div>
              <div style={{display:"flex",gap:5,marginBottom:3}}>
                <Tag color={C.purple}>Phase {wyckoff.phase}</Tag>
                <Tag color={wyckoff.spring_confirmed?C.green:C.inkMuted}>{wyckoff.spring_confirmed?"Spring ✓":"No Spring"}</Tag>
                {wyckoff.utad_risk&&<Tag color={C.red}>UTAD Risk</Tag>}
              </div>
              <div style={{fontFamily:C.mono,fontSize:9,color:C.inkSoft}}>{wyckoff.summary}</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function TradingDashboard() {
  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}button,select{outline:none}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:2px}`}</style>
      <div style={{padding:"20px 24px",background:C.bg,minHeight:"100%",display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <h1 style={{fontFamily:C.mono,fontSize:17,fontWeight:800,color:C.ink,margin:0,letterSpacing:"-0.02em"}}>Trading <span style={{color:C.cyan}}>Dashboard</span></h1>
            <p style={{fontFamily:C.mono,fontSize:10,color:C.inkMuted,margin:"3px 0 0"}}>Two-tier chart analysis · Intelligence scanner · Order blocks · Agent loop</p>
          </div>
          <Tag color={C.green}>● Live</Tag>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:14}}>
          <WalletPanel/><AgentRunsPanel/>
        </div>
        <IntelligencePanel/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
          <ChartAnalysisPanel/><OrderBlocksPanel/><PrimitivesPanel/>
        </div>
      </div>
    </>
  );
}
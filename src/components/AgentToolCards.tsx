"use client";

/**
 * AgentToolCards.tsx
 *
 * Adaptive inline cards rendered inside AgentChat when the agent
 * dispatches a backend tool call. Each card is self-contained,
 * matches the existing chat design system, and accepts the raw
 * API response shape directly.
 *
 * Usage in AgentChat:
 *   if (msg.toolResult) return <AgentToolCard result={msg.toolResult} accentColor={mood.accent} />
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, ArrowRight, Layers, Brain, BarChart3, Eye, Activity } from "lucide-react";

// ── Shared design tokens (mirror AgentChat mood system) ───────────────────────
const D = {
  surface:  "rgb(8,18,32)",
  border:   "rgba(255,255,255,0.07)",
  inkSoft:  "rgba(255,255,255,0.65)",
  inkMuted: "rgba(255,255,255,0.35)",
  mono:     "var(--font-mono,'JetBrains Mono',monospace)",
  display:  "var(--font-display,'Inter',sans-serif)",
  green:    "#00e5a0",
  red:      "#ff5572",
  amber:    "#ffb020",
  purple:   "#a78bfa",
  cyan:     "#00d4ff",
};

// ── Shared micro-components ────────────────────────────────────────────────────
function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 10, fontFamily: D.mono, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}30` }}>
      {children}
    </span>
  );
}
function Row({ label, value, color = D.inkSoft }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${D.border}` }}>
      <span style={{ fontFamily: D.mono, fontSize: 10, color: D.inkMuted }}>{label}</span>
      <span style={{ fontFamily: D.mono, fontSize: 11, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
function Bar({ value, color = D.cyan }: { value: number; color?: string }) {
  return (
    <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, value))}%`, background: color, borderRadius: 2 }} />
    </div>
  );
}
function fmt(n: number, dec = 2) { return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function biasColor(b: string) { if (b==="long"||b==="bullish") return D.green; if (b==="short"||b==="bearish") return D.red; return D.inkSoft; }
function cascadeColor(s: string) { if (s==="window_open") return D.amber; if (s==="reacting_now") return D.green; if (s==="leading") return D.purple; return D.inkMuted; }

function CardShell({ icon, title, accent, children }: { icon: React.ReactNode; title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${accent}30`, background: D.surface, maxWidth: 540, width: "100%" }}>
      <div style={{ padding: "10px 14px", background: `${accent}0d`, borderBottom: `1px solid ${accent}20`, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: accent, display: "flex" }}>{icon}</span>
        <span style={{ fontFamily: D.mono, fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</span>
      </div>
      <div style={{ padding: "12px 14px" }}>{children}</div>
    </div>
  );
}

// ── Tool result types ──────────────────────────────────────────────────────────
export type ToolResultType =
  | "chart_analyze"
  | "chart_history"
  | "chart_primitives"
  | "intelligence_scan"
  | "intelligence_coin"
  | "orderblocks_active"
  | "orderblocks_sync"
  | "agent_runs"
  | "agent_config";

export interface ToolResult {
  type: ToolResultType;
  symbol?: string;
  data: any;
}

// ── 1. Chart Analysis Card ─────────────────────────────────────────────────────
function ChartAnalysisCard({ data, symbol }: { data: any; symbol?: string }) {
  const [expanded, setExpanded] = useState(false);
  const a = data?.analysis ?? data;
  const risk = data?.risk;
  if (!a?.bias) return null;
  const accent = biasColor(a.bias);

  return (
    <CardShell icon={<BarChart3 size={13}/>} title={`Chart Analysis · ${symbol ?? a.symbol ?? ""}`} accent={accent}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <Chip color={accent}>{a.bias==="long"?"↑ LONG":a.bias==="short"?"↓ SHORT":"— NEUTRAL"}</Chip>
        <Chip color={D.inkMuted}>{(a.regime??"").replace(/_/g," ").toUpperCase()}</Chip>
        <Chip color={D.purple}>{a.primary_framework}</Chip>
        <Chip color={a.confidence>=70?D.green:a.confidence>=50?D.amber:D.red}>{a.confidence}% conf</Chip>
        {risk&&<Chip color={risk.approved?D.green:D.red}>{risk.approved?"✓ RISK OK":"✗ RISK REJECTED"}</Chip>}
      </div>

      <div style={{ fontFamily: D.mono, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.88)", marginBottom: 10 }}>{a.setup_name}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
        {[
          { l: "Entry Zone", v: `$${fmt(a.entry_zone?.low)} – $${fmt(a.entry_zone?.high)}`, c: D.cyan },
          { l: "Stop Loss",  v: `$${fmt(a.stop_loss)}`, c: D.red },
          { l: "R:R",        v: `${a.risk_reward}:1`,   c: a.risk_reward>=2?D.green:D.amber },
        ].map(item => (
          <div key={item.l} style={{ padding: "8px 10px", borderRadius: 8, background: `${item.c}0a`, border: `1px solid ${item.c}20` }}>
            <div style={{ fontFamily: D.mono, fontSize: 9, color: D.inkMuted, marginBottom: 3, textTransform: "uppercase" }}>{item.l}</div>
            <div style={{ fontFamily: D.mono, fontSize: 11, fontWeight: 700, color: item.c }}>{item.v}</div>
          </div>
        ))}
      </div>

      {a.take_profit_levels?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: D.mono, fontSize: 9, color: D.inkMuted, marginBottom: 5, textTransform: "uppercase" }}>Take Profits</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {a.take_profit_levels.map((tp: number, i: number) => (
              <span key={i} style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontFamily: D.mono, fontWeight: 600, background: `${D.green}10`, border: `1px solid ${D.green}25`, color: D.green }}>TP{i+1} ${fmt(tp)}</span>
            ))}
          </div>
        </div>
      )}

      {a.confluence_factors?.length > 0 && (
        <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.25)", border: `1px solid ${D.border}` }}>
          <div style={{ fontFamily: D.mono, fontSize: 9, color: D.inkMuted, marginBottom: 5, textTransform: "uppercase" }}>Confluence ({a.confluence_score})</div>
          {a.confluence_factors.map((f: string, i: number) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3 }}>
              <span style={{ color: D.cyan }}>·</span>
              <span style={{ fontFamily: D.mono, fontSize: 10, color: D.inkSoft }}>{f}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: "6px 10px", borderRadius: 8, background: `${D.red}08`, border: `1px solid ${D.red}20`, fontFamily: D.mono, fontSize: 10, color: D.red, marginBottom: 10 }}>
        ⚠ {a.invalidation}
      </div>

      {a.reasoning && (
        <div>
          <button onClick={() => setExpanded(!expanded)} style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", cursor: "pointer", fontFamily: D.mono, fontSize: 10, color: D.inkMuted, padding: 0, marginBottom: expanded ? 6 : 0 }}>
            {expanded ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}{expanded ? "Hide" : "Show"} reasoning
          </button>
          {expanded && (
            <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.2)", border: `1px solid ${D.border}`, fontFamily: D.mono, fontSize: 10, color: D.inkSoft, lineHeight: 1.7 }}>
              {a.reasoning}
            </div>
          )}
        </div>
      )}

      {data?.primitives_meta && (
        <div style={{ marginTop: 8, fontFamily: D.mono, fontSize: 9, color: D.inkMuted }}>
          Timeframes: {data.primitives_meta.timeframes_analyzed?.join(", ")} · ~{data.primitives_meta.token_count_estimate} tokens
        </div>
      )}
    </CardShell>
  );
}

// ── 2. Intelligence Scan Card ──────────────────────────────────────────────────
function IntelligenceScanCard({ data }: { data: any }) {
  const [selected, setSelected] = useState<any>(null);
  const [tab, setTab] = useState<"top"|"all">("top");
  if (!data?.btc_context) return null;

  const btc = data.btc_context;
  const accent = biasColor(btc.bias);
  const coins = tab === "top" ? (data.top_opportunities ?? []) : (data.coins ?? []);

  return (
    <CardShell icon={<Brain size={13}/>} title="Intelligence Scan" accent={accent}>
      {/* BTC context strip */}
      <div style={{ display: "flex", gap: 12, padding: "8px 10px", borderRadius: 8, marginBottom: 10, background: "rgba(0,0,0,0.3)", border: `1px solid ${D.border}`, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: D.mono, fontSize: 8, color: D.inkMuted, marginBottom: 2, textTransform: "uppercase" }}>BTC</div>
          <Chip color={accent}>{btc.bias==="long"?"↑ LONG":btc.bias==="short"?"↓ SHORT":"NEUTRAL"}</Chip>
        </div>
        <div>
          <div style={{ fontFamily: D.mono, fontSize: 8, color: D.inkMuted, marginBottom: 2, textTransform: "uppercase" }}>Signal</div>
          <span style={{ fontFamily: D.mono, fontSize: 10, color: "rgba(255,255,255,0.75)" }}>{btc.signal_type}</span>
        </div>
        <div>
          <div style={{ fontFamily: D.mono, fontSize: 8, color: D.inkMuted, marginBottom: 2, textTransform: "uppercase" }}>Phase</div>
          <Chip color={D.amber}>{(data.market_phase??"").replace(/_/g," ").toUpperCase()}</Chip>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontFamily: D.mono, fontSize: 8, color: D.inkMuted, marginBottom: 2 }}>WINDOWS</div>
          <span style={{ fontFamily: D.mono, fontSize: 14, fontWeight: 700, color: D.amber }}>{data.windows_open}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 1, marginBottom: 8, borderBottom: `1px solid ${D.border}` }}>
        {[{k:"top",l:"Top Opps"},{k:"all",l:`All (${(data.coins??[]).length})`}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as any)} style={{ padding: "4px 12px", border: "none", background: "transparent", cursor: "pointer", fontFamily: D.mono, fontSize: 10, fontWeight: 600, color: tab===t.k?D.cyan:D.inkMuted, borderBottom: tab===t.k?`2px solid ${D.cyan}`:"2px solid transparent", marginBottom: -1, transition: "all 0.15s" }}>{t.l}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {coins.slice(0, 8).map((c: any) => (
          <button key={c.coin} onClick={() => setSelected(selected?.coin===c.coin?null:c)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, cursor: "pointer", background: selected?.coin===c.coin?`${D.cyan}10`:"rgba(0,0,0,0.2)", border: `1px solid ${selected?.coin===c.coin?D.cyan+"40":D.border}`, textAlign: "left" }}>
            <div style={{ width: 40, flexShrink: 0 }}>
              <div style={{ fontFamily: D.mono, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>{c.coin}</div>
              <div style={{ fontFamily: D.mono, fontSize: 9, color: D.inkMuted }}>${fmt(c.current_price, c.current_price<1?4:2)}</div>
            </div>
            <div style={{ width: 44, flexShrink: 0, textAlign: "right" }}>
              <span style={{ fontFamily: D.mono, fontSize: 10, fontWeight: 700, color: c.price_change_24h>=0?D.green:D.red }}>{c.price_change_24h>=0?"+":""}{fmt(c.price_change_24h)}%</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontFamily: D.mono, fontSize: 8, fontWeight: 700, color: cascadeColor(c.cascade?.status) }}>● {(c.cascade?.status??"").replace(/_/g," ").toUpperCase()}</span>
                <span style={{ fontFamily: D.mono, fontSize: 8, color: D.inkMuted }}>{c.cascade?.window_remaining_minutes}m</span>
              </div>
              <Bar value={(c.cascade?.window_remaining_minutes??0)/((c.cascade?.expected_window_hours??1)*60)*100} color={cascadeColor(c.cascade?.status)}/>
            </div>
            <div style={{ width: 44, flexShrink: 0, textAlign: "right" }}>
              <div style={{ fontFamily: D.mono, fontSize: 12, fontWeight: 700, color: D.amber }}>{((c.opportunity_score??0)*100).toFixed(1)}</div>
            </div>
            <Chip color={biasColor(c.analysis?.bias??"")}>{(c.analysis?.bias??"").toUpperCase()}</Chip>
            <ArrowRight size={10} style={{ color: D.inkMuted, flexShrink: 0 }}/>
          </button>
        ))}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.35)", border: `1px solid ${D.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontFamily: D.mono, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>{selected.coin}</span>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: D.inkMuted, cursor: "pointer" }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            <Chip color={biasColor(selected.analysis?.bias??"")}>{selected.analysis?.bias?.toUpperCase()}</Chip>
            <Chip color={cascadeColor(selected.cascade?.status)}>{(selected.cascade?.status??"").replace(/_/g," ")}</Chip>
            <Chip color={selected.analysis?.confidence>=70?D.green:selected.analysis?.confidence>=50?D.amber:D.red}>{selected.analysis?.confidence}%</Chip>
          </div>
          <div style={{ fontFamily: D.mono, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.88)", marginBottom: 8 }}>{selected.analysis?.setup_name}</div>
          {[
            { l: "Entry",       v: `$${fmt(selected.analysis?.entry_zone?.low)} – $${fmt(selected.analysis?.entry_zone?.high)}`, c: D.cyan },
            { l: "Stop Loss",   v: `$${fmt(selected.analysis?.stop_loss)}`,       c: D.red },
            { l: "R:R",         v: `${selected.analysis?.risk_reward}:1`,          c: D.green },
            { l: "Exp. Move",   v: `${selected.cascade?.expected_move_pct}%`,      c: D.amber },
            { l: "Follow Rate", v: `${((selected.cascade?.historical_follow_rate??0)*100).toFixed(0)}%`, c: D.purple },
            { l: "Beta",        v: `${fmt(selected.correlation?.beta_30d)}x`,      c: D.inkSoft },
            { l: "Corr 30d",    v: fmt(selected.correlation?.correlation_30d??0,3), c: D.inkSoft },
          ].map(row => <Row key={row.l} label={row.l} value={row.v} color={row.c}/>)}
          {(selected.confluence_factors??[]).length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontFamily: D.mono, fontSize: 8, color: D.inkMuted, marginBottom: 4, textTransform: "uppercase" }}>Confluence</div>
              {selected.confluence_factors.map((f: string, i: number) => (
                <div key={i} style={{ display: "flex", gap: 5, marginBottom: 2 }}><span style={{ color: D.cyan }}>·</span><span style={{ fontFamily: D.mono, fontSize: 9, color: D.inkSoft }}>{f}</span></div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 8, fontFamily: D.mono, fontSize: 9, color: D.inkMuted }}>
        {data.total_analyzed} coins analyzed · scan {data.scan_id?.slice(0, 8)}
      </div>
    </CardShell>
  );
}

// ── 3. Order Blocks Card ───────────────────────────────────────────────────────
function OrderBlocksCard({ data, symbol }: { data: any; symbol?: string }) {
  const obs: any[] = data?.data ?? (Array.isArray(data) ? data : []);
  const count = data?.count ?? obs.length;
  const syncedAt = data?.synced_at;
  const accent = D.amber;

  return (
    <CardShell icon={<Layers size={13}/>} title={`Order Blocks · ${symbol ?? ""}`} accent={accent}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontFamily: D.mono, fontSize: 11, color: D.inkSoft }}>{count} active block{count!==1?"s":""}</span>
        {syncedAt && <span style={{ fontFamily: D.mono, fontSize: 9, color: D.inkMuted }}>· synced just now</span>}
      </div>
      {obs.length === 0 && <div style={{ fontFamily: D.mono, fontSize: 11, color: D.inkMuted, textAlign: "center", padding: "12px 0" }}>No active order blocks</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {obs.map((ob: any) => {
          const col = ob.type==="bullish"?D.green:D.red;
          return (
            <div key={ob.id ?? ob._id} style={{ padding: "9px 11px", borderRadius: 8, background: `${col}08`, border: `1px solid ${col}25` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <Chip color={col}>{ob.type.toUpperCase()} OB</Chip>
                  <span style={{ fontFamily: D.mono, fontSize: 9, color: D.inkMuted }}>{ob.timeframe}</span>
                </div>
                <span style={{ fontFamily: D.mono, fontSize: 10, color: D.amber }}>Strength {ob.strength}</span>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div>
                  <div style={{ fontFamily: D.mono, fontSize: 8, color: D.inkMuted, marginBottom: 2 }}>RANGE</div>
                  <div style={{ fontFamily: D.mono, fontSize: 12, fontWeight: 700, color: col }}>${fmt(ob.low)} – ${fmt(ob.high)}</div>
                </div>
                {ob.associated_fvg && (
                  <div>
                    <div style={{ fontFamily: D.mono, fontSize: 8, color: D.inkMuted, marginBottom: 2 }}>FVG</div>
                    <div style={{ fontFamily: D.mono, fontSize: 10, color: D.inkSoft }}>${fmt(ob.associated_fvg.low)} – ${fmt(ob.associated_fvg.high)}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

// ── 4. Primitives Card ─────────────────────────────────────────────────────────
function PrimitivesCard({ data, symbol }: { data: any; symbol?: string }) {
  const [section, setSection] = useState<"indicators"|"smart_money"|"wyckoff"|"mtfa">("indicators");
  const d = data?.data ?? data;
  if (!d) return null;
  const ind = d.indicators, sm = d.smart_money, wyckoff = d.wyckoff, mtfa = d.mtfa;
  const accent = D.purple;

  const tabs = [
    { k: "indicators" as const, l: "Indicators" },
    { k: "smart_money" as const, l: "Smart Money" },
    { k: "wyckoff" as const, l: "Wyckoff" },
    { k: "mtfa" as const, l: "MTF" },
  ];

  return (
    <CardShell icon={<Eye size={13}/>} title={`Primitives · ${symbol ?? d.meta?.symbol ?? ""}`} accent={accent}>
      <div style={{ fontFamily: D.mono, fontSize: 9, color: D.inkMuted, marginBottom: 8 }}>
        {d.meta?.timeframes_analyzed?.join(", ")} · ~{d.meta?.token_count_estimate} tokens
      </div>

      <div style={{ display: "flex", gap: 1, marginBottom: 10, borderBottom: `1px solid ${D.border}` }}>
        {tabs.map(t => (
          <button key={t.k} onClick={() => setSection(t.k)} style={{ padding: "4px 10px", border: "none", background: "transparent", cursor: "pointer", fontFamily: D.mono, fontSize: 9, fontWeight: 600, color: section===t.k?accent:D.inkMuted, borderBottom: section===t.k?`2px solid ${accent}`:"2px solid transparent", marginBottom: -1, transition: "all 0.15s" }}>{t.l}</button>
        ))}
      </div>

      {section==="indicators" && ind && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {[
            { l: "RSI 14",   v: fmt(ind.rsi_14,1),        c: ind.rsi_14>70?D.red:ind.rsi_14<30?D.green:D.inkSoft },
            { l: "ADX",      v: fmt(ind.adx,1),            c: ind.adx>25?D.amber:D.inkMuted },
            { l: "Stoch %K", v: `${fmt(ind.stoch?.k,1)} (${ind.stoch?.state})`, c: ind.stoch?.state?.includes("overbought")?D.red:ind.stoch?.state?.includes("oversold")?D.green:D.inkSoft },
            { l: "OBV",      v: ind.obv_trend,             c: ind.obv_trend==="rising"?D.green:ind.obv_trend==="falling"?D.red:D.inkMuted },
            { l: "CMF",      v: fmt(ind.cmf,3),            c: ind.cmf>0?D.green:D.red },
            { l: "MACD H",   v: fmt(ind.macd?.histogram,3),c: (ind.macd?.histogram??0)>0?D.green:D.red },
            { l: "BB %B",    v: fmt(ind.bb?.percent_b,3)+(ind.bb?.squeeze?" 🗜":""), c: (ind.bb?.percent_b??0.5)>0.8?D.red:(ind.bb?.percent_b??0.5)<0.2?D.green:D.inkSoft },
            { l: "Williams R",v: fmt(ind.williams_r,1),    c: ind.williams_r<-80?D.green:ind.williams_r>-20?D.red:D.inkSoft },
          ].map(row => (
            <div key={row.l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 7px", borderRadius: 5, background: "rgba(0,0,0,0.2)" }}>
              <span style={{ fontFamily: D.mono, fontSize: 9, color: D.inkMuted }}>{row.l}</span>
              <span style={{ fontFamily: D.mono, fontSize: 9, fontWeight: 700, color: row.c }}>{row.v}</span>
            </div>
          ))}
        </div>
      )}

      {section==="smart_money" && sm && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {sm.bos && <Chip color={sm.bos.direction==="bullish"?D.green:D.red}>{sm.bos.type} {sm.bos.direction.toUpperCase()} @ ${fmt(sm.bos.level)}</Chip>}
          {sm.order_blocks?.map((ob: any, i: number) => (
            <div key={i} style={{ fontFamily: D.mono, fontSize: 10, color: D.inkSoft }}>{ob.type==="bullish"?"🟢":"🔴"} {ob.type} OB {ob.timeframe}: ${fmt(ob.price_low)} – ${fmt(ob.price_high)} ({ob.status})</div>
          ))}
          {sm.fvgs?.length > 0 && (
            <div>
              <div style={{ fontFamily: D.mono, fontSize: 8, color: D.inkMuted, marginBottom: 4, textTransform: "uppercase" }}>FVGs ({sm.fvgs.length} unfilled)</div>
              {sm.fvgs.slice(0,3).map((f: any, i: number) => (
                <div key={i} style={{ fontFamily: D.mono, fontSize: 9, color: D.inkSoft, marginBottom: 2 }}>{f.type==="bullish"?"↑":"↓"} ${fmt(f.low)} – ${fmt(f.high)}</div>
              ))}
            </div>
          )}
          <div style={{ fontFamily: D.mono, fontSize: 9, color: D.inkMuted }}>Liquidity sweeps: {sm.liquidity_sweeps?.length??0}</div>
        </div>
      )}

      {section==="wyckoff" && wyckoff && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Chip color={accent}>Phase {wyckoff.phase}</Chip>
            <Chip color={wyckoff.spring_confirmed?D.green:D.inkMuted}>{wyckoff.spring_confirmed?"Spring ✓":"No Spring"}</Chip>
            {wyckoff.utad_risk && <Chip color={D.red}>UTAD Risk</Chip>}
          </div>
          <Row label="Range High" value={`$${fmt(wyckoff.range_high)}`} color={D.red}/>
          <Row label="Range Low"  value={`$${fmt(wyckoff.range_low)}`}  color={D.green}/>
          <Row label="Volume"     value={wyckoff.volume_analysis}        color={D.inkSoft}/>
          <div style={{ padding: "7px 9px", borderRadius: 8, background: `${accent}08`, border: `1px solid ${accent}20`, fontFamily: D.mono, fontSize: 10, color: D.inkSoft, lineHeight: 1.6 }}>{wyckoff.summary}</div>
        </div>
      )}

      {section==="mtfa" && mtfa && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(["1D","4H","1H"] as const).map(tf => {
            const t = mtfa[tf]; if (!t) return null;
            return (
              <div key={tf} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: D.mono, fontSize: 9, color: D.inkMuted, width: 24 }}>{tf}</span>
                <Chip color={biasColor(t.bias)}>{t.bias.toUpperCase()}</Chip>
                <span style={{ fontFamily: D.mono, fontSize: 9, color: D.inkSoft, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.structure}</span>
              </div>
            );
          })}
          {mtfa.htf_overrides_ltf && <div style={{ fontFamily: D.mono, fontSize: 9, color: D.amber, marginTop: 2 }}>⚠ HTF overrides LTF — {mtfa.confluence_note}</div>}
          <div style={{ marginTop: 2 }}><Chip color={biasColor(mtfa.overall_bias)}>Overall: {(mtfa.overall_bias??"").toUpperCase()}</Chip></div>
        </div>
      )}
    </CardShell>
  );
}

// ── 5. Agent Runs Card ─────────────────────────────────────────────────────────
function AgentRunsCard({ data }: { data: any }) {
  const [expanded, setExpanded] = useState<string|null>(null);
  const runs: any[] = data?.runs ?? (Array.isArray(data) ? data : []);
  const accent = D.amber;

  return (
    <CardShell icon={<Activity size={13}/>} title={`Agent Runs · ${data?.total ?? runs.length} total`} accent={accent}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {runs.slice(0,5).map((run: any) => {
          const isOpen = expanded === run.runId;
          const intentColor = (t: string) => t==="swap"?D.green:t==="set_alert"?D.cyan:t==="no_action"?D.inkMuted:D.amber;
          return (
            <div key={run.runId} style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${D.border}` }}>
              <button onClick={() => setExpanded(isOpen?null:run.runId)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", background: isOpen?"rgba(0,0,0,0.3)":"rgba(0,0,0,0.15)", border: "none", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: run.status==="completed"?D.green:run.status==="failed"?D.red:D.amber }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    <span style={{ fontFamily: D.mono, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.88)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{run.runId}</span>
                    {run.decision && <Chip color={intentColor(run.decision.intent.type)}>{run.decision.intent.type.replace(/_/g," ")}</Chip>}
                  </div>
                  <div style={{ fontFamily: D.mono, fontSize: 9, color: D.inkMuted }}>{run.strategy}{run.decision?` · ${run.decision.confidence}% conf`:""}</div>
                </div>
                {isOpen?<ChevronUp size={10} style={{color:D.inkMuted}}/>:<ChevronDown size={10} style={{color:D.inkMuted}}/>}
              </button>
              {isOpen && run.decision && (
                <div style={{ padding: "7px 10px", background: "rgba(0,0,0,0.25)", borderTop: `1px solid ${D.border}` }}>
                  <div style={{ fontFamily: D.mono, fontSize: 10, color: D.inkSoft, lineHeight: 1.6, marginBottom: 6 }}>{run.decision.intent.rationale ?? run.decision.reasoning}</div>
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {run.decision.toolCallTrace?.map((t: string, i: number) => (
                      <span key={i} style={{ padding: "1px 5px", borderRadius: 4, fontSize: 8, fontFamily: D.mono, background: "rgba(255,255,255,0.04)", border: `1px solid ${D.border}`, color: D.inkMuted }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

// ── Main dispatcher ────────────────────────────────────────────────────────────
export function AgentToolCard({ result, accentColor }: { result: ToolResult; accentColor?: string }) {
  const { type, data, symbol } = result;

  switch (type) {
    case "chart_analyze":
      return <ChartAnalysisCard data={data} symbol={symbol}/>;
    case "intelligence_scan":
      return <IntelligenceScanCard data={data}/>;
    case "intelligence_coin":
      return <IntelligenceScanCard data={{ coins: [data], top_opportunities: [data], btc_context: data.btc_context ?? { bias: "neutral", signal_type: "—", regime: "ranging", dominance: { btc_dominance: 52, btc_d_trend: "neutral", market_phase: "mixed" }, minutes_since_signal: 0 }, market_phase: "mixed", total_analyzed: 1, windows_open: data.cascade?.status==="window_open"?1:0, scan_id: "—" }}/>;
    case "orderblocks_active":
    case "orderblocks_sync":
      return <OrderBlocksCard data={data} symbol={symbol}/>;
    case "chart_primitives":
      return <PrimitivesCard data={data} symbol={symbol}/>;
    case "agent_runs":
      return <AgentRunsCard data={data}/>;
    default:
      return null;
  }
}

// ── Hook: parse agent message for tool dispatch intent ─────────────────────────
/**
 * Call this inside AgentChat to detect when the agent wants to
 * invoke a backend tool based on its text response.
 *
 * The agent backend should include a JSON block in its response:
 *   <!--TOOL:{"type":"chart_analyze","symbol":"BTCUSDT"}-->
 *
 * Or the frontend can do keyword matching as a fallback.
 */
export function parseToolIntent(content: string): { type: ToolResultType; symbol?: string } | null {
  // 1. Structured signal from backend
  const match = content.match(/<!--TOOL:(\{.*?\})-->/);
  if (match) {
    try { return JSON.parse(match[1]); } catch {}
  }

  // 2. Keyword fallback — covers natural language requests
  const lower = content.toLowerCase();
  const symbolMatch = content.match(/\b(BTC|ETH|SOL|BNB|AVAX|SOL|ARB|OP|AAVE|WIF|TAO)USDT?\b/i);
  const symbol = symbolMatch ? symbolMatch[1].toUpperCase() + "USDT" : undefined;

  if (/\b(analyz|analyse|chart analysis|run analysis|check.*chart)\b/.test(lower))
    return { type: "chart_analyze", symbol: symbol ?? "BTCUSDT" };

  if (/\b(intelligence.*scan|scan.*market|cascade|windows? open|opportunity score)\b/.test(lower))
    return { type: "intelligence_scan" };

  if (/\b(order block|orderblock|ob\b.*active|active.*ob)\b/.test(lower))
    return { type: "orderblocks_active", symbol: symbol ?? "BTCUSDT" };

  if (/\b(primitive|tier.?1|indicator|wyckoff|smart money|multi.?timeframe|mtf|rsi|macd|adx)\b/.test(lower))
    return { type: "chart_primitives", symbol: symbol ?? "BTCUSDT" };

  if (/\b(agent run|run.*history|what.*agent.*do|last.*run)\b/.test(lower))
    return { type: "agent_runs" };

  return null;
}
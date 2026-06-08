"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { AlertCard } from "@/components/AlertCard";
import { useAlerts, useCreateAlert, useDeleteAlert, useToggleAlert } from "@/controllers/useAlerts";
import { useCoinList } from "@/controllers/useCoinList";
import type { AlertCondition } from "@/models/alert.model";

const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)", outline: "none", transition: "all 0.2s" };

function AlertsInner() {
  const { data: alerts, isLoading } = useAlerts();
  const { data: coins } = useCoinList();
  const create = useCreateAlert();
  const toggle = useToggleAlert();
  const del    = useDeleteAlert();

  const [coinId,    setCoinId]    = useState("bitcoin");
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [threshold, setThreshold] = useState("");

  const list      = alerts ?? [];
  const active    = list.filter(a => a.active).length;
  const triggered = list.filter(a => a.triggered).length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({ coinId, condition, threshold: Number(threshold) });
    setThreshold("");
  };

  const condBtn = (c: AlertCondition, label: string) => (
    <button
      key={c}
      type="button"
      onClick={() => setCondition(c)}
      style={{
        padding: "8px 14px", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 10,
        textTransform: "uppercase", letterSpacing: "0.12em", cursor: "pointer", transition: "all 0.15s",
        background: condition === c ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${condition === c ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.07)"}`,
        color: condition === c ? "var(--cyan)" : "var(--ink-muted)",
      }}
    >{label}</button>
  );

  return (
    <div style={{ padding: 20, maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* title */}
      <div className="fade-up fade-up-1">
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Alerts</h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>Get notified when the market crosses your price levels</p>
      </div>

      {/* stats */}
      <div className="fade-up fade-up-2" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <StatCard label="Active"    value={active}      accent="up" />
        <StatCard label="Triggered" value={triggered}   accent="warn" />
        <StatCard label="Total"     value={list.length} />
      </div>

      {/* create form */}
      <div className="fade-up fade-up-3 rounded-xl overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(10,20,34,0.94), rgba(5,12,22,0.98))", border: "1px solid rgba(0,212,255,0.1)", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(0,212,255,0.08)", background: "rgba(0,212,255,0.04)", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 2, height: 14, borderRadius: 1, background: "var(--cyan)", boxShadow: "0 0 8px var(--cyan)" }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--cyan)" }}>New Alert</span>
        </div>
        <form onSubmit={submit} style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
          {/* asset */}
          <div style={{ flex: "1 1 140px" }}>
            <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--ink-muted)" }}>Asset</label>
            <select value={coinId} onChange={e => setCoinId(e.target.value)} style={inputStyle}
              onFocus={e => e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)"}
              onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
            >
              {(coins ?? []).map(c => <option key={c.id} value={c.id}>{c.symbol} — {c.id}</option>)}
            </select>
          </div>
          {/* condition */}
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--ink-muted)" }}>Condition</label>
            <div style={{ display: "flex", gap: 4 }}>
              {condBtn("above", "Above")} {condBtn("below", "Below")} {condBtn("pct_change", "±%")}
            </div>
          </div>
          {/* threshold */}
          <div style={{ flex: "1 1 120px" }}>
            <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--ink-muted)" }}>
              {condition === "pct_change" ? "Percent" : "Threshold ($)"}
            </label>
            <input type="number" step="any" value={threshold} required onChange={e => setThreshold(e.target.value)} placeholder="0.00" style={inputStyle}
              onFocus={e => e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)"}
              onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
            />
          </div>
          {/* submit */}
          <button
            type="submit" disabled={create.isPending}
            className="btn-shiny"
            style={{ padding: "10px 20px", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--up)", background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.22)", cursor: "pointer", opacity: create.isPending ? 0.5 : 1, transition: "all 0.2s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(0,229,160,0.2)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >
            {create.isPending ? "…" : "Arm Alert"}
          </button>
        </form>
      </div>

      {/* list */}
      <div className="fade-up fade-up-4" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12 }} />)
          : list.length
          ? list.map(a => (
              <AlertCard
                key={a.id} alert={a}
                coin={coins?.find(c => c.id === a.coinId)}
                onToggle={(id, active) => toggle.mutate({ id, active })}
                onDelete={id => del.mutate(id)}
                busy={toggle.isPending || del.isPending}
              />
            ))
          : (
            <div style={{ textAlign: "center", padding: "40px 20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)" }}>
              No alerts armed. Create one above to start monitoring.
            </div>
          )
        }
      </div>
    </div>
  );
}

export default function AlertsView() {
  return <ProtectedRoute><AlertsInner /></ProtectedRoute>;
}
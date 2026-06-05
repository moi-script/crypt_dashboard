"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { AlertCard } from "@/components/AlertCard";
import {
  useAlerts,
  useCreateAlert,
  useDeleteAlert,
  useToggleAlert,
} from "@/controllers/useAlerts";
import { useCoinList } from "@/controllers/useCoinList";
import { clsx } from "@/lib/format";
import type { AlertCondition } from "@/models/alert.model";

function AlertsInner() {
  const { data: alerts, isLoading } = useAlerts();
  const { data: coins } = useCoinList();
  const create = useCreateAlert();
  const toggle = useToggleAlert();
  const del = useDeleteAlert();

  const [coinId, setCoinId] = useState("bitcoin");
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [threshold, setThreshold] = useState("");

  const list = alerts ?? [];
  const active = list.filter((a) => a.active).length;
  const triggered = list.filter((a) => a.triggered).length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({ coinId, condition, threshold: Number(threshold) });
    setThreshold("");
  };

  return (
    <div className="mx-auto max-w-[1000px] p-4 md:p-6">
      <div className="mb-5">
        <h1 className="font-mono text-2xl font-bold tracking-tight text-ink">Alerts</h1>
        <p className="mt-0.5 text-sm text-muted">Get notified when the market crosses your levels</p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="Active" value={active} accent="up" />
        <StatCard label="Triggered" value={triggered} accent="warn" />
        <StatCard label="Total" value={list.length} />
      </div>

      {/* Create */}
      <Panel className="mb-5" title="New Alert" ticks>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted">Asset</label>
            <select
              value={coinId}
              onChange={(e) => setCoinId(e.target.value)}
              className="w-full border border-line bg-void px-3 py-2 font-mono text-sm text-ink outline-none focus:border-up/50"
            >
              {(coins ?? []).map((c) => (
                <option key={c.id} value={c.id} className="bg-panel">
                  {c.symbol} — {c.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted">Condition</label>
            <div className="flex">
              {(["above", "below", "pct_change"] as AlertCondition[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={clsx(
                    "border px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors",
                    condition === c ? "border-up/40 bg-up/10 text-up" : "border-line text-muted hover:text-ink",
                  )}
                >
                  {c === "pct_change" ? "±%" : c}
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-[120px] flex-1">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted">
              {condition === "pct_change" ? "Percent" : "Threshold ($)"}
            </label>
            <input
              type="number" step="any" value={threshold} required
              onChange={(e) => setThreshold(e.target.value)} placeholder="0.00"
              className="w-full border border-line bg-void px-3 py-2 font-mono text-sm text-ink outline-none focus:border-up/50"
            />
          </div>
          <button
            type="submit"
            disabled={create.isPending}
            className="border border-up/40 bg-up/10 px-4 py-2 font-mono text-xs uppercase tracking-wider text-up transition-colors hover:bg-up/20 disabled:opacity-40"
          >
            {create.isPending ? "…" : "Arm"}
          </button>
        </form>
      </Panel>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16" />)
        ) : list.length ? (
          list.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              coin={coins?.find((c) => c.id === a.coinId)}
              onToggle={(id, activeNext) => toggle.mutate({ id, active: activeNext })}
              onDelete={(id) => del.mutate(id)}
              busy={toggle.isPending || del.isPending}
            />
          ))
        ) : (
          <Panel ticks>
            <p className="px-4 py-10 text-center font-mono text-xs text-muted">
              No alerts armed. Create one above to start monitoring.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}

export default function AlertsView() {
  return (
    <ProtectedRoute>
      <AlertsInner />
    </ProtectedRoute>
  );
}

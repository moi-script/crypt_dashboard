# Unified Agent Run — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the "Run Analysis" and "Run One Tick" triggers into a single "⚡ Run Agent" button whose primary output is the 4-framework technical chart grid (candlestick + overlays), loaded on mount from the last run.

**Architecture:** All changes are inside the `RunsTab` function in `src/components/AgentChat/ChatDashboard.tsx`. Add a `latestRun` state populated on mount via `coinAnalysisService.getLatest()`. Compute `displayRun = activeRun ?? latestRun` to drive the chart grid. Restructure JSX so the chart grid appears immediately below the control bar; remove `▶ Run One Tick`; rename the trigger button.

**Tech Stack:** React (useState, useCallback, useRef), TypeScript, existing `coinAnalysisService` from `@/services/agent.service.frontend`.

## Global Constraints

- No backend changes — frontend only
- No new files, no new components
- Only file modified: `src/components/AgentChat/ChatDashboard.tsx`
- Do not change `ProposalsTab`, `MiniChart`, `AgentChart`, `ChartModal`, or approve/reject logic
- `coinAnalysisService.getLatest()` can 404 when no run exists — always `.catch(() => null)`

---

### Task 1: Add `latestRun` state and load it on mount

**Files:**
- Modify: `src/components/AgentChat/ChatDashboard.tsx` — `RunsTab` function, state block + `load()` callback

**Interfaces:**
- Consumes: `coinAnalysisService.getLatest()` → `Promise<CoinAnalysisRun>` (already imported)
- Produces: `latestRun: CoinAnalysisRun | null` state, `displayRun: CoinAnalysisRun | null` computed value — used by Task 2

- [ ] **Step 1: Add `latestRun` state**

In `RunsTab`, directly after the `const [agentEnabled, setAgentEnabled]` line, add:

```tsx
const [latestRun, setLatestRun] = useState<CoinAnalysisRun | null>(null);
```

- [ ] **Step 2: Add `getLatest()` to `load()`**

Replace the existing `load` callback with this version (adds a 5th entry to `Promise.all` and stores the result):

```tsx
const load = useCallback(async () => {
  setLoading(true);
  try {
    const [r, s, a, cfg, latest] = await Promise.all([
      apiClient.get<{ runs: AgentRun[]; total: number }>("/agent-runs?limit=20"),
      apiClient.get<AgentRunStats>("/agent-runs/stats"),
      fetchApprovals(),
      apiClient.get<{ config: AgentConfig }>("/agent-runs/config"),
      coinAnalysisService.getLatest().catch(() => null),
    ]);
    setRuns(r.runs ?? []);
    setStats(s);
    setApprovals(a);
    if (cfg.config.selectedCoin) setSelectedCoin(cfg.config.selectedCoin);
    else if (cfg.config.watchlist?.[0]) setSelectedCoin(cfg.config.watchlist[0]);
    setAgentEnabled(cfg.config.enabled);
    if (latest) setLatestRun(latest);
  } catch { /* ignore */ } finally { setLoading(false); }
}, []);
```

- [ ] **Step 3: Add `displayRun` computed value**

Directly after the `pollRef` declaration and before `const stopPoll`, add:

```tsx
const displayRun = activeRun ?? latestRun;
```

- [ ] **Step 4: Replace all `activeRun` references inside the chart section with `displayRun`**

The chart section starts with `{(triggering || activeRun) && (` and ends before the stats grid. Apply these replacements **only within that block**:

```tsx
// Line: {(triggering || activeRun) && (
{(triggering || displayRun) && (

// Line: {activeRun && (
{displayRun && (

// Line: activeRun.symbol
displayRun.symbol

// Line: activeRun.status.replace(...)  (status badge)
displayRun.status.replace(...)

// Line: activeRun.status === "pending_approval"
displayRun.status === "pending_approval"

// Line: activeRun.autoMode (in pending approval banner)
displayRun.autoMode

// Line: triggering && !activeRun?.strategyCards.length
triggering && !displayRun?.strategyCards.length

// Line: triggering && (!activeRun || activeRun.status === "running")
triggering && (!displayRun || displayRun.status === "running")

// Line: {activeRun && activeRun.status === "pending_approval" && !activeRun.autoMode
{displayRun && displayRun.status === "pending_approval" && !displayRun.autoMode

// Line: {activeRun && activeRun.strategyCards.length > 0 && (   [cards grid]
{displayRun && displayRun.strategyCards.length > 0 && (

// Line: activeRun.strategyCards.map(card => (
displayRun.strategyCards.map(card => (

// Line: runId={activeRun.coinAnalysisRunId}
runId={displayRun.coinAnalysisRunId}

// Line: autoMode={activeRun.autoMode}
autoMode={displayRun.autoMode}

// Line: {activeRun && activeRun.strategyCards.length > 0 && (   [footer meta]
{displayRun && displayRun.strategyCards.length > 0 && (

// Line: activeRun.coinAnalysisRunId.slice(0, 12)
displayRun.coinAnalysisRunId.slice(0, 12)

// Line: activeRun.newsArticlesUsed.length
displayRun.newsArticlesUsed.length

// Line: activeRun.completedAt
displayRun.completedAt
```

- [ ] **Step 5: Verify TypeScript compiles**

```powershell
cd C:\crypto_dashboard\my-app
npx tsc --noEmit
```

Expected: no errors related to `RunsTab`. If `displayRun` type errors appear, ensure `CoinAnalysisRun | null` is consistent — `displayRun?.x` for optional access.

- [ ] **Step 6: Commit**

```powershell
git add src/components/AgentChat/ChatDashboard.tsx
git commit -m "feat(agent): load latest run on mount, add displayRun fallback"
```

---

### Task 2: Rename button, remove dead button, remove parallel-label

**Files:**
- Modify: `src/components/AgentChat/ChatDashboard.tsx` — `RunsTab` JSX only

**Interfaces:**
- Consumes: `displayRun` from Task 1
- Produces: cleaned-up control bar, removed `▶ Run One Tick` button

- [ ] **Step 1: Rename `⚡ Run Analysis` → `⚡ Run Agent`**

In the control bar block, find the trigger button (it has `onClick={trigger}` and renders `"⚡ Run Analysis"`). Change its label:

```tsx
// Before:
{triggering ? "⏳ Running…" : "⚡ Run Analysis"}

// After:
{triggering ? "⏳ Running…" : "⚡ Run Agent"}
```

- [ ] **Step 2: Remove the "Runs in parallel" label from the control bar**

Delete this entire block from the control bar `<div>`:

```tsx
{/* Parallel strategies label */}
<div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.25)" }}>Runs in parallel:</span>
  {(["SmartMoney", "Wyckoff", "ElliottWave", "Harmonic"] as const).map(fw => (
    <span key={fw} style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: FW_COLOR[fw], background: FW_COLOR[fw] + "12", padding: "2px 6px", borderRadius: 4 }}>{fw}</span>
  ))}
</div>
```

- [ ] **Step 3: Remove the `▶ Run One Tick` button**

Find and delete this entire block (it appears after the pending approvals section, before the run list):

```tsx
{/* Trigger button */}
<button
  onClick={trigger}
  disabled={triggering || loading}
  style={{
    width: "100%", padding: "10px 0", borderRadius: 10,
    fontSize: 13, fontWeight: 700, fontFamily: "var(--font-display,sans-serif)",
    color: triggering ? "rgba(255,255,255,0.3)" : "#020609",
    background: triggering ? "rgb(12,24,42)" : accentColor,
    border: "none", cursor: triggering ? "not-allowed" : "pointer",
    opacity: triggering ? 0.6 : 1, transition: "all 0.2s ease",
  }}
>
  {triggering ? "Running…" : "▶  Run One Tick"}
</button>
```

- [ ] **Step 4: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual verification — start dev server**

```powershell
npm run dev
```

Open the Agent tab → Agent sub-view → Runs tab. Verify:
1. On first load with existing runs: chart cards appear immediately (loaded from last run)
2. On first load with no runs: empty state message shows
3. Button label reads "⚡ Run Agent"
4. No "Runs in parallel: SmartMoney Wyckoff…" label visible
5. No "▶ Run One Tick" button visible
6. Clicking "⚡ Run Agent" → skeleton cards → chart cards appear with candlesticks + overlays
7. Chart cards show MiniChart with trendlines, entry zone, SL/TP price lines
8. Run history list still appears below the chart grid
9. Stats grid (Total / Done / 24h…) still visible below charts

- [ ] **Step 6: Commit**

```powershell
git add src/components/AgentChat/ChatDashboard.tsx
git commit -m "feat(agent): unify Run Agent button, charts as primary loop output"
```

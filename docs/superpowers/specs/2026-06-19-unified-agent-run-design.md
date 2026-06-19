# Unified Agent Run — Design Spec
Date: 2026-06-19

## Problem
The Agent tab (Runs section) has two disconnected triggers:
- `⚡ Run Analysis` → calls `coinAnalysisService.trigger()` → produces 4-framework chart cards
- `▶ Run One Tick` → calls the full agent loop tick → produces a Decision with no chart output

This creates confusion about which button to use and buries the chart output (the most meaningful visual result) among unrelated UI.

## Goal
One unified `⚡ Run Agent` button. The 4-framework technical chart cards (candlestick + trendlines + overlays) become the primary visual output of every agent run. The user approves or rejects each chart's trade proposal directly. No separate agent decision step.

---

## Scope
Frontend only — `src/components/AgentChat/ChatDashboard.tsx`, `RunsTab` component.  
No backend changes. No new components.

---

## Layout (top → bottom inside RunsTab)

```
┌─────────────────────────────────────────────────┐
│  CONTROL BAR                                     │
│  [BTC] [ETH] [SOL] [BNB] [AVAX] [ARB] [AAVE]  │
│                              [⚡ Run Agent]      │
│  (warning: "Agent loop halted…" if disabled)    │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  HERO CHART GRID  (2×2)                         │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ SmartMoney   │  │ Wyckoff      │            │
│  │ [MiniChart]  │  │ [MiniChart]  │            │
│  │ Entry/SL/TP  │  │ Entry/SL/TP  │            │
│  │ News snippet │  │ News snippet │            │
│  │ ✓ Approve ✕  │  │ ✓ Approve ✕  │            │
│  └──────────────┘  └──────────────┘            │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ ElliottWave  │  │ Harmonic     │            │
│  └──────────────┘  └──────────────┘            │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  RUN HISTORY (secondary)                        │
│  Stats grid: Total / Done / 24h / Failed /      │
│              Blocked / Pending                  │
│  Intent breakdown bar chart                     │
│  Pending approvals panel                        │
│  Expandable run list                            │
└─────────────────────────────────────────────────┘
```

---

## Behavior

### On mount
- Call `coinAnalysisService.getLatest()` to fetch the most recent run
- If a run exists → render chart grid with its `strategyCards`
- If no run → render empty state: *"Select a coin and click Run Agent"*
- Also load run history, stats, approvals, and config in parallel (existing `load()` call)

### On `⚡ Run Agent` click
1. Set `triggering = true`, clear `activeRun`
2. Save selected coin to config via `PUT /agent-runs/config`
3. Call `coinAnalysisService.trigger(selectedCoin)` → receive `coinAnalysisRunId`
4. Poll `coinAnalysisService.getRun(runId)` every 2.5s
5. While `status === "running"` → show 2×2 skeleton cards with pulse animation
6. When status changes → set `activeRun`, stop polling, set `triggering = false`
7. Refresh run history in background

### Chart grid states
| State | Display |
|---|---|
| No run ever | Empty state message |
| Running | 2×2 skeleton cards (pulse) |
| Completed / pending_approval / auto_executed | 2×2 `ProposalCard` with `MiniChart` |
| Failed | Error banner, last successful run charts remain |

### Removed
- `▶ Run One Tick` button (full agent loop tick trigger) — removed entirely
- "Runs in parallel: SmartMoney Wyckoff…" label in control bar — redundant with chart card headers

---

## Changes to `RunsTab` in `ChatDashboard.tsx`

1. **State**: Add `latestRun` state (loaded on mount from `coinAnalysisService.getLatest()`). Merge with existing `activeRun` — `activeRun` takes priority when set (current session run), falls back to `latestRun`.

2. **`load()` function**: Add `coinAnalysisService.getLatest()` to the parallel fetch. Store result in `latestRun`.

3. **Render order**:
   - Control bar (coin picker + Run Agent button + halted warning) — unchanged except label
   - Hero chart grid — moved to immediately below control bar, always visible when a run exists
   - Stats grid — below charts
   - Intent breakdown — below stats
   - Pending approvals — below intent breakdown
   - Run list — at bottom
   - ~~`▶ Run One Tick` button~~ — deleted

4. **`displayRun`**: computed as `activeRun ?? latestRun` — drives what the chart grid shows.

---

## Non-goals
- No changes to `ProposalsTab` (separate tab, stays as-is)
- No changes to backend endpoints
- No changes to `MiniChart`, `AgentChart`, or `ChartModal`
- No changes to approve/reject logic

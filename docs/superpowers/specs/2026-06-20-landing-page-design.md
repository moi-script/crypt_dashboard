# Landing Page Design — CRPTX Terminal
**Date:** 2026-06-20

## What we're building
Replace the `/` route (currently the markets view) with a cinematic split-layout landing page that doubles as the auth entry point. Authenticated users auto-redirect to `/dashboard`.

## Layout
- **Left side (flex: 1):** Scrolling narrative — 5 stacked sections, each `min-h-[100dvh]`
- **Right side (420px):** `position: sticky; top: 0; height: 100dvh` — auth panel with login/register tabs, persistent across all left sections

## Left sections
1. **Hero** — Big Syne headline, two ambient glow blobs (cyan + violet, CSS drift animation), two CTAs
2. **Markets** — Live `useCoinList` data rendered in a glassmorphic card, 6 coins shown, fade-out at bottom
3. **Charts** — Static SVG candlestick preview, violet accent, indicator badges
4. **Agent** — Static AI chat card (two exchanges), emerald accent
5. **Stats** — Three large numbers, hairline above, minimal

## Right auth panel
- Tab switcher: Sign In / Register
- Heading: "Welcome back" / "Join the terminal" (Syne, no terminal jargon)
- Ambient glow behind panel shifts color as the left section changes: cyan (hero/markets) → violet (charts) → emerald (agent) → cyan (stats)
- Submit: `router.replace("/dashboard")` on success

## Routing
- `AppLayout` in `app-shell.tsx`: add `pathname === "/"` to the bypass condition so the landing page handles its own layout
- `app/page.tsx`: export from `landing.view` instead of `markets.view`

## Design system
- Fonts: Syne (display), JetBrains Mono (mono) — existing tokens
- Colors: existing CSS variables (`--cyan`, `--violet`, `--up`, `--bg`, etc.)
- Dark, no glassmorphism overuse — only the auth panel and coin card
- Motion: CSS keyframe drift on ambient blobs, CSS transitions on color changes


// ============================================================
// intelligence.controller.ts
// REST handlers for the Intelligence Scanner endpoints
// ============================================================

import { Request, Response } from 'express';
import { runIntelligenceScan, getCoinCard } from '../services/intelligence.service';
import { IntelligenceScan } from '../agents/chartAnalysis.types';

// In-memory cache for the latest scan (Redis in production)
let cachedScan: IntelligenceScan | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ─── GET /api/intelligence/scan ───────────────────────────────
// Returns the latest full intelligence scan
export async function getLatestScan(req: Request, res: Response): Promise<void> {
  try {
    const now = Date.now();
    const forceRefresh = req.query.refresh === 'true';

    // Serve from cache if fresh
    if (!forceRefresh && cachedScan && (now - cacheTimestamp) < CACHE_TTL_MS) {
      res.json({ success: true, data: cachedScan, cached: true });
      return;
    }

    // Run fresh scan
    const scan = await runIntelligenceScan();
    cachedScan = scan;
    cacheTimestamp = now;

    res.json({ success: true, data: scan, cached: false });
  } catch (err) {
    console.error('[IntelligenceController] getLatestScan error:', err);
    res.status(500).json({ success: false, error: 'Intelligence scan failed' });
  }
}

// ─── GET /api/intelligence/coin/:symbol ──────────────────────
// Returns single coin intelligence card (with latest BTC context)
export async function getCoinIntelligence(req: Request, res: Response): Promise<void> {
  try {
    const { symbol } = req.params;
    const symbolToString = symbol as string

    if (!symbolToString) {
      res.status(400).json({ success: false, error: 'Symbol required' });
      return;
    }

    const btcContext = cachedScan?.btc_context;
    const card = await getCoinCard(symbolToString.toUpperCase(), btcContext);

    if (!card) {
      res.status(404).json({ success: false, error: `No data for ${symbolToString}` });
      return;
    }

    res.json({ success: true, data: card });
  } catch (err) {
    console.error('[IntelligenceController] getCoinIntelligence error:', err);
    res.status(500).json({ success: false, error: 'Coin analysis failed' });
  }
}

// ─── GET /api/intelligence/cascade ───────────────────────────
// Returns only the cascade map (lightweight endpoint for real-time updates)
export async function getCascadeMap(req: Request, res: Response): Promise<void> {
  try {
    if (!cachedScan) {
      res.status(404).json({ success: false, error: 'No scan available yet. Call /scan first.' });
      return;
    }

    const cascadeData = {
      scan_id: cachedScan.scan_id,
      generated_at: cachedScan.generated_at,
      btc_signal: {
        type: cachedScan.btc_context.signal_type,
        fired_at: cachedScan.btc_context.signal_fired_at,
        bias: cachedScan.btc_context.bias,
      },
      windows_open: cachedScan.windows_open,
      coins: cachedScan.coins.map(c => ({
        symbol: c.coin,
        cascade_status: c.cascade.status,
        window_remaining_minutes: c.cascade.window_remaining_minutes,
        expected_move_pct: c.cascade.expected_move_pct,
        historical_follow_rate: c.cascade.historical_follow_rate,
        opportunity_score: c.opportunity_score,
        current_price: c.current_price,
        price_change_24h: c.price_change_24h,
      })),
    };

    res.json({ success: true, data: cascadeData });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Cascade map retrieval failed' });
  }
}

// ─── GET /api/intelligence/top ───────────────────────────────
// Returns top N opportunities
export async function getTopOpportunities(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 5;

    if (!cachedScan) {
      const scan = await runIntelligenceScan();
      cachedScan = scan;
      cacheTimestamp = Date.now();
    }

    const top = cachedScan.top_opportunities.slice(0, limit);
    res.json({ success: true, data: top, total_windows_open: cachedScan.windows_open });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get top opportunities' });
  }
}

// ─── POST /api/intelligence/trigger ──────────────────────────
// Manually trigger a new scan (for testing / on-demand)
export async function triggerScan(req: Request, res: Response): Promise<void> {
  try {
    const scan = await runIntelligenceScan();
    cachedScan = scan;
    cacheTimestamp = Date.now();
    res.json({
      success: true,
      message: 'Scan complete',
      scan_id: scan.scan_id,
      coins_analyzed: scan.total_analyzed,
      windows_open: scan.windows_open,
      top_coins: scan.top_opportunities.slice(0, 3).map(c => c.coin),
    });
  } catch (err) {
    console.error('[IntelligenceController] triggerScan error:', err);
    res.status(500).json({ success: false, error: 'Scan trigger failed' });
  }
}



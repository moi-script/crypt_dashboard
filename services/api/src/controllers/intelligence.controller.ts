
// ============================================================
// intelligence.controller.ts
// REST handlers for the Intelligence Scanner endpoints
// ============================================================

import { Request, Response } from 'express';
import { runIntelligenceScan, getCoinCard } from '../services/intelligence.service';
import { IntelligenceScan } from '../agents/chartAnalysis.types';
import {
  saveScan,
  getLatestScan as getLatestScanFromDb,
  getScanById,
  listScans,
} from '../services/intelligenceScan.repository';

// In-memory cache for the latest scan (hot path). Durable history lives
// in MongoDB via intelligenceScan.repository.
let cachedScan: IntelligenceScan | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ─── Helpers ──────────────────────────────────────────────────

/** Run a fresh scan, update the in-memory cache, and persist it to the DB. */
async function runAndPersistScan(): Promise<IntelligenceScan> {
  const scan = await runIntelligenceScan();
  cachedScan = scan;
  cacheTimestamp = Date.now();
  await saveScan(scan); // best-effort; never blocks the response on DB errors
  return scan;
}

/**
 * Return the in-memory cached scan, rehydrating it from the DB if the cache
 * is cold (e.g. after a process restart). Returns null only when neither the
 * cache nor the DB has a scan yet.
 */
async function getCachedOrPersistedScan(): Promise<IntelligenceScan | null> {
  if (cachedScan) return cachedScan;
  const persisted = await getLatestScanFromDb();
  if (persisted) {
    cachedScan = persisted;
    cacheTimestamp = new Date(persisted.generated_at).getTime();
  }
  return cachedScan;
}

// ─── GET /api/intelligence/scan ───────────────────────────────
// Returns the latest full intelligence scan
export async function getLatestScan(req: Request, res: Response): Promise<void> {
  try {
    const now = Date.now();
    const forceRefresh = req.query.refresh === 'true';

    // Serve from cache if fresh, rehydrating from the DB on a cold cache
    if (!forceRefresh) {
      const existing = await getCachedOrPersistedScan();
      if (existing && (now - cacheTimestamp) < CACHE_TTL_MS) {
        res.json({ success: true, data: existing, cached: true });
        return;
      }
    }

    // Run fresh scan (also persists to the DB)
    const scan = await runAndPersistScan();
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

    const latest = await getCachedOrPersistedScan();
    const btcContext = latest?.btc_context;
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
    const scan = await getCachedOrPersistedScan();
    if (!scan) {
      res.status(404).json({ success: false, error: 'No scan available yet. Call /scan first.' });
      return;
    }

    const cascadeData = {
      scan_id: scan.scan_id,
      generated_at: scan.generated_at,
      btc_signal: {
        type: scan.btc_context.signal_type,
        fired_at: scan.btc_context.signal_fired_at,
        bias: scan.btc_context.bias,
      },
      windows_open: scan.windows_open,
      coins: scan.coins.map(c => ({
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

    let scan = await getCachedOrPersistedScan();
    if (!scan) {
      scan = await runAndPersistScan();
    }

    const top = scan.top_opportunities.slice(0, limit);
    res.json({ success: true, data: top, total_windows_open: scan.windows_open });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get top opportunities' });
  }
}

// ─── POST /api/intelligence/trigger ──────────────────────────
// Manually trigger a new scan (for testing / on-demand)
export async function triggerScan(req: Request, res: Response): Promise<void> {
  try {
    const scan = await runAndPersistScan();
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

// ─── GET /api/intelligence/history ───────────────────────────
// Returns lightweight metadata for the last N persisted scans
export async function getScanHistory(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const history = await listScans(limit);
    res.json({ success: true, data: history, count: history.length });
  } catch (err) {
    console.error('[IntelligenceController] getScanHistory error:', err);
    res.status(500).json({ success: false, error: 'Scan history fetch failed' });
  }
}

// ─── GET /api/intelligence/scan/:scanId ──────────────────────
// Returns a specific persisted scan snapshot by id
export async function getScanByIdHandler(req: Request, res: Response): Promise<void> {
  try {
    const { scanId } = req.params;
    if (!scanId) { res.status(400).json({ success: false, error: 'scanId required' }); return; }

    const scan = await getScanById(scanId as string);
    if (!scan) {
      res.status(404).json({ success: false, error: `No scan found for id ${scanId}` });
      return;
    }
    res.json({ success: true, data: scan });
  } catch (err) {
    console.error('[IntelligenceController] getScanByIdHandler error:', err);
    res.status(500).json({ success: false, error: 'Scan fetch failed' });
  }
}



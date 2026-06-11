// ============================================================
// orderBlock.controller.ts
// REST handlers for Order Block endpoints.
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { Request, Response } from 'express';
import {
  getActiveOrderBlocks,
  getOrderBlocksNearPrice,
  getNearestOrderBlock,
  syncOrderBlocks,
  markMitigated,
} from '../services/orderBlock.service';

// ─── GET /api/orderblocks/active/:symbol ─────────────────────
export async function getActiveOBs(req: Request, res: Response): Promise<void> {
  try {
    const { symbol } = req.params;
    const symbolToString = symbol as string
    if (!symbol) { res.status(400).json({ success: false, error: 'Symbol required' }); return; }

    const obs = await getActiveOrderBlocks(symbolToString.toUpperCase());
    res.json({ success: true, data: obs, count: obs.length });
  } catch (err) {
    console.error('[OrderBlockController] getActiveOBs error:', err);
    res.status(500).json({ success: false, error: 'OB fetch failed' });
  }
}

// ─── GET /api/orderblocks/near/:symbol/:price ────────────────
export async function getNearOBs(req: Request, res: Response): Promise<void> {
  try {
    const { symbol, price } = req.params;
    const symbolToString = symbol as string

    const tolerancePct = parseFloat(req.query.tolerance as string) || 0.005;
    const parsedPrice = parseFloat(price as string);

    if (!symbol || isNaN(parsedPrice)) {
      res.status(400).json({ success: false, error: 'Symbol and valid price required' });
      return;
    }

    const obs = await getOrderBlocksNearPrice(symbolToString.toUpperCase(), parsedPrice, tolerancePct);
    res.json({ success: true, data: obs, count: obs.length });
  } catch (err) {
    console.error('[OrderBlockController] getNearOBs error:', err);
    res.status(500).json({ success: false, error: 'OB near-price fetch failed' });
  }
}

// ─── GET /api/orderblocks/nearest/:symbol/:price/:direction ──
export async function getNearestOB(req: Request, res: Response): Promise<void> {
  try {
    const { symbol, price, direction } = req.params;
    const symbolToString = symbol as string
    
    const parsedPrice = parseFloat(price as string);

    if (!symbol || isNaN(parsedPrice) || !['above', 'below'].includes(direction as string)) {
      res.status(400).json({ success: false, error: 'Symbol, price, and direction (above|below) required' });
      return;
    }

    const ob = await getNearestOrderBlock(symbolToString.toUpperCase(), parsedPrice, direction as 'above' | 'below');
    if (!ob) {
      res.status(404).json({ success: false, error: `No OB found ${direction} ${parsedPrice}` });
      return;
    }
    res.json({ success: true, data: ob });
  } catch (err) {
    console.error('[OrderBlockController] getNearestOB error:', err);
    res.status(500).json({ success: false, error: 'Nearest OB fetch failed' });
  }
}

// ─── POST /api/orderblocks/sync/:symbol ──────────────────────
export async function syncOBs(req: Request, res: Response): Promise<void> {
  try {
    const { symbol } = req.params;
    const symbolToString = symbol as string

    if (!symbol) { res.status(400).json({ success: false, error: 'Symbol required' }); return; }

    const obs = await syncOrderBlocks(symbolToString.toUpperCase());
    res.json({ success: true, data: obs, count: obs.length, synced_at: new Date().toISOString() });
  } catch (err) {
    console.error('[OrderBlockController] syncOBs error:', err);
    res.status(500).json({ success: false, error: 'OB sync failed' });
  }
}

// ─── PATCH /api/orderblocks/mitigate/:id ─────────────────────
export async function mitigateOB(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) { res.status(400).json({ success: false, error: 'OB id required' }); return; }

    await markMitigated(id as string);
    res.json({ success: true, message: `OB ${id} marked mitigated` });
  } catch (err) {
    console.error('[OrderBlockController] mitigateOB error:', err);
    res.status(500).json({ success: false, error: 'Mitigation failed' });
  }
}
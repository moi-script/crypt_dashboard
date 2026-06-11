// ============================================================
// orderBlock.service.ts
// OB lifecycle management: active → mitigated tracking across ticks.
// Persists to MongoDB. Diffs against DB on each scheduler tick.
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { Candle, OrderBlock } from '../agents/chartAnalysis.types';
import {
  detectOrderBlocks,
} from '../agents/skills/smartMoney.skill';
import { ohlcvIngest } from '../read/ingestion/ohlcv.ingest';
// import OrderBlockModel from '../models/orderBlock.model';
import OrderBlockModel from '../models/orderBlock.model';

const PRICE_TOLERANCE_PCT = 0.005; // 0.5% — OB is "near" if within this range

// ─── Sync OBs for a symbol (called each scheduler tick) ──────
// 1. Detect fresh OBs from candles
// 2. Diff vs DB active OBs — insert new, mark mitigated where price traded through
// Returns current active OBs
export async function syncOrderBlocks(
  symbol: string,
  candles?: Candle[]
): Promise<OrderBlock[]> {
  const freshCandles = candles
    ?? (await ohlcvIngest.fetch({ symbol, timeframe: '4h', limit: 200 })).candles;

  const detected = detectOrderBlocks(freshCandles, '4H');
  const currentPrice = freshCandles[freshCandles.length - 1].close;

  try {
    const existing = await OrderBlockModel.find({ symbol, status: 'active' }).lean();
    const existingIds = new Set(existing.map((ob: any) => ob.id));

    // Insert net-new OBs (not in DB yet)
    const newOBs = detected.filter(ob => !existingIds.has(ob.id));
    if (newOBs.length > 0) {
      await OrderBlockModel.insertMany(
        newOBs.map(ob => ({ ...ob, symbol })),
        { ordered: false } // continue on duplicate key
      ).catch(() => {}); // swallow duplicate key errors gracefully
    }

    // Mark mitigated: price has traded through (inside) the OB zone
    for (const ob of existing) {
      const inZone = currentPrice >= (ob as any).low && currentPrice <= (ob as any).high;
      if (inZone) {
        await OrderBlockModel.findOneAndUpdate(
          { id: (ob as any).id },
          { status: 'mitigated', mitigated_at: new Date() }
        );
      }
    }

    // Return refreshed active list from DB
    const active = await OrderBlockModel.find({ symbol, status: 'active' })
      .sort({ origin_timestamp: -1 })
      .lean();

    return active as unknown as OrderBlock[];
  } catch (err) {
    // DB unavailable — fall back to in-memory detected list
    console.warn('[OrderBlockService] DB unavailable, returning in-memory OBs:', err);
    return detected;
  }
}

// ─── Get active OBs from DB ───────────────────────────────────
export async function getActiveOrderBlocks(symbol: string): Promise<OrderBlock[]> {
  try {
    const result = await OrderBlockModel.find({ symbol, status: 'active' })
      .sort({ origin_timestamp: -1 })
      .lean();
    return result as unknown as OrderBlock[];
  } catch {
    // Fallback: detect from live candles
    const { candles } = await ohlcvIngest.fetch({ symbol, timeframe: '4h', limit: 200 });
    return detectOrderBlocks(candles, '4H');
  }
}

// ─── Mark an OB as mitigated ─────────────────────────────────
export async function markMitigated(id: string): Promise<void> {
  try {
    await OrderBlockModel.findOneAndUpdate(
      { id },
      { status: 'mitigated', mitigated_at: new Date() }
    );
  } catch (err) {
    console.warn(`[OrderBlockService] markMitigated failed for id ${id}:`, err);
  }
}

// ─── Find OBs near a given price ─────────────────────────────
export async function getOrderBlocksNearPrice(
  symbol: string,
  price: number,
  tolerancePct = PRICE_TOLERANCE_PCT
): Promise<OrderBlock[]> {
  const active = await getActiveOrderBlocks(symbol);
  return active.filter(ob =>
    price >= ob.low  * (1 - tolerancePct) &&
    price <= ob.high * (1 + tolerancePct)
  );
}

// ─── Get nearest unmitigated OB above/below price ────────────
export async function getNearestOrderBlock(
  symbol: string,
  price: number,
  direction: 'above' | 'below'
): Promise<OrderBlock | null> {
  const active = await getActiveOrderBlocks(symbol);
  if (direction === 'above') {
    const above = active.filter(ob => ob.low > price).sort((a, b) => a.low - b.low);
    return above[0] ?? null;
  }
  const below = active.filter(ob => ob.high < price).sort((a, b) => b.high - a.high);
  return below[0] ?? null;
}

// ─── Bulk upsert from external source ────────────────────────
// Used when intelligence.service.ts pre-loads OBs for multiple symbols
export async function bulkSyncOrderBlocks(
  entries: Array<{ symbol: string; candles: Candle[] }>
): Promise<Map<string, OrderBlock[]>> {
  const results = new Map<string, OrderBlock[]>();
  await Promise.allSettled(
    entries.map(async ({ symbol, candles }) => {
      const obs = await syncOrderBlocks(symbol, candles);
      results.set(symbol, obs);
    })
  );
  return results;
}
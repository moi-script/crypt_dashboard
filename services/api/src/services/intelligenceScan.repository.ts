// ============================================================
// intelligenceScan.repository.ts
// Persistence helpers for IntelligenceScan snapshots.
// Bridges the in-memory IntelligenceScan shape (generated_at as ISO
// string) and the MongoDB document (generated_at as Date).
// ============================================================

import IntelligenceScanModel, {
  IIntelligenceScanDocument,
} from '../models/intelligenceScan.model';
import { IntelligenceScan } from '../agents/chartAnalysis.types';

// ─── Mappers ──────────────────────────────────────────────────

/** Map a persisted document back into the in-memory IntelligenceScan shape. */
function toScan(doc: IIntelligenceScanDocument): IntelligenceScan {
  return {
    scan_id:           doc.scan_id,
    generated_at:      doc.generated_at.toISOString(),
    btc_context:       doc.btc_context!,
    dominance:         doc.dominance!,
    market_phase:      doc.market_phase,
    coins:             doc.coins ?? [],
    total_analyzed:    doc.total_analyzed,
    windows_open:      doc.windows_open,
    top_opportunities: doc.top_opportunities ?? [],
  };
}

// ─── Writes ───────────────────────────────────────────────────

/**
 * Persist a scan snapshot. Best-effort: a DB failure logs a warning and
 * resolves false rather than breaking the live response path (mirrors the
 * chart-analysis persist behaviour).
 */
export async function saveScan(scan: IntelligenceScan): Promise<boolean> {
  try {
    await IntelligenceScanModel.create({
      scan_id:           scan.scan_id,
      generated_at:      new Date(scan.generated_at),
      market_phase:      scan.market_phase,
      total_analyzed:    scan.total_analyzed,
      windows_open:      scan.windows_open,
      coin_count:        scan.coins.length,
      btc_regime:        scan.btc_context?.regime ?? null,
      btc_bias:          scan.btc_context?.bias ?? null,
      btc_context:       scan.btc_context,
      dominance:         scan.dominance,
      coins:             scan.coins,
      top_opportunities: scan.top_opportunities,
    });
    return true;
  } catch (err) {
    console.warn('[IntelligenceScanRepository] persist failed:', err);
    return false;
  }
}

// ─── Reads ────────────────────────────────────────────────────

/** Return the most recent persisted scan, or null if none exist. */
export async function getLatestScan(): Promise<IntelligenceScan | null> {
  try {
    const doc = await IntelligenceScanModel.findOne().sort({ generated_at: -1 });
    return doc ? toScan(doc) : null;
  } catch (err) {
    console.warn('[IntelligenceScanRepository] getLatestScan failed:', err);
    return null;
  }
}

/** Return a specific persisted scan by its scan_id, or null. */
export async function getScanById(scanId: string): Promise<IntelligenceScan | null> {
  try {
    const doc = await IntelligenceScanModel.findOne({ scan_id: scanId });
    return doc ? toScan(doc) : null;
  } catch (err) {
    console.warn('[IntelligenceScanRepository] getScanById failed:', err);
    return null;
  }
}

export interface ScanHistoryEntry {
  scan_id: string;
  generated_at: string;
  market_phase: string;
  total_analyzed: number;
  windows_open: number;
  coin_count: number;
  btc_regime: string | null;
  btc_bias: 'long' | 'short' | 'neutral' | null;
}

/** Return lightweight metadata for the last N scans (newest first). */
export async function listScans(limit = 20): Promise<ScanHistoryEntry[]> {
  try {
    const docs = await IntelligenceScanModel.find(
      {},
      {
        scan_id: 1, generated_at: 1, market_phase: 1, total_analyzed: 1,
        windows_open: 1, coin_count: 1, btc_regime: 1, btc_bias: 1,
      },
    )
      .sort({ generated_at: -1 })
      .limit(limit)
      .lean();

    return docs.map((d: any) => ({
      scan_id:        d.scan_id,
      generated_at:   new Date(d.generated_at).toISOString(),
      market_phase:   d.market_phase,
      total_analyzed: d.total_analyzed,
      windows_open:   d.windows_open,
      coin_count:     d.coin_count,
      btc_regime:     d.btc_regime ?? null,
      btc_bias:       d.btc_bias ?? null,
    }));
  } catch (err) {
    console.warn('[IntelligenceScanRepository] listScans failed:', err);
    return [];
  }
}

// ============================================================
// chartAnalysis.controller.ts
// REST handlers for chart analysis endpoints.
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { Request, Response } from 'express';
import { analyzeSymbol, buildMarketPrimitives } from '../services/chartAnalysis.service';
import { validateChartAnalysisTrade } from '../risk/chartAnalysis.risk';
import ChartAnalysisModel from '../models/chartAnalysis.model';

// ─── POST /api/chart/analyze/:symbol ─────────────────────────
// Full analysis pipeline: primitives → LLM → risk gate → persist
export async function analyzeSymbolHandler(req: Request, res: Response): Promise<void> {
  try {
    const { symbol } = req.params;
    const symbolToString = symbol as string

    if (!symbol) { res.status(400).json({ success: false, error: 'Symbol required' }); return; }

    const { primitives, result } = await analyzeSymbol(symbolToString.toUpperCase());

    // Run risk gate
    const riskCheck = validateChartAnalysisTrade(result, primitives);

    // Persist to DB
    try {
      await ChartAnalysisModel.create({
        symbol:              symbolToString.toUpperCase(),
        ...result,
        framework_scores:    new Map(Object.entries(result.framework_scores)),
        risk_approved:       riskCheck.approved,
        adjusted_confidence: riskCheck.adjusted_confidence,
        adjusted_size_mult:  riskCheck.adjusted_size_multiplier,
        risk_warnings:       riskCheck.warnings,
        risk_rejection:      riskCheck.rejection_reason ?? null,
        analyzed_at:         new Date(),
        timeframes_used:     primitives.meta.timeframes_analyzed,
      });
    } catch (dbErr) {
      console.warn('[ChartAnalysisController] DB persist failed:', dbErr);
    }

    res.json({
      success: true,
      data: {
        primitives_meta: primitives.meta,
        analysis: result,
        risk: {
          approved:             riskCheck.approved,
          adjusted_confidence:  riskCheck.adjusted_confidence,
          adjusted_size_mult:   riskCheck.adjusted_size_multiplier,
          warnings:             riskCheck.warnings,
          rejection_reason:     riskCheck.rejection_reason,
        },
      },
    });
  } catch (err) {
    console.error('[ChartAnalysisController] analyzeSymbol error:', err);
    res.status(500).json({ success: false, error: 'Analysis failed' });
  }
}

// ─── GET /api/chart/history/:symbol ──────────────────────────
// Returns last N approved analyses for a symbol
export async function getAnalysisHistory(req: Request, res: Response): Promise<void> {
  try {
    const { symbol } = req.params;
    const symbolToString = symbol as string
    const limit = parseInt(req.query.limit as string) || 10;

    const history = await ChartAnalysisModel.find(
      { symbol: symbolToString.toUpperCase() },
      { reasoning: 0, confluence_factors: 0 } // omit large fields by default
    )
      .sort({ analyzed_at: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, data: history, count: history.length });
  } catch (err) {
    console.error('[ChartAnalysisController] getHistory error:', err);
    res.status(500).json({ success: false, error: 'History fetch failed' });
  }
}

// ─── GET /api/chart/primitives/:symbol ───────────────────────
// Returns only the Tier 1 primitives (no LLM call) — useful for debugging
export async function getPrimitives(req: Request, res: Response): Promise<void> {
  try {
    const { symbol } = req.params;
    const symbolToString = symbol as string

    if (!symbol) { res.status(400).json({ success: false, error: 'Symbol required' }); return; }

    const primitives = await buildMarketPrimitives(symbolToString.toUpperCase());
    res.json({ success: true, data: primitives });
  } catch (err) {
    console.error('[ChartAnalysisController] getPrimitives error:', err);
    res.status(500).json({ success: false, error: 'Primitives fetch failed' });
  }
}

// ─── GET /api/chart/ohlcv/:symbol ───────────────────────────
// Returns OHLCV candles for a given symbol and timeframe
import { ohlcvIngest } from '../read/ingestion/ohlcv.ingest'
import type { Timeframe } from '../read/ingestion/ohlcv.ingest'

const ALLOWED_SYMBOLS   = new Set(['BTCUSDT', 'ETHUSDT'])
const ALLOWED_TIMEFRAMES = new Set<Timeframe>(['1m', '5m', '15m', '1h', '4h', '1d', '1w'])

export async function getOhlcv(req: Request, res: Response): Promise<void> {
  try {
    const symbol    = ((req.params.symbol ?? '') as string).toUpperCase()
    const timeframe = ((req.query.timeframe ?? '4h') as string) as Timeframe
    const limit     = Math.min(parseInt((req.query.limit ?? '') as string) || 300, 500)

    if (!ALLOWED_SYMBOLS.has(symbol)) {
      res.status(400).json({ error: `Symbol "${symbol}" not supported. Use BTCUSDT or ETHUSDT.` })
      return
    }
    if (!ALLOWED_TIMEFRAMES.has(timeframe)) {
      res.status(400).json({ error: `Timeframe "${timeframe}" not supported.` })
      return
    }

    const candleMap = await ohlcvIngest.fetchMultiTimeframe(symbol, [timeframe], limit)
    const candles   = candleMap[timeframe] ?? []

    res.json({ symbol, timeframe, candles })
  } catch (err) {
    console.error('[ChartAnalysisController] getOhlcv error:', err);
    res.status(500).json({ error: 'OHLCV fetch failed' });
  }
}
// ============================================================
// chartAnalysis.routes.ts
// Express router for chart analysis endpoints.
// Mount in routes/index.ts: app.use('/api/chart', chartAnalysisRouter)
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { Router } from 'express';
import {
  analyzeSymbolHandler,
  getAnalysisHistory,
  getPrimitives,
  getOhlcv,
} from '../controllers/chartAnalysis.controller';
import { auth } from '../middleware/auth';

const router = Router();
router.use(auth);

router.get('/ohlcv/:symbol',       getOhlcv);              // GET  /api/chart/ohlcv/BTCUSDT?timeframe=4h&limit=300
router.post('/analyze/:symbol',    analyzeSymbolHandler);  // POST /api/chart/analyze/BTCUSDT
router.get('/history/:symbol',     getAnalysisHistory);    // GET  /api/chart/history/BTCUSDT?limit=10
router.get('/primitives/:symbol',  getPrimitives);         // GET  /api/chart/primitives/BTCUSDT

export default router;
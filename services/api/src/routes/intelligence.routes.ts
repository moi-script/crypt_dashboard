
// ============================================================
// intelligence.routes.ts
// Express router for the Intelligence Scanner API
// Mount in routes/index.ts: app.use('/api/intelligence', intelligenceRouter)
// ============================================================

import { Router } from 'express';
import {
  getLatestScan,
  getCoinIntelligence,
  getCascadeMap,
  getTopOpportunities,
  triggerScan,
  getScanHistory,
  getScanByIdHandler,
} from '../controllers/intelligence.controller';
import { auth } from '../middleware/auth'; // existing auth middleware

const router = Router();

// All intelligence routes require authentication
router.use(auth);

// ─── Scan Endpoints ───────────────────────────────────────────
router.get('/scan',         getLatestScan);        // GET  /api/intelligence/scan?refresh=true
router.post('/trigger',     triggerScan);          // POST /api/intelligence/trigger
router.get('/top',          getTopOpportunities);  // GET  /api/intelligence/top?limit=5
router.get('/cascade',      getCascadeMap);        // GET  /api/intelligence/cascade
router.get('/history',      getScanHistory);       // GET  /api/intelligence/history?limit=20
router.get('/scan/:scanId', getScanByIdHandler);   // GET  /api/intelligence/scan/<id>

// ─── Coin Endpoints ───────────────────────────────────────────
router.get('/coin/:symbol', getCoinIntelligence);  // GET  /api/intelligence/coin/SOL

export default router;




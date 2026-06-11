// ============================================================
// orderBlock.routes.ts
// Express router for Order Block endpoints.
// Mount in routes/index.ts: app.use('/api/orderblocks', orderBlockRouter)
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { Router } from 'express';
import {
  getActiveOBs,
  getNearOBs,
  getNearestOB,
  syncOBs,
  mitigateOB,
} from '../controllers/orderBlock.controller';
import { auth } from '../middleware/auth';

const router = Router();
router.use(auth);

router.get('/active/:symbol',                        getActiveOBs);   // GET  /api/orderblocks/active/SOLUSDT
router.get('/near/:symbol/:price',                   getNearOBs);     // GET  /api/orderblocks/near/SOLUSDT/150.00?tolerance=0.005
router.get('/nearest/:symbol/:price/:direction',     getNearestOB);   // GET  /api/orderblocks/nearest/SOLUSDT/150.00/above
router.post('/sync/:symbol',                         syncOBs);        // POST /api/orderblocks/sync/SOLUSDT
router.patch('/mitigate/:id',                        mitigateOB);     // PATCH /api/orderblocks/mitigate/:id

export default router;
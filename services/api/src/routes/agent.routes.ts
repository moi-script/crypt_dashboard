import { Router } from "express";
import { agentController } from "../controllers/agent.controller";
import { auth } from "../middleware/auth";

const router = Router();

// ── Session Management ────────────────────────────────────────────────────────

// POST /api/agent/session/create
// Uses optionalAuth — attaches userId if token present, but doesn't block guests.
// The controller will 401 if userId is missing (you must be logged in to create).
router.post("/session/create", optionalAuth, agentController.createSession);

// GET /api/agent/session/:sessionId — no auth needed
router.get("/session/:sessionId", agentController.getSession);

// DELETE /api/agent/session/:sessionId
router.delete("/session/:sessionId", agentController.clearSession);

// GET /api/agent/sessions — requires auth
router.get("/sessions", auth, agentController.getUserSessions);

// ── Chat ──────────────────────────────────────────────────────────────────────
router.post("/chat/stream", agentController.streamChat);

// ── Analysis Pipeline Callback ────────────────────────────────────────────────
router.post("/analysis-complete", agentController.notifyAnalysisComplete);
router.post('/session/:sessionId/tool-result', auth, agentController.saveToolResult);

export default router;

// ── optionalAuth — same as auth but doesn't block if no token ────────────────
// Attach to any route that should work for both guests and logged-in users.
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(); // no token — continue without userId
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { sub: string };
    (req as any).userId = payload.sub;
  } catch {
    // invalid token — ignore, continue without userId
  }
  next();
}
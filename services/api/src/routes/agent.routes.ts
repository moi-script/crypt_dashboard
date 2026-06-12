import { Router } from "express";
import { agentController } from "../controllers/agent.controller";

// import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// ── Session Management ────────────────────────────────────────────────────────

// POST /api/agent/session/create
// Frontend: apiClient.post("/api/agent/session/create", { coinId })
// Creates a clean DB session and returns { sessionId }
router.post("/session/create", agentController.createSession);

// GET /api/agent/session/:sessionId
// Frontend: apiClient.get(`/api/agent/session/${activeSessionId}`)
// Returns { messages, currentEmotion } for history restoration on page load
router.get("/session/:sessionId", agentController.getSession);

// DELETE /api/agent/session/:sessionId
// Frontend: called when user clears a session from the sidebar
router.delete("/session/:sessionId", agentController.clearSession);

// GET /api/agent/sessions
// Frontend: fetches the session list shown in ChatSidebar
router.get("/sessions", agentController.getUserSessions);

// ── Chat ──────────────────────────────────────────────────────────────────────

// POST /api/agent/chat/stream
// Frontend: native fetch() in useChatEngine.sendMessage()
// Streams NDJSON chunks: text_delta | emotion_update | tool_execution | done | error
router.post("/chat/stream", agentController.streamChat);

// ── Analysis Pipeline Callback ────────────────────────────────────────────────

// POST /api/agent/analysis-complete
// Called by your agent-run job after orchestrate() finishes.
// Returns the full ChatOutput including analysisReport for rich rendering.
router.post("/analysis-complete", agentController.notifyAnalysisComplete);

export default router;
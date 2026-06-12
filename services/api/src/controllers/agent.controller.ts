import { Request, Response } from "express";
import { AgentSessionDoc } from "../models/agent.model";
import { AgentService }    from "../services/agent.service";
import { makeEmotion }     from "../agents/emotion.types";

const agentService = new AgentService();

export const agentController = {

  // ── 1. Clean Session Initialization ──────────────────────────────────────────
  // Replaces the old frontend hack of sending an " init " message.
  // Creates a bare session document and returns the sessionId to the client.

  async createSession(req: Request, res: Response) {
    try {
      const { coinId = "bitcoin" } = req.body;
      const userId = (req as any).user?.id ?? "anonymous";

      const sessionId = `sess_${coinId}_${Date.now()}`;

      await AgentSessionDoc.create({
        sessionId,
        userId,
        coinId,
        messages:       [],
        createdAt:      new Date(),
        updatedAt:      new Date(),
        currentEmotion: makeEmotion("thinking", "low", "New session", "Ready."),
      });

      return res.status(200).json({ sessionId });
    } catch (error) {
      console.error("[AgentController] Error creating session:", error);
      return res.status(500).json({ error: "Failed to create session" });
    }
  },

  // ── 2. Get Session ────────────────────────────────────────────────────────────
  // Returns the full session (messages + currentEmotion) for history restoration.

  async getSession(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const coinId = (req.query.coinId as string) ?? "bitcoin";
      const session = await agentService.getOrCreateSession(String(sessionId), coinId);
      return res.status(200).json(session);
    } catch (error) {
      console.error("[AgentController] Error fetching session:", error);
      return res.status(500).json({ error: "Failed to fetch session" });
    }
  },

  // ── 3. NDJSON Streaming Chat ──────────────────────────────────────────────────
  // Each chunk written to the response is a self-contained JSON line terminated
  // with \n so the frontend reader can parse them one-by-one.
  //
  // Chunk shapes the frontend expects (see useChatEngine.ts):
  //   { type: "text_delta",     text: string }
  //   { type: "emotion_update", emotion: AgentEmotion }
  //   { type: "tool_execution", toolName: string, symbol: string, toolData: any }
  //   { type: "done" }
  //   { type: "error",          message: string }

  async streamChat(req: Request, res: Response) {
    const { sessionId, message, coinId = "bitcoin" } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: "Missing sessionId or message" });
    }

    // Set NDJSON streaming headers before we write anything
    res.setHeader("Content-Type",     "application/x-ndjson");
    res.setHeader("Transfer-Encoding","chunked");
    res.setHeader("Connection",       "keep-alive");
    res.setHeader("Cache-Control",    "no-cache");

    // Convenience helper — keeps every write consistent
    const send = (payload: object) => res.write(JSON.stringify(payload) + "\n");

    try {
      // AgentService.chat() is the single source of truth for emotion + LLM logic.
      // It already handles: session loading, DeepSeek call, emotion derivation,
      // session persistence, and fallback responses.
      const output = await agentService.chat({
        sessionId,
        message,
        coinId,
        userId:      (req as any).user?.id,
        isAnalysing: req.body.isAnalysing ?? false,
      });

      // ── Stream the text content token-by-token ──────────────────────────────
      // AgentService returns the full string at once (DeepSeek non-streaming call).
      // We simulate a token stream here so the frontend cursor animation works.
      // Swap this block for a real streaming LLM call when you upgrade AgentService.

      const words = output.content.split(" ");
      for (const word of words) {
        send({ type: "text_delta", text: word + " " });
        // Tiny yield so Node doesn't hold the event loop
        await new Promise(r => setImmediate(r));
      }

      // ── Emit the final emotion state ────────────────────────────────────────
      send({ type: "emotion_update", emotion: output.emotion });

      // ── Emit the analysis report as a synthetic tool_execution chunk ────────
      // This is how the frontend's AgentToolCard receives structured data without
      // regex scraping. If no report is attached, this block is skipped.
      if (output.analysisReport) {
        send({
          type:     "tool_execution",
          toolName: "analysis_report",
          symbol:   output.analysisReport.symbol ?? coinId.toUpperCase(),
          toolData: output.analysisReport,
        });
      }

      // ── Suggest-analysis flag (frontend can show a "Run Analysis" button) ───
      if (output.suggestAnalysis) {
        send({ type: "suggest_analysis" });
      }

      send({ type: "done" });
      res.end();

    } catch (error: any) {
      console.error("[AgentController] Streaming error:", error);

      if (!res.headersSent) {
        return res.status(500).json({ error: "Internal server error during generation" });
      }

      send({ type: "error", message: "Stream interrupted: " + (error.message ?? "unknown") });
      res.end();
    }
  },

  // ── 4. Notify Analysis Complete ───────────────────────────────────────────────
  // Called by your analysis pipeline (agent-run job) once orchestration finishes.
  // Returns the full analysis report the frontend can render in the chat.

  async notifyAnalysisComplete(req: Request, res: Response) {
    try {
      const { sessionId, coinId, verdict, score, confidence } = req.body;

      if (!sessionId || !coinId || !verdict) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const output = await agentService.notifyAnalysisComplete(
        sessionId, coinId, verdict, score ?? 0, confidence ?? 0,
      );

      return res.status(200).json(output);
    } catch (error) {
      console.error("[AgentController] Error notifying analysis complete:", error);
      return res.status(500).json({ error: "Failed to notify analysis complete" });
    }
  },

  // ── 5. List User Sessions ─────────────────────────────────────────────────────

  async getUserSessions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const sessions = await agentService.getUserSessions(userId);
      return res.status(200).json(sessions);
    } catch (error) {
      console.error("[AgentController] Error fetching user sessions:", error);
      return res.status(500).json({ error: "Failed to fetch sessions" });
    }
  },

  // ── 6. Clear Session ──────────────────────────────────────────────────────────

  async clearSession(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      await agentService.clearSession(String(sessionId));
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("[AgentController] Error clearing session:", error);
      return res.status(500).json({ error: "Failed to clear session" });
    }
  },
};
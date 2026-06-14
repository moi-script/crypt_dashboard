import { Request, Response } from "express";
import { AgentSessionDoc } from "../models/agent.model";
import { AgentService }    from "../services/agent.service";
import { makeEmotion }     from "../agents/emotion.types";

const agentService = new AgentService();

function getUserId(req: Request): string | undefined {
  return (req as any).userId;
}

export const agentController = {

  // ── 1. Create Session ─────────────────────────────────────────────────────────
  async createSession(req: Request, res: Response) {
    try {
      const { coinId = "bitcoin" } = req.body;
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized — please log in to create a session" });
      }

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
  async streamChat(req: Request, res: Response) {
    const { sessionId, message, coinId = "bitcoin" } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: "Missing sessionId or message" });
    }

    res.setHeader("Content-Type",      "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Connection",        "keep-alive");
    res.setHeader("Cache-Control",     "no-cache");

    const send = (payload: object) => res.write(JSON.stringify(payload) + "\n");

    try {
      const output = await agentService.chat({
        sessionId,
        message,
        coinId,
        userId:      getUserId(req),
        isAnalysing: req.body.isAnalysing ?? false,
      });

      const words = output.content.split(" ");
      for (const word of words) {
        send({ type: "text_delta", text: word + " " });
        await new Promise(r => setImmediate(r));
      }

      send({ type: "emotion_update", emotion: output.emotion });

      if (output.analysisReport) {
        send({
          type:     "tool_execution",
          toolName: "analysis_report",
          symbol:   output.analysisReport.symbol ?? coinId.toUpperCase(),
          toolData: output.analysisReport,
        });
      }

      if (output.suggestAnalysis) {
        send({ type: "suggest_analysis" });
      }

      // ── Persist user + agent messages (with report/tool data) to the session ──
      try {
        const now = Date.now();
        const userMsg = {
          role:    "user" as const,
          content: message,
          ts:      now,
        };
        const agentMsg = {
          role:      "agent" as const,
          content:   output.content,
          emotion:   output.emotion,
          ts:        now + 1,
          report:    output.analysisReport ?? undefined,
        };

        await AgentSessionDoc.updateOne(
          { sessionId },
          {
            $push: { messages: { $each: [userMsg, agentMsg] } },
            $set:  { currentEmotion: output.emotion, updatedAt: new Date() },
          },
        );
      } catch (persistErr: any) {
        console.warn("[AgentController] Failed to persist chat messages:", persistErr.message);
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
      const userId = getUserId(req);
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
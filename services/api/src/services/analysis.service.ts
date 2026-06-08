/**
 * analysis.service.ts  (updated)
 *
 * notifyAnalysisComplete now returns a ChatOutput with the full analysisReport
 * attached so the HTTP response can carry it back to the frontend.
 */

import { orchestrate }        from '../agents/orchestrator'
import { generateReport, buildFinalReasoningSteps } from '../agents/report.generator'
import { AnalysisDoc, CoinBehaviourDoc } from '../models/analysis.model'
import { AgentService }       from './agent.service'

const agentSvc = new AgentService()

export class AnalysisService {

  async runAnalysis(coinId: string, sessionId?: string) {
    console.log(`[AnalysisService] Running full analysis for ${coinId}`)

    // 1. Orchestrate
    const orchestrated = await orchestrate(coinId)

    // 2. Generate AI report
    const report = await generateReport(orchestrated)

    // 3. Build full reasoning
    const finalSteps    = buildFinalReasoningSteps(report, orchestrated.reasoning.length)
    const fullReasoning = [...orchestrated.reasoning, ...finalSteps]

    // 4. Save to MongoDB
    const analysis = await AnalysisDoc.create({
      coinId:       orchestrated.coinId,
      coinName:     orchestrated.coinName,
      symbol:       orchestrated.symbol,
      runAt:        new Date(),
      skillsUsed:   orchestrated.skillsUsed,
      skills:       orchestrated.skills,
      reasoning:    fullReasoning,
      verdict:      report.verdict,
      confidence:   report.confidence,
      score:        report.score,
      narrative:    report.narrative,
      keyPoints:    report.keyPoints,
      risks:        report.risks,
      imagePrompt:  report.imagePrompt,
      priceAtRun:   orchestrated.price,
      newsCount:    orchestrated.newsCount,
      sentimentAvg: orchestrated.sentimentAvg,
      behaviourNotes: report.behaviourNotes,
    })

    // 5. Update behaviour memory
    await this.updateBehaviour(orchestrated.coinId, orchestrated.symbol, report)

    // 6. Notify agent and get rich ChatOutput back
    let agentOutput = null
    if (sessionId) {
      try {
        agentOutput = await agentSvc.notifyAnalysisComplete(
          sessionId,
          coinId,
          report.verdict,
          report.score,
          report.confidence,
        )
      } catch (err: any) {
        console.warn('[AnalysisService] Agent notify failed:', err.message)
      }
    }

    console.log(`[AnalysisService] Done — verdict: ${report.verdict}, confidence: ${report.confidence}%`)

    // Return both the saved analysis and the agent output so the controller
    // can send the rich chat response back to the frontend
    return {
      analysis,
      agentOutput,
    }
  }

  private async updateBehaviour(
    coinId:  string,
    symbol:  string,
    report:  Awaited<ReturnType<typeof generateReport>>,
  ) {
    const existing = await CoinBehaviourDoc.findOne({ coinId })

    if (!existing) {
      await CoinBehaviourDoc.create({
        coinId, symbol,
        updatedAt:    new Date(),
        patterns:     report.behaviourNotes ? [report.behaviourNotes] : [],
        avgSentiment: 0,
        avgScore:     report.score,
        runCount:     1,
        lastVerdict:  report.verdict,
        notes:        report.behaviourNotes,
      })
      return
    }

    const alpha    = 0.3
    const newAvg   = existing.avgScore * (1 - alpha) + report.score * alpha
    const patterns = existing.patterns ?? []

    if (report.behaviourNotes && !patterns.includes(report.behaviourNotes)) {
      patterns.unshift(report.behaviourNotes)
      if (patterns.length > 10) patterns.pop()
    }

    await CoinBehaviourDoc.updateOne({ coinId }, {
      $set: {
        updatedAt:   new Date(),
        avgScore:    Math.round(newAvg),
        lastVerdict: report.verdict,
        notes:       report.behaviourNotes,
        patterns,
        runCount:    existing.runCount + 1,
      },
    })
  }

  async getLatest(coinId: string) {
    return AnalysisDoc.findOne({ coinId }).sort({ runAt: -1 }).lean()
  }

  async getHistory(coinId: string, limit = 10) {
    return AnalysisDoc.find({ coinId }).sort({ runAt: -1 }).limit(limit).lean()
  }

  async getAllLatest() {
    return AnalysisDoc.aggregate([
      { $sort:  { runAt: -1 } },
      { $group: { _id: '$coinId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort:  { runAt: -1 } },
    ])
  }

  async getBehaviour(coinId: string) {
    return CoinBehaviourDoc.findOne({ coinId }).lean()
  }

  async getAllBehaviours() {
    return CoinBehaviourDoc.find().sort({ runCount: -1 }).lean()
  }
}
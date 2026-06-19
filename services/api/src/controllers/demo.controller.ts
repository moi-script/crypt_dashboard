/**
 * demo.controller.ts
 *
 * Seeds a user's account with realistic mock data so every UI feature
 * is populated in one click. Safe to call multiple times — clears
 * previous demo data for the user before re-seeding.
 *
 * POST /demo/seed
 */

import type { Response } from 'express'
import type { AuthRequest as Request } from '../middleware/auth'
import { AgentRunDoc }       from '@/models/agentRun.model'
import { PositionDoc, OrderDoc } from '@/models/position.model'
import { CoinAnalysisRunDoc }    from '@/models/coinAnalysisRun.model'
import { AgentMemoryDoc }        from '@/models/agentMemory.model'
import { OpportunityDoc }        from '@/models/opportunity.model'
import { PaperWalletDoc }        from '@/models/paperWallet.model'
import { AgentConfigDoc }        from '@/models/agentConfig.model'

// ── Helpers ──────────────────────────────────────────────────────────────────

const id  = (pfx: string, n: number) => `${pfx}-demo-${n}`
const ago = (ms: number) => new Date(Date.now() - ms)
const H   = 3_600_000
const D   = 24 * H

/** 384-dim random unit vector to satisfy the agentMemory embedding field */
function fakeEmbedding(): number[] {
  const v = Array.from({ length: 384 }, () => Math.random() * 0.2 - 0.1)
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
  return v.map(x => x / mag)
}

// ── Market snapshots (ballpark prices — sparkline fetches live candles) ───────

const BTC_PRICE  = 104_850
const ETH_PRICE  = 3_420
const SOL_PRICE  = 182
const AVAX_PRICE = 38.4
const BNB_PRICE  = 680

function btcSnapshot(framework: string) {
  return {
    symbol:           'BTC',
    binanceSymbol:    'BTCUSDT',
    framework,
    snapshotAt:       new Date().toISOString(),
    entryZone:        { low: 104_200, high: 104_800 },
    stopLoss:         102_500,
    takeProfitLevels: [107_200, 110_500],
    confidence:       74,
    overlays: {
      supportResistance: [
        { price: 102_500, type: 'support',    strength: 'strong' },
        { price: 104_000, type: 'support',    strength: 'medium' },
        { price: 107_200, type: 'resistance', strength: 'strong' },
        { price: 110_500, type: 'resistance', strength: 'medium' },
      ],
      trendlines: [
        { direction: 'up', p1: { time: Date.now() - 14 * D, price: 94_000 }, p2: { time: Date.now() - 7 * D, price: 99_500 } },
      ],
      wyckoffRange:    null,
      harmonicPattern: null,
      elliottPivots:   null,
      orderBlocks: [
        { high: 104_800, low: 104_200, type: 'bullish', status: 'unmitigated' },
        { high: 102_600, low: 101_900, type: 'bullish', status: 'unmitigated' },
      ],
    },
  }
}

function ethSnapshot(framework: string) {
  return {
    symbol:           'ETH',
    binanceSymbol:    'ETHUSDT',
    framework,
    snapshotAt:       new Date().toISOString(),
    entryZone:        { low: 3_350, high: 3_390 },
    stopLoss:         3_240,
    takeProfitLevels: [3_580, 3_720],
    confidence:       68,
    overlays: {
      supportResistance: [
        { price: 3_240, type: 'support',    strength: 'strong'  },
        { price: 3_580, type: 'resistance', strength: 'medium'  },
        { price: 3_720, type: 'resistance', strength: 'strong'  },
      ],
      trendlines: [
        { direction: 'up', p1: { time: Date.now() - 10 * D, price: 3_100 }, p2: { time: Date.now() - 3 * D, price: 3_320 } },
      ],
      wyckoffRange:    { phase: 'C', high: 3_420, low: 3_200 },
      harmonicPattern: null,
      elliottPivots:   null,
      orderBlocks: [
        { high: 3_395, low: 3_350, type: 'bullish', status: 'unmitigated' },
      ],
    },
  }
}

// Bypass strict Mongoose generic types for demo seed objects
/* eslint-disable @typescript-eslint/no-explicit-any */
const ins  = <T>(doc: T[]): any[] => doc as any[]
const obj  = <T>(doc: T): any  => doc as any

// ── Main seed function ────────────────────────────────────────────────────────

async function seedDemoData(userId: string): Promise<Record<string, number>> {
  // ── 0. Clear existing demo data for this user ────────────────────────────
  await Promise.all([
    AgentRunDoc.deleteMany({ userId, runId: /^run-demo/ }),
    PositionDoc.deleteMany({ userId, positionId: /^pos-demo/ }),
    OrderDoc.deleteMany({ userId, orderId: /^ord-demo/ }),
    CoinAnalysisRunDoc.deleteMany({ userId, coinAnalysisRunId: /^ca-demo/ }),
    AgentMemoryDoc.deleteMany({ agentId: userId, runId: /^run-demo/ }),
    OpportunityDoc.deleteMany({ userId, opportunityId: /^opp-demo/ }),
  ])

  // ── 1. Paper wallet: $10 000 USDC + small BTC/ETH bag ───────────────────
  await PaperWalletDoc.findOneAndUpdate(
    { userId },
    {
      $set: {
        totalValueUsd: 10_000,
        balances: [
          { symbol: 'USDC', amount: 7_450,  valueUsd: 7_450,  lastUpdated: new Date() },
          { symbol: 'BTC',  amount: 0.01,   valueUsd: 1_048,  lastUpdated: new Date() },
          { symbol: 'ETH',  amount: 0.44,   valueUsd: 1_505,  lastUpdated: new Date() },
        ],
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  )

  // ── 2. Agent config: chartSignal on, manual approval required ────────────
  await AgentConfigDoc.findOneAndUpdate(
    { userId },
    {
      $set: {
        enabled:              true,
        mode:                 'paper',
        loopIntervalMs:       300_000,
        strategies:           { yieldHunter: false, rebalance: false, airdropWatch: false, chartSignal: true },
        watchlist:            ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX'],
        selectedCoin:         'BTC',
        maxTradeUsd:          500,
        requireManualApproval: true,
      },
    },
    { upsert: true, new: true },
  )

  // ── 3. Completed agent runs (history) ────────────────────────────────────
  const completedRuns = [
    {
      runId: id('run', 1), userId, strategy: 'chartSignal', mode: 'paper',
      startedAt: ago(5 * D), completedAt: ago(5 * D - 8 * H), status: 'completed',
      decision: {
        intent:     { type: 'propose_trade', tokenIn: 'USDC', tokenOut: 'SOL', amountUsd: 500, bias: 'long', framework: 'SmartMoney', stopLossPrice: 171, takeProfitPrice: 192 },
        reasoning:  'SmartMoney OB at 178–181 validated by ChoCh. Spring confirmed on 4H. HTF bullish above 200EMA.',
        confidence: 74,
      },
      executionResult: { status: 'filled', filledAmountUsd: 500, entryPrice: SOL_PRICE - 2, feesUsd: 0.15, executedAt: ago(5 * D - 8 * H) },
    },
    {
      runId: id('run', 2), userId, strategy: 'chartSignal', mode: 'paper',
      startedAt: ago(3 * D), completedAt: ago(3 * D - 6 * H), status: 'completed',
      decision: {
        intent:     { type: 'no_action', reason: 'HTF bias mixed — BTC below daily 50 EMA. Waiting for cleaner setup.' },
        reasoning:  'No confluence across frameworks. Elliott count ambiguous. Wyckoff still in Phase B.',
        confidence: 30,
      },
      executionResult: { status: 'filled', filledAmountUsd: 0, feesUsd: 0, executedAt: ago(3 * D - 6 * H) },
    },
    {
      runId: id('run', 3), userId, strategy: 'chartSignal', mode: 'paper',
      startedAt: ago(1 * D + 4 * H), completedAt: ago(1 * D + 4 * H - 5 * H), status: 'blocked',
      decision: {
        intent:     { type: 'propose_trade', tokenIn: 'USDC', tokenOut: 'AVAX', amountUsd: 500 },
        reasoning:  'Risk guard blocked — open position in AVAX already. De-duplication enforced.',
        confidence: 61,
      },
      executionResult: { status: 'blocked_by_risk', filledAmountUsd: 0, feesUsd: 0, executedAt: ago(1 * D + 4 * H - 5 * H) },
    },
    {
      runId: id('run', 4), userId, strategy: 'chartSignal', mode: 'paper',
      startedAt: ago(2 * H), completedAt: ago(1 * H), status: 'completed',
      decision: {
        intent:     { type: 'propose_trade', tokenIn: 'USDC', tokenOut: 'BNB', amountUsd: 500, bias: 'long', framework: 'Wyckoff' },
        reasoning:  'BNB Phase D LPS — accumulation completing. Volume profile bullish. SoS candle on 4H.',
        confidence: 67,
      },
      executionResult: { status: 'filled', filledAmountUsd: 500, entryPrice: BNB_PRICE - 1.2, feesUsd: 0.12, executedAt: ago(1 * H) },
    },
  ]
  await AgentRunDoc.insertMany(ins(completedRuns), { ordered: false })

  // ── 4. Pending approval agent run (shows sparkline + approve/reject) ─────
  // Use raw collection insert to avoid Mongoose's `type` key ambiguity in
  // ChartOverlaySchema (supportResistance/orderBlocks arrays have a `type` field
  // which Mongoose misinterprets as the schema type descriptor when using create()).
  // The real agent avoids this the same way — it uses updateOne+$set.
  const pendingRun = {
    runId: id('run', 5), userId, strategy: 'chartSignal', mode: 'paper',
    startedAt: ago(20 * 60_000), status: 'pending_approval',
    decision: {
      intent: {
        type: 'propose_trade', tokenIn: 'USDC', tokenOut: 'BTC',
        amountUsd: 500, bias: 'long', framework: 'SmartMoney',
        stopLossPrice: 102_500, takeProfitPrice: 107_200,
        entryZoneLow: 104_200, entryZoneHigh: 104_800,
      },
      reasoning:
        'BTC order block at 104.2–104.8K unmitigated on 4H. ChoCh confirmed bullish at 103.9K. ' +
        'HTF (1D) structure bullish above 200EMA at 98K. SmartMoney + Wyckoff Phase D agree → 2× confluence. ' +
        'News sentiment neutral (avg 0.12). R:R 1:3.5.',
      confidence: 74,
    },
    chartSnapshot: btcSnapshot('SmartMoney'),
  }
  await AgentRunDoc.collection.insertOne(pendingRun)

  // ── 5. Positions ─────────────────────────────────────────────────────────

  // 5a. Open BTC long (active, SL + TP set)
  await PositionDoc.create(obj({
    positionId: id('pos', 1), userId, mode: 'paper', status: 'open', isOpen: true,
    tokenIn: 'USDC', tokenOut: 'BTC', entryAmountUsd: 500,
    entryPrice: BTC_PRICE - 300, entryFeesUsd: 0.15, entryAt: ago(6 * H),
    strategy: 'chartSignal', runId: id('run', 4),
    stopLossPrice:   102_500,
    takeProfitPrice: 107_200,
    framework: 'SmartMoney', confidence: 74,
  }))

  // 5b. Pending ETH limit order (waiting for price re-entry)
  await PositionDoc.create(obj({
    positionId: id('pos', 2), userId, mode: 'paper', status: 'pending', isOpen: false,
    tokenIn: 'USDC', tokenOut: 'ETH', entryAmountUsd: 500,
    entryFeesUsd: 0, entryAt: ago(1 * H),
    strategy: 'chartSignal', runId: id('run', 2),
    stopLossPrice:   3_240,
    takeProfitPrice: 3_580,
    entryZoneLow:  3_350, entryZoneHigh: 3_390,
    entryExpiresAt: new Date(Date.now() + 5 * H),
    framework: 'Wyckoff', confidence: 68,
  }))

  // 5c. SOL closed — TP hit (shows ✓ TP Hit badge + green border)
  await PositionDoc.create(obj({
    positionId: id('pos', 3), userId, mode: 'paper', status: 'closed', isOpen: false,
    tokenIn: 'USDC', tokenOut: 'SOL', entryAmountUsd: 500,
    entryPrice: SOL_PRICE - 4, entryFeesUsd: 0.12, entryAt: ago(5 * D),
    exitAt: ago(2 * D), exitPrice: 192,
    realizedPnlUsd: 32.4,
    strategy: 'chartSignal', runId: id('run', 1),
    stopLossPrice:   171,
    takeProfitPrice: 192,
    framework: 'SmartMoney', confidence: 74,
  }))

  // 5d. AVAX closed — SL hit (shows ⚡ SL Auto-closed badge + red border)
  await PositionDoc.create(obj({
    positionId: id('pos', 4), userId, mode: 'paper', status: 'closed', isOpen: false,
    tokenIn: 'USDC', tokenOut: 'AVAX', entryAmountUsd: 300,
    entryPrice: AVAX_PRICE + 0.4, entryFeesUsd: 0.08, entryAt: ago(4 * D),
    exitAt: ago(1 * D + 12 * H), exitPrice: 35.8,
    realizedPnlUsd: -19.6,
    strategy: 'chartSignal', runId: id('run', 3),
    stopLossPrice:   35.8,
    takeProfitPrice: 42.5,
    framework: 'ElliottWave', confidence: 58,
  }))

  // ── 6. CoinAnalysisRun — 3-framework confluence → pending approval ────────
  //       SmartMoney + Wyckoff + ElliottWave all long on ETH → 3× confluence
  const caRunId = id('ca', 1)
  const newsImpactNeutral = { verdict: 'neutral', confidenceDelta: 0, headlines: [
    { title: 'Ethereum TVL reaches new 2025 high amid DeFi resurgence', sentiment: 0.35 },
    { title: 'ETH staking yield steady at 4.2% — institutional demand rising', sentiment: 0.28 },
    { title: 'Crypto markets pause ahead of Fed minutes release', sentiment: 0.05 },
  ]}
  const newsImpactSupports = { verdict: 'supports', confidenceDelta: 8, headlines: [
    { title: 'Ethereum TVL reaches new 2025 high amid DeFi resurgence', sentiment: 0.35 },
    { title: 'ETH accumulation by wallets >100 ETH up 12% this week', sentiment: 0.42 },
  ]}

  // Same raw-insert workaround — chartSnapshot inside strategyCards has the same
  // Mongoose type-key ambiguity for overlays.supportResistance / orderBlocks.
  await CoinAnalysisRunDoc.collection.insertOne({
    coinAnalysisRunId: caRunId, userId, symbol: 'ETH',
    triggeredBy: 'on_demand', status: 'pending_approval',
    startedAt: ago(25 * 60_000), completedAt: ago(15 * 60_000),
    autoMode: false,
    newsArticlesUsed: [
      'Ethereum TVL reaches new 2025 high amid DeFi resurgence',
      'ETH accumulation by wallets >100 ETH up 12% this week',
      'Crypto markets pause ahead of Fed minutes release',
    ],
    strategyCards: [
      {
        framework: 'SmartMoney',
        approvalStatus: 'pending',
        newsImpact: newsImpactSupports,
        llmNarrative:
          'ETH swept the low at $3,240 (Spring-like move), reclaimed the OB at 3,350–3,390. ' +
          'ChoCh bullish. OB is unmitigated on 4H. SL below swept low at 3,240. TP1 at structure high 3,580.',
        signal: {
          symbol: 'ETH', framework: 'SmartMoney', bias: 'long',
          setup_name: 'Order Block Reclaim + ChoCh',
          entry_zone: { high: 3_390, low: 3_350 },
          stop_loss: 3_240, take_profit_levels: [3_580, 3_720],
          risk_reward: 2.8, confidence: 71,
          invalidation: 'Daily close below 3,240',
          reasoning: 'Unmitigated OB at 3,350–3,390 with ChoCh confirmation. HTF bullish above 200EMA.',
          confluence_factors: ['OB reclaim', 'ChoCh', 'HTF bullish', 'Volume spike at sweep low'],
          generated_at: new Date().toISOString(),
        },
        chartSnapshot: ethSnapshot('SmartMoney'),
      },
      {
        framework: 'Wyckoff',
        approvalStatus: 'pending',
        newsImpact: newsImpactNeutral,
        llmNarrative:
          'ETH in Phase D of Wyckoff accumulation. LPS at $3,280. Cause built since late May (~45 P&F boxes). ' +
          'SoS candle on 4H confirms strength. Price above creek resistance. Target: $3,700–$3,800.',
        signal: {
          symbol: 'ETH', framework: 'Wyckoff', bias: 'long',
          setup_name: 'Phase D LPS — Accumulation',
          entry_zone: { high: 3_390, low: 3_340 },
          stop_loss: 3_220, take_profit_levels: [3_600, 3_780],
          risk_reward: 2.6, confidence: 65,
          invalidation: 'Close below PS at 3,200',
          reasoning: 'Phase D confirmed. LPS above spring low. Volume decreasing on pullbacks.',
          confluence_factors: ['Phase D LPS', 'SoS candle', 'Cause count 45 boxes', 'Volume profile bullish'],
          generated_at: new Date().toISOString(),
        },
        chartSnapshot: ethSnapshot('Wyckoff'),
      },
      {
        framework: 'ElliottWave',
        approvalStatus: 'pending',
        newsImpact: newsImpactNeutral,
        llmNarrative:
          'ETH appears to be completing Wave 4 corrective at the 0.382 Fib of Wave 3 ($3,330). ' +
          'Wave 5 target aligns with 1.618 extension at $3,720. Confidence 0.63 — above threshold.',
        signal: {
          symbol: 'ETH', framework: 'ElliottWave', bias: 'long',
          setup_name: 'Wave 5 Extension from Wave 4 Low',
          entry_zone: { high: 3_380, low: 3_330 },
          stop_loss: 3_200, take_profit_levels: [3_720],
          risk_reward: 2.4, confidence: 63,
          invalidation: 'Wave 4 overlaps Wave 1 high at 3,180',
          reasoning: 'Wave 4 corrective ending at 0.382 Fib. Wave 5 to 1.618 extension = $3,720.',
          confluence_factors: ['Wave 4 Fib support', '1.618 extension target', 'RSI bullish divergence'],
          generated_at: new Date().toISOString(),
        },
        chartSnapshot: ethSnapshot('ElliottWave'),
      },
      {
        framework: 'Harmonic',
        approvalStatus: 'skipped',
        skippedReason: 'Harmonic: no pattern above 75% completion — XABCD incomplete (completion: 68%)',
        newsImpact: { verdict: 'neutral', confidenceDelta: 0, headlines: [] },
        llmNarrative: '',
        signal: null,
        chartSnapshot: null,
      },
    ],
  })

  // ── 7. Agent memories (RAG) ───────────────────────────────────────────────
  const memories = [
    {
      agentId: userId, runId: id('run', 1),
      timestamp: ago(5 * D), coin: 'SOL', type: 'outcome',
      summary: 'SOL SmartMoney OB trade at 178–181 CLOSED at TP1 $192. +$32 PnL (+6.5%). Spring + OB reclaim + ChoCh worked.',
      fullContext: { setup: 'OB reclaim', entry: SOL_PRICE - 4, exit: 192, pnl: 32.4 },
      embedding: fakeEmbedding(),
      marketRegime: 'bullish',
      signals: ['OB reclaim', 'ChoCh'],
      tools: ['get_price', 'get_order_blocks'],
      outcome: { pnl: 32.4, pnlPercent: 6.48, durationHeldMs: 3 * D, closedAt: ago(2 * D), success: true },
    },
    {
      agentId: userId, runId: id('run', 3),
      timestamp: ago(4 * D), coin: 'AVAX', type: 'outcome',
      summary: 'AVAX ElliottWave Wave 5 trade SL HIT at $35.8. -$19.6 PnL (-6.5%). Macro risk event invalidated setup before TP.',
      fullContext: { setup: 'Wave 5 extension', entry: AVAX_PRICE + 0.4, exit: 35.8, pnl: -19.6 },
      embedding: fakeEmbedding(),
      marketRegime: 'bearish_divergence',
      signals: ['Wave 5 extension', 'RSI divergence'],
      tools: ['get_price', 'get_htf_context'],
      outcome: { pnl: -19.6, pnlPercent: -6.53, durationHeldMs: 2.5 * D, closedAt: ago(1 * D + 12 * H), success: false },
    },
    {
      agentId: userId, runId: id('run', 2),
      timestamp: ago(3 * D), coin: 'BTC', type: 'observation',
      summary: 'BTC no-action: HTF below daily 50 EMA. Wyckoff Phase B — distribution or re-accumulation unclear. Waiting for Phase C spring or SoS to confirm.',
      fullContext: { reason: 'No confluence', phase: 'B', htf: 'mixed' },
      embedding: fakeEmbedding(),
      marketRegime: 'ranging',
      signals: ['Wyckoff Phase B'],
      tools: ['get_full_htf_context', 'get_wallet_state'],
    },
  ]
  await AgentMemoryDoc.insertMany(ins(memories), { ordered: false })

  // ── 8. Opportunities ─────────────────────────────────────────────────────
  await OpportunityDoc.insertMany(ins([
    {
      opportunityId: id('opp', 1), userId,
      type: 'yield_anomaly', strategy: 'yieldHunter', runId: id('run', 1),
      title: 'USDC/USDT Curve on Arbitrum — APY spike 8.4%',
      detail: 'Curve 3pool Arbitrum APY jumped 3.1pp above 7d avg (5.3%). TVL $42M. Stable pair — low IL.',
      asset: 'USDC', protocol: 'Curve', chain: 'arbitrum', score: 78,
      acted: false, detectedAt: ago(2 * H), expiresAt: new Date(Date.now() + 22 * H),
      metadata: { apyPct: 8.4, avg7dApyPct: 5.3, tvlUsd: 42_000_000 },
    },
    {
      opportunityId: id('opp', 2), userId,
      type: 'yield_anomaly', strategy: 'yieldHunter', runId: id('run', 4),
      title: 'ETH/stETH Balancer on Mainnet — APY spike 6.1%',
      detail: 'Balancer ETH/stETH APY 6.1% vs 3.8% 7d avg (+2.3pp). TVL $88M. Low-IL stablecoin-like pair.',
      asset: 'ETH', protocol: 'Balancer', chain: 'ethereum', score: 69,
      acted: false, detectedAt: ago(45 * 60_000), expiresAt: new Date(Date.now() + 23 * H),
      metadata: { apyPct: 6.1, avg7dApyPct: 3.8, tvlUsd: 88_000_000 },
    },
  ]), { ordered: false })

  return {
    agentRuns:        5,
    positions:        4,
    coinAnalysisRuns: 1,
    strategyCards:    4,
    memories:         3,
    opportunities:    2,
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export const seedDemo = async (req: Request, res: Response): Promise<void> => {
  try {
    const counts = await seedDemoData(req.userId!)
    res.json({ ok: true, seeded: counts })
  } catch (err: any) {
    console.error('[DemoSeed] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
